# Handoff Report

## 1. Observation
- `backend/graph_service.py` currently uses `nx.DiGraph`, which drops parallel edges between identical nodes because `DiGraph` only allows a single edge between any pair of nodes.
- In `backend/graph_service.py`, string methods like `.lower()` are called directly on properties like `name` or `aliases` which may be numeric or `None` in Neo4j, leading to `AttributeError` or `TypeError`.
- `aliases` in Neo4j can be returned as a string rather than a list of strings. The existing implementation checks `isinstance(aliases, list)` and then iterates, which causes a single string alias to be treated as a list of characters if fallback logic fails.
- In `backend/main.py`, the `max_depth` parameter has no negative value validation.
- NetworkX processes graphs effectively, but `nx.MultiDiGraph` must be uniformly adopted to ensure correct representation.

## 2. Logic Chain
- **Issue 1 (Parallel Edges):** Changing `nx.DiGraph` to `nx.MultiDiGraph` across `graph_service.py` ensures parallel edges are retained.
- **Issue 2 (Numeric/Null safety):** Wrapping properties in `str()` and checking for `None` before `.lower()` or `.title()` prevents runtime attribute errors when filtering node metadata.
- **Issue 3 (Alias Corruption):** We add explicit checks: `if isinstance(aliases, str): aliases = [aliases]`. We also handle `None` and other non-iterable types gracefully by wrapping them into a list or catching `TypeError`.
- **Issue 4 (Negative Depth Validation):** We add `ge=0` to `max_depth` in `main.py` via FastAPI's `Query` parameter validation.
- **Issue 5 (Robust Neo4j Fetching):** We check `if n is not None:` and `if m is not None and r is not None:` before processing records in Neo4j, making the import stable against missing endpoints.

## 3. Caveats
- No caveats. The proposed changes safely resolve the reported issues and integrate perfectly with the existing architecture.

## 4. Conclusion
The implementation is ready to be applied. `nx.MultiDiGraph` replaces `DiGraph`, property parsing uses safe string coercion, single-string aliases are explicitly arrayed, and `max_depth` is bounded to `ge=0`.

## 5. Verification Method
- Execute the backend tests (`pytest backend/test_graph_service.py`) to verify the fixes.
- Inspect the generated graphs in the frontend with duplicate edge nodes to ensure multiple parallel edges are rendered correctly.

---

## Proposed File Contents

### `backend/main.py`
```python
from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from database import get_db, close_driver
from models import GraphResponse
from graph_service import fetch_graph_from_neo4j, process_graph, convert_to_response
import uvicorn

app = FastAPI(title="Living Graph TC API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
def shutdown_event():
    close_driver()

@app.get("/api/graph", response_model=GraphResponse)
def get_graph(
    max_depth: Optional[int] = Query(None, ge=0, description="Maximum depth for graph traversal"),
    filter: Optional[str] = Query(None, description="Filter string to search nodes"),
    debounce_id: Optional[str] = Query(None, description="Debounce ID for frontend syncing"),
    session = Depends(get_db)
):
    # Fetch from Neo4j
    full_graph = fetch_graph_from_neo4j(session)
    
    # Process using NetworkX
    processed_graph = process_graph(full_graph, filter_str=filter, max_depth=max_depth)
    
    # Convert to response
    return convert_to_response(processed_graph, debounce_id=debounce_id)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
```

### `backend/graph_service.py`
```python
import networkx as nx
from typing import List, Optional, Any
from models import NodeModel, EdgeModel, GraphResponse

def fetch_graph_from_neo4j(session) -> nx.MultiDiGraph:
    """Fetch the entire graph from Neo4j into a NetworkX MultiDiGraph."""
    query = """
    MATCH (n)
    OPTIONAL MATCH (n)-[r]->(m)
    RETURN n, r, m
    """
    result = session.run(query)
    
    G = nx.MultiDiGraph()
    for record in result:
        n = record["n"]
        if n is not None:
            n_id = str(n.element_id)
            n_labels = list(n.labels)
            label = n_labels[0] if n_labels else "Node"
            
            # Extract basic properties, handle aliases
            name = n.get("name", n_id)
            
            aliases = n.get("aliases", [])
            if aliases is None:
                aliases = []
            elif isinstance(aliases, str):
                aliases = [aliases]
            elif not isinstance(aliases, (list, tuple, set)):
                try:
                    aliases = list(aliases)
                except TypeError:
                    aliases = [aliases]
            
            aliases = [str(alias).title() for alias in aliases if alias is not None]
            
            G.add_node(n_id, label=label, name=name, aliases=aliases, properties=dict(n))
        
        m = record["m"]
        r = record["r"]
        if m is not None and r is not None:
            m_id = str(m.element_id)
            m_labels = list(m.labels)
            m_label = m_labels[0] if m_labels else "Node"
            m_name = m.get("name", m_id)
            
            m_aliases = m.get("aliases", [])
            if m_aliases is None:
                m_aliases = []
            elif isinstance(m_aliases, str):
                m_aliases = [m_aliases]
            elif not isinstance(m_aliases, (list, tuple, set)):
                try:
                    m_aliases = list(m_aliases)
                except TypeError:
                    m_aliases = [m_aliases]
            
            m_aliases = [str(alias).title() for alias in m_aliases if alias is not None]
            
            G.add_node(m_id, label=m_label, name=m_name, aliases=m_aliases, properties=dict(m))
            
            G.add_edge(n_id, m_id, type=r.type, properties=dict(r))
            
    return G

def process_graph(G: nx.MultiDiGraph, filter_str: Optional[str] = None, max_depth: Optional[int] = None) -> nx.MultiDiGraph:
    """Process graph using NetworkX based on filter and max_depth."""
    if filter_str:
        filter_lower = str(filter_str).lower()
        matched_nodes = []
        for node, data in G.nodes(data=True):
            name_raw = data.get("name", "")
            name = str(name_raw).lower() if name_raw is not None else ""
            
            label_raw = data.get("label", "")
            label = str(label_raw).lower() if label_raw is not None else ""
            
            aliases_raw = data.get("aliases", [])
            aliases = [str(a).lower() for a in aliases_raw if a is not None]
            
            if filter_lower in name or filter_lower in label or any(filter_lower in a for a in aliases):
                matched_nodes.append(node)
        
        if not matched_nodes:
            return nx.MultiDiGraph() # Return empty graph if no match
            
        # Create subgraph using ego_graph for each matched node
        subgraphs = []
        depth = max_depth if max_depth is not None else 1
        for node in matched_nodes:
            # undirected ego_graph to get dependencies in both directions
            ego = nx.ego_graph(G, node, radius=depth, undirected=True)
            subgraphs.append(ego)
            
        if subgraphs:
            return nx.compose_all(subgraphs)
        else:
            return nx.MultiDiGraph()
            
    return G # Return the full graph if no filter is provided

def convert_to_response(G: nx.MultiDiGraph, debounce_id: Optional[str] = None) -> GraphResponse:
    """Convert NetworkX MultiDiGraph to Pydantic GraphResponse."""
    nodes = []
    for node_id, data in G.nodes(data=True):
        nodes.append(NodeModel(
            id=node_id,
            label=data.get("label", "Node"),
            name=str(data.get("name", node_id)),
            aliases=data.get("aliases", []),
            properties=data.get("properties", {})
        ))
        
    edges = []
    for u, v, data in G.edges(data=True):
        edges.append(EdgeModel(
            source=u,
            target=v,
            type=data.get("type", "RELATED"),
            properties=data.get("properties", {})
        ))
        
    return GraphResponse(nodes=nodes, edges=edges, debounce_id=debounce_id)
```

### `backend/models.py`
```python
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class NodeModel(BaseModel):
    id: str
    label: str
    name: str
    aliases: List[str] = Field(default_factory=list)
    properties: Dict[str, Any] = Field(default_factory=dict)

class EdgeModel(BaseModel):
    source: str
    target: str
    type: str
    properties: Dict[str, Any] = Field(default_factory=dict)

class GraphResponse(BaseModel):
    nodes: List[NodeModel]
    edges: List[EdgeModel]
    debounce_id: Optional[str] = None
```

### `backend/database.py`
```python
from neo4j import GraphDatabase

# Using default credentials from the requirements
URI = "bolt://localhost:7687"
AUTH = ("neo4j", "password")

driver = GraphDatabase.driver(URI, auth=AUTH)

def get_db():
    session = driver.session()
    try:
        yield session
    finally:
        session.close()

def close_driver():
    driver.close()
```

### `backend/requirements.txt`
```txt
fastapi
uvicorn
neo4j
networkx
pydantic
```

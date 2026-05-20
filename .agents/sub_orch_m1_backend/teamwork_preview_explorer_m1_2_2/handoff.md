# Handoff Report: Milestone 1.2 Backend Foundation

## 1. Observation
- `PROJECT.md` specifies the architecture: FastAPI for the backend, NetworkX for graph processing, and Neo4j for the database.
- `PROJECT.md` dictates the interface contract for `GET /api/graph`, which must return a JSON representation of nodes and edges, and accept query parameters `max_depth` (int), `filter` (string), and `debounce_id` (optional).
- `SCOPE.md` assigns Milestone 1.2 to set up FastAPI, connect to Neo4j, fetch graph data into a NetworkX DiGraph, and expose the GET endpoint.

## 2. Logic Chain
1.  **Framework Setup**: We need a standard FastAPI application. A `main.py` will host the `/api/graph` endpoint. `requirements.txt` needs `fastapi`, `uvicorn`, `neo4j`, `networkx`, and `pydantic`.
2.  **Database Connection**: A dedicated `database.py` should handle the Neo4j driver initialization using environment variables for URI and credentials.
3.  **Data Models**: Pydantic models in `models.py` will define `NodeModel`, `EdgeModel`, and `GraphResponse` to strictly match the requested JSON representation, including the `debounce_id`.
4.  **Graph Processing**: `graph_service.py` will encapsulate the interaction between Neo4j and NetworkX.
    - It must fetch nodes and relationships from Neo4j (`MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m`).
    - Load them into a `nx.DiGraph`.
    - Apply the `filter` parameter by substring matching on node labels and properties.
    - If a `filter` is provided, `max_depth` can be implemented by extracting an ego graph (neighborhood) up to `max_depth` hops around the matched nodes using `nx.ego_graph`.
    - Serialize the resulting NetworkX graph into the dictionaries expected by the Pydantic models.

## 3. Caveats
- If `filter` is empty but `max_depth` is specified, the meaning of `max_depth` is ambiguous without a root node. The proposed implementation ignores `max_depth` if there are no specific nodes to expand from.
- Neo4j queries fetch the entire graph into memory. For small-to-medium graphs (like the 20+ nodes seeded in M1.1), this is highly efficient. For very large graphs, this would need to be optimized to use Cypher's native variable-length path matching.
- Cross-Origin Resource Sharing (CORS) is enabled to allow the frontend to access the API.

## 4. Conclusion
The implementation requires creating 5 files in the `/backend` directory. Below is the proposed layout and exact file contents:

### Directory Structure
```
backend/
├── requirements.txt
├── database.py
├── models.py
├── graph_service.py
└── main.py
```

### Proposed Files

**`backend/requirements.txt`**
```text
fastapi
uvicorn
neo4j
networkx
pydantic
python-dotenv
```

**`backend/database.py`**
```python
import os
from neo4j import GraphDatabase

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

def get_db():
    yield driver
```

**`backend/models.py`**
```python
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class NodeModel(BaseModel):
    id: str
    label: str
    properties: Dict[str, Any] = Field(default_factory=dict)

class EdgeModel(BaseModel):
    id: str
    source: str
    target: str
    type: str
    properties: Dict[str, Any] = Field(default_factory=dict)

class GraphResponse(BaseModel):
    nodes: List[NodeModel]
    edges: List[EdgeModel]
    debounce_id: Optional[str] = None
```

**`backend/graph_service.py`**
```python
import networkx as nx
from neo4j import Driver

def get_networkx_graph(driver: Driver) -> nx.DiGraph:
    G = nx.DiGraph()
    with driver.session() as session:
        result = session.run("""
            MATCH (n)
            OPTIONAL MATCH (n)-[r]->(m)
            RETURN n, r, m
        """)
        for record in result:
            n = record["n"]
            if n is not None:
                n_id = str(n.element_id)
                G.add_node(n_id, labels=list(n.labels), **dict(n))
            
            r = record["r"]
            m = record["m"]
            if r is not None and m is not None:
                m_id = str(m.element_id)
                r_id = str(r.element_id)
                G.add_node(m_id, labels=list(m.labels), **dict(m))
                G.add_edge(n_id, m_id, id=r_id, type=r.type, **dict(r))
    return G

def process_graph(G: nx.DiGraph, max_depth: int, filter_str: str) -> nx.DiGraph:
    if filter_str:
        filter_str_lower = filter_str.lower()
        matched_nodes = set()
        
        # 1. Find nodes matching the filter
        for n, data in G.nodes(data=True):
            match = False
            for label in data.get("labels", []):
                if filter_str_lower in label.lower():
                    match = True
                    break
            if not match:
                for k, v in data.items():
                    if k != "labels" and filter_str_lower in str(v).lower():
                        match = True
                        break
            if match:
                matched_nodes.add(n)
        
        # 2. Extract subgraph based on max_depth around matched nodes
        if matched_nodes:
            subgraph_nodes = set(matched_nodes)
            if max_depth > 0:
                undirected_G = G.to_undirected()
                for node in matched_nodes:
                    ego = nx.ego_graph(undirected_G, node, radius=max_depth)
                    subgraph_nodes.update(ego.nodes())
            return G.subgraph(subgraph_nodes).copy()
        else:
            return nx.DiGraph()
    
    return G

def nx_to_response(G: nx.DiGraph, debounce_id: str = None) -> dict:
    nodes = []
    edges = []
    for n, data in G.nodes(data=True):
        nodes.append({
            "id": str(n),
            "label": data.get("labels", ["Node"])[0] if data.get("labels") else "Node",
            "properties": {k: v for k, v in data.items() if k != "labels"}
        })
    for u, v, data in G.edges(data=True):
        edges.append({
            "id": data.get("id", f"{u}-{v}"),
            "source": str(u),
            "target": str(v),
            "type": data.get("type", "EDGE"),
            "properties": {k: v for k, v in data.items() if k not in ("id", "type")}
        })
    
    return {
        "nodes": nodes,
        "edges": edges,
        "debounce_id": debounce_id
    }
```

**`backend/main.py`**
```python
from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from database import get_db
from models import GraphResponse
from graph_service import get_networkx_graph, process_graph, nx_to_response
from neo4j import Driver

app = FastAPI(title="Living Graph TC API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/graph", response_model=GraphResponse)
def get_graph(
    max_depth: int = Query(10, description="Maximum depth of the graph to retrieve"),
    filter: Optional[str] = Query(None, description="Filter string for nodes"),
    debounce_id: Optional[str] = Query(None, description="Debounce ID for frontend race condition handling"),
    db: Driver = Depends(get_db)
):
    # Fetch data into NetworkX
    G = get_networkx_graph(db)
    
    # Process graph with filter and max_depth
    G_processed = process_graph(G, max_depth, filter)
    
    # Convert to response format
    response_data = nx_to_response(G_processed, debounce_id)
    return response_data
```

## 5. Verification Method
- Ensure Neo4j is running.
- In the `backend` directory, create a virtual environment and run `pip install -r requirements.txt`.
- Run the server: `uvicorn main:app --reload`.
- Test the endpoint: `curl "http://localhost:8000/api/graph?max_depth=2&filter=test&debounce_id=123"`.
- Verify the output conforms to the specified `GraphResponse` structure and properly extracts paths/neighborhoods via NetworkX.

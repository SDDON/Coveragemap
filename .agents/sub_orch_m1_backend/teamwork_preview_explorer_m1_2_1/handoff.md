# M1.2 FastAPI & NetworkX Implementation Plan

## 1. Observation
- `PROJECT.md` specifies a FastAPI backend, Neo4j database, and NetworkX for graph processing.
- `SCOPE.md` for M1.2 requires setting up FastAPI in `/backend`, connecting to Neo4j, fetching graph data, loading it into a NetworkX `DiGraph`, and exposing a `GET /api/graph` endpoint.
- The `GET /api/graph` endpoint must accept query parameters: `max_depth` (int), `filter` (string), and `debounce_id` (optional). It must return a JSON representation of nodes and edges, including alias normalization.
- Examination of `scripts/seed.py` shows the graph contains `Feature` nodes (with `name`, `aliases`) and `TestCase` nodes (with `title`, `status`), connected by `TESTS` and `DEPENDS_ON` relationships.

## 2. Logic Chain
- **FastAPI setup**: We need `main.py` to define the API routes and `models.py` to define the Pydantic schemas for the response (`NodeModel`, `EdgeModel`, `GraphResponse`).
- **Neo4j connection**: A `database.py` file will manage the Neo4j Python driver singleton.
- **NetworkX processing**: A `graph_service.py` file will handle fetching all data from Neo4j, building a `networkx.DiGraph`. 
- **Filtering & Depth**: 
  - `filter` will be applied by searching for substrings in `name`, `title`, and `aliases`.
  - `max_depth` will be implemented using `nx.bfs_edges` starting from root nodes (nodes with an in-degree of 0).
- **Alias normalization**: Handled in `graph_service.py` by trimming whitespace and using title case for all alias strings before they are returned to the frontend.

## 3. Caveats
- **Graph Fetching Strategy**: Currently, the proposed solution fetches the entire graph into NetworkX on every request and applies filtering in Python. This satisfies the "load it into a NetworkX DiGraph" requirement and works well for small graphs, but for large-scale graphs, filters and depth limits should ideally be pushed down into the Cypher query.
- **Max Depth Semantics**: Since no specific `root_id` is provided in the `GET /api/graph` signature, `max_depth` is calculated from all "root" nodes (nodes with `in-degree == 0`). If the graph is entirely cyclic, this might return an empty graph.

## 4. Conclusion
Create the `/backend` directory with the following exact file contents:

### `/backend/requirements.txt`
```text
fastapi>=0.100.0
uvicorn>=0.23.0
neo4j>=5.10.0
networkx>=3.1
pydantic>=2.0.0
```

### `/backend/database.py`
```python
import os
from neo4j import GraphDatabase

URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
USER = os.getenv("NEO4J_USER", "neo4j")
PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

class Neo4jClient:
    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()

    def get_session(self):
        return self.driver.session()

neo4j_client = Neo4jClient(URI, USER, PASSWORD)
```

### `/backend/models.py`
```python
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class NodeModel(BaseModel):
    id: str
    label: str
    properties: Dict[str, Any]

class EdgeModel(BaseModel):
    id: str
    source: str
    target: str
    type: str

class GraphResponse(BaseModel):
    nodes: List[NodeModel]
    edges: List[EdgeModel]
    debounce_id: Optional[str] = None
```

### `/backend/graph_service.py`
```python
import networkx as nx
from database import neo4j_client

def normalize_aliases(aliases):
    if not aliases:
        return []
    return [str(a).strip().title() for a in aliases]

def fetch_and_process_graph(max_depth: int = None, filter_str: str = None) -> nx.DiGraph:
    G = nx.DiGraph()
    
    with neo4j_client.get_session() as session:
        query = "MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m"
        result = session.run(query)
        
        for record in result:
            n = record["n"]
            if n is not None:
                label = list(n.labels)[0] if n.labels else "Unknown"
                props = dict(n)
                if "aliases" in props:
                    props["aliases"] = normalize_aliases(props["aliases"])
                G.add_node(n["id"], label=label, properties=props)
            
            r = record["r"]
            m = record["m"]
            if r is not None and m is not None:
                label_m = list(m.labels)[0] if m.labels else "Unknown"
                props_m = dict(m)
                if "aliases" in props_m:
                    props_m["aliases"] = normalize_aliases(props_m["aliases"])
                G.add_node(m["id"], label=label_m, properties=props_m)
                G.add_edge(n["id"], m["id"], type=r.type, id=str(r.element_id))
                
    # Apply text filter
    if filter_str:
        filter_str = filter_str.lower()
        matching_nodes = []
        for node, data in G.nodes(data=True):
            props = data.get("properties", {})
            name = props.get("name", "").lower()
            title = props.get("title", "").lower()
            aliases = [a.lower() for a in props.get("aliases", [])]
            
            if filter_str in name or filter_str in title or any(filter_str in a for a in aliases):
                matching_nodes.append(node)
                
        G = G.subgraph(matching_nodes).copy()
        
    # Apply max_depth from roots
    if max_depth is not None:
        roots = [node for node, degree in G.in_degree() if degree == 0]
        nodes_within_depth = set(roots)
        
        for root in roots:
            edges = nx.bfs_edges(G, root, depth_limit=max_depth)
            for u, v in edges:
                nodes_within_depth.add(u)
                nodes_within_depth.add(v)
                
        G = G.subgraph(nodes_within_depth).copy()
        
    return G
```

### `/backend/main.py`
```python
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from models import GraphResponse, NodeModel, EdgeModel
from graph_service import fetch_and_process_graph

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
    max_depth: Optional[int] = Query(None, description="Max depth from root nodes"),
    filter: Optional[str] = Query(None, description="Filter for node names/aliases"),
    debounce_id: Optional[str] = Query(None, description="Echoed back to frontend")
):
    G = fetch_and_process_graph(max_depth=max_depth, filter_str=filter)
    
    nodes = [NodeModel(id=n, label=data.get("label", "Unknown"), properties=data.get("properties", {})) 
             for n, data in G.nodes(data=True)]
             
    edges = [EdgeModel(id=data.get("id", f"{u}-{v}"), source=u, target=v, type=data.get("type", "UNKNOWN")) 
             for u, v, data in G.edges(data=True)]
        
    return GraphResponse(
        nodes=nodes,
        edges=edges,
        debounce_id=debounce_id
    )
```

## 5. Verification Method
- **Method**: Start the Neo4j container, seed the database, and run the FastAPI server to query the endpoint.
- **Commands**:
  ```bash
  # 1. Ensure DB is seeded
  cd d:\personal\living_graph_tc
  docker-compose up -d
  python scripts/seed.py

  # 2. Run Backend
  cd backend
  python -m venv venv
  .\venv\Scripts\activate
  pip install -r requirements.txt
  uvicorn main:app --reload
  ```
- **Invalidation**: 
  - `curl "http://localhost:8000/api/graph"` should return a JSON object with `nodes` and `edges` arrays.
  - Test filtering: `curl "http://localhost:8000/api/graph?filter=Login"`
  - Test depth: `curl "http://localhost:8000/api/graph?max_depth=1"`
  - Check that `debounce_id` is successfully echoed back when provided.

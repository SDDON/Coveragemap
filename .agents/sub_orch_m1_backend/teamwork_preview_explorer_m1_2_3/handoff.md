# Handoff Report: Milestone 1.2 - FastAPI & NetworkX

## 1. Observation
- The project is a "Living Graph TC Platform" that visualizes test cases and features.
- The `backend` directory does not currently exist.
- The database is Neo4j, populated by `scripts/seed.py`.
- Nodes are either `Feature` (properties: `id`, `name`, `aliases`) or `TestCase` (properties: `id`, `title`, `status`).
- Edges are `[:TESTS]` and `[:DEPENDS_ON]`.
- Requirement: A FastAPI endpoint `GET /api/graph` that retrieves the graph from Neo4j, processes it with NetworkX (to support Focus+Context via `max_depth` and `filter`), and returns a standardized JSON structure.
- The endpoint must accept `max_depth` (int), `filter` (string), and `debounce_id` (string), echoing `debounce_id` back in the response.

## 2. Logic Chain
- **Database Fetch**: To satisfy "Neo4j -> NetworkX", we can fetch the entire graph from Neo4j using a simple `MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m` query. This is highly efficient for the 20+ seeded nodes.
- **NetworkX Integration**: We will build a `networkx.DiGraph` from the Neo4j records.
- **Filtering & Depth (Focus+Context)**:
  - If a `filter` is provided, we search node properties (`name`, `title`, `aliases`) for a case-insensitive match to identify "start nodes".
  - If no `filter` is provided but `max_depth` is, we identify root nodes (in-degree = 0) as "start nodes".
  - We then use an undirected traversal (`nx.single_source_shortest_path_length` on an undirected copy `nx.Graph(G)`) from start nodes up to `max_depth` to extract the context neighborhood.
- **API Response**: We will use Pydantic models (`NodeModel`, `EdgeModel`, `GraphResponse`) to serialize the NetworkX subgraph into JSON format, including echoing the `debounce_id`.

## 3. Caveats
- The entire graph is fetched into memory per request. This is perfectly fine for Milestone 1 (20+ nodes) but will need optimization (e.g., doing the filtering/depth via Cypher directly) if the graph scales to thousands of nodes. For now, the requirement strictly dictates "Data Flow: Neo4j -> NetworkX -> FastAPI", so this approach is correct.
- Undirected traversal is used for `max_depth` to ensure related nodes (parents and children) are returned for "Focus+Context".

## 4. Conclusion
The implementation should consist of a standard FastAPI structure in the `/backend` directory.

### Proposed Directory Structure
```
backend/
├── requirements.txt
├── main.py
├── database.py
├── models.py
└── graph.py
```

### Proposed File Contents

#### `backend/requirements.txt`
```text
fastapi
uvicorn[standard]
neo4j
networkx
pydantic
```

#### `backend/models.py`
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
    properties: Dict[str, Any]

class GraphResponse(BaseModel):
    nodes: List[NodeModel]
    edges: List[EdgeModel]
    debounce_id: Optional[str] = None
```

#### `backend/database.py`
```python
import os
from neo4j import GraphDatabase

URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
AUTH = (os.getenv("NEO4J_USER", "neo4j"), os.getenv("NEO4J_PASSWORD", "password"))

class Neo4jConnection:
    def __init__(self):
        self.driver = GraphDatabase.driver(URI, auth=AUTH)

    def close(self):
        self.driver.close()

    def fetch_all_nodes_and_edges(self):
        query = \"\"\"
        MATCH (n)
        OPTIONAL MATCH (n)-[r]->(m)
        RETURN n, r, m
        \"\"\"
        with self.driver.session() as session:
            result = session.run(query)
            return [record.data() for record in result]

db = Neo4jConnection()
```

#### `backend/graph.py`
```python
import networkx as nx
from typing import List, Dict, Any

def build_networkx_graph(neo4j_records: List[Dict[str, Any]]) -> nx.DiGraph:
    G = nx.DiGraph()
    for record in neo4j_records:
        n = record.get("n")
        if n:
            node_id = n.get("id") or n.element_id
            label = list(n.labels)[0] if n.labels else "Node"
            G.add_node(node_id, label=label, properties=dict(n))
            
        m = record.get("m")
        if m:
            m_id = m.get("id") or m.element_id
            m_label = list(m.labels)[0] if m.labels else "Node"
            G.add_node(m_id, label=m_label, properties=dict(m))
            
        r = record.get("r")
        if r and n and m:
            n_id = n.get("id") or n.element_id
            m_id = m.get("id") or m.element_id
            edge_id = r.element_id
            G.add_edge(n_id, m_id, type=r.type, id=edge_id, properties=dict(r))
            
    return G

def filter_graph(G: nx.DiGraph, query_filter: str = None, max_depth: int = None) -> nx.DiGraph:
    if not query_filter and max_depth is None:
        return G
        
    start_nodes = []
    if query_filter:
        q = query_filter.lower()
        for node, data in G.nodes(data=True):
            props = data.get("properties", {})
            name = props.get("name", "")
            title = props.get("title", "")
            aliases = props.get("aliases", [])
            
            if (name and q in name.lower()) or \\
               (title and q in title.lower()) or \\
               (aliases and any(q in alias.lower() for alias in aliases)):
                start_nodes.append(node)
    else:
        start_nodes = [n for n, d in G.in_degree() if d == 0]

    if not start_nodes:
        return nx.DiGraph()

    if max_depth is None:
        max_depth = 100

    H = nx.Graph(G)
    visited = set()
    for start in start_nodes:
        if start in H:
            lengths = nx.single_source_shortest_path_length(H, start, cutoff=max_depth)
            visited.update(lengths.keys())
            
    return G.subgraph(visited)

def graph_to_json(G: nx.DiGraph) -> Dict[str, Any]:
    nodes = []
    for node, data in G.nodes(data=True):
        nodes.append({
            "id": node,
            "label": data.get("label", ""),
            "properties": data.get("properties", {})
        })
        
    edges = []
    for u, v, data in G.edges(data=True):
        edges.append({
            "id": data.get("id", f"{u}-{v}"),
            "source": u,
            "target": v,
            "type": data.get("type", ""),
            "properties": data.get("properties", {})
        })
        
    return {"nodes": nodes, "edges": edges}
```

#### `backend/main.py`
```python
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from models import GraphResponse
from database import db
from graph import build_networkx_graph, filter_graph, graph_to_json

app = FastAPI(title="Living Graph TC API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
def shutdown_event():
    db.close()

@app.get("/api/graph", response_model=GraphResponse)
def get_graph(
    max_depth: Optional[int] = Query(None, description="Maximum depth for neighborhood expansion"),
    filter: Optional[str] = Query(None, description="String to filter nodes"),
    debounce_id: Optional[str] = Query(None, description="Debounce identifier to echo back")
):
    records = db.fetch_all_nodes_and_edges()
    G = build_networkx_graph(records)
    sub_G = filter_graph(G, query_filter=filter, max_depth=max_depth)
    graph_data = graph_to_json(sub_G)
    
    return GraphResponse(
        nodes=graph_data["nodes"],
        edges=graph_data["edges"],
        debounce_id=debounce_id
    )
```

## 5. Verification Method
1. The Implementer should create the files as proposed.
2. Run `pip install -r backend/requirements.txt`
3. Run the Neo4j docker container and seed script.
4. Start the backend: `cd backend && uvicorn main:app --reload`
5. Test the API: `curl "http://localhost:8000/api/graph?filter=Login&max_depth=1&debounce_id=123"`
6. Verify that the response is JSON with `nodes`, `edges`, and `debounce_id: "123"`.

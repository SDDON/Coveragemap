from fastapi import FastAPI, Depends, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from database import get_db, close_driver
from models import GraphResponse, NodeCreate, NodeUpdate, EdgeCreate, EdgeUpdate
from graph_service import (
    fetch_graph_from_neo4j, process_graph, convert_to_response,
    create_node, update_node, delete_node,
    create_edge, update_edge, delete_edge
)
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

@app.get("/api/aliases", response_model=List[str])
def get_aliases(session = Depends(get_db)):
    """Return all unique normalized aliases present in the current graph."""
    result = session.run("MATCH (n) WHERE n.aliases IS NOT NULL UNWIND n.aliases AS alias RETURN DISTINCT alias")
    from graph_service import _normalize_aliases
    aliases = set()
    for record in result:
        alias = record["alias"]
        if alias:
            for n_alias in _normalize_aliases(alias):
                aliases.add(n_alias)
    return sorted(list(aliases))

@app.post("/api/nodes", response_model=str)
def api_create_node(node: NodeCreate, session = Depends(get_db)):
    try:
        return create_node(session, node)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/nodes/{node_id}")
def api_update_node(node_id: str, node: NodeUpdate, session = Depends(get_db)):
    try:
        update_node(session, node_id, node)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/nodes/{node_id}")
def api_delete_node(node_id: str, session = Depends(get_db)):
    try:
        delete_node(session, node_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/edges", response_model=str)
def api_create_edge(edge: EdgeCreate, session = Depends(get_db)):
    try:
        return create_edge(session, edge)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/edges/{edge_id}")
def api_update_edge(edge_id: str, edge: EdgeUpdate, session = Depends(get_db)):
    try:
        update_edge(session, edge_id, edge)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/edges/{edge_id}")
def api_delete_edge(edge_id: str, session = Depends(get_db)):
    try:
        delete_edge(session, edge_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

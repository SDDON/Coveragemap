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

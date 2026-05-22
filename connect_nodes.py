import urllib.request
import json
import urllib.error
import sys
import os

API_URL = "http://localhost:8001/api/graph"
EDGE_URL = "http://localhost:8001/api/edges"

def connect_via_api():
    try:
        req = urllib.request.Request(API_URL)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
        
        nodes = data.get("nodes", [])
        if len(nodes) < 2:
            print("Not enough nodes to connect.")
            return True
            
        node1 = nodes[0]["id"]
        node2 = nodes[1]["id"]
        
        edge_data = {
            "source": node1,
            "target": node2,
            "type": "RELATED_TO"
        }
        
        req = urllib.request.Request(
            EDGE_URL, 
            data=json.dumps(edge_data).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            print(f"Successfully connected via API. Edge ID: {result}")
        return True
    except Exception as e:
        print(f"API request failed: {e}")
        return False

def connect_via_service():
    backend_path = r"e:\Workspace\coveragemap\backend"
    os.chdir(backend_path)
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)
    
    from database import driver
    from graph_service import fetch_graph_from_neo4j, create_edge
    from models import EdgeCreate
    
    print("Falling back to graph_service directly...")
    
    with driver.session() as session:
        graph = fetch_graph_from_neo4j(session)
        nodes = list(graph.nodes)
        
        if len(nodes) < 2:
            print("Not enough nodes in database.")
            return
            
        node1 = nodes[0]
        node2 = nodes[1]
        
        edge = EdgeCreate(source=node1, target=node2, type="RELATED_TO")
        edge_id = create_edge(session, edge)
        print(f"Successfully connected via graph_service. Edge ID: {edge_id}")

if not connect_via_api():
    connect_via_service()

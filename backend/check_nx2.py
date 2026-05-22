from database import get_db
from graph_service import fetch_graph_from_neo4j
import json

generator = get_db()
db = next(generator)
G = fetch_graph_from_neo4j(db)
print("Nodes:", len(G.nodes()))
print("Edges:", len(G.edges()))

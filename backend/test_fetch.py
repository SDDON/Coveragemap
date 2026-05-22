from database import driver
from graph_service import fetch_graph_from_neo4j
import json

session = driver.session()
G = fetch_graph_from_neo4j(session)
session.close()

print('Nodes:', G.number_of_nodes())
print('Edges:', G.number_of_edges())

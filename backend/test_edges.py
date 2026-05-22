from database import driver
from graph_service import fetch_graph_from_neo4j

session = driver.session()
G = fetch_graph_from_neo4j(session)
session.close()

for u, v, k, data in G.edges(data=True, keys=True):
    print(G.nodes[u]['name'], '->', G.nodes[v]['name'], data.get('type'))

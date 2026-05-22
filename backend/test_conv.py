from database import driver
from graph_service import fetch_graph_from_neo4j, convert_to_response

session = driver.session()
G = fetch_graph_from_neo4j(session)
res = convert_to_response(G)
session.close()

print(len(res.edges))

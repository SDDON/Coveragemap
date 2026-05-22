from database import driver
from graph_service import fetch_graph_from_neo4j

session = driver.session()
try:
    G = fetch_graph_from_neo4j(session)
    print("Nodes:", G.number_of_nodes())
    print("Edges:", G.number_of_edges())
except Exception as e:
    print("Error:", e)
finally:
    session.close()

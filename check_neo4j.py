from neo4j import GraphDatabase
uri = "bolt://localhost:7687"
driver = GraphDatabase.driver(uri, auth=("neo4j", "password"))
with driver.session() as session:
    res = session.run("MATCH ()-[r]->() RETURN r LIMIT 5")
    edges = list(res)
    print(f"Edges in DB: {len(edges)}")

from neo4j import GraphDatabase
uri = "bolt://localhost:7687"
driver = GraphDatabase.driver(uri, auth=("neo4j", "password"))
with driver.session() as session:
    res = session.run("MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m")
    edges_count = 0
    for record in res:
        if record["r"]:
            edges_count += 1
    print(f"Edges: {edges_count}")

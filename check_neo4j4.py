from neo4j import GraphDatabase
uri = "bolt://localhost:7687"
driver = GraphDatabase.driver(uri, auth=("neo4j", "password"))
with driver.session() as session:
    res = session.run("MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN id(n), type(r), id(m) LIMIT 500")
    edges = [record for record in res if record["type(r)"]]
    print(len(edges))

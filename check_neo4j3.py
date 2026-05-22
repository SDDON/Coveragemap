from neo4j import GraphDatabase
uri = "bolt://localhost:7687"
driver = GraphDatabase.driver(uri, auth=("neo4j", "password"))
with driver.session() as session:
    res = session.run("MATCH (n)-[r]->(m) RETURN id(n), type(r), id(m)")
    for record in res:
        print(record)

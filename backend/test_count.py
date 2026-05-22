from database import driver
session = driver.session()
query = "MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN count(*)"
count = session.run(query).single()[0]
print("Query count:", count)
session.close()

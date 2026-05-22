from database import get_db
import json

generator = get_db()
db = next(generator)
query = "MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m"
result = db.run(query)
edges = 0
for record in result:
    if record["r"]:
        edges += 1
print("Edges from DB result:", edges)

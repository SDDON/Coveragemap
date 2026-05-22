from database import get_db
generator = get_db()
db = next(generator)
result = db.run("MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN r")
for i, record in enumerate(result):
    if i < 5:
        print(f"Record {i}: {record['r']}")

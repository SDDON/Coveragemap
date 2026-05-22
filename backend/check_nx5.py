from database import get_db
generator = get_db()
db = next(generator)
result = db.run("MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN r")
count = 0
for record in result:
    if record["r"] is not None:
        count += 1
print("Count where r is not None:", count)

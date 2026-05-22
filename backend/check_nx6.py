from database import get_db
generator = get_db()
db = next(generator)
result = db.run("MATCH ()-[r]->() RETURN r LIMIT 1")
r = result.single()["r"]
print(r, type(r))
print(bool(r))
print(dict(r))

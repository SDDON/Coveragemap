from database import driver
session = driver.session()
result = session.run("MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN r, m LIMIT 10")
for rec in result:
    r = rec['r']
    m = rec['m']
    print(f"r: {type(r)} bool(r): {bool(r)}")
session.close()

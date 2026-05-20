# Handoff Report: M1.1 Neo4j Docker & Seeding

## 1. Observation
- The project `d:\personal\living_graph_tc\PROJECT.md` specifies Neo4j via Docker Compose, WSL-compatible for the Database.
- Code layout dictates `/docker-compose.yml` for local Neo4j instance and `/scripts` for auto-seeding scripts.
- The task is to write a Python script to auto-seed 20+ nodes.

## 2. Logic Chain
- For WSL compatibility with Docker and databases, binding local Windows directories directly to Linux paths (like `/data` in Neo4j) can lead to severe performance issues or permission errors. Thus, we should use **Docker named volumes** for Neo4j data and logs.
- The Neo4j container needs to expose ports `7474` (HTTP) and `7687` (Bolt).
- We should configure an initial password using `NEO4J_AUTH=neo4j/password` to make local development and seeding frictionless.
- The Python script `scripts/seed_neo4j.py` will use the official `neo4j` Python driver to connect to the database via `bolt://localhost:7687`.
- The seeding script should clear the database and then create at least 20 nodes of varying labels (e.g., `Application`, `Database`, `Feature`, `TestCase`) and link them with relationships (e.g., `DEPENDS_ON`, `IMPLEMENTS`, `COVERS`). This aligns with the "Living TC" theme.

## 3. Caveats
- The seeder script requires the `neo4j` Python package to be installed (`pip install neo4j`). The Implementer must ensure a virtual environment is set up or dependencies are handled.
- Docker must be running to start the Neo4j instance and for the seeder to succeed.

## 4. Conclusion
We should create two files:
1. `d:\personal\living_graph_tc\docker-compose.yml`
2. `d:\personal\living_graph_tc\scripts\seed_neo4j.py`

### Proposed `docker-compose.yml`
```yaml
version: '3.8'

services:
  neo4j:
    image: neo4j:5.12
    container_name: living_graph_neo4j
    ports:
      - "7474:7474" # HTTP for Neo4j Browser
      - "7687:7687" # Bolt protocol
    environment:
      - NEO4J_AUTH=neo4j/password
    volumes:
      # Named volumes are strongly recommended for databases in WSL to avoid permission/performance issues
      - neo4j_data:/data
      - neo4j_logs:/logs

volumes:
  neo4j_data:
  neo4j_logs:
```

### Proposed `scripts/seed_neo4j.py`
```python
import os
from neo4j import GraphDatabase

URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
AUTH = (os.getenv("NEO4J_USER", "neo4j"), os.getenv("NEO4J_PASSWORD", "password"))

def seed_db():
    driver = GraphDatabase.driver(URI, auth=AUTH)
    with driver.session() as session:
        # Clear existing data
        session.run("MATCH (n) DETACH DELETE n")

        # Create 20+ nodes and some relationships
        query = \"\"\"
        // Applications & Services
        CREATE (app1:Application {id: 'app_1', name: 'Frontend React App', type: 'Frontend', status: 'Passed'})
        CREATE (app2:Application {id: 'app_2', name: 'Backend FastAPI', type: 'Backend', status: 'Passed'})
        CREATE (app3:Application {id: 'app_3', name: 'Auth Service', type: 'Service', status: 'Passed'})
        
        // Databases
        CREATE (db1:Database {id: 'db_1', name: 'Neo4j Graph DB', type: 'Graph', status: 'Untested'})
        CREATE (db2:Database {id: 'db_2', name: 'PostgreSQL DB', type: 'Relational', status: 'Passed'})
        
        // Features
        CREATE (feat1:Feature {id: 'feat_1', name: 'User Login', type: 'Feature', status: 'Passed'})
        CREATE (feat2:Feature {id: 'feat_2', name: 'Graph Visualization', type: 'Feature', status: 'Untested'})
        CREATE (feat3:Feature {id: 'feat_3', name: 'Node Creation', type: 'Feature', status: 'Untested'})
        CREATE (feat4:Feature {id: 'feat_4', name: 'Edge Creation', type: 'Feature', status: 'Untested'})
        CREATE (feat5:Feature {id: 'feat_5', name: 'Alias Config', type: 'Feature', status: 'Failed'})
        CREATE (feat6:Feature {id: 'feat_6', name: 'Focus Context', type: 'Feature', status: 'Untested'})
        CREATE (feat7:Feature {id: 'feat_7', name: 'Dark Mode', type: 'Feature', status: 'Passed'})
        CREATE (feat8:Feature {id: 'feat_8', name: 'User Profile', type: 'Feature', status: 'Passed'})
        CREATE (feat9:Feature {id: 'feat_9', name: 'Data Export', type: 'Feature', status: 'Untested'})
        CREATE (feat10:Feature {id: 'feat_10', name: 'Data Import', type: 'Feature', status: 'Untested'})
        
        // Test Cases
        CREATE (tc1:TestCase {id: 'tc_1', name: 'Test Login Success', status: 'Passed'})
        CREATE (tc2:TestCase {id: 'tc_2', name: 'Test Login Failure', status: 'Passed'})
        CREATE (tc3:TestCase {id: 'tc_3', name: 'Test Graph Load', status: 'Passed'})
        CREATE (tc4:TestCase {id: 'tc_4', name: 'Test Node Create', status: 'Untested'})
        CREATE (tc5:TestCase {id: 'tc_5', name: 'Test Alias Resolve', status: 'Failed'})
        
        // Relationships
        CREATE (app1)-[:DEPENDS_ON]->(app2)
        CREATE (app2)-[:DEPENDS_ON]->(app3)
        CREATE (app2)-[:USES]->(db1)
        CREATE (app3)-[:USES]->(db2)
        
        CREATE (app1)-[:IMPLEMENTS]->(feat1)
        CREATE (app1)-[:IMPLEMENTS]->(feat2)
        CREATE (app1)-[:IMPLEMENTS]->(feat3)
        CREATE (app1)-[:IMPLEMENTS]->(feat4)
        CREATE (app1)-[:IMPLEMENTS]->(feat5)
        CREATE (app1)-[:IMPLEMENTS]->(feat6)
        CREATE (app1)-[:IMPLEMENTS]->(feat7)
        CREATE (app1)-[:IMPLEMENTS]->(feat8)
        CREATE (app1)-[:IMPLEMENTS]->(feat9)
        CREATE (app1)-[:IMPLEMENTS]->(feat10)
        
        CREATE (tc1)-[:COVERS]->(feat1)
        CREATE (tc2)-[:COVERS]->(feat1)
        CREATE (tc3)-[:COVERS]->(feat2)
        CREATE (tc4)-[:COVERS]->(feat3)
        CREATE (tc5)-[:COVERS]->(feat5)
        
        RETURN count(*) as count
        \"\"\"
        result = session.run(query)
        record = result.single()
        print(f"Graph DB Seeded successfully. Nodes created.")
    driver.close()
        
if __name__ == "__main__":
    seed_db()
```

## 5. Verification Method
- Implement the files as specified.
- Run `docker-compose up -d`.
- Run `pip install neo4j` and then `python scripts/seed_neo4j.py`.
- Verify the output prints "Graph DB Seeded successfully." and use the Neo4j browser at `http://localhost:7474` (login: `neo4j`/`password`) to check that 20 nodes exist.

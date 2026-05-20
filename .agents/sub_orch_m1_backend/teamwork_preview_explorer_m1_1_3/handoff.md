# Handoff Report: Milestone 1.1 - Neo4j Docker & Seeding

## 1. Observation
- The project is building the "Living Graph TC Platform".
- Milestone 1.1 requires a `docker-compose.yml` for Neo4j that is WSL compatible and a Python script to auto-seed 20+ nodes.
- According to `PROJECT.md`, the platform uses FastAPI, NetworkX, and React Flow. Nodes have a test status (`Untested`, `Passed`, `Failed`) and might have an `alias`.

## 2. Logic Chain
- For WSL compatibility with Docker, using Docker named volumes is preferred over bind mounts, as Windows-WSL bind mounts often face permission and performance issues with databases like Neo4j.
- The `neo4j` Docker image needs ports `7474` (HTTP) and `7687` (Bolt) exposed. Environment variable `NEO4J_AUTH` should be set to secure the instance (e.g., `neo4j/password`).
- The Python script should use the official `neo4j` python driver to connect via Bolt.
- To model a Test Case platform, I propose a graph schema with `Feature`, `Component`, and `TestCase` nodes.
- The seeding script creates 3 Features, 6 Components, and 15 TestCases (24 nodes total, satisfying the 20+ requirement).
- `TestCase` nodes include a `status` property (`Passed`, `Failed`, `Untested`) to support Milestone 4.
- `Component` nodes include an `aliases` list property to support Milestone 3.

## 3. Caveats
- The python seed script requires the `neo4j` python package to be installed (`pip install neo4j`).
- The docker-compose uses a fixed password `password` for the `neo4j` user.
- The data is recreated on every script run (the script runs `MATCH (n) DETACH DELETE n` before seeding) which is suitable for initial seeding but not for production updates.

## 4. Conclusion
We should create `docker-compose.yml` in the project root and `scripts/seed.py` for the database seeding.

### Proposed `docker-compose.yml` (in `d:\personal\living_graph_tc\docker-compose.yml`)
```yaml
version: '3.8'

services:
  neo4j:
    image: neo4j:5.12.0
    container_name: living_graph_neo4j
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      - NEO4J_AUTH=neo4j/password
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
      - neo4j_import:/var/lib/neo4j/import
      - neo4j_plugins:/plugins
    restart: unless-stopped

volumes:
  neo4j_data:
  neo4j_logs:
  neo4j_import:
  neo4j_plugins:
```

### Proposed Python Seed Script (in `d:\personal\living_graph_tc\scripts\seed.py`)
```python
import os
from neo4j import GraphDatabase

# You may override these using environment variables
URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
USER = os.getenv("NEO4J_USER", "neo4j")
PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

def create_seed_data(tx):
    # Clear existing data
    tx.run("MATCH (n) DETACH DELETE n")

    # Create 20+ nodes and relationships
    query = """
    // Create Features
    CREATE (f1:Feature {id: 'F1', name: 'User Authentication', type: 'Feature'})
    CREATE (f2:Feature {id: 'F2', name: 'Graph Visualization', type: 'Feature'})
    CREATE (f3:Feature {id: 'F3', name: 'Data Management', type: 'Feature'})

    // Create Components
    CREATE (c1:Component {id: 'C1', name: 'Login UI', type: 'Component', aliases: ['login', 'signin']})
    CREATE (c2:Component {id: 'C2', name: 'Auth API', type: 'Component', aliases: ['auth_backend']})
    CREATE (c3:Component {id: 'C3', name: 'React Flow Canvas', type: 'Component', aliases: ['canvas', 'graph_ui']})
    CREATE (c4:Component {id: 'C4', name: 'Node Engine', type: 'Component'})
    CREATE (c5:Component {id: 'C5', name: 'Neo4j Connector', type: 'Component', aliases: ['db_connector']})
    CREATE (c6:Component {id: 'C6', name: 'User Profile', type: 'Component'})

    // Connect Features to Components
    CREATE (f1)-[:INCLUDES]->(c1)
    CREATE (f1)-[:INCLUDES]->(c2)
    CREATE (f1)-[:INCLUDES]->(c6)
    CREATE (f2)-[:INCLUDES]->(c3)
    CREATE (f2)-[:INCLUDES]->(c4)
    CREATE (f3)-[:INCLUDES]->(c5)

    // Create Test Cases
    // F1 - C1
    CREATE (tc1:TestCase {id: 'TC1', name: 'Valid Login', status: 'Passed'})
    CREATE (tc2:TestCase {id: 'TC2', name: 'Invalid Login', status: 'Failed'})
    CREATE (tc3:TestCase {id: 'TC3', name: 'Password Reset', status: 'Untested'})
    CREATE (tc1)-[:TESTS]->(c1)
    CREATE (tc2)-[:TESTS]->(c1)
    CREATE (tc3)-[:TESTS]->(c1)

    // F1 - C2
    CREATE (tc4:TestCase {id: 'TC4', name: 'JWT Token Generation', status: 'Passed'})
    CREATE (tc5:TestCase {id: 'TC5', name: 'Token Expiry', status: 'Passed'})
    CREATE (tc4)-[:TESTS]->(c2)
    CREATE (tc5)-[:TESTS]->(c2)

    // F2 - C3
    CREATE (tc6:TestCase {id: 'TC6', name: 'Render Nodes', status: 'Passed'})
    CREATE (tc7:TestCase {id: 'TC7', name: 'Render Edges', status: 'Passed'})
    CREATE (tc8:TestCase {id: 'TC8', name: 'Zoom and Pan', status: 'Untested'})
    CREATE (tc6)-[:TESTS]->(c3)
    CREATE (tc7)-[:TESTS]->(c3)
    CREATE (tc8)-[:TESTS]->(c3)

    // F2 - C4
    CREATE (tc9:TestCase {id: 'TC9', name: 'Focus Node', status: 'Failed'})
    CREATE (tc10:TestCase {id: 'TC10', name: 'Context De-emphasis', status: 'Untested'})
    CREATE (tc9)-[:TESTS]->(c4)
    CREATE (tc10)-[:TESTS]->(c4)

    // F3 - C5
    CREATE (tc11:TestCase {id: 'TC11', name: 'Connect to DB', status: 'Passed'})
    CREATE (tc12:TestCase {id: 'TC12', name: 'Execute Cypher Query', status: 'Passed'})
    CREATE (tc13:TestCase {id: 'TC13', name: 'Handle Connection Loss', status: 'Failed'})
    CREATE (tc11)-[:TESTS]->(c5)
    CREATE (tc12)-[:TESTS]->(c5)
    CREATE (tc13)-[:TESTS]->(c5)

    // F1 - C6
    CREATE (tc14:TestCase {id: 'TC14', name: 'Update Profile Info', status: 'Untested'})
    CREATE (tc15:TestCase {id: 'TC15', name: 'Upload Avatar', status: 'Untested'})
    CREATE (tc14)-[:TESTS]->(c6)
    CREATE (tc15)-[:TESTS]->(c6)
    """
    tx.run(query)
    print("Seed data created successfully.")

if __name__ == "__main__":
    with GraphDatabase.driver(URI, auth=(USER, PASSWORD)) as driver:
        with driver.session() as session:
            session.execute_write(create_seed_data)
```

## 5. Verification Method
1. Place the `docker-compose.yml` in the project root.
2. Run `docker-compose up -d`.
3. Verify the container is running and port 7474 and 7687 are mapped correctly.
4. Ensure `pip install neo4j` is run in the python environment.
5. Run the python script `python scripts/seed.py`.
6. Navigate to `http://localhost:7474` in a browser, log in with `neo4j` / `password`.
7. Execute `MATCH (n) RETURN count(n)` and verify the output is at least 24.

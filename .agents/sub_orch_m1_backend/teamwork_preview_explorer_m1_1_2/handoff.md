# Handoff: Milestone 1.1 Neo4j Docker & Seeding

## 1. Observation
- **Requirement**: Milestone 1.1 requires a `docker-compose.yml` for Neo4j that is WSL-compatible and a Python script (`scripts/seed.py`) to auto-seed 20+ nodes for the Living Graph TC Platform.
- **Constraints**: WSL compatibility can suffer from slow I/O and file permission errors if Windows host directories are directly bind-mounted for database storage. 

## 2. Logic Chain
- **WSL Compatibility**: To ensure Neo4j runs smoothly under WSL2, we should use Docker named volumes (e.g., `neo4j_data`) instead of host bind mounts (e.g., `./data:/data`).
- **Data Model**: The project is a "Living Graph TC (Test Case) Platform". The seed data should represent this domain:
  - `Feature` nodes (with `aliases` list property)
  - `TestCase` nodes (with `status` property: "Passed", "Failed", "Untested")
- **Scale**: We need 20+ nodes. The proposed model contains 5 `Feature` nodes and 18 `TestCase` nodes (Total = 23 nodes).
- **Seeding Logic**: 
  - Using the official `neo4j` Python driver.
  - Neo4j takes a few moments to start. The script must include a retry/wait loop (`verify_connectivity()`) before executing Cypher queries.
  - Queries can use `UNWIND` for batch node creation. Relationships are created dynamically using Cypher string formatting for relationship types, and parameterized node IDs.

## 3. Caveats
- The script uses Python's standard `neo4j` package. This requires `pip install neo4j`.
- We assume `bolt://localhost:7687` and `neo4j/password` as default local credentials.
- APOC plugin is not included in the `docker-compose.yml` by default to keep the footprint small, so we use standard Cypher `MERGE` for relationships instead of APOC dynamic procedures.

## 4. Conclusion
We propose creating the following three files:
- `/docker-compose.yml`: WSL-friendly Neo4j setup.
- `/scripts/requirements.txt`: To install the python dependencies.
- `/scripts/seed.py`: To clear existing data and insert the 23 nodes and 24 relationships.

### Proposed `/docker-compose.yml`
```yaml
version: '3.8'

services:
  neo4j:
    image: neo4j:5
    container_name: neo4j_living_graph
    ports:
      - "7474:7474" # HTTP Browser
      - "7687:7687" # Bolt Protocol
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

### Proposed `/scripts/requirements.txt`
```text
neo4j==5.20.0
```

### Proposed `/scripts/seed.py`
```python
import os
import time
from neo4j import GraphDatabase

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

def wait_for_db():
    print(f"Connecting to Neo4j at {NEO4J_URI}...")
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    
    max_retries = 30
    for i in range(max_retries):
        try:
            driver.verify_connectivity()
            print("Connected to Neo4j.")
            return driver
        except Exception as e:
            print(f"Waiting for Neo4j... ({i+1}/{max_retries})")
            time.sleep(2)
            
    raise Exception("Could not connect to Neo4j.")

def seed_database():
    driver = wait_for_db()
    
    features = [
        {"id": "F1", "name": "User Authentication", "aliases": ["auth", "login"]},
        {"id": "F2", "name": "Graph Rendering", "aliases": ["render", "canvas"]},
        {"id": "F3", "name": "Graph Editing", "aliases": ["edit", "mutate"]},
        {"id": "F4", "name": "Focus Context", "aliases": ["focus", "highlight"]},
        {"id": "F5", "name": "Alias Dictionary", "aliases": ["aliases", "dict"]}
    ]
    
    test_cases = [
        {"id": "TC1", "name": "Login valid user", "status": "Passed"},
        {"id": "TC2", "name": "Login invalid user", "status": "Failed"},
        {"id": "TC3", "name": "Logout user", "status": "Passed"},
        {"id": "TC4", "name": "Render 100 nodes", "status": "Passed"},
        {"id": "TC5", "name": "Render edges", "status": "Passed"},
        {"id": "TC6", "name": "Create Node UI", "status": "Passed"},
        {"id": "TC7", "name": "Create Edge UI", "status": "Untested"},
        {"id": "TC8", "name": "Delete Node UI", "status": "Failed"},
        {"id": "TC9", "name": "Delete Edge UI", "status": "Untested"},
        {"id": "TC10", "name": "Focus highlights node", "status": "Passed"},
        {"id": "TC11", "name": "Focus de-emphasizes background", "status": "Untested"},
        {"id": "TC12", "name": "Alias normalization", "status": "Passed"},
        {"id": "TC13", "name": "Alias dropdown suggestions", "status": "Untested"},
        {"id": "TC14", "name": "Update node status", "status": "Passed"},
        {"id": "TC15", "name": "Session timeout", "status": "Untested"},
        {"id": "TC16", "name": "Zoom and pan canvas", "status": "Passed"},
        {"id": "TC17", "name": "Export graph to JSON", "status": "Untested"},
        {"id": "TC18", "name": "Import graph from JSON", "status": "Failed"}
    ]
    
    relationships = [
        ("TC1", "TESTS_FEATURE", "F1"),
        ("TC2", "TESTS_FEATURE", "F1"),
        ("TC3", "TESTS_FEATURE", "F1"),
        ("TC15", "TESTS_FEATURE", "F1"),
        ("TC4", "TESTS_FEATURE", "F2"),
        ("TC5", "TESTS_FEATURE", "F2"),
        ("TC16", "TESTS_FEATURE", "F2"),
        ("TC6", "TESTS_FEATURE", "F3"),
        ("TC7", "TESTS_FEATURE", "F3"),
        ("TC8", "TESTS_FEATURE", "F3"),
        ("TC9", "TESTS_FEATURE", "F3"),
        ("TC10", "TESTS_FEATURE", "F4"),
        ("TC11", "TESTS_FEATURE", "F4"),
        ("TC12", "TESTS_FEATURE", "F5"),
        ("TC13", "TESTS_FEATURE", "F5"),
        ("TC14", "TESTS_FEATURE", "F3"),
        ("TC17", "TESTS_FEATURE", "F2"),
        ("TC18", "TESTS_FEATURE", "F2"),
        ("TC2", "DEPENDS_ON", "TC1"),
        ("TC3", "DEPENDS_ON", "TC1"),
        ("TC7", "DEPENDS_ON", "TC6"),
        ("TC8", "DEPENDS_ON", "TC6"),
        ("TC9", "DEPENDS_ON", "TC7"),
        ("TC13", "DEPENDS_ON", "TC12")
    ]

    with driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")
        print("Cleared existing data.")
        
        session.run("""
        UNWIND $features AS f
        CREATE (n:Feature {id: f.id, name: f.name, aliases: f.aliases})
        """, features=features)
        print(f"Inserted {len(features)} Features.")
        
        session.run("""
        UNWIND $testcases AS tc
        CREATE (n:TestCase {id: tc.id, name: tc.name, status: tc.status})
        """, testcases=test_cases)
        print(f"Inserted {len(test_cases)} TestCases.")
        
        for src, rel_type, tgt in relationships:
            session.run(f"""
            MATCH (s {{id: $src}})
            MATCH (t {{id: $tgt}})
            MERGE (s)-[:{rel_type}]->(t)
            """, src=src, tgt=tgt)
            
        print(f"Inserted {len(relationships)} relationships.")
        
    driver.close()
    print("Seeding complete.")

if __name__ == "__main__":
    seed_database()
```

## 5. Verification Method
1. Start the container: `docker compose up -d`
2. Wait for it to become healthy (the python script will auto-wait up to 60s).
3. Navigate to `scripts/` directory and install dependencies: `pip install -r requirements.txt`.
4. Run the script: `python seed.py`.
5. Open Neo4j browser at `http://localhost:7474`, login with `neo4j` / `password`.
6. Run Cypher query: `MATCH (n) RETURN n` to confirm 23 nodes and 24 edges exist.

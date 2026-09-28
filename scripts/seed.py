import os
import time
from neo4j import GraphDatabase, exceptions

URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
AUTH = (os.getenv("NEO4J_USER", "neo4j"), os.getenv("NEO4J_PASSWORD", "password"))

MAX_RETRIES = 30
RETRY_DELAY = 2

def get_driver():
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            driver = GraphDatabase.driver(URI, auth=AUTH)
            # Verify connectivity
            driver.verify_connectivity()
            print(f"Connected to Neo4j successfully on attempt {attempt}")
            return driver
        except Exception as e:
            print(f"Attempt {attempt}/{MAX_RETRIES} failed to connect: {e}")
            if attempt == MAX_RETRIES:
                print("Max retries reached. Could not connect to Neo4j.")
                raise e
            time.sleep(RETRY_DELAY)

def clear_db(tx):
    tx.run("MATCH (n) DETACH DELETE n")

def seed_data(tx):
    # Create minimal features for E2E tests to pass
    features = [
        {"id": "Game_Root", "name": "Game Testing Root", "aliases": ["Root", "valid_category", "synonym_xyz"]},
        {"id": "Game_Child", "name": "Game Testing Child", "aliases": ["Sub"]},
        {"id": "Game_Settings", "name": "Game Settings", "aliases": ["Settings"]}
    ]
    
    for f in features:
        tx.run(
            """
            CREATE (n:Feature {
                id: $id, 
                name: $name, 
                aliases: $aliases
            })
            """, 
            id=f["id"], name=f["name"], aliases=f["aliases"]
        )

    # 1 TestCase
    testcases = [
        {"id": "TC1", "title": "Initial TC", "status": "Untested", "tests_feature": "Game_Root"}
    ]
    for tc in testcases:
        tx.run(
            """
            MATCH (f:Feature {id: $tests_feature})
            CREATE (t:TestCase {
                id: $id,
                title: $title,
                status: $status
            })-[:TESTS]->(f)
            """,
            id=tc["id"], title=tc["title"], status=tc["status"], tests_feature=tc["tests_feature"]
        )
        
    # 1 dependency
    dependencies = [
        ("Game_Root", "Game_Child")
    ]
    for src, dst in dependencies:
        tx.run(
            """
            MATCH (a {id: $src})
            MATCH (b {id: $dst})
            CREATE (a)-[:DEPENDS_ON]->(b)
            """,
            src=src, dst=dst
        )

    contains_relations = []
    
    for src, dst in contains_relations:
        tx.run(
            """
            MATCH (a {id: $src})
            MATCH (b {id: $dst})
            CREATE (a)-[:CONTAINS]->(b)
            """,
            src=src, dst=dst
        )

def main():
    driver = get_driver()
    with driver.session() as session:
        print("Clearing existing data...")
        session.execute_write(clear_db)
        print("Seeding new data...")
        session.execute_write(seed_data)
        
        # Verify counts
        result = session.run("MATCH (n) RETURN count(n) AS count")
        count = result.single()["count"]
        print(f"Seed complete. Total nodes inserted: {count}")
        
    driver.close()
    
if __name__ == "__main__":
    main()

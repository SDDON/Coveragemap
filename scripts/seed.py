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
    # Create Features
    features = [
        {"id": "F1", "name": "Login", "aliases": ["Sign In", "Auth"]},
        {"id": "F2", "name": "Dashboard", "aliases": ["Home", "Main Page"]},
        {"id": "F3", "name": "User Profile", "aliases": ["Settings", "Account"]},
        {"id": "F4", "name": "Billing", "aliases": ["Payments", "Invoices"]},
        {"id": "F5", "name": "Notifications", "aliases": ["Alerts"]},
        {"id": "F6", "name": "Search", "aliases": ["Find", "Query"]},
        {"id": "F7", "name": "Reports", "aliases": ["Analytics", "Metrics"]},
        {"id": "F8", "name": "Export", "aliases": ["Download", "Save As"]},
        {"id": "F9", "name": "Integrations", "aliases": ["API", "Webhooks"]},
        {"id": "F10", "name": "Admin Panel", "aliases": ["Backoffice"]},
        # Arena Category / Group Nodes
        {"id": "Arena_Group", "name": "Arena Group", "aliases": ["Arena", "PVP"]},
        {"id": "Arena_Lobby", "name": "Arena Lobby", "aliases": ["Arena"]},
        {"id": "Arena_Match", "name": "Arena Matchmaking", "aliases": ["Arena"]},
        {"id": "Arena_Battle", "name": "Arena Battle", "aliases": ["Arena"]},
        {"id": "Arena_Result", "name": "Arena Result", "aliases": ["Arena"]}
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

    # Create TestCases
    testcases = [
        {"id": "TC1", "title": "Valid Login", "status": "Passed", "tests_feature": "F1"},
        {"id": "TC2", "title": "Invalid Password", "status": "Failed", "tests_feature": "F1"},
        {"id": "TC3", "title": "Dashboard Loads", "status": "Passed", "tests_feature": "F2"},
        {"id": "TC4", "title": "Profile Update", "status": "Untested", "tests_feature": "F3"},
        {"id": "TC5", "title": "Avatar Upload", "status": "Passed", "tests_feature": "F3"},
        {"id": "TC6", "title": "Process Payment", "status": "Failed", "tests_feature": "F4"},
        {"id": "TC7", "title": "View Invoice", "status": "Untested", "tests_feature": "F4"},
        {"id": "TC8", "title": "Receive Notification", "status": "Passed", "tests_feature": "F5"},
        {"id": "TC9", "title": "Global Search", "status": "Passed", "tests_feature": "F6"},
        {"id": "TC10", "title": "Generate Monthly Report", "status": "Failed", "tests_feature": "F7"},
        {"id": "TC11", "title": "Export to PDF", "status": "Untested", "tests_feature": "F8"},
        {"id": "TC12", "title": "Webhook Trigger", "status": "Passed", "tests_feature": "F9"},
        {"id": "TC13", "title": "Admin Role Access", "status": "Passed", "tests_feature": "F10"},
        {"id": "TC14", "title": "SQL Injection on Search", "status": "Failed", "tests_feature": "F6"},
        {"id": "TC15", "title": "Export to CSV", "status": "Passed", "tests_feature": "F8"},
        # Arena Test Cases
        {"id": "TC_Arena_1", "title": "Enter Arena Lobby", "status": "Passed", "tests_feature": "Arena_Lobby"},
        {"id": "TC_Arena_2", "title": "Queue Matchmaking", "status": "Untested", "tests_feature": "Arena_Match"},
        {"id": "TC_Arena_3", "title": "Battle Victory Check", "status": "Passed", "tests_feature": "Arena_Battle"},
        {"id": "TC_Arena_4", "title": "Result Reward Claim", "status": "Untested", "tests_feature": "Arena_Result"}
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
        
    # Create some dependencies
    dependencies = [
        ("F2", "F1"), # Dashboard depends on Login
        ("F3", "F1"), # User Profile depends on Login
        ("F4", "F1"), # Billing depends on Login
        ("F7", "F2"), # Reports depends on Dashboard
        ("F8", "F7"), # Export depends on Reports
        ("TC6", "TC1"), # Process Payment tests valid login first? Just for graph connectivity
        # Arena Dependencies
        ("Arena_Group", "F2"), # Arena depends on Dashboard
        ("Arena_Lobby", "F1"), # Lobby depends on Login
        ("Arena_Match", "Arena_Lobby"),
        ("Arena_Battle", "Arena_Match"),
        ("Arena_Result", "Arena_Battle")
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

    # Create Group Containment Relationships (Sub-Flows)
    contains_relations = [
        ("Arena_Group", "Arena_Lobby"),
        ("Arena_Group", "Arena_Match"),
        ("Arena_Group", "Arena_Battle"),
        ("Arena_Group", "Arena_Result")
    ]
    
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

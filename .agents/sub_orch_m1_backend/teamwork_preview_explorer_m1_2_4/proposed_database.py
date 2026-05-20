from neo4j import GraphDatabase

# Using default credentials from the requirements
URI = "bolt://localhost:7687"
AUTH = ("neo4j", "password")

driver = GraphDatabase.driver(URI, auth=AUTH)

def get_db():
    session = driver.session()
    try:
        yield session
    finally:
        session.close()

def close_driver():
    driver.close()

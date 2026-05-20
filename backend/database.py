import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

# Use environment variables with fallbacks to support both Docker and native binary installs
URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
AUTH = (
    os.getenv("NEO4J_USER", "neo4j"),
    os.getenv("NEO4J_PASSWORD", "password")
)

driver = GraphDatabase.driver(URI, auth=AUTH)

def get_db():
    session = driver.session()
    try:
        yield session
    finally:
        session.close()

def close_driver():
    driver.close()

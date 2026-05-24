from neo4j import GraphDatabase
import os
from dotenv import load_dotenv
load_dotenv()
driver = GraphDatabase.driver(os.getenv('NEO4J_URI'), auth=(os.getenv('NEO4J_USER'), os.getenv('NEO4J_PASSWORD')))
session = driver.session()
session.run("MATCH (n:SCREEN) WHERE n.name = 'Dummy Node with 5 Badges' REMOVE n:SCREEN SET n:Screen SET n.is_global = 'true'")
session.close()
driver.close()

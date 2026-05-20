import os
from neo4j import GraphDatabase

URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
AUTH = (os.getenv("NEO4J_USER", "neo4j"), os.getenv("NEO4J_PASSWORD", "password"))

def verify():
    driver = GraphDatabase.driver(URI, auth=AUTH)
    
    with driver.session() as session:
        # Check counts
        feature_count = session.run("MATCH (f:Feature) RETURN count(f) AS c").single()["c"]
        tc_count = session.run("MATCH (t:TestCase) RETURN count(t) AS c").single()["c"]
        tests_count = session.run("MATCH ()-[r:TESTS]->() RETURN count(r) AS c").single()["c"]
        depends_count = session.run("MATCH ()-[r:DEPENDS_ON]->() RETURN count(r) AS c").single()["c"]
        
        print(f"Features: {feature_count} (Expected: 10)")
        print(f"TestCases: {tc_count} (Expected: 15)")
        print(f"TESTS relationships: {tests_count} (Expected: 15)")
        print(f"DEPENDS_ON relationships: {depends_count} (Expected: 6)")
        
        assert feature_count == 10, f"Expected 10 features, got {feature_count}"
        assert tc_count == 15, f"Expected 15 testcases, got {tc_count}"
        assert tests_count == 15, f"Expected 15 TESTS relationships, got {tests_count}"
        assert depends_count == 6, f"Expected 6 DEPENDS_ON relationships, got {depends_count}"
        
        print("All verification checks passed.")
        
    driver.close()

if __name__ == "__main__":
    verify()

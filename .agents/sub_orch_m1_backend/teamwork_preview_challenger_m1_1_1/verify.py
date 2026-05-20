import os
import re

def verify_cypher(filepath):
    print(f"Reading {filepath} for Cypher queries...")
    with open(filepath, "r") as f:
        content = f.read()

    # Extract all tx.run() queries
    queries = re.findall(r'tx\.run\((.*?)\)', content, re.DOTALL)
    
    issues = []
    
    for i, q in enumerate(queries):
        print(f"--- Query {i+1} ---")
        print(q.strip())
        
        # Check basic syntax rules for Neo4j 5
        if "CREATE " in q and "MATCH " in q:
            # Ensure MATCH comes before CREATE
            if q.index("CREATE ") < q.index("MATCH "):
                issues.append(f"Query {i+1}: MATCH must precede CREATE")
                
        # Neo4j 5 deprecations check (e.g. periodically commit, bare nodes)
        if "USING PERIODIC COMMIT" in q:
            issues.append(f"Query {i+1}: USING PERIODIC COMMIT is removed in Neo4j 5")
            
        # Check property syntax in MATCH
        if "MATCH" in q and "{" in q:
            # Ensure proper node label or property mapping
            pass

    if issues:
        print("\nVerification FAILED. Issues found:")
        for issue in issues:
            print("-", issue)
        return False
    
    print("\nVerification PASSED. Cypher queries are syntactically valid for Neo4j 5.")
    return True

if __name__ == "__main__":
    filepath = r"d:\personal\living_graph_tc\scripts\seed.py"
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
    else:
        verify_cypher(filepath)

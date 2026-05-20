import networkx as nx
from backend.graph_service import _normalize_aliases, ALIAS_MAP

def test_alias_normalization_duplicates():
    # Simulate DB having both canonical and non-canonical forms
    raw_aliases_1 = ["front-end"]
    raw_aliases_2 = ["frontend"]
    
    norm_1 = _normalize_aliases(raw_aliases_1)
    norm_2 = _normalize_aliases(raw_aliases_2)
    
    print(f"'front-end' normalizes to: {norm_1}")
    print(f"'frontend' normalizes to: {norm_2}")
    
    # We expect them to be the exact same canonical form
    if norm_1 != norm_2:
        print("BUG: Canonical forms diverge!")
        
    # Same for database
    print(f"'db' normalizes to: {_normalize_aliases(['db'])}")
    print(f"'database' normalizes to: {_normalize_aliases(['database'])}")

if __name__ == "__main__":
    test_alias_normalization_duplicates()

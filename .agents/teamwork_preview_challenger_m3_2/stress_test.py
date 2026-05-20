import time
import networkx as nx
from backend.graph_service import process_graph, _normalize_aliases

def test_alias_normalization_bug():
    print("--- Testing Alias Normalization Bug ---")
    raw_aliases = ["front-end", "frontend", "db", "database"]
    normalized = _normalize_aliases(raw_aliases)
    print(f"Input: {raw_aliases}")
    print(f"Output: {normalized}")
    
    # Check if duplicates exist (case-insensitive clash)
    lower_normalized = [a.lower() for a in normalized]
    if len(set(lower_normalized)) < len(normalized):
        print("VETO: Normalization bug confirmed! Canonical forms diverge and produce duplicates (e.g., 'frontend' vs 'Frontend').")
    else:
        print("PASS: Normalization works.")
    print()

def test_bfs_stress():
    print("--- Stress Testing BFS Logic ---")
    # Generate a large star graph
    num_nodes = 50000
    print(f"Generating graph with {num_nodes} nodes...")
    G = nx.MultiDiGraph()
    G.add_node("root", name="Root", label="Core", aliases=[])
    for i in range(1, num_nodes):
        G.add_node(str(i), name=f"Node{i}", label="Item", aliases=[])
        G.add_edge("root", str(i), type="CHILD")
    
    start_time = time.time()
    # Filter for 'root', should traverse to all children if max_depth=1
    processed = process_graph(G, filter_str="root", max_depth=1)
    duration = time.time() - start_time
    
    print(f"Processed graph size: {len(processed.nodes)} nodes, {len(processed.edges)} edges")
    print(f"BFS Time: {duration:.4f} seconds")
    if duration > 1.0:
        print("WARNING: BFS is slow for large graphs.")
    else:
        print("PASS: BFS handles large shallow structures well.")
    print()

if __name__ == "__main__":
    test_alias_normalization_bug()
    test_bfs_stress()

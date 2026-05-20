import networkx as nx

from backend.graph_service import process_graph, convert_to_response

def test_process_graph():
    G = nx.DiGraph()
    G.add_node("1", name="Alice", label="Person", aliases=["Ali"])
    G.add_node("2", name="Bob", label="Person", aliases=["Bobby"])
    G.add_node("3", name="Charlie", label="Person", aliases=["Chuck"])
    G.add_node("4", name="David", label="Person", aliases=["Dave"])
    
    G.add_edge("1", "2", type="KNOWS")
    G.add_edge("2", "3", type="KNOWS")
    G.add_edge("3", "4", type="KNOWS")
    
    # Test 1: Filter string matches one node, depth 1
    sub_g = process_graph(G, filter_str="alice", max_depth=1)
    assert set(sub_g.nodes()) == {"1", "2"}, f"Expected {{1, 2}}, got {sub_g.nodes()}"
    
    # Test 2: Filter string matches one node, depth 2
    sub_g = process_graph(G, filter_str="alice", max_depth=2)
    assert set(sub_g.nodes()) == {"1", "2", "3"}, f"Expected {{1, 2, 3}}, got {sub_g.nodes()}"

    # Test 3: No filter, returns full graph
    sub_g = process_graph(G, filter_str=None, max_depth=2)
    assert set(sub_g.nodes()) == {"1", "2", "3", "4"}

    # Test 4: non-string label or name? 
    # Actually graph_service has:
    # name = data.get("name", "").lower()
    # what if name is an int?
    G.add_node("5", name=123, label="Number", aliases=[])
    try:
        process_graph(G, filter_str="123", max_depth=1)
        print("Test 4 passed (handled int name)")
    except Exception as e:
        print(f"Test 4 failed with: {e}")

    # Test 5: What if graph is completely empty?
    empty_G = nx.DiGraph()
    sub_g = process_graph(empty_G, filter_str="alice", max_depth=1)
    assert len(sub_g.nodes()) == 0

    print("All basic tests executed.")

if __name__ == "__main__":
    test_process_graph()

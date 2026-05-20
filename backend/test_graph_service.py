import networkx as nx
from graph_service import process_graph

def test_process_graph_no_filter():
    G = nx.DiGraph()
    G.add_node("1", name="Alice", label="Person", aliases=[])
    G.add_node("2", name="Bob", label="Person", aliases=[])
    G.add_edge("1", "2", type="KNOWS")

    processed = process_graph(G)
    assert len(processed.nodes) == 2
    assert len(processed.edges) == 1

def test_process_graph_with_filter():
    G = nx.DiGraph()
    G.add_node("1", name="Alice", label="Person", aliases=[])
    G.add_node("2", name="Bob", label="Person", aliases=[])
    G.add_edge("1", "2", type="KNOWS")

    # Filter 'alice' should match node 1
    # max_depth=1 should include node 2 because it's connected to node 1
    processed = process_graph(G, filter_str="alice", max_depth=1)
    assert len(processed.nodes) == 2, f"Expected 2 nodes, got {len(processed.nodes)}"
    assert len(processed.edges) == 1, f"Expected 1 edge, got {len(processed.edges)}"

def test_process_graph_with_filter_no_depth():
    G = nx.DiGraph()
    G.add_node("1", name="Alice", label="Person", aliases=[])
    G.add_node("2", name="Bob", label="Person", aliases=[])
    G.add_node("3", name="Charlie", label="Person", aliases=[])
    G.add_edge("1", "2", type="KNOWS")
    G.add_edge("2", "3", type="KNOWS")

    # max_depth defaults to 1
    processed = process_graph(G, filter_str="alice", max_depth=None)
    assert len(processed.nodes) == 2, f"Expected 2 nodes, got {len(processed.nodes)}"
    assert "3" not in processed.nodes, "Node 3 should not be in the graph"

def test_process_graph_case_insensitive():
    G = nx.DiGraph()
    G.add_node("1", name="ALICE", label="Person", aliases=[])
    processed = process_graph(G, filter_str="alice")
    assert len(processed.nodes) == 1

def test_process_graph_alias_match():
    G = nx.DiGraph()
    G.add_node("1", name="Alice", label="Person", aliases=["Ally"])
    processed = process_graph(G, filter_str="ally")
    assert len(processed.nodes) == 1

def test_process_graph_label_match():
    G = nx.DiGraph()
    G.add_node("1", name="Alice", label="SuperPerson", aliases=[])
    processed = process_graph(G, filter_str="super")
    assert len(processed.nodes) == 1

def test_process_graph_ego_graph_undirected():
    # ego_graph with undirected=True means it considers both in and out edges
    G = nx.DiGraph()
    G.add_node("1", name="Alice", label="Person", aliases=[])
    G.add_node("2", name="Bob", label="Person", aliases=[])
    G.add_edge("2", "1", type="KNOWS") # In-edge to Alice

    processed = process_graph(G, filter_str="alice", max_depth=1)
    assert len(processed.nodes) == 2, f"Expected 2 nodes, got {len(processed.nodes)}"
    assert len(processed.edges) == 1, f"Expected 1 edge, got {len(processed.edges)}"

def test_normalize_string():
    from graph_service import _normalize_string
    assert _normalize_string("front-end") == "frontend"
    assert _normalize_string("FRONT-END") == "frontend"
    assert _normalize_string("database") == "database"
    assert _normalize_string("DB") == "database"
    assert _normalize_string("RELATED") == "Related"
    assert _normalize_string(123) == 123
    assert _normalize_string(None) is None

if __name__ == '__main__':
    test_process_graph_no_filter()
    test_process_graph_with_filter()
    test_process_graph_with_filter_no_depth()
    test_process_graph_case_insensitive()
    test_process_graph_alias_match()
    test_process_graph_label_match()
    test_process_graph_ego_graph_undirected()
    test_normalize_string()
    print("All tests passed.")

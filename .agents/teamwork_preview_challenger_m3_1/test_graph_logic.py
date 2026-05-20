import networkx as nx
import collections
from typing import Optional, Any
import time

def _normalize_aliases(aliases: Any) -> list[str]:
    ALIAS_MAP = {
        "front-end": "frontend",
        "back-end": "backend",
        "db": "database",
        "ui": "ui",
        "ux": "ux",
        "api": "api"
    }
    if aliases is None:
        return []
    
    raw_list = []
    if isinstance(aliases, str):
        raw_list = [aliases]
    else:
        try:
            raw_list = [str(a) for a in aliases if a is not None]
        except (TypeError, ValueError):
            raw_list = [str(aliases)]
            
    standardized = []
    for a in raw_list:
        a_lower = a.lower()
        if a_lower in ALIAS_MAP:
            standardized.append(ALIAS_MAP[a_lower])
        else:
            standardized.append(a.title())
    
    result = []
    for s in standardized:
        if s not in result:
            result.append(s)
    return result

def process_graph(G: nx.MultiDiGraph, filter_str: Optional[str] = None, max_depth: Optional[int] = None) -> nx.MultiDiGraph:
    if filter_str:
        filter_lower = str(filter_str).lower()
        matched_nodes = []
        for node, data in G.nodes(data=True):
            name_val = data.get("name")
            name = str(name_val).lower() if name_val is not None else ""
            
            label_val = data.get("label")
            label = str(label_val).lower() if label_val is not None else ""
            
            aliases_val = data.get("aliases") or []
            aliases = [str(a).lower() for a in aliases_val if a is not None]
            
            if filter_lower in name or filter_lower in label or any(filter_lower in a for a in aliases):
                matched_nodes.append(node)
        
        if not matched_nodes:
            return nx.MultiDiGraph() # Return empty graph if no match
            
        depth = max_depth if max_depth is not None else 1
        
        # Multi-source BFS using deque
        visited = set(matched_nodes)
        queue = collections.deque([(n, 0) for n in matched_nodes])
        
        # Undirected view to get neighbors in both directions
        G_undirected = G.to_undirected(as_view=True)
        
        while queue:
            curr_node, curr_depth = queue.popleft()
            
            if curr_depth < depth:
                for neighbor in G_undirected.neighbors(curr_node):
                    if neighbor not in visited:
                        visited.add(neighbor)
                        queue.append((neighbor, curr_depth + 1))
                        
        return G.subgraph(visited).copy()
            
    return G

def run_tests():
    print("Testing process_graph logic...")
    
    # 1. Test basic matching
    G1 = nx.MultiDiGraph()
    G1.add_node("1", name="App", label="Component", aliases=["frontend"])
    G1.add_node("2", name="API", label="Component", aliases=["backend"])
    G1.add_node("3", name="Database", label="Component", aliases=["database"])
    G1.add_edge("1", "2")
    G1.add_edge("2", "3")
    
    res1 = process_graph(G1, filter_str="app", max_depth=1)
    print(f"Test 1 (app, depth 1): nodes = {list(res1.nodes)}")
    assert "1" in res1.nodes
    assert "2" in res1.nodes
    assert "3" not in res1.nodes

    res2 = process_graph(G1, filter_str="API", max_depth=0)
    print(f"Test 2 (API, depth 0): nodes = {list(res2.nodes)}")
    assert "2" in res2.nodes
    assert "1" not in res2.nodes
    assert "3" not in res2.nodes
    
    # 2. Test multi-source BFS overlap
    G2 = nx.MultiDiGraph()
    for i in range(10):
        G2.add_node(str(i), name=f"Node_{i}")
    for i in range(9):
        G2.add_edge(str(i), str(i+1))
        
    res3 = process_graph(G2, filter_str="Node", max_depth=2) # Matches all nodes
    print(f"Test 3 (Match all, depth 2): nodes = {len(res3.nodes)}")
    assert len(res3.nodes) == 10
    
    # 3. Test alias normalization
    print(f"Test 4 (Alias normalization)")
    assert _normalize_aliases("FRONT-END") == ["frontend"]
    assert _normalize_aliases(["UI", "front-end"]) == ["ui", "frontend"]
    assert _normalize_aliases(["UX", "UX"]) == ["ux"]
    assert _normalize_aliases(123) == ["123"]
    assert _normalize_aliases(None) == []
    
    # 4. Stress Test: large graph
    G_large = nx.MultiDiGraph()
    num_nodes = 50000
    for i in range(num_nodes):
        G_large.add_node(str(i), name=f"Item{i}", aliases=["common"])
    for i in range(num_nodes - 1):
        G_large.add_edge(str(i), str(i+1))
        
    start_time = time.time()
    # Filter matches 1 node, depth is 1000
    res_large = process_graph(G_large, filter_str="Item25000", max_depth=1000)
    duration = time.time() - start_time
    print(f"Stress test duration: {duration:.4f} seconds, nodes found: {len(res_large.nodes)}")
    
    # It should take < 1 second.
    assert duration < 5.0

    print("All tests passed.")

if __name__ == "__main__":
    run_tests()

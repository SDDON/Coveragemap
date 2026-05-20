import networkx as nx
import time

def process_graph_compose_all(G, matched_nodes, depth):
    subgraphs = []
    for node in matched_nodes:
        ego = nx.ego_graph(G, node, radius=depth, undirected=True)
        subgraphs.append(ego)
    return nx.compose_all(subgraphs)

def process_graph_subgraph(G, matched_nodes, depth):
    all_nodes = set()
    for node in matched_nodes:
        all_nodes.update(nx.ego_graph(G, node, radius=depth, undirected=True).nodes)
    return G.subgraph(all_nodes)

def test_performance():
    # Create a large star graph
    G = nx.MultiDiGraph()
    center = "center"
    G.add_node(center)
    # Add 2000 outer nodes
    num_nodes = 2000
    for i in range(num_nodes):
        node_id = f"node_{i}"
        G.add_node(node_id)
        G.add_edge(center, node_id)
    
    # Let's say all outer nodes match
    matched_nodes = [f"node_{i}" for i in range(num_nodes)]
    
    start = time.time()
    process_graph_subgraph(G, matched_nodes, 1)
    time_subgraph = time.time() - start
    
    start = time.time()
    try:
        process_graph_compose_all(G, matched_nodes, 1)
        time_compose = time.time() - start
    except Exception as e:
        time_compose = str(e)
        
    print(f"Subgraph method: {time_subgraph:.4f}s")
    print(f"Compose all method: {time_compose}s")

if __name__ == "__main__":
    test_performance()

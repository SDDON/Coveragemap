import networkx as nx
G = nx.MultiDiGraph()
G.add_edge(1, 2, key=0, attr='A')
G.add_edge(1, 2, key=1, attr='B')
for edge in G.edges(data=True):
    print(edge)

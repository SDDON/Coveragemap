import networkx as nx

G = nx.MultiDiGraph()
G.add_edge("A", "B", key="k1", weight=1)
G.add_edge("A", "B", key="k2", weight=2)

for edge in G.edges(data=True):
    print("Edge without keys:", edge)

for edge in G.edges(keys=True, data=True):
    print("Edge with keys:", edge)

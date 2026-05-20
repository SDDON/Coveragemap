import networkx as nx
from typing import List, Optional
from models import NodeModel, EdgeModel, GraphResponse

def _parse_aliases(aliases_raw) -> List[str]:
    """Safely parse aliases into a list of strings."""
    if aliases_raw is None:
        return []
    if isinstance(aliases_raw, str):
        return [aliases_raw.title()]
    try:
        return [str(a).title() for a in aliases_raw]
    except TypeError:
        return [str(aliases_raw).title()]

def fetch_graph_from_neo4j(session) -> nx.MultiDiGraph:
    """Fetch the entire graph from Neo4j into a NetworkX MultiDiGraph."""
    query = """
    MATCH (n)
    OPTIONAL MATCH (n)-[r]->(m)
    RETURN n, r, m
    """
    result = session.run(query)
    
    G = nx.MultiDiGraph()
    for record in result:
        n = record["n"]
        if n:
            n_id = str(n.element_id)
            n_labels = list(n.labels)
            label = str(n_labels[0]) if n_labels else "Node"
            
            # Extract basic properties, handle numeric/null safely
            name_raw = n.get("name")
            name = str(name_raw) if name_raw is not None else n_id
            
            aliases = _parse_aliases(n.get("aliases"))
            
            G.add_node(n_id, label=label, name=name, aliases=aliases, properties=dict(n))
        
        m = record["m"]
        r = record["r"]
        if m and r:
            m_id = str(m.element_id)
            m_labels = list(m.labels)
            m_label = str(m_labels[0]) if m_labels else "Node"
            
            m_name_raw = m.get("name")
            m_name = str(m_name_raw) if m_name_raw is not None else m_id
            
            m_aliases = _parse_aliases(m.get("aliases"))
            
            G.add_node(m_id, label=m_label, name=m_name, aliases=m_aliases, properties=dict(m))
            
            # Use MultiDiGraph to preserve parallel edges
            G.add_edge(n_id, m_id, type=str(r.type), properties=dict(r))
            
    return G

def process_graph(G: nx.MultiDiGraph, filter_str: Optional[str] = None, max_depth: Optional[int] = None) -> nx.MultiDiGraph:
    """Process graph using NetworkX based on filter and max_depth."""
    if filter_str:
        filter_lower = str(filter_str).lower()
        matched_nodes = []
        for node, data in G.nodes(data=True):
            # safely handle potentially numeric/null properties before calling lower()
            name_raw = data.get("name")
            name = str(name_raw).lower() if name_raw is not None else ""
            
            label_raw = data.get("label")
            label = str(label_raw).lower() if label_raw is not None else ""
            
            aliases_raw = data.get("aliases", [])
            if aliases_raw is None:
                aliases_raw = []
            elif isinstance(aliases_raw, str):
                aliases_raw = [aliases_raw]
            
            try:
                aliases = [str(a).lower() for a in aliases_raw if a is not None]
            except TypeError:
                aliases = [str(aliases_raw).lower()]
                
            if filter_lower in name or filter_lower in label or any(filter_lower in a for a in aliases):
                matched_nodes.append(node)
        
        if not matched_nodes:
            return nx.MultiDiGraph() # Return empty graph if no match
            
        # Create subgraph using ego_graph for each matched node
        subgraphs = []
        depth = max_depth if max_depth is not None else 1
        for node in matched_nodes:
            # undirected ego_graph to get dependencies in both directions
            ego = nx.ego_graph(G, node, radius=depth, undirected=True)
            subgraphs.append(ego)
            
        if subgraphs:
            return nx.compose_all(subgraphs)
        else:
            return nx.MultiDiGraph()
            
    return G # Return the full graph if no filter is provided

def convert_to_response(G: nx.MultiDiGraph, debounce_id: Optional[str] = None) -> GraphResponse:
    """Convert NetworkX MultiDiGraph to Pydantic GraphResponse."""
    nodes = []
    for node_id, data in G.nodes(data=True):
        nodes.append(NodeModel(
            id=str(node_id),
            label=str(data.get("label", "Node")),
            name=str(data.get("name", node_id)),
            aliases=data.get("aliases", []),
            properties=data.get("properties", {})
        ))
        
    edges = []
    # For MultiDiGraph, edges(data=True) returns (u, v, data) for every edge
    for u, v, data in G.edges(data=True):
        edges.append(EdgeModel(
            source=str(u),
            target=str(v),
            type=str(data.get("type", "RELATED")),
            properties=data.get("properties", {})
        ))
        
    return GraphResponse(nodes=nodes, edges=edges, debounce_id=debounce_id)

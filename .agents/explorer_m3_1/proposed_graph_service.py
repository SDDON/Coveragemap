import networkx as nx
from typing import List, Optional, Any
from models import NodeModel, EdgeModel, GraphResponse

import collections

ALIAS_MAP = {
    "front-end": "frontend",
    "back-end": "backend",
    "db": "database",
    "ui": "ui",
    "ux": "ux",
    "api": "api"
}

CANONICAL_VALUES = set(ALIAS_MAP.values())

def _normalize_string(val: str) -> str:
    """Normalize a single string using ALIAS_MAP."""
    if not val:
        return val
    v_lower = str(val).lower()
    if v_lower in ALIAS_MAP:
        return ALIAS_MAP[v_lower]
    elif v_lower in CANONICAL_VALUES:
        return v_lower
    return val.title()

def _normalize_aliases(aliases: Any) -> List[str]:
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
        standardized.append(_normalize_string(a))
    
    # Remove duplicates but keep order
    result = []
    for s in standardized:
        if s not in result:
            result.append(s)
    return result

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
            label = _normalize_string(n_labels[0]) if n_labels else "Node"
            
            # Extract basic properties, handle aliases safely
            name_val = n.get("name")
            name = str(name_val) if name_val is not None else n_id
            aliases = _normalize_aliases(n.get("aliases"))
            
            G.add_node(n_id, label=label, name=name, aliases=aliases, properties=dict(n))
        
        m = record["m"]
        r = record["r"]
        if m and r:
            m_id = str(m.element_id)
            m_labels = list(m.labels)
            m_label = _normalize_string(m_labels[0]) if m_labels else "Node"
            
            m_name_val = m.get("name")
            m_name = str(m_name_val) if m_name_val is not None else m_id
            m_aliases = _normalize_aliases(m.get("aliases"))
            
            G.add_node(m_id, label=m_label, name=m_name, aliases=m_aliases, properties=dict(m))
            
            edge_type = _normalize_string(r.type)
            G.add_edge(n_id, m_id, type=edge_type, properties=dict(r))
            
    return G

def process_graph(G: nx.MultiDiGraph, filter_str: Optional[str] = None, max_depth: Optional[int] = None) -> nx.MultiDiGraph:
    """Process graph using NetworkX based on filter and max_depth."""
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
        G_undirected = G.to_undirected()
        
        while queue:
            curr_node, curr_depth = queue.popleft()
            
            if curr_depth < depth:
                for neighbor in G_undirected.neighbors(curr_node):
                    if neighbor not in visited:
                        visited.add(neighbor)
                        queue.append((neighbor, curr_depth + 1))
                        
        return G.subgraph(visited).copy()
            
    return G

def convert_to_response(G: nx.MultiDiGraph, debounce_id: Optional[str] = None) -> GraphResponse:
    """Convert NetworkX MultiDiGraph to Pydantic GraphResponse."""
    nodes = []
    for node_id, data in G.nodes(data=True):
        nodes.append(NodeModel(
            id=node_id,
            label=data.get("label", "Node"),
            name=data.get("name", node_id),
            aliases=data.get("aliases", []),
            properties=data.get("properties", {})
        ))
        
    edges = []
    # For MultiDiGraph, G.edges(data=True) returns (u, v, data) for each edge
    for u, v, data in G.edges(data=True):
        edges.append(EdgeModel(
            source=u,
            target=v,
            type=data.get("type", "RELATED"),
            properties=data.get("properties", {})
        ))
        
    return GraphResponse(nodes=nodes, edges=edges, debounce_id=debounce_id)

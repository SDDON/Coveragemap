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
        a_lower = a.lower()
        if a_lower in ALIAS_MAP:
            standardized.append(ALIAS_MAP[a_lower])
        elif a_lower in CANONICAL_VALUES:
            standardized.append(a_lower)
        else:
            standardized.append(a.title())
    
    # Remove duplicates but keep order
    result = []
    for s in standardized:
        if s not in result:
            result.append(s)
    return result

def _normalize_string(val: Any) -> Any:
    if not isinstance(val, str):
        return val
    val_lower = val.lower()
    if val_lower in ALIAS_MAP:
        return ALIAS_MAP[val_lower]
    elif val_lower in CANONICAL_VALUES:
        return val_lower
    return val.title()

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
            label = n_labels[0] if n_labels else "Node"
            
            # Extract basic properties, handle aliases safely
            name_val = n.get("name")
            name = str(name_val) if name_val is not None else n_id
            aliases = _normalize_aliases(n.get("aliases"))
            
            n_props = dict(n)
            for key in ["category", "type"]:
                if key in n_props:
                    n_props[key] = _normalize_string(n_props[key])
            test_status = n_props.get("test_status", "Untested")
            
            G.add_node(n_id, label=label, name=name, aliases=aliases, properties=n_props, test_status=test_status)
        
        m = record["m"]
        r = record["r"]
        if m is not None and r is not None:
            m_id = str(m.element_id)
            m_labels = list(m.labels)
            m_label = m_labels[0] if m_labels else "Node"
            
            m_name_val = m.get("name")
            m_name = str(m_name_val) if m_name_val is not None else m_id
            m_aliases = _normalize_aliases(m.get("aliases"))
            
            m_props = dict(m)
            for key in ["category", "type"]:
                if key in m_props:
                    m_props[key] = _normalize_string(m_props[key])
            m_test_status = m_props.get("test_status", "Untested")
            
            G.add_node(m_id, label=m_label, name=m_name, aliases=m_aliases, properties=m_props, test_status=m_test_status)
            
            r_id = str(r.element_id)
            r_props = dict(r)
            for key in ["category", "type"]:
                if key in r_props:
                    r_props[key] = _normalize_string(r_props[key])
            r_test_status = r_props.get("test_status", "Untested")
            normalized_edge_type = _normalize_string(r.type)
            
            G.add_edge(n_id, m_id, key=r_id, id=r_id, type=normalized_edge_type, action=r_props.get("action"), properties=r_props, test_status=r_test_status)
            
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
            properties=data.get("properties", {}),
            test_status=data.get("test_status", "Untested")
        ))
        
    edges = []
    # For MultiDiGraph, G.edges(data=True, keys=True) returns (u, v, k, data) for each edge
    for u, v, k, data in G.edges(data=True, keys=True):
        edges.append(EdgeModel(
            id=data.get("id", k),
            source=u,
            target=v,
            type=data.get("type", "RELATED"),
            action=data.get("action"),
            properties=data.get("properties", {}),
            test_status=data.get("test_status", "Untested")
        ))
        
    return GraphResponse(nodes=nodes, edges=edges, debounce_id=debounce_id)

from models import NodeCreate, NodeUpdate, EdgeCreate, EdgeUpdate

def create_node(session, node_data: NodeCreate) -> str:
    query = f"""
    CREATE (n:`{node_data.label}`)
    SET n.name = $name,
        n.aliases = $aliases,
        n.description = $description,
        n.issue_link = $issue_link,
        n.test_status = $test_status,
        n += $properties
    RETURN elementId(n) as id
    """
    result = session.run(query, 
        name=node_data.name,
        aliases=node_data.aliases,
        description=node_data.description,
        issue_link=node_data.issue_link,
        test_status=node_data.test_status,
        properties=node_data.properties
    )
    record = result.single()
    return record["id"]

def update_node(session, node_id: str, node_data: NodeUpdate):
    set_clauses = []
    params = {"id": node_id}
    
    if node_data.name is not None:
        set_clauses.append("n.name = $name")
        params["name"] = node_data.name
    if node_data.aliases is not None:
        set_clauses.append("n.aliases = $aliases")
        params["aliases"] = node_data.aliases
    if node_data.description is not None:
        set_clauses.append("n.description = $description")
        params["description"] = node_data.description
    if node_data.issue_link is not None:
        set_clauses.append("n.issue_link = $issue_link")
        params["issue_link"] = node_data.issue_link
    if node_data.test_status is not None:
        set_clauses.append("n.test_status = $test_status")
        params["test_status"] = node_data.test_status
    if node_data.properties is not None:
        set_clauses.append("n += $properties")
        params["properties"] = node_data.properties
        
    set_query = "SET " + ", ".join(set_clauses) if set_clauses else ""
        
    if not set_query and node_data.label is None:
        return
        
    query = f"""
    MATCH (n) WHERE elementId(n) = $id
    {set_query}
    RETURN n
    """
    
    # First apply properties update
    if set_query:
        session.run(query, **params)
        
    # Then handle label update if provided
    if node_data.label is not None:
        # Get existing labels
        labels_result = session.run("MATCH (n) WHERE elementId(n) = $id RETURN labels(n) as labels", id=node_id).single()
        if labels_result and labels_result["labels"]:
            old_labels = labels_result["labels"]
            # Remove all old labels and set the new one
            remove_clause = " ".join([f"REMOVE n:`{l}`" for l in old_labels])
            set_label_query = f"MATCH (n) WHERE elementId(n) = $id {remove_clause} SET n:`{node_data.label}`"
            session.run(set_label_query, id=node_id)

def _recalc_target_node_status(session, target_id: str):
    query = """
    MATCH (target) WHERE elementId(target) = $target_id
    OPTIONAL MATCH ()-[in_r]->(target)
    WITH target, collect(coalesce(in_r.test_status, 'Untested')) AS statuses
    SET target.test_status = 
      CASE 
        WHEN size(statuses) = 0 THEN 'Untested'
        WHEN 'Failed' IN statuses THEN 'Failed' 
        WHEN all(s IN statuses WHERE s = 'Passed') THEN 'Passed' 
        ELSE 'Untested' 
      END
    """
    session.run(query, target_id=target_id)

def delete_node(session, node_id: str):
    find_targets_query = """
    MATCH (n)-[r]->(target) WHERE elementId(n) = $id
    RETURN elementId(target) AS target_id
    """
    targets = [record["target_id"] for record in session.run(find_targets_query, id=node_id)]
    
    query = """
    MATCH (n) WHERE elementId(n) = $id
    DETACH DELETE n
    """
    session.run(query, id=node_id)
    
    for t_id in targets:
        _recalc_target_node_status(session, t_id)

def create_edge(session, edge_data: EdgeCreate) -> str:
    query = f"""
    MATCH (source), (target)
    WHERE elementId(source) = $source_id AND elementId(target) = $target_id
    CREATE (source)-[r:`{edge_data.type}`]->(target)
    SET r.test_status = $test_status,
        r.action = $action,
        r += $properties
    RETURN elementId(r) as id
    """
    result = session.run(query, 
        source_id=edge_data.source,
        target_id=edge_data.target,
        test_status=edge_data.test_status,
        action=edge_data.action,
        properties=edge_data.properties
    )
    record = result.single()
    if not record:
        raise ValueError(f"Source or target node not found")
    _recalc_target_node_status(session, edge_data.target)
    return record["id"]

def update_edge(session, edge_id: str, edge_data: EdgeUpdate) -> str:
    set_clauses = []
    params = {"id": edge_id}
    
    if edge_data.test_status is not None:
        set_clauses.append("r.test_status = $test_status")
        params["test_status"] = edge_data.test_status
    if getattr(edge_data, "action", None) is not None or "action" in edge_data.model_fields_set:
        set_clauses.append("r.action = $action")
        params["action"] = edge_data.action
    if edge_data.properties is not None:
        set_clauses.append("r += $properties")
        params["properties"] = edge_data.properties
        
    set_query = "SET " + ", ".join(set_clauses) if set_clauses else ""
    
    new_id = edge_id
    if getattr(edge_data, "type", None) is not None:
        query = f"""
        MATCH (a)-[r]->(b) WHERE elementId(r) = $id
        CREATE (a)-[r2:`{edge_data.type}`]->(b)
        SET r2 = properties(r)
        {set_query.replace('r.', 'r2.').replace('r +=', 'r2 +=')}
        DELETE r
        RETURN elementId(r2) AS new_id, elementId(b) AS target_id
        """
        result = session.run(query, **params)
        record = result.single()
        if record:
            new_id = record["new_id"]
            _recalc_target_node_status(session, record["target_id"])
            return new_id
        return new_id
        
    if set_query:
        query = f"""
        MATCH ()-[r]->(target) WHERE elementId(r) = $id
        {set_query}
        RETURN elementId(r) AS new_id, elementId(target) AS target_id
        """
        result = session.run(query, **params)
        record = result.single()
        if record:
            new_id = record["new_id"]
            _recalc_target_node_status(session, record["target_id"])
            
    return new_id

def delete_edge(session, edge_id: str):
    query = """
    MATCH ()-[r]->(target) WHERE elementId(r) = $id
    WITH r, target, elementId(target) AS target_id
    DELETE r
    RETURN target_id
    """
    result = session.run(query, id=edge_id)
    record = result.single()
    if record:
        _recalc_target_node_status(session, record["target_id"])

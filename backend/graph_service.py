import networkx as nx
from typing import List, Optional, Any, Dict
from models import (
    NodeModel, EdgeModel, GraphResponse,
    NodeStatusSummary, RootCauseInfo, ImpactScopeResponse,
    CrossCuttingAuditResponse, NextTestTarget
)

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
    # Check for duplicate name
    check_query = "MATCH (n) WHERE n.name = $name RETURN elementId(n) as id LIMIT 1"
    check_result = session.run(check_query, name=node_data.name).single()
    if check_result:
        raise ValueError("중복된 이름입니다. 기존 노드를 재사용하시거나, 구분하려면 해시태그를 붙여주세요 (예: 타이틀 화면 #상점)")

    query = f"""
    CREATE (n:`{node_data.label}`)
    SET n.name = $name,
        n.aliases = $aliases,
        n.description = $description,
        n.issue_link = $issue_link,
        n.test_status = $test_status,
        n.is_manual_override = $is_manual_override,
        n.override_reason = $override_reason,
        n += $properties
    RETURN elementId(n) as id
    """
    result = session.run(query, 
        name=node_data.name,
        aliases=node_data.aliases,
        description=node_data.description,
        issue_link=node_data.issue_link,
        test_status=node_data.test_status,
        is_manual_override=node_data.is_manual_override,
        override_reason=node_data.override_reason,
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
    if node_data.is_manual_override is not None:
        set_clauses.append("n.is_manual_override = $is_manual_override")
        params["is_manual_override"] = node_data.is_manual_override
    if node_data.override_reason is not None:
        set_clauses.append("n.override_reason = $override_reason")
        params["override_reason"] = node_data.override_reason
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

def _recalc_target_node_status(session, target_id: str, visited=None):
    """
    Living TC 4-Stage Status Taxonomy에 따라 타겟 노드의 상태를 들어오는 엣지들을 바탕으로 재계산합니다.
    수동 오버라이드(is_manual_override=True)가 설정된 노드는 사용자의 판단을 보존합니다.
    상태가 변경되면 하류(outgoing) 노드들로 연쇄 전파합니다.
    """
    if visited is None:
        visited = set()
    if target_id in visited:
        return
    visited.add(target_id)

    query = """
    MATCH (target) WHERE elementId(target) = $target_id
    OPTIONAL MATCH ()-[in_r]->(target)
    WITH target, collect(coalesce(in_r.test_status, 'Untested')) AS statuses
    RETURN target.test_status AS current_status,
           target.is_manual_override AS is_override,
           statuses
    """
    rec = session.run(query, target_id=target_id).single()
    if not rec:
        return

    # 수동 고정(Manual Override)되어 있다면 자동 합성 스킵
    if rec["is_override"] in [True, "true", "True"]:
        return

    statuses = rec["statuses"]
    old_status = rec["current_status"]
    
    # 3.2 상태 합성 로직:
    # 0개 -> Untested
    # 1개 이상: 'Failed' 또는 'Blocked'가 있으면 -> 'Blocked' (선행 결함으로 차단)
    # 모든 엣지가 'Passed'이면 -> 'Passed'
    # 그 외 -> 'Untested'
    if len(statuses) == 0:
        new_status = "Untested"
    elif "Failed" in statuses or "Blocked" in statuses:
        new_status = "Blocked"
    elif all(s == "Passed" for s in statuses):
        new_status = "Passed"
    else:
        new_status = "Untested"

    if new_status != old_status:
        update_query = """
        MATCH (target) WHERE elementId(target) = $target_id
        SET target.test_status = $new_status
        """
        session.run(update_query, target_id=target_id, new_status=new_status)
        
        # 하류(outgoing) 노드들로 연쇄 전파
        downstream_query = """
        MATCH (target)-[r]->(downstream) WHERE elementId(target) = $target_id
        RETURN elementId(downstream) AS next_id
        """
        downstream_recs = session.run(downstream_query, target_id=target_id)
        for d in downstream_recs:
            _recalc_target_node_status(session, d["next_id"], visited=visited)

def delete_node(session, node_id: str):
    check_query = """
    MATCH (n) WHERE elementId(n) = $id
    OPTIONAL MATCH (n)-[r]-(target)
    RETURN n.is_global AS is_global, count(r) AS rel_count
    """
    check_result = session.run(check_query, id=node_id).single()
    if check_result and check_result["is_global"] == 'true' and check_result["rel_count"] > 0:
        raise ValueError(f"현재 {check_result['rel_count']}개의 노드에서 배지로 사용 중입니다. 먼저 배지 연결을 해제하세요.")

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


def get_impact_nodes(session, global_node_id: str) -> dict:
    """Return all nodes connected to a global node and their edge info.
    
    Used by the Impact Overlay feature to show which nodes are affected
    by a cross-cutting concern (e.g. language, sound settings).
    """
    query = """
    MATCH (global) WHERE elementId(global) = $id
    OPTIONAL MATCH (n)-[r]-(global)
    WHERE n <> global
    RETURN elementId(n) AS connected_id,
           n.name AS name,
           labels(n)[0] AS label,
           coalesce(n.test_status, 'Untested') AS test_status,
           type(r) AS edge_type,
           elementId(r) AS edge_id,
           coalesce(r.test_status, 'Untested') AS edge_test_status,
           CASE WHEN startNode(r) = n THEN 'outgoing' ELSE 'incoming' END AS direction
    """
    result = session.run(query, id=global_node_id)
    
    connected = []
    stats = {"Passed": 0, "Failed": 0, "Untested": 0}
    
    for record in result:
        if record["connected_id"] is None:
            continue
        node_status = record["test_status"]
        stats[node_status] = stats.get(node_status, 0) + 1
        connected.append({
            "id": record["connected_id"],
            "name": record["name"],
            "label": record["label"],
            "test_status": node_status,
            "edge_type": record["edge_type"],
            "edge_id": record["edge_id"],
            "edge_test_status": record["edge_test_status"],
            "direction": record["direction"]
        })
    
    return {
        "global_node_id": global_node_id,
        "connected_nodes": connected,
        "total": len(connected),
        "stats": stats
    }

def delete_alias(session, alias_name: str):
    """Delete an alias from all nodes that contain it."""
    query = """
    MATCH (n) WHERE $alias_name IN n.aliases
    SET n.aliases = [a IN n.aliases WHERE a <> $alias_name]
    """
    session.run(query, alias_name=alias_name)

def rename_alias(session, old_alias: str, new_alias: str):
    """Rename an alias across all nodes."""
    query = """
    MATCH (n) WHERE $old_alias IN n.aliases
    // Only add new_alias if it doesn't already exist in the remaining list to prevent duplicates
    SET n.aliases = CASE
        WHEN $new_alias IN [a IN n.aliases WHERE a <> $old_alias] THEN [a IN n.aliases WHERE a <> $old_alias]
        ELSE [a IN n.aliases WHERE a <> $old_alias] + $new_alias
    END
    """
    session.run(query, old_alias=old_alias, new_alias=new_alias)


# ─── QA Copilot Service Functions (Phase 1) ─────────────────────────

def get_node_status_summary(session, query_str: str) -> Optional[NodeStatusSummary]:
    """
    특정 노드의 상태, 수동 오버라이드 여부, 비고, 들어오는 엣지 분포,
    그리고 차단(Blocked) 상태일 경우의 최초 원인(Root Cause)을 상세 분석하여 반환합니다.
    """
    find_query = """
    MATCH (n)
    WHERE elementId(n) = $q OR toLower(n.name) = toLower($q) OR toLower(n.name) CONTAINS toLower($q)
    RETURN elementId(n) AS id, labels(n)[0] AS label, n.name AS name,
           coalesce(n.test_status, 'Untested') AS test_status,
           coalesce(n.is_manual_override, false) AS is_manual_override,
           n.override_reason AS override_reason,
           n.description AS description,
           n.issue_link AS issue_link
    LIMIT 1
    """
    rec = session.run(find_query, q=query_str.strip()).single()
    if not rec:
        return None
    
    node_id = rec["id"]
    test_status = rec["test_status"]
    
    # 들어오는 엣지 분포 집계
    incoming_query = """
    MATCH (src)-[r]->(n) WHERE elementId(n) = $id
    RETURN coalesce(r.test_status, 'Untested') AS status, count(r) AS count
    """
    in_recs = session.run(incoming_query, id=node_id)
    incoming_statuses = {r["status"]: r["count"] for r in in_recs}
    
    root_cause_info = None
    if test_status in ["Blocked", "Failed"]:
        # 역방향으로 Failed/Blocked 원인 추적
        trace_query = """
        MATCH p = (origin)-[r*1..10]->(n)
        WHERE elementId(n) = $id AND origin.test_status = 'Failed'
        RETURN elementId(origin) AS origin_id, origin.name AS origin_name,
               [node IN nodes(p) | node.name] AS path_names
        LIMIT 1
        """
        trace_rec = session.run(trace_query, id=node_id).single()
        if trace_rec:
            root_cause_info = RootCauseInfo(
                origin_node_id=trace_rec["origin_id"],
                origin_node_name=trace_rec["origin_name"],
                reason=f"선행 노드 '{trace_rec['origin_name']}'에서 결함(Failed) 발생",
                path=trace_rec["path_names"]
            )
            
    is_override_bool = bool(rec["is_manual_override"] in [True, "true", "True"])
    
    return NodeStatusSummary(
        id=node_id,
        name=rec["name"],
        label=rec["label"],
        test_status=test_status,
        is_manual_override=is_override_bool,
        override_reason=rec["override_reason"],
        description=rec["description"],
        issue_link=rec["issue_link"],
        root_cause=root_cause_info,
        incoming_statuses=incoming_statuses
    )


def get_impact_scope(session, query_str: str) -> Optional[ImpactScopeResponse]:
    """
    특정 기능/노드가 변경되었을 때, 하류(downstream) 방향으로 영향을 받는 모든 노드와 엣지를 NetworkX로 추출하여
    회귀 테스트(Regression Test) 추천 범위를 산출합니다.
    """
    # 1. 대상 노드 찾기
    find_query = """
    MATCH (n)
    WHERE elementId(n) = $q OR toLower(n.name) = toLower($q) OR toLower(n.name) CONTAINS toLower($q)
    RETURN elementId(n) AS id, n.name AS name
    LIMIT 1
    """
    start_rec = session.run(find_query, q=query_str.strip()).single()
    if not start_rec:
        return None
    
    start_id = start_rec["id"]
    start_name = start_rec["name"]
    
    # 2. 전체 그래프 NetworkX로 로드
    G = fetch_graph_from_neo4j(session)
    if start_id not in G:
        return ImpactScopeResponse(
            changed_node_id=start_id,
            changed_node_name=start_name,
            impacted_nodes=[],
            impacted_edges=[],
            total_impacted_nodes=0,
            recommended_regression_scope=[]
        )
    
    # 3. 하류 도달 가능한 노드들 (descendants)
    descendants = nx.descendants(G, start_id)
    impacted_node_ids = set(descendants)
    
    impacted_nodes = []
    recommended_scope = []
    
    for nid in impacted_node_ids:
        ndata = G.nodes[nid]
        lbl = ndata.get("label", "Node")
        nname = ndata.get("name", nid)
        status = ndata.get("test_status", "Untested")
        impacted_nodes.append({
            "id": nid,
            "name": nname,
            "label": lbl,
            "test_status": status
        })
        if lbl in ["Screen", "Feature", "TestCase"]:
            recommended_scope.append(f"[{lbl}] {nname}")
            
    # 도달 가능한 서브그래프의 엣지들
    impacted_edges = []
    all_sub_nodes = impacted_node_ids | {start_id}
    for u, v, k, edata in G.edges(data=True, keys=True):
        if u in all_sub_nodes and v in all_sub_nodes:
            impacted_edges.append({
                "id": edata.get("id", k),
                "source": u,
                "target": v,
                "type": edata.get("type", "RELATED")
            })
            
    return ImpactScopeResponse(
        changed_node_id=start_id,
        changed_node_name=start_name,
        impacted_nodes=impacted_nodes,
        impacted_edges=impacted_edges,
        total_impacted_nodes=len(impacted_nodes),
        recommended_regression_scope=recommended_scope
    )


def audit_cross_cutting(session, aspect: str) -> CrossCuttingAuditResponse:
    """
    다국어(i18n), 화면비(Aspect Ratio), 사운드 등 전체 UI 전반에 걸친 횡단 관심사(Cross-cutting Concerns)가
    각 Screen/Feature에 누락 없이 매핑되어 있는지 전수 감사(Audit)하여 사각지대(Gap)를 찾아냅니다.
    """
    aspect_lower = aspect.lower().strip()
    
    # 1. 감사의 대상이 되는 비-글로벌 노드들 (Screen, Feature, TestCase 등)
    nodes_query = """
    MATCH (n)
    WHERE coalesce(n.is_global, 'false') <> 'true'
    RETURN elementId(n) AS id, labels(n)[0] AS label, n.name AS name, n.aliases AS aliases
    """
    records = list(session.run(nodes_query))
    
    # 2. aspect 키워드와 매칭되는 글로벌 노드 ID들 조회
    global_query = """
    MATCH (g)
    WHERE g.is_global = 'true'
    RETURN elementId(g) AS id, g.name AS name, g.aliases AS aliases
    """
    global_recs = list(session.run(global_query))
    matched_global_ids = set()
    for g in global_recs:
        g_name = (g["name"] or "").lower()
        g_aliases = [str(a).lower() for a in (g["aliases"] or [])]
        if aspect_lower in g_name or any(aspect_lower in a for a in g_aliases):
            matched_global_ids.add(g["id"])
            
    # 3. 글로벌 뱃지와 노드 간의 연결(Edge) 조회
    connected_to_matched_globals = set()
    if matched_global_ids:
        edge_query = """
        MATCH (n)-[r]-(g)
        WHERE elementId(g) IN $g_ids
        RETURN DISTINCT elementId(n) AS target_id
        """
        for r in session.run(edge_query, g_ids=list(matched_global_ids)):
            connected_to_matched_globals.add(r["target_id"])
            
    covered_nodes = []
    missing_nodes = []
    
    for r in records:
        nid = r["id"]
        nname = r["name"]
        nlabel = r["label"]
        naliases = [str(a).lower() for a in (r["aliases"] or [])]
        
        # 判定: 1) alias/name에 aspect 포함 또는 2) matched global 노드와 연결됨
        has_aspect_in_alias = any(aspect_lower in a for a in naliases) or (aspect_lower in nname.lower())
        is_connected_to_global = nid in connected_to_matched_globals
        
        node_info = {"id": nid, "name": nname, "label": nlabel}
        if has_aspect_in_alias or is_connected_to_global:
            covered_nodes.append(node_info)
        else:
            missing_nodes.append(node_info)
            
    total = len(records)
    rate = (len(covered_nodes) / total * 100) if total > 0 else 0.0
    
    if len(missing_nodes) == 0:
        gap_summary = f"전체 {total}개 화면/기능 노드 모두에 '{aspect}' 대응이 완벽히 매핑되어 있습니다. (커버리지 100%)"
    else:
        missing_names = ", ".join([f"[{n['label']}] {n['name']}" for n in missing_nodes[:5]])
        if len(missing_nodes) > 5:
            missing_names += f" 외 {len(missing_nodes) - 5}개"
        gap_summary = f"전체 {total}개 중 {len(covered_nodes)}개 적용 완료 ({rate:.1f}%), {len(missing_nodes)}개 누락: {missing_names}"
        
    return CrossCuttingAuditResponse(
        aspect_queried=aspect,
        total_screens_features=total,
        covered_nodes=covered_nodes,
        missing_nodes=missing_nodes,
        coverage_rate=round(rate, 1),
        gap_summary=gap_summary
    )


def get_next_test_targets(session) -> List[NextTestTarget]:
    """
    선행 조건(Incoming Edges)이 모두 Passed되어 지금 즉시 검증을 시작할 수 있는 Untested 노드들을 찾아 추천합니다.
    """
    query = """
    MATCH (n)
    WHERE coalesce(n.is_global, 'false') <> 'true'
      AND coalesce(n.test_status, 'Untested') = 'Untested'
    OPTIONAL MATCH (src)-[r]->(n)
    WITH n, collect(CASE WHEN r IS NOT NULL THEN {status: coalesce(r.test_status, 'Untested'), src_name: coalesce(src.name, elementId(src))} END) AS incoming_edges
    RETURN elementId(n) AS id, labels(n)[0] AS label, n.name AS name,
           [edge IN incoming_edges WHERE edge IS NOT NULL] AS clean_edges
    """
    records = list(session.run(query))
    targets = []
    
    for r in records:
        clean_edges = r["clean_edges"]
        
        # 선행 조건 충족 여부:
        # 1) 들어오는 엣지가 없거나(진입점 노드)
        # 2) 들어오는 모든 엣지가 'Passed'인 경우
        if len(clean_edges) == 0:
            met = True
            reasons = ["진입점 노드 (선행 의존성 없음, 즉시 테스트 가능)"]
        elif all(e["status"] == "Passed" for e in clean_edges):
            met = True
            reasons = [f"모든 선행 조건({len(clean_edges)}개) 검증 완료(Passed)"]
        else:
            met = False
            unmet = [f"선행 '{e['src_name']}' 상태: {e['status']}" for e in clean_edges if e["status"] != "Passed"]
            reasons = unmet
            
        targets.append(NextTestTarget(
            id=r["id"],
            name=r["name"],
            label=r["label"],
            incoming_requirements_met=met,
            untested_reasons=reasons
        ))
        
    # 선행 조건 충족된 노드를 우선 정렬
    targets.sort(key=lambda t: (not t.incoming_requirements_met, t.name))
    return targets



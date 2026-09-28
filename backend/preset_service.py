import os
import json
import datetime
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from graph_service import fetch_graph_from_neo4j, convert_to_response

PRESETS_DIR = os.path.join(os.path.dirname(__file__), "presets")

def ensure_presets_dir():
    if not os.path.exists(PRESETS_DIR):
        os.makedirs(PRESETS_DIR, exist_ok=True)

def list_presets() -> List[Dict[str, Any]]:
    """List all available presets with metadata."""
    ensure_presets_dir()
    presets = []
    
    for filename in sorted(os.listdir(PRESETS_DIR)):
        if filename.endswith(".json"):
            filepath = os.path.join(PRESETS_DIR, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    presets.append({
                        "id": data.get("id", os.path.splitext(filename)[0]),
                        "name": data.get("name", filename),
                        "description": data.get("description", ""),
                        "created_at": data.get("created_at", ""),
                        "node_count": len(data.get("nodes", [])),
                        "edge_count": len(data.get("edges", []))
                    })
            except Exception as e:
                print(f"Error reading preset file {filename}: {e}")
                
    return presets

def get_preset(preset_id: str) -> Dict[str, Any]:
    """Retrieve the full content of a specific preset."""
    ensure_presets_dir()
    filepath = os.path.join(PRESETS_DIR, f"{preset_id}.json")
    if not os.path.exists(filepath):
        # Check without .json in case it was included
        filepath = os.path.join(PRESETS_DIR, preset_id)
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail=f"Preset '{preset_id}' not found.")
            
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read preset: {str(e)}")

def load_preset_to_neo4j(session, preset_id: str, clean: bool = True) -> Dict[str, Any]:
    """Load a preset into Neo4j, either replacing (clean) or merging."""
    preset_data = get_preset(preset_id)
    nodes = preset_data.get("nodes", [])
    edges = preset_data.get("edges", [])
    
    if clean:
        session.run("MATCH (n) DETACH DELETE n")
        
    id_to_elem_id = {}
    
    # 1. Create Nodes
    for n in nodes:
        label = n.get("label", "Node")
        n_id = n.get("id")
        name = n.get("name", n_id)
        aliases = n.get("aliases", [])
        description = n.get("description", "")
        test_status = n.get("test_status", "Untested")
        props = n.get("properties", {})
        
        # Safe cypher creation
        query = f"""
        CREATE (n:`{label}`)
        SET n.id = $id,
            n.name = $name,
            n.aliases = $aliases,
            n.description = $description,
            n.test_status = $test_status,
            n += $props
        RETURN elementId(n) AS elem_id
        """
        res = session.run(query, id=n_id, name=name, aliases=aliases, description=description, test_status=test_status, props=props)
        record = res.single()
        if record:
            elem_id = record["elem_id"]
            id_to_elem_id[n_id] = elem_id
            id_to_elem_id[elem_id] = elem_id
            
    # 2. Create Edges
    created_edges_count = 0
    for e in edges:
        source_key = e.get("source")
        target_key = e.get("target")
        e_type = e.get("type", "Depends_On")
        action = e.get("action", "")
        test_status = e.get("test_status", "Untested")
        props = e.get("properties", {})
        
        source_elem = id_to_elem_id.get(source_key)
        target_elem = id_to_elem_id.get(target_key)
        
        if source_elem and target_elem:
            edge_query = f"""
            MATCH (s), (t)
            WHERE elementId(s) = $s_id AND elementId(t) = $t_id
            CREATE (s)-[r:`{e_type}`]->(t)
            SET r.action = $action,
                r.test_status = $test_status,
                r += $props
            RETURN elementId(r) AS elem_id
            """
            res = session.run(edge_query, s_id=source_elem, t_id=target_elem, action=action, test_status=test_status, props=props)
            if res.single():
                created_edges_count += 1
        else:
            # Fallback lookup by id property if nodes were already existing in DB
            edge_query = f"""
            MATCH (s {id: $source_key}), (t {id: $target_key})
            CREATE (s)-[r:`{e_type}`]->(t)
            SET r.action = $action,
                r.test_status = $test_status,
                r += $props
            RETURN elementId(r) AS elem_id
            """
            res = session.run(edge_query, source_key=source_key, target_key=target_key, action=action, test_status=test_status, props=props)
            if res.single():
                created_edges_count += 1

    return {
        "status": "success",
        "preset_id": preset_id,
        "nodes_created": len(nodes),
        "edges_created": created_edges_count,
        "clean_mode": clean
    }

def save_current_graph_as_preset(session, preset_id: str, name: str, description: str) -> Dict[str, Any]:
    """Export the active Neo4j graph into a new preset JSON file."""
    ensure_presets_dir()
    
    # Sanitize preset_id
    safe_id = "".join([c if c.isalnum() or c in ("-", "_") else "_" for c in preset_id.strip()]).lower()
    if not safe_id:
        safe_id = f"preset_{int(datetime.datetime.now().timestamp())}"
        
    full_graph = fetch_graph_from_neo4j(session)
    response_data = convert_to_response(full_graph)
    
    nodes_export = []
    for n in response_data.nodes:
        nodes_export.append({
            "id": n.properties.get("id") or n.id,
            "label": n.label,
            "name": n.name,
            "aliases": n.aliases,
            "description": n.properties.get("description", ""),
            "test_status": n.test_status,
            "properties": {k: v for k, v in n.properties.items() if k not in ("id", "name", "aliases", "test_status", "description")}
        })
        
    edges_export = []
    for e in response_data.edges:
        edges_export.append({
            "source": e.source,
            "target": e.target,
            "type": e.type,
            "action": e.action,
            "test_status": e.test_status,
            "properties": e.properties
        })
        
    preset_data = {
        "id": safe_id,
        "name": name.strip() or safe_id,
        "description": description.strip(),
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "nodes": nodes_export,
        "edges": edges_export
    }
    
    filepath = os.path.join(PRESETS_DIR, f"{safe_id}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(preset_data, f, ensure_ascii=False, indent=2)
        
    return {
        "status": "success",
        "preset_id": safe_id,
        "name": preset_data["name"],
        "node_count": len(nodes_export),
        "edge_count": len(edges_export)
    }

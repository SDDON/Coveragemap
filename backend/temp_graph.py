with open('graph_service.py', 'a', encoding='utf-8') as f:
    f.write('''

from models import SyncPayload

def process_sync_operations(session, payload: SyncPayload):
    id_map = {} # maps temp_id to real_id
    
    for op in payload.operations:
        if op.type == "node":
            if op.action == "create":
                node_data = NodeCreate(**op.data)
                real_id = create_node(session, node_data)
                if op.temp_id:
                    id_map[op.temp_id] = real_id
            elif op.action == "update":
                real_id = id_map.get(op.id, op.id)
                node_data = NodeUpdate(**op.data)
                update_node(session, real_id, node_data)
            elif op.action == "delete":
                real_id = id_map.get(op.id, op.id)
                delete_node(session, real_id)
        elif op.type == "edge":
            if op.action == "create":
                op.data["source"] = id_map.get(op.data.get("source"), op.data.get("source"))
                op.data["target"] = id_map.get(op.data.get("target"), op.data.get("target"))
                
                edge_data = EdgeCreate(**op.data)
                real_id = create_edge(session, edge_data)
                if op.temp_id:
                    id_map[op.temp_id] = real_id
            elif op.action == "update":
                real_id = id_map.get(op.id, op.id)
                edge_data = EdgeUpdate(**op.data)
                update_edge(session, real_id, edge_data)
            elif op.action == "delete":
                real_id = id_map.get(op.id, op.id)
                delete_edge(session, real_id)
''')

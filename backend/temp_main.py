with open('main.py', 'a', encoding='utf-8') as f:
    f.write('''

from models import SyncPayload
from graph_service import process_sync_operations

@app.post("/api/sync")
def api_sync(payload: SyncPayload, session = Depends(get_db)):
    try:
        process_sync_operations(session, payload)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
''')

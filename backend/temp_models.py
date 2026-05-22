with open('models.py', 'a', encoding='utf-8') as f:
    f.write('''

class SyncOperation(BaseModel):
    type: Literal["node", "edge"]
    action: Literal["create", "update", "delete"]
    id: Optional[str] = None
    temp_id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

class SyncPayload(BaseModel):
    operations: List[SyncOperation]
''')

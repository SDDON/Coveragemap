from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class NodeModel(BaseModel):
    id: str
    label: str
    name: str
    aliases: List[str] = Field(default_factory=list)
    properties: Dict[str, Any] = Field(default_factory=dict)

class EdgeModel(BaseModel):
    source: str
    target: str
    type: str
    properties: Dict[str, Any] = Field(default_factory=dict)

class GraphResponse(BaseModel):
    nodes: List[NodeModel]
    edges: List[EdgeModel]
    debounce_id: Optional[str] = None

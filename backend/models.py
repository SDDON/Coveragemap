from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal

class NodeModel(BaseModel):
    id: str
    label: str
    name: str
    aliases: List[str] = Field(default_factory=list)
    properties: Dict[str, Any] = Field(default_factory=dict)
    test_status: Literal["Untested", "Passed", "Failed"] = "Untested"

class EdgeModel(BaseModel):
    id: str
    source: str
    target: str
    type: str
    properties: Dict[str, Any] = Field(default_factory=dict)
    test_status: Literal["Untested", "Passed", "Failed"] = "Untested"

class NodeCreate(BaseModel):
    label: str = Field(..., pattern=r"^[A-Za-z0-9_]+$")
    name: str
    aliases: List[str] = Field(default_factory=list)
    properties: Dict[str, Any] = Field(default_factory=dict)
    test_status: Literal["Untested", "Passed", "Failed"] = "Untested"

class NodeUpdate(BaseModel):
    name: Optional[str] = None
    aliases: Optional[List[str]] = None
    properties: Optional[Dict[str, Any]] = None
    test_status: Optional[Literal["Untested", "Passed", "Failed"]] = None

class EdgeCreate(BaseModel):
    source: str
    target: str
    type: str = Field(..., pattern=r"^[A-Za-z0-9_]+$")
    properties: Dict[str, Any] = Field(default_factory=dict)
    test_status: Literal["Untested", "Passed", "Failed"] = "Untested"

class EdgeUpdate(BaseModel):
    properties: Optional[Dict[str, Any]] = None
    test_status: Optional[Literal["Untested", "Passed", "Failed"]] = None

class GraphResponse(BaseModel):
    nodes: List[NodeModel]
    edges: List[EdgeModel]
    debounce_id: Optional[str] = None

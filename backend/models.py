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
    action: Optional[str] = None
    properties: Dict[str, Any] = Field(default_factory=dict)
    test_status: Literal["Untested", "Passed", "Failed"] = "Untested"

class NodeCreate(BaseModel):
    label: str = Field(..., pattern=r"^.*$")
    name: str
    aliases: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    issue_link: Optional[str] = None
    properties: Dict[str, Any] = Field(default_factory=dict)
    test_status: Literal["Untested", "Passed", "Failed"] = "Untested"

class NodeUpdate(BaseModel):
    label: Optional[str] = None
    name: Optional[str] = None
    aliases: Optional[List[str]] = None
    description: Optional[str] = None
    issue_link: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None
    test_status: Optional[Literal["Untested", "Passed", "Failed"]] = None

class EdgeCreate(BaseModel):
    source: str
    target: str
    type: str = Field(..., pattern=r"^.*$")
    action: Optional[str] = None
    properties: Dict[str, Any] = Field(default_factory=dict)
    test_status: Literal["Untested", "Passed", "Failed"] = "Untested"

class EdgeUpdate(BaseModel):
    type: Optional[str] = None
    action: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None
    test_status: Optional[Literal["Untested", "Passed", "Failed"]] = None

class GraphResponse(BaseModel):
    nodes: List[NodeModel]
    edges: List[EdgeModel]
    debounce_id: Optional[str] = None

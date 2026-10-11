from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal

TestStatus = Literal["Untested", "Passed", "Failed", "Blocked"]

# Cypher의 라벨/관계 타입은 쿼리 파라미터로 바인딩할 수 없어 문자열로 삽입됩니다.
# 백틱(`) 탈출에 의한 Cypher 인젝션을 막기 위해 허용 문자를 영문/한글/숫자/밑줄로 제한합니다.
IDENTIFIER_PATTERN = r"^[A-Za-z가-힣_][A-Za-z0-9가-힣_]{0,63}$"

class NodeModel(BaseModel):
    id: str
    label: str
    name: str
    aliases: List[str] = Field(default_factory=list)
    properties: Dict[str, Any] = Field(default_factory=dict)
    test_status: TestStatus = "Untested"
    is_manual_override: Optional[bool] = None
    override_reason: Optional[str] = None

class EdgeModel(BaseModel):
    id: str
    source: str
    target: str
    type: str
    action: Optional[str] = None
    properties: Dict[str, Any] = Field(default_factory=dict)
    test_status: TestStatus = "Untested"

class NodeCreate(BaseModel):
    label: str = Field(..., pattern=IDENTIFIER_PATTERN)
    name: str
    aliases: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    issue_link: Optional[str] = None
    properties: Dict[str, Any] = Field(default_factory=dict)
    test_status: TestStatus = "Untested"
    is_manual_override: Optional[bool] = None
    override_reason: Optional[str] = None

class NodeUpdate(BaseModel):
    label: Optional[str] = Field(None, pattern=IDENTIFIER_PATTERN)
    name: Optional[str] = None
    aliases: Optional[List[str]] = None
    description: Optional[str] = None
    issue_link: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None
    test_status: Optional[TestStatus] = None
    is_manual_override: Optional[bool] = None
    override_reason: Optional[str] = None

class EdgeCreate(BaseModel):
    source: str
    target: str
    type: str = Field(..., pattern=IDENTIFIER_PATTERN)
    action: Optional[str] = None
    properties: Dict[str, Any] = Field(default_factory=dict)
    test_status: TestStatus = "Untested"

class EdgeUpdate(BaseModel):
    type: Optional[str] = Field(None, pattern=IDENTIFIER_PATTERN)
    action: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None
    test_status: Optional[TestStatus] = None

class GraphResponse(BaseModel):
    nodes: List[NodeModel]
    edges: List[EdgeModel]
    debounce_id: Optional[str] = None

class PresetCreate(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""

# Change Impact Ripple Highlight: 노드 수정 표시 요청 (TESTCASE 스펙 7.4)
class ModifiedMark(BaseModel):
    note: Optional[str] = ""

# ─── QA Copilot Response Models ────────────────────────────────────

class RootCauseInfo(BaseModel):
    origin_node_id: str
    origin_node_name: str
    reason: str
    path: List[str]

class NodeStatusSummary(BaseModel):
    id: str
    name: str
    label: str
    test_status: TestStatus
    is_manual_override: bool = False
    override_reason: Optional[str] = None
    description: Optional[str] = None
    issue_link: Optional[str] = None
    root_cause: Optional[RootCauseInfo] = None
    incoming_statuses: Dict[str, int] = Field(default_factory=dict)

class ImpactScopeResponse(BaseModel):
    changed_node_id: str
    changed_node_name: str
    impacted_nodes: List[Dict[str, Any]]
    impacted_edges: List[Dict[str, Any]]
    total_impacted_nodes: int
    recommended_regression_scope: List[str]

class CrossCuttingAuditResponse(BaseModel):
    aspect_queried: str
    total_screens_features: int
    covered_nodes: List[Dict[str, Any]]
    missing_nodes: List[Dict[str, Any]]
    coverage_rate: float
    gap_summary: str

class NextTestTarget(BaseModel):
    id: str
    name: str
    label: str
    incoming_requirements_met: bool
    untested_reasons: List[str]

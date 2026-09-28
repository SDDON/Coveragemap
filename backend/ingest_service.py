import csv
import io
import json
import re
import os
from typing import Dict, Any, List, Optional
from fastapi import HTTPException
from graph_service import _normalize_aliases, _recalc_target_node_status

def parse_spreadsheet_to_graph(csv_text: str) -> Dict[str, Any]:
    """
    CSV 형식의 테스트 명세서를 파싱하여 CoverageMap의 노드 및 엣지 구조로 변환합니다.
    
    지원 헤더:
    - Screen (대분류/화면)
    - Feature (중분류/기능)
    - TestCase (소분류/검증항목)
    - Prerequisite (선행조건 기능 또는 TC 이름)
    - CrossCutting (쉼표 구분 횡단속성 예: 다국어, 21:9)
    - Description (기능/검증 설명)
    """
    reader = csv.DictReader(io.StringIO(csv_text.strip()))
    
    nodes_map: Dict[str, Dict[str, Any]] = {}
    edges_list: List[Dict[str, Any]] = []
    
    # 헤더 정규화 매핑
    field_map = {}
    if reader.fieldnames:
        for f in reader.fieldnames:
            f_clean = f.strip().lower()
            if "screen" in f_clean or "화면" in f_clean:
                field_map["screen"] = f
            elif "feature" in f_clean or "기능" in f_clean:
                field_map["feature"] = f
            elif "testcase" in f_clean or "tc" in f_clean or "테스트" in f_clean or "시나리오" in f_clean:
                field_map["testcase"] = f
            elif "prereq" in f_clean or "선행" in f_clean or "선수" in f_clean:
                field_map["prerequisite"] = f
            elif "cross" in f_clean or "횡단" in f_clean or "속성" in f_clean or "badge" in f_clean:
                field_map["crosscutting"] = f
            elif "desc" in f_clean or "설명" in f_clean or "비고" in f_clean:
                field_map["description"] = f
                
    row_idx = 0
    for row in reader:
        row_idx += 1
        screen_val = (row.get(field_map.get("screen", "")) or "").strip()
        feature_val = (row.get(field_map.get("feature", "")) or "").strip()
        tc_val = (row.get(field_map.get("testcase", "")) or "").strip()
        prereq_val = (row.get(field_map.get("prerequisite", "")) or "").strip()
        cross_val = (row.get(field_map.get("crosscutting", "")) or "").strip()
        desc_val = (row.get(field_map.get("description", "")) or "").strip()
        
        # 1. Screen 노드 등록
        screen_id = None
        if screen_val:
            screen_id = f"screen_{re.sub(r'[^a-zA-Z0-9가-힣]', '_', screen_val)}"
            if screen_id not in nodes_map:
                nodes_map[screen_id] = {
                    "id": screen_id,
                    "label": "Screen",
                    "name": screen_val,
                    "aliases": ["Screen"],
                    "description": f"{screen_val} 화면",
                    "test_status": "Untested",
                    "properties": {}
                }
                
        # 2. Feature 노드 등록
        feature_id = None
        if feature_val:
            feature_id = f"feat_{re.sub(r'[^a-zA-Z0-9가-힣]', '_', feature_val)}"
            if feature_id not in nodes_map:
                aliases = ["Feature"]
                if cross_val:
                    aliases.extend([c.strip() for c in cross_val.split(",") if c.strip()])
                nodes_map[feature_id] = {
                    "id": feature_id,
                    "label": "Feature",
                    "name": feature_val,
                    "aliases": _normalize_aliases(aliases),
                    "description": desc_val if not tc_val else f"{feature_val} 기능",
                    "test_status": "Untested",
                    "properties": {}
                }
            # Screen -> Feature 의존성 연결
            if screen_id:
                edges_list.append({
                    "source": screen_id,
                    "target": feature_id,
                    "type": "Contains",
                    "action": "포함",
                    "test_status": "Untested"
                })
                
        # 3. TestCase 노드 등록
        if tc_val:
            tc_id = f"tc_{row_idx}_{re.sub(r'[^a-zA-Z0-9가-힣]', '_', tc_val[:15])}"
            nodes_map[tc_id] = {
                "id": tc_id,
                "label": "TestCase",
                "name": tc_val,
                "aliases": ["TestCase"],
                "description": desc_val or tc_val,
                "test_status": "Untested",
                "properties": {}
            }
            # Feature -> TestCase 연결
            parent_target = feature_id or screen_id
            if parent_target:
                edges_list.append({
                    "source": tc_id,
                    "target": parent_target,
                    "type": "Tests",
                    "action": "검증",
                    "test_status": "Untested"
                })
                
        # 4. Prerequisite(선행조건) 연결
        if prereq_val and (feature_id or screen_id):
            target_node = feature_id or screen_id
            # 기존 노드 중 이름 일치 검색
            matched_prereq_id = None
            for nid, ndata in nodes_map.items():
                if ndata["name"].lower() == prereq_val.lower():
                    matched_prereq_id = nid
                    break
            if not matched_prereq_id:
                # 없으면 임시 노드로 생성
                matched_prereq_id = f"prereq_{re.sub(r'[^a-zA-Z0-9가-힣]', '_', prereq_val)}"
                nodes_map[matched_prereq_id] = {
                    "id": matched_prereq_id,
                    "label": "Feature",
                    "name": prereq_val,
                    "aliases": ["Prerequisite"],
                    "description": f"선행 조건: {prereq_val}",
                    "test_status": "Untested",
                    "properties": {}
                }
            edges_list.append({
                "source": matched_prereq_id,
                "target": target_node,
                "type": "Depends_On",
                "action": "선수 조건",
                "test_status": "Untested"
            })
            
    # 중복 엣지 제거
    unique_edges = []
    seen_edge_keys = set()
    for e in edges_list:
        key = f"{e['source']}->{e['target']}::{e['type']}"
        if key not in seen_edge_keys:
            seen_edge_keys.add(key)
            unique_edges.append(e)
            
    return {
        "nodes": list(nodes_map.values()),
        "edges": unique_edges
    }


def parse_spec_text_to_graph(spec_text: str, api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    기획서/기능 명세서 텍스트를 구조화하여 Screen, Feature, TestCase, Edges로 자동 변환합니다.
    - 사용자가 API 키를 설정한 경우(또는 시스템 GEMINI_API_KEY 환경변수 설정 시):
      Google Gemini LLM을 호출하여 자연어 비정형 기획서를 고품질 그래프로 정밀 분석합니다.
    - API 키가 없거나 비어있는 경우:
      100% 로컬 인하우스 규칙 기반 휴리스틱 파서로 안전하게 동작합니다.
    """
    key = (api_key or os.getenv("GEMINI_API_KEY") or "").strip()
    if key:
        try:
            return _parse_with_gemini(spec_text, key)
        except Exception as e:
            print(f"[WARN] Gemini API spec parsing failed ({e}), falling back to heuristic parser.")
            
    return _parse_with_heuristics(spec_text)


def _parse_with_heuristics(text: str) -> Dict[str, Any]:
    """
    마크다운 제목(#, ##, ###), 글머리 기호(-, *), 번호 목록 등을 분석하여
    Screen -> Feature -> TestCase 계층 및 화면 전이 엣지를 추출하는 휴리스틱 파서입니다.
    """
    lines = text.strip().splitlines()
    nodes_map: Dict[str, Dict[str, Any]] = {}
    edges_list: List[Dict[str, Any]] = []
    
    current_screen_id = None
    current_feature_id = None
    node_counter = 0
    
    for line in lines:
        line_str = line.strip()
        if not line_str:
            continue
            
        # 1. H1 (# ) or Screen 키워드 -> Screen 노드
        if line_str.startswith("# ") or re.match(r"^(화면|Screen|씬|Scene)\s*[:：\-]\s*", line_str, re.IGNORECASE):
            node_counter += 1
            clean_title = re.sub(r"^(#\s*|(화면|Screen|씬|Scene)\s*[:：\-]\s*)", "", line_str, flags=re.IGNORECASE).strip()
            sid = f"screen_{node_counter}_{re.sub(r'[^a-zA-Z0-9가-힣]', '_', clean_title[:15])}"
            current_screen_id = sid
            current_feature_id = None
            nodes_map[sid] = {
                "id": sid,
                "label": "Screen",
                "name": clean_title,
                "aliases": ["Screen"],
                "description": f"{clean_title} 화면",
                "test_status": "Untested",
                "properties": {}
            }
            
        # 2. H2 (## ) or Feature 키워드 -> Feature 노드
        elif line_str.startswith("## ") or re.match(r"^(기능|Feature|시스템|버튼)\s*[:：\-]\s*", line_str, re.IGNORECASE):
            node_counter += 1
            clean_title = re.sub(r"^(##\s*|(기능|Feature|시스템|버튼)\s*[:：\-]\s*)", "", line_str, flags=re.IGNORECASE).strip()
            fid = f"feat_{node_counter}_{re.sub(r'[^a-zA-Z0-9가-힣]', '_', clean_title[:15])}"
            current_feature_id = fid
            nodes_map[fid] = {
                "id": fid,
                "label": "Feature",
                "name": clean_title,
                "aliases": ["Feature"],
                "description": f"{clean_title} 기능",
                "test_status": "Untested",
                "properties": {}
            }
            # Screen이 있으면 연결
            if current_screen_id:
                edges_list.append({
                    "source": current_screen_id,
                    "target": fid,
                    "type": "Contains",
                    "action": "포함",
                    "test_status": "Untested"
                })
                
        # 3. H3 (### ), 글머리 기호(-, *), 번호 목록 (1., 2.) -> TestCase 또는 Feature 하위
        elif line_str.startswith("### ") or re.match(r"^(\-|\*|\d+\.)\s+", line_str):
            node_counter += 1
            clean_text = re.sub(r"^(###\s*|(\-|\*|\d+\.)\s+)", "", line_str).strip()
            
            # 횡단 관심사 키워드 감지 (다국어, 사운드, 해상도 등)
            cross_aliases = ["TestCase"]
            for kw in ["다국어", "i18n", "화면비", "해상도", "사운드", "네트워크", "재화"]:
                if kw in clean_text:
                    cross_aliases.append(kw)
                    
            tcid = f"tc_{node_counter}_{re.sub(r'[^a-zA-Z0-9가-힣]', '_', clean_text[:15])}"
            nodes_map[tcid] = {
                "id": tcid,
                "label": "TestCase",
                "name": clean_text,
                "aliases": _normalize_aliases(cross_aliases),
                "description": clean_text,
                "test_status": "Untested",
                "properties": {}
            }
            parent_id = current_feature_id or current_screen_id
            if parent_id:
                edges_list.append({
                    "source": tcid,
                    "target": parent_id,
                    "type": "Tests",
                    "action": "검증",
                    "test_status": "Untested"
                })
        else:
            # 일반 텍스트 라인: 만약 아직 Screen이 없다면 첫 Screen으로 생성
            if not current_screen_id and len(line_str) < 30:
                node_counter += 1
                sid = f"screen_{node_counter}_{re.sub(r'[^a-zA-Z0-9가-힣]', '_', line_str[:15])}"
                current_screen_id = sid
                nodes_map[sid] = {
                    "id": sid,
                    "label": "Screen",
                    "name": line_str,
                    "aliases": ["Screen"],
                    "description": line_str,
                    "test_status": "Untested",
                    "properties": {}
                }
                
    # 만약 노드가 하나도 생성되지 않았을 때 폴백
    if not nodes_map:
        nodes_map["screen_sample"] = {
            "id": "screen_sample",
            "label": "Screen",
            "name": "신규 게임 기능 컨테이너",
            "aliases": ["Screen"],
            "description": text[:100],
            "test_status": "Untested",
            "properties": {}
        }
        
    return {
        "nodes": list(nodes_map.values()),
        "edges": edges_list
    }


def _parse_with_gemini(spec_text: str, api_key: str) -> Dict[str, Any]:
    """Gemini API를 사용하여 비정형 기획서에서 고품질 그래프 구조를 추출합니다."""
    import httpx
    
    prompt = f"""
당신은 모바일 게임 전문 QA 리드이자 그래프 모델링 아키텍트입니다.
제공된 게임 기능 기획서를 분석하여 CoverageMap 그래프 규격의 JSON을 작성해주세요.

[추출 규칙]
1. Screen: 최상위 UI 화면이나 팝업 컨테이너 (예: '가차 메인 화면', '소환 결과 팝업')
2. Feature: 사용자가 클릭하는 버튼, 주요 시스템 기능, 분기 로직 (예: '1회 소환 버튼', '확률 정보 모달')
3. TestCase: 검증해야 하는 정상/경계/예외 시나리오 (예: '재화 부족 시 상점 유도 팝업', '10연차 시 SR 확정 검증')
4. Edges:
   - Screen -(Contains)-> Feature
   - Feature -(Transition)-> 다른 Screen 또는 Feature
   - Feature -(Depends_On)-> 선행 필수 기능
   - TestCase -(Tests)-> 해당 Feature 또는 Screen
5. aliases에 다국어, 21:9, 사운드, 네트워크 등 횡단 관심사 태그를 적극 포함하세요.

기획서 내용:
\"\"\"
{spec_text}
\"\"\"

반드시 아래 JSON 형식만 반환하세요:
{{
  "nodes": [
    {{"id": "s1", "label": "Screen", "name": "화면명", "aliases": ["Screen"], "description": "설명", "test_status": "Untested"}},
    {{"id": "f1", "label": "Feature", "name": "기능명", "aliases": ["Feature", "다국어"], "description": "설명", "test_status": "Untested"}},
    {{"id": "t1", "label": "TestCase", "name": "검증시나리오", "aliases": ["TestCase"], "description": "설명", "test_status": "Untested"}}
  ],
  "edges": [
    {{"source": "s1", "target": "f1", "type": "Contains", "action": "포함", "test_status": "Untested"}},
    {{"source": "t1", "target": "f1", "type": "Tests", "action": "검증", "test_status": "Untested"}}
  ]
}}
"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"response_mime_type": "application/json"}
    }
    
    with httpx.Client(timeout=30) as client:
        r = client.post(url, json=payload)
        if r.status_code >= 400:
            raise Exception(f"Gemini API error {r.status_code}: {r.text}")
        data = r.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(raw_text)


def apply_ingested_graph_to_neo4j(session, graph_data: Dict[str, Any], clean: bool = False) -> Dict[str, Any]:
    """
    파싱된 노드와 엣지를 Neo4j 데이터베이스에 일괄 적용합니다.
    clean=True인 경우 기존 데이터를 비우고 적용하며, False인 경우 기존 그래프에 병합(Merge)합니다.
    """
    nodes = graph_data.get("nodes", [])
    edges = graph_data.get("edges", [])
    
    if clean:
        session.run("MATCH (n) DETACH DELETE n")
        
    id_to_elem_id = {}
    
    # 1. 노드 생성 (이름 중복 방지: 이미 존재하는 노드는 ID 매핑만 수행)
    created_nodes = 0
    for n in nodes:
        label = n.get("label", "Feature")
        n_id = n.get("id")
        name = n.get("name", n_id)
        aliases = n.get("aliases", [])
        description = n.get("description", "")
        test_status = n.get("test_status", "Untested")
        props = n.get("properties", {})
        
        # Check if node with same name exists
        existing = session.run("MATCH (n) WHERE n.name = $name RETURN elementId(n) AS elem_id LIMIT 1", name=name).single()
        if existing:
            elem_id = existing["elem_id"]
            id_to_elem_id[n_id] = elem_id
            id_to_elem_id[elem_id] = elem_id
        else:
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
            rec = res.single()
            if rec:
                elem_id = rec["elem_id"]
                id_to_elem_id[n_id] = elem_id
                id_to_elem_id[elem_id] = elem_id
                created_nodes += 1
                
    # 2. 엣지 생성
    created_edges = 0
    for e in edges:
        source_key = e.get("source")
        target_key = e.get("target")
        e_type = e.get("type", "Depends_On")
        action = e.get("action", "")
        test_status = e.get("test_status", "Untested")
        props = e.get("properties", {})
        
        real_src = id_to_elem_id.get(source_key, source_key)
        real_tgt = id_to_elem_id.get(target_key, target_key)
        
        edge_query = f"""
        MATCH (a), (b)
        WHERE elementId(a) = $src AND elementId(b) = $tgt
        MERGE (a)-[r:`{e_type}`]->(b)
        ON CREATE SET r.test_status = $test_status,
                      r.action = $action,
                      r += $props
        RETURN elementId(r) AS rel_id
        """
        r_res = session.run(edge_query, src=real_src, tgt=real_tgt, test_status=test_status, action=action, props=props)
        if r_res.single():
            created_edges += 1
            _recalc_target_node_status(session, real_tgt)
            
    return {
        "status": "success",
        "created_nodes": created_nodes,
        "created_edges": created_edges,
        "total_parsed_nodes": len(nodes),
        "total_parsed_edges": len(edges)
    }

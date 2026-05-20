# Original User Request

## Initial Request — 2026-05-20T19:59:38Z

점진적인 개발과 기능 확장이 가능한 'Living Graph TC Platform'의 견고하고 기능적인 프로토타입을 구축합니다. 이 프로토타입은 철저한 책임 분리(Separation of concerns) 원칙, 쉬운 디버깅, 테스트 자동화 기반을 갖춘 Neo4j + FastAPI(NetworkX) + React Flow 파이프라인을 구현해야 합니다. UI 스타일링(CSS)은 최소화해도 무방하지만, 핵심 기능 로직은 실무 프로세스에 즉시 투입할 수 있을 정도로 안정적이어야 합니다.

Working directory: d:\personal\living_graph_tc
Integrity mode: development

## Requirements (요구사항)

### R1. 로컬 데이터 파이프라인 구축 (Local Data Pipeline)
보안이 필요한 기존 데이터를 보호하기 위해, `docker-compose`를 사용하여 로컬에 완전히 격리된 테스트용 Neo4j 인스턴스를 띄우고 더미 데이터(Seed data)를 자동으로 주입하도록 구성합니다. (참고: Docker Desktop 없이 WSL 내부에 직접 설치된 Docker 환경에서도 문제없이 실행되도록 스크립트와 가이드를 작성해야 합니다.) NetworkX를 활용해 Neo4j에서 그래프 데이터를 조회/추출하고 이를 JSON으로 반환하는 FastAPI 백엔드를 구현합니다.

### R2. 핵심 시각화 및 맥락 유지 (Core Visualization)
React Flow 프론트엔드를 구현하여 그래프를 렌더링합니다. 사용자가 특정 경로나 노드(Focus)를 선택했을 때, 대상이 아닌 주변 노드(Context)들이 DOM에서 삭제되지 않은 채 시각적으로 옅게 처리되도록(예: 투명도 감소, 흑백 처리 등) Focus+Context 기법을 구현합니다.

### R3. 테스트 커버리지 시각화 (Living TC)
사용자가 마우스 인터랙션을 통해 노드와 엣지의 '테스트 상태(Untested, Passed, Failed)'를 직접 마킹할 수 있는 기능을 구현합니다. 마킹 결과에 따라 UI가 즉각적으로 업데이트되어 현재의 "테스트 커버리지(Scope of Testing)"를 명확히 보여주어야 합니다. (예: 통과된 경로는 초록색 굵은 선, 실패한 노드는 빨간색 등으로 시각화)

### R4. 노드 및 엣지 편집 기능 (Graph Editing)
React Flow 캔버스 상에서 사용자가 직접 새로운 노드를 추가하거나 기존 노드 정보(이름, 속성 등)를 수정 및 삭제할 수 있어야 합니다. 또한 씬(Scene) 전환이나 UI 흐름을 테스트하기 위해 두 노드를 잇는 엣지(연결선)를 새로 연결하거나 끊을 수(삭제할 수) 있어야 하며, 이러한 변경 사항이 프론트엔드에 즉각 반영되고 백엔드 API와 연동될 수 있는 구조를 갖춰야 합니다.

### R5. Config 제어 및 로딩 UX (Config Panel)
프론트엔드에서 그래프 복잡도를 제어할 수 있는 설정 패널(최대 트랜지션 Depth, 루프 허용 여부, 특정 관점 필터링 등)을 제공해야 합니다. 잦은 API 호출을 방지하기 위해 Debounce(입력 대기) 처리가 필요하며, 백엔드가 서브그래프를 다시 연산하는 동안 캔버스에 반투명 로딩 오버레이를 띄워 사용자의 오작동(Race Condition)을 방지해야 합니다.

### R6. 관점 동의어 관리 (Alias Dictionary)
태그 파편화를 막기 위해 백엔드에 표준어와 동의어(Aliases) 맵을 관리합니다. 백엔드는 프론트엔드로 데이터를 넘길 때 동의어를 모두 표준어로 정규화해야 하며, 프론트엔드에서 사용자가 관점을 입력하거나 검색할 때는 자유 텍스트가 아닌 자동완성 드롭다운을 강제해야 합니다.

## Acceptance Criteria (인수 조건)

### API 및 파이프라인 검증
- [ ] 로컬 스크립트 실행 시 Neo4j 도커 컨테이너가 정상적으로 실행되며, 최소 20개 이상의 노드를 가진 더미 시드 데이터가 자동 주입된다.
- [ ] FastAPI 엔드포인트에 `GET` 요청 시, 백엔드에서 관점 속성의 동의어가 표준어로 자동 정규화되어 반환된다.

### 인터랙션 및 시각화 검증
- [ ] 프론트엔드 Config 패널에서 최대 뎁스나 필터 등을 변경하면 지정된 지연 시간(Debounce) 이후 백엔드로 재연산 API를 호출하며, 이 때 로딩 오버레이가 정상적으로 화면을 덮는다.
- [ ] React 애플리케이션 화면에서 'Untested' 상태인 노드나 엣지를 클릭하여 'Passed'로 마킹하면, 해당 요소의 상태가 업데이트되고 스타일이 눈에 띄게 변경된다.
- [ ] 캔버스에서 특정 타겟 노드(Focus)를 선택하면, 이와 무관한 배경 노드들에 즉시 'de-emphasized' 처리를 위한 CSS 클래스가 적용된다.

### 그래프 편집 및 관리 검증
- [ ] 캔버스 내에서 신규 노드를 생성하거나 엣지를 새로 연결/삭제할 수 있다.
- [ ] 노드를 수정하거나 검색할 때, 텍스트 직접 입력이 차단되고 지정된 표준어 드롭다운을 통해서만 선택할 수 있다.

## Resume Instruction — 2026-05-20T21:16:11+09:00

Note: This is a resumed execution. The previous subagent successfully completed Milestone 1 (Backend Foundation) and Milestone 2 (Core Visualization). The codebase in `d:\personal\living_graph_tc` already contains the Neo4j docker setup, FastAPI backend, and React Flow frontend with Dagre layout and Focus+Context dimming.
Your task is to pick up exactly from **Milestone 3** (Alias & Config Control) and then proceed to Milestone 4 and 5 (Graph Editing and Living TC). Do not overwrite the existing working foundation; build upon it to satisfy the remaining Requirements (R3, R4, R5, R6) and their Acceptance Criteria.

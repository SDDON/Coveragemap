# Handoff Report: React Flow UI Enhancements - Connection Mechanism

## 1. Observation
- 대상 파일: rontend/src/CoverageNode.tsx
- 현재 CoverageNode 구현을 확인한 결과, 2개의 <Handle> 컴포넌트(	ype="target", 	ype="source")가 다음과 같은 인라인 스타일로 구현되어 있습니다.
  style={{ width: '100%', height: '100%', position: 'absolute', zIndex: 1, ... }}
- 이로 인해 <Handle> 요소가 노드의 전체(100%)를 덮고 있으며(z-index: 1), source 핸들과 target 핸들이 완전히 겹쳐 있는 상태입니다. 

## 2. Logic Chain
- React Flow에서 <Handle>은 포인터 이벤트를 가로채어 엣지(Edge) 연결을 시작하는 역할을 합니다.
- 핸들 2개가 노드 크기의 100%를 차지하고 노드 위에 덮어씌워져 있으므로, 사용자가 노드의 본문을 클릭하거나 드래그하려고 할 때 실제로는 핸들을 클릭하게 되어 노드 선택 및 드래그가 불가능해집니다.
- 또한 source와 	arget 핸들이 동일한 크기로 정확히 겹쳐 있기 때문에, 마우스 이벤트가 상단에 위치한 핸들에만 도달하여 들어오는 연결(incoming connection)을 	arget 핸들에 올바르게 연결할 수 없습니다.
- 이를 해결하기 위해서는 노드의 중앙 부분(드래그 및 클릭 영역)을 방해하지 않으면서 엣지가 노드의 경계면에 자연스럽게 연결되도록 핸들의 크기와 위치를 수정해야 합니다. 

## 3. Caveats
- Custom Edge(Floating Edge)를 구현하는 방법도 있으나, 구조가 복잡해지므로 현재 구조에서 가장 간단하고 직관적인 '얇은 경계면 핸들' 전략이 적합하다고 판단했습니다.
- 저는 Read-only 조사자(explorer)이므로 직접 코드를 수정하지 않습니다.

## 4. Conclusion
리뷰어의 피드백을 반영하여 드래그/클릭 이벤트를 막지 않도록 **상/하단 얇은 경계면 핸들(Thin boundary handles)** 전략을 채택할 것을 권장합니다.

**추천 수정 전략:**
rontend/src/CoverageNode.tsx의 핸들 스타일을 노드 전체를 덮지 않고 얇은 띠 형태로 분리합니다.
1. **Target Handle (Top):** 노드의 상단 모서리에만 얇게 배치.
   - height: '10px', width: '100%', 	op: 0, 	ransform: 'translateY(-50%)'
2. **Source Handle (Bottom):** 노드의 하단 모서리에만 얇게 배치.
   - height: '10px', width: '100%', ottom: 0, 	ransform: 'translateY(50%)'

이 방식을 통해 노드의 중앙 영역이 개방되어 정상적으로 드래그와 클릭이 가능해지며, 동시에 다중 연결을 쉽게 할 수 있습니다.

## 5. Verification Method
- **명령어:** cd frontend && npm run build (문법 에러 확인)
- **검증 조건:** 앱 실행 후 노드 중앙 바디를 클릭하여 선택 및 드래그가 가능한지, 그리고 상/하단 엣지로 올바르게 엣지 연결이 가능한지 테스트합니다.

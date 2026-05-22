# Handoff Report

## 1. Observation (관찰 결과)
- 파일 위치: frontend/src/CoverageNode.tsx
- 현재 상태: <Handle> 컴포넌트(Top, Bottom)의 style 속성 내에 transform: 'none'이 적용되어 있습니다.
- 문제 원인(Iteration 5): width: '100%'와 left: 0을 설정한 상태에서 React Flow의 기본 transform: translate(-50%, -50%)이 적용되면 핸들이 왼쪽으로 50% 이동하는 버그가 발생했습니다. 이를 해결하기 위해 transform: 'none'을 적용했습니다.
- 문제 발생(Iteration 6): transform: 'none'을 적용함으로써 기본적으로 필요했던 Y축 이동(vertical shift)까지 함께 제거되었습니다. 이로 인해 10px 높이의 핸들이 노드 경계선 안쪽으로 5px 들어오게 되었고, 엣지의 화살표(arrowhead)가 핸들 중앙(노드 안쪽 5px)으로 연결되면서 불투명한 노드 배경에 화살표가 가려지는(clipped) 시각적 결함이 발생했습니다.

## 2. Logic Chain (논리 전개)
1. 문제의 핵심: X축 방향의 기본 이동(-50%)은 제거하되, Y축 방향의 이동(-50% 또는 50%)은 유지하여 핸들의 중앙을 노드의 바깥 경계선과 정확히 일치시켜야 합니다.
2. Top Handle: 
   - top: 0, height: '10px'이므로 변환이 없으면 핸들이 Y=0에서 Y=10 사이에 위치하여 중앙이 Y=5(노드 안쪽)가 됩니다.
   - transform: 'translate(0, -50%)'를 적용하면 핸들이 위로 5px 이동하여 중앙이 노드의 상단 경계선(Y=0)과 정확히 일치하게 됩니다.
3. Bottom Handle: 
   - bottom: 0, height: '10px'이므로 변환이 없으면 핸들 중앙이 노드 하단 경계선 안쪽 5px 지점에 위치하게 됩니다.
   - transform: 'translate(0, 50%)'를 적용하면 핸들이 아래로 5px 이동하여 중앙이 노드의 하단 경계선과 정확히 일치하게 됩니다.

## 3. Caveats (주의사항)
- React Flow 버전에 따라 기본 CSS 동작이 약간 다를 수 있으나, 현재 인라인 스타일에서 top, bottom, left, width, height 등을 강력하게 오버라이드하고 있으므로 위 논리대로 정확히 동작할 것입니다.
- 노드의 테두리(border) 두께가 두꺼워질 경우 1~2px 오차가 생길 수 있으나 현재는 이슈가 없습니다.

## 4. Conclusion (결론 및 구현 지침)
Worker(구현자)는 frontend/src/CoverageNode.tsx의 코드를 다음과 같이 수정해야 합니다:
- Top Handle의 style 속성에서 transform: 'none'을 transform: 'translate(0, -50%)'으로 변경합니다.
- Bottom Handle의 style 속성에서 transform: 'none'을 transform: 'translate(0, 50%)'으로 변경합니다.
(코드를 직접 작성하지 않았으므로, 위 지침을 바탕으로 구현을 진행해 주세요.)

## 5. Verification Method (검증 방법)
- 터미널에서 프론트엔드 서버 실행: cd frontend && npm run dev
- CoverageMap UI에서 노드를 연결해보고 화살표(arrowhead) 끝부분이 노드 배경에 잘리지 않고 경계선에 정확히 맞닿는지 확인합니다.
- 브라우저 개발자 도구(F12)를 열어 핸들의 Bounding Box가 노드의 상단/하단 경계에 걸쳐 절반씩 위치하는지 점검합니다.

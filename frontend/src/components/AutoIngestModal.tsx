import React, { useState } from 'react';

interface AutoIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedNode {
  id: string;
  label: string;
  name: string;
  aliases?: string[];
  description?: string;
  test_status?: string;
}

interface ParsedEdge {
  source: string;
  target: string;
  type: string;
  action?: string;
  test_status?: string;
}

interface ParsedGraph {
  nodes: ParsedNode[];
  edges: ParsedEdge[];
}

const SAMPLE_SPEC_TEXT = `# 가차 소환 시스템 기획서

## 일반 소환 화면
일반 상시 워프(가차) 화면입니다. 1회 뽑기와 10회 뽑기 기능을 제공합니다.

### 1회 뽑기 버튼
- 클릭 시 성옥 160개 소모 후 가차 연출 영상 재생
- 재화 부족 시 상점 충전 팝업 노출 확인
- 21:9 해상도에서 버튼 위치 및 이펙트 정렬 확인

### 10회 뽑기 버튼
- 성옥 1,600개 소모 후 10연차 연출 재생
- 10회 뽑기 시 4성 이상 1개 확정 지급 검증
- 다국어 폰트 줄바꿈 검증

## 픽업 이벤트 화면
한정 픽업 캐릭터 전용 소환 화면입니다.

### 픽업 확률 정보 모달
- 상세 확률표 팝업 표시
- 다국어 텍스트 및 확률 수치(0.6%) 표기 검증
`;

const SAMPLE_CSV_TEXT = `Screen,Feature,TestCase,Prerequisite,CrossCutting,Description
인벤토리 화면,아이템 분해,일반 등급 장비 일괄 분해 검증,,다국어,인벤토리 가방 내 장비 분해
인벤토리 화면,아이템 분해,잠금된 장비 분해 시도 시 경고 팝업,아이템 분해,다국어,잠금 보호 로직 검증
인벤토리 화면,장비 강화,강화 재료 투입 후 골드 소모 검증,로그인 완료,"다국어, 21:9",골드 및 재료 차감
인벤토리 화면,장비 강화,골드 부족 시 상점 이동 모달 확인,장비 강화,다국어,예외 처리
상점 화면,패키지 구매,한정 패키지 결제 완료 후 인벤토리 지급 검증,로그인 완료,네트워크,결제 모듈 연동
`;

export const AutoIngestModal: React.FC<AutoIngestModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'spec' | 'csv'>('csv');
  const [specInput, setSpecInput] = useState<string>('');
  const [csvInput, setCsvInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedGraph, setParsedGraph] = useState<ParsedGraph | null>(null);
  const [cleanDb, setCleanDb] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleParseSpec = async () => {
    if (!specInput.trim()) {
      setError('기획서 텍스트를 입력해주세요.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ingest/parse-spec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec_text: specInput })
      });
      if (!res.ok) throw new Error(await res.text());
      const data: ParsedGraph = await res.json();
      setParsedGraph(data);
    } catch (err: any) {
      setError(`기획서 분석 실패: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleParseCsv = async () => {
    if (!csvInput.trim()) {
      setError('CSV 내용을 입력해주세요.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ingest/parse-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_text: csvInput })
      });
      if (!res.ok) throw new Error(await res.text());
      const data: ParsedGraph = await res.json();
      setParsedGraph(data);
    } catch (err: any) {
      setError(`CSV 파싱 실패: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = async () => {
    if (!parsedGraph) return;
    setIsApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/ingest/apply?clean=${cleanDb}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedGraph)
      });
      if (!res.ok) throw new Error(await res.text());
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(`적용 실패: ${err.message}`);
    } finally {
      setIsApplying(false);
    }
  };

  const screens = parsedGraph?.nodes.filter(n => n.label === 'Screen') || [];
  const features = parsedGraph?.nodes.filter(n => n.label === 'Feature') || [];
  const testcases = parsedGraph?.nodes.filter(n => n.label === 'TestCase') || [];

  return (
    <div 
      className="auto-ingest-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 'var(--z-modal)',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div 
        className="auto-ingest-modal"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '920px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚡ 신작 게임 테스트 자동 그래프 셋업 (Auto Ingestion)
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              수작업 없이 기획서 텍스트나 엑셀 시트로부터 화면, 기능, 테스트케이스 및 의존성을 일괄 자동 생성합니다.
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f1f5f9' }}>
          <button
            onClick={() => { setActiveTab('csv'); setParsedGraph(null); }}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'csv' ? '3px solid #0284c7' : '3px solid transparent',
              background: activeTab === 'csv' ? '#ffffff' : 'transparent',
              fontWeight: activeTab === 'csv' ? 700 : 500,
              color: activeTab === 'csv' ? '#0369a1' : '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '0.95rem'
            }}
          >
            📊 엑셀/CSV 일괄 임포트 (보안 안전 / 로컬 100%)
          </button>
          <button
            onClick={() => { setActiveTab('spec'); setParsedGraph(null); }}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'spec' ? '3px solid #3b82f6' : '3px solid transparent',
              background: activeTab === 'spec' ? '#ffffff' : 'transparent',
              fontWeight: activeTab === 'spec' ? 700 : 500,
              color: activeTab === 'spec' ? '#1e40af' : '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '0.95rem'
            }}
          >
            📝 로컬 기획서 파서 (마크다운 규칙 기반)
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {activeTab === 'spec' ? (
            <div>
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🛡️ <strong>100% 로컬 처리 (외부 유출 원천 차단):</strong> 외부 AI 클라우드 API를 호출하지 않으며, PC 내부의 규칙 기반 파서로 안전하게 구조화합니다.</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                  게임 기획서 / 기능 명세서 텍스트 붙여넣기:
                </label>
                <button
                  type="button"
                  onClick={() => setSpecInput(SAMPLE_SPEC_TEXT)}
                  style={{
                    backgroundColor: '#e0f2fe',
                    color: '#0369a1',
                    border: '1px solid #bae6fd',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  📋 샘플 기획서 채우기 (가차 시스템)
                </button>
              </div>
              <textarea
                value={specInput}
                onChange={(e) => setSpecInput(e.target.value)}
                placeholder="Notion, Confluence, 마크다운 기획서의 내용을 복사하여 붙여넣으세요..."
                rows={9}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  resize: 'vertical'
                }}
              />
              <button
                type="button"
                onClick={handleParseSpec}
                disabled={isLoading}
                style={{
                  marginTop: '10px',
                  width: '100%',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  padding: '10px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isLoading ? '⏳ 기획서 구조 분석 중...' : '⚡ 로컬 마크다운 구조 분석 실행'}
              </button>
            </div>
          ) : (
            <div>
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🛡️ <strong>100% 로컬 인하우스 파싱:</strong> 어떠한 외부 AI API나 클라우드 서버도 호출하지 않습니다. 로컬 파이썬 엔진에서 테이블을 즉시 그래프로 매핑합니다.</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                  CSV 내용 붙여넣기 (Screen, Feature, TestCase, Prerequisite, CrossCutting):
                </label>
                <button
                  type="button"
                  onClick={() => setCsvInput(SAMPLE_CSV_TEXT)}
                  style={{
                    backgroundColor: '#e0f2fe',
                    color: '#0369a1',
                    border: '1px solid #bae6fd',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  📋 표준 CSV 템플릿 채우기 (인벤토리)
                </button>
              </div>
              <textarea
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                placeholder="Screen,Feature,TestCase,Prerequisite,CrossCutting,Description..."
                rows={9}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  resize: 'vertical'
                }}
              />
              <button
                type="button"
                onClick={handleParseCsv}
                disabled={isLoading}
                style={{
                  marginTop: '10px',
                  width: '100%',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  padding: '10px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isLoading ? '⏳ CSV 데이터 파싱 중...' : '⚡ CSV 구조 분석 실행'}
              </button>
            </div>
          )}

          {/* Analysis Preview Section */}
          {parsedGraph && (
            <div style={{
              marginTop: '12px',
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              padding: '16px',
              backgroundColor: '#f8fafc',
              animation: 'fadeIn 0.2s ease-in'
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>
                🔍 분석 결과 미리보기 (Preview)
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#3b82f6' }}>{screens.length}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Screen (화면)</div>
                </div>
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>{features.length}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Feature (기능)</div>
                </div>
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#8b5cf6' }}>{testcases.length}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>TestCase (검증 시나리오)</div>
                </div>
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>{parsedGraph.edges.length}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Edges (의존성/전이)</div>
                </div>
              </div>

              {/* Sample Nodes List */}
              <div style={{ maxHeight: '160px', overflowY: 'auto', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem' }}>
                <div style={{ fontWeight: 600, color: '#475569', marginBottom: '6px' }}>생성될 주요 노드 목록:</div>
                {parsedGraph.nodes.map((n, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0' }}>
                    <span style={{
                      backgroundColor: n.label === 'Screen' ? '#dbeafe' : n.label === 'Feature' ? '#d1fae5' : '#ede9fe',
                      color: n.label === 'Screen' ? '#1e40af' : n.label === 'Feature' ? '#065f46' : '#5b21b6',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 600
                    }}>
                      {n.label}
                    </span>
                    <span style={{ fontWeight: 500, color: '#1e293b' }}>{n.name}</span>
                    {n.aliases && n.aliases.length > 0 && (
                      <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                        [{n.aliases.join(', ')}]
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#475569', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={cleanDb}
              onChange={(e) => setCleanDb(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            <span>기존 캔버스 비우고 새로 적용 (Clean Apply)</span>
          </label>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              취소
            </button>
            <button
              onClick={handleApply}
              disabled={!parsedGraph || isApplying}
              style={{
                backgroundColor: (!parsedGraph || isApplying) ? '#94a3b8' : '#16a34a',
                color: '#ffffff',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: (!parsedGraph || isApplying) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isApplying ? '적용 중...' : '🚀 CoverageMap 캔버스에 적용'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

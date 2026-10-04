import React, { useEffect, useState } from 'react';
import { t } from '../locales/koKR';

interface AutoIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  // 현재 선택된 워크스페이스(alias 필터). 빈 문자열이면 '전체 보기' 상태
  workspace: string;
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

// 이전 버전에서 브라우저에 저장하던 외부 LLM API 키 (기능 제거에 따라 정리 대상)
const LEGACY_API_KEY_STORAGE = 'coveragemap_gemini_api_key';

export const AutoIngestModal: React.FC<AutoIngestModalProps> = ({ isOpen, onClose, onSuccess, workspace }) => {
  const [csvInput, setCsvInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedGraph, setParsedGraph] = useState<ParsedGraph | null>(null);
  const [cleanDb, setCleanDb] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  // clean 적용 전 dry-run으로 받은 삭제 대상 노드 이름 목록. null이면 확인 단계가 아님
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);

  const hasWorkspace = workspace.trim().length > 0;

  useEffect(() => {
    // 외부 LLM 기능 제거: 남아 있는 API 키를 1회 정리
    if (isOpen) localStorage.removeItem(LEGACY_API_KEY_STORAGE);
  }, [isOpen]);

  useEffect(() => {
    // 워크스페이스가 없으면 clean 옵션을 강제로 해제
    if (!hasWorkspace) setCleanDb(false);
  }, [hasWorkspace]);

  if (!isOpen) return null;

  const handleParseCsv = async () => {
    if (!csvInput.trim()) {
      setError(t.ingest.emptyInput);
      return;
    }
    setIsLoading(true);
    setError(null);
    setPendingDelete(null);
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
      setError(`${t.ingest.parseFailed}: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 백엔드 적용 호출. dryRun=true이면 DB를 바꾸지 않고 예상 결과만 받음
  const callApply = async (dryRun: boolean) => {
    const params = new URLSearchParams({ clean: String(cleanDb), dry_run: String(dryRun) });
    const res = await fetch(`/api/ingest/apply?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...parsedGraph, workspace })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const handleApply = async () => {
    if (!parsedGraph) return;
    setIsApplying(true);
    setError(null);
    try {
      if (cleanDb) {
        // 파괴적 작업: 먼저 삭제 대상을 보여주고 확인을 받음
        const preview = await callApply(true);
        setPendingDelete(preview.will_delete || []);
        return;
      }
      await callApply(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(`${t.ingest.applyFailed}: ${err.message}`);
    } finally {
      setIsApplying(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsApplying(true);
    setError(null);
    try {
      await callApply(false);
      setPendingDelete(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(`${t.ingest.applyFailed}: ${err.message}`);
    } finally {
      setIsApplying(false);
    }
  };

  const screens = parsedGraph?.nodes.filter(n => n.label === 'Screen') || [];
  const features = parsedGraph?.nodes.filter(n => n.label === 'Feature') || [];
  const testcases = parsedGraph?.nodes.filter(n => n.label === 'TestCase') || [];

  const countCard = (value: number, label: string, color: string) => (
    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.25rem', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{label}</div>
    </div>
  );

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
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              {t.ingest.title}
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              {t.ingest.subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t.ingest.cancel}
            style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', color: '#94a3b8', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px' }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem' }}>
            {t.ingest.localNotice}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label htmlFor="ingest-csv-input" style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                {t.ingest.inputLabel}
              </label>
              <button
                type="button"
                onClick={() => setCsvInput(t.ingest.sampleCsv)}
                style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
              >
                {t.ingest.fillSample}
              </button>
            </div>
            <textarea
              id="ingest-csv-input"
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
              placeholder="Screen,Feature,TestCase,Prerequisite,CrossCutting,Description..."
              rows={9}
              style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: '0.85rem', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical' }}
            />
            <button
              type="button"
              onClick={handleParseCsv}
              disabled={isLoading}
              style={{ marginTop: '10px', width: '100%', backgroundColor: '#0284c7', color: '#ffffff', padding: '10px', borderRadius: '8px', fontWeight: 600, fontSize: '0.95rem', cursor: isLoading ? 'not-allowed' : 'pointer', border: 'none' }}
            >
              {isLoading ? t.ingest.parsing : t.ingest.parse}
            </button>
          </div>

          {/* Analysis Preview Section */}
          {parsedGraph && (
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px', backgroundColor: '#f8fafc' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>
                {t.ingest.previewTitle}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
                {countCard(screens.length, t.ingest.countScreen, '#3b82f6')}
                {countCard(features.length, t.ingest.countFeature, '#10b981')}
                {countCard(testcases.length, t.ingest.countTestCase, '#8b5cf6')}
                {countCard(parsedGraph.edges.length, t.ingest.countEdges, '#f59e0b')}
              </div>

              {/* Sample Nodes List */}
              <div style={{ maxHeight: '160px', overflowY: 'auto', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem' }}>
                <div style={{ fontWeight: 600, color: '#475569', marginBottom: '6px' }}>{t.ingest.previewNodeList}</div>
                {parsedGraph.nodes.map((n, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0' }}>
                    <span style={{
                      backgroundColor: n.label === 'Screen' ? '#dbeafe' : n.label === 'Feature' ? '#d1fae5' : '#ede9fe',
                      color: n.label === 'Screen' ? '#1e40af' : n.label === 'Feature' ? '#065f46' : '#5b21b6',
                      padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600
                    }}>
                      {n.label}
                    </span>
                    <span style={{ fontWeight: 500, color: '#1e293b' }}>{n.name}</span>
                    {n.aliases && n.aliases.length > 0 && (
                      <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>[{n.aliases.join(', ')}]</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clean 적용 전 삭제 확인 단계 */}
          {pendingDelete !== null && (
            <div data-testid="ingest-delete-confirm" style={{ border: '1px solid #fca5a5', borderRadius: '12px', padding: '16px', backgroundColor: '#fef2f2' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#991b1b', fontWeight: 700 }}>{t.ingest.confirmTitle}</h3>
              <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#7f1d1d' }}>
                {t.ingest.confirmBody(workspace, pendingDelete.length)}
              </p>
              {pendingDelete.length > 0 && (
                <ul style={{ maxHeight: '140px', overflowY: 'auto', margin: '0 0 12px 0', padding: '8px 12px 8px 28px', backgroundColor: '#ffffff', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '0.8rem' }}>
                  {pendingDelete.map((name, idx) => <li key={idx}>{name}</li>)}
                </ul>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setPendingDelete(null)}
                  style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                >
                  {t.ingest.confirmBack}
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={isApplying}
                  style={{ backgroundColor: isApplying ? '#94a3b8' : '#dc2626', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, cursor: isApplying ? 'not-allowed' : 'pointer' }}
                >
                  {isApplying ? t.ingest.applying : t.ingest.confirmProceed}
                </button>
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
          gap: '16px',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: '#475569' }}>
            <span>
              {t.ingest.targetWorkspace}: <strong data-testid="ingest-target-workspace">{hasWorkspace ? workspace : t.ingest.noWorkspace}</strong>
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: hasWorkspace ? 'pointer' : 'not-allowed', color: hasWorkspace ? '#475569' : '#94a3b8' }}>
              <input
                type="checkbox"
                checked={cleanDb}
                disabled={!hasWorkspace}
                onChange={(e) => { setCleanDb(e.target.checked); setPendingDelete(null); }}
                style={{ width: '16px', height: '16px' }}
              />
              <span>{hasWorkspace ? t.ingest.cleanApply : t.ingest.cleanRequiresWorkspace}</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
            >
              {t.ingest.cancel}
            </button>
            <button
              onClick={handleApply}
              disabled={!parsedGraph || isApplying || pendingDelete !== null}
              style={{
                backgroundColor: (!parsedGraph || isApplying || pendingDelete !== null) ? '#94a3b8' : '#16a34a',
                color: '#ffffff', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: 700,
                cursor: (!parsedGraph || isApplying || pendingDelete !== null) ? 'not-allowed' : 'pointer'
              }}
            >
              {isApplying ? (cleanDb && pendingDelete === null ? t.ingest.checking : t.ingest.applying) : t.ingest.apply}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

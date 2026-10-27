import React, { useState, useEffect } from 'react';
import { t } from '../locales/koKR';

interface PresetItem {
  id: string;
  name: string;
  description: string;
  node_count: number;
  edge_count: number;
  created_at: string;
}

interface PresetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPresetLoaded: () => void;
}

export const PresetManagerModal: React.FC<PresetManagerModalProps> = ({
  isOpen,
  onClose,
  onPresetLoaded
}) => {
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPresetId, setLoadingPresetId] = useState<string | null>(null);
  const [cleanLoad, setCleanLoad] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New preset form state
  const [showSaveSection, setShowSaveSection] = useState(false);
  const [showBackups, setShowBackups] = useState(false);
  const [saveId, setSaveId] = useState('');
  const [saveName, setSaveName] = useState('');
  const [saveDesc, setSaveDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const regularPresets = presets.filter((p) => !p.id.startsWith('_autobackup_'));
  const backupPresets = presets.filter((p) => p.id.startsWith('_autobackup_'));

  useEffect(() => {
    if (isOpen) {
      fetchPresets();
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  const fetchPresets = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/presets');
      if (!res.ok) throw new Error(t.preset.listLoadFailed);
      const data = await res.json();
      setPresets(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message || t.preset.genericError);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPreset = async (presetId: string) => {
    try {
      setLoadingPresetId(presetId);
      setErrorMsg(null);
      setSuccessMsg(null);

      const res = await fetch(`/api/presets/${encodeURIComponent(presetId)}/load?clean=${cleanLoad}`, {
        method: 'POST'
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || t.preset.loadFailed);
      }
      
      const result = await res.json();
      setSuccessMsg(t.preset.loadSuccess(presetId, result.nodes_created, result.edges_created));
      
      // Trigger parent graph refresh
      onPresetLoaded();

      // Automatically close after a brief delay
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message || t.preset.loadError);
    } finally {
      setLoadingPresetId(null);
    }
  };

  const handleSaveCurrentGraph = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveId.trim() || !saveName.trim()) {
      setErrorMsg(t.preset.idNameRequired);
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: saveId.trim(),
          name: saveName.trim(),
          description: saveDesc.trim()
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || t.preset.saveFailed);
      }
      
      setSuccessMsg(t.preset.saveSuccess);
      setSaveId('');
      setSaveName('');
      setSaveDesc('');
      setShowSaveSection(false);
      fetchPresets();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message || t.preset.saveError);
    } finally {
      setSaving(false);
    }
  };

  const renderPresetCard = (preset: PresetItem) => {
    const isFeatured = preset.id === 'honkai_starrail_full_qa';
    return (
      <div
        key={preset.id}
        data-testid={`preset-card-${preset.id}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '16px',
          border: isFeatured ? '2px solid #3b82f6' : '1.5px solid #e2e8f0',
          borderRadius: '12px',
          backgroundColor: isFeatured ? '#f8faff' : '#ffffff',
          transition: 'all 0.15s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                {preset.name}
              </span>
              {isFeatured && (
                <span style={{
                  padding: '2px 8px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  backgroundColor: '#dbeafe',
                  color: '#1d4ed8',
                  borderRadius: '9999px'
                }}>
                  {t.preset.featuredBadge}
                </span>
              )}
              <span style={{
                padding: '2px 8px',
                fontSize: '0.7rem',
                fontWeight: 600,
                backgroundColor: '#e0f2fe',
                color: '#0369a1',
                borderRadius: '9999px'
              }}>
                {t.preset.nodeCount(preset.node_count)}
              </span>
              <span style={{
                padding: '2px 8px',
                fontSize: '0.7rem',
                fontWeight: 600,
                backgroundColor: '#f1f5f9',
                color: '#475569',
                borderRadius: '9999px'
              }}>
                {t.preset.edgeCount(preset.edge_count)}
              </span>
            </div>
            <div style={{
              fontSize: '0.85rem',
              color: '#64748b',
              marginTop: '6px',
              lineHeight: '1.45'
            }}>
              {preset.description || t.preset.noDescription}
            </div>
          </div>

          <button
            onClick={() => handleLoadPreset(preset.id)}
            disabled={loadingPresetId !== null}
            style={{
              padding: '8px 16px',
              backgroundColor: loadingPresetId === preset.id ? '#94a3b8' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: loadingPresetId !== null ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)'
            }}
          >
            {loadingPresetId === preset.id ? t.preset.loading : t.preset.load}
          </button>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(4px)',
        zIndex: 'var(--z-modal, 3000)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '85vh',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          color: '#0f172a'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 24px',
          borderBottom: '1px solid #f1f5f9',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>📂</span>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              {t.preset.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.4rem',
              cursor: 'pointer',
              color: '#64748b',
              padding: '4px 8px',
              borderRadius: '6px'
            }}
          >
            &times;
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {errorMsg && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#dc2626',
              fontSize: '0.875rem',
              marginBottom: '16px',
              fontWeight: 500
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              color: '#16a34a',
              fontSize: '0.875rem',
              marginBottom: '16px',
              fontWeight: 500
            }}>
              ✅ {successMsg}
            </div>
          )}

          {/* Option: Clean Load Checkbox */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: '#f1f5f9',
            borderRadius: '10px',
            marginBottom: '16px'
          }}>
            <div>
              <label 
                htmlFor="cleanLoadCheckbox" 
                style={{ 
                  cursor: 'pointer', 
                  fontSize: '0.9rem', 
                  fontWeight: 600, 
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <input
                  type="checkbox"
                  id="cleanLoadCheckbox"
                  checked={cleanLoad}
                  onChange={(e) => setCleanLoad(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                {t.preset.cleanLoad}
              </label>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', marginLeft: '24px' }}>
                {t.preset.cleanLoadHint}
              </div>
            </div>
          </div>

          {/* Preset Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {loading && presets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
                {t.preset.listLoading}
              </div>
            ) : presets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
                {t.preset.empty}
              </div>
            ) : (
              <>
                {regularPresets.map(renderPresetCard)}
                {backupPresets.length > 0 && (
                  <div style={{ marginTop: '8px', borderTop: '1px dashed #cbd5e1', paddingTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setShowBackups(!showBackups)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '4px 0',
                        color: '#64748b',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>{showBackups ? '▼' : '▶'}</span>
                      <span>{t.preset.backupSection(backupPresets.length)}</span>
                    </button>
                    {showBackups && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                        {backupPresets.map(renderPresetCard)}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Collapsible Save Current Graph Section */}
          <div style={{ marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <button
              onClick={() => setShowSaveSection(!showSaveSection)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 0',
                color: '#2563eb',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>{showSaveSection ? '▼' : '▶'}</span>
              <span>{t.preset.saveSection}</span>
            </button>

            {showSaveSection && (
              <form onSubmit={handleSaveCurrentGraph} style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                      {t.preset.idLabel}
                    </label>
                    <input
                      type="text"
                      placeholder={t.preset.idPlaceholder}
                      value={saveId}
                      onChange={(e) => setSaveId(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>
                  <div style={{ flex: 1.5 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                      {t.preset.nameLabel}
                    </label>
                    <input
                      type="text"
                      placeholder={t.preset.namePlaceholder}
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                    {t.preset.descLabel}
                  </label>
                  <input
                    type="text"
                    placeholder={t.preset.descPlaceholder}
                    value={saveDesc}
                    onChange={(e) => setSaveDesc(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {saving ? t.preset.saving : t.preset.save}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid #f1f5f9',
          backgroundColor: '#f8fafc',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              backgroundColor: '#e2e8f0',
              color: '#334155',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            {t.common.close}
          </button>
        </div>
      </div>
    </div>
  );
};

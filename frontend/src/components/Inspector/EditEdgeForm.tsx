import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { EditFormData } from '../../types/ui';
import type { StatusName } from '../../types/graph';
import { EDGE_TYPE_OPTIONS } from '../../utils/constants';
import { t } from '../../locales/koKR';

interface EditEdgeFormProps {
  editFormData: EditFormData;
  setEditFormData: Dispatch<SetStateAction<EditFormData>>;
  handleSaveStatus: (status: StatusName) => Promise<void>;
  handleDelete: () => Promise<void>;
  handleSave: () => Promise<void>;
}

export const EditEdgeForm: React.FC<EditEdgeFormProps> = ({
  editFormData,
  setEditFormData,
  handleSaveStatus,
  handleDelete,
  handleSave,
}) => {
  return (
    <>
      <div className="form-group">
        <label htmlFor="edgeType" className="form-label">
          {t.inspector.edgeType}
          <span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.edgeType}>?</span>
        </label>
        {/* data.type도 함께 갱신해야 전파 엔진(edgeTypeOf)이 바뀐 타입(예: Return 전환)을 인식합니다. */}
        <select
          id="edgeType"
          value={editFormData.edgeType || 'Transition'}
          onChange={e => setEditFormData({ ...editFormData, edgeType: e.target.value })}
        >
          {EDGE_TYPE_OPTIONS.map(et => (
            <option key={et} value={et}>{t.edgeType[et] || et}</option>
          ))}
          {editFormData.edgeType && !(EDGE_TYPE_OPTIONS as readonly string[]).includes(editFormData.edgeType) && (
            <option value={editFormData.edgeType}>{editFormData.edgeType}</option>
          )}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="edgeAction" className="form-label">
          {t.inspector.actionTrigger}
          <span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.actionTrigger}>?</span>
        </label>
        <input
          id="edgeAction"
          type="text"
          value={editFormData.action || ''}
          onChange={e => setEditFormData({ ...editFormData, action: e.target.value })}
          placeholder={t.inspector.actionPlaceholder}
        />
      </div>

      <div className="form-group">
        <label className="form-label">
          {t.inspector.status}
          <span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.status}>?</span>
        </label>
        <div style={{ display: 'flex', gap: '8px', marginTop: '5px', flexWrap: 'wrap' }}>
          <button className="success" onClick={(e) => { e.preventDefault(); handleSaveStatus('Passed'); }}>
            {t.inspector.markPassed}
          </button>
          <button className="danger" onClick={(e) => { e.preventDefault(); handleSaveStatus('Failed'); }}>
            {t.inspector.markFailed}
          </button>
          <button
            onClick={(e) => { e.preventDefault(); handleSaveStatus('Untested'); }}
            style={{ border: '1.5px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#334155' }}
          >
            {t.inspector.resetStatus}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button className="danger" style={{ flex: 1 }} onClick={handleDelete}>
          {t.common.delete}
        </button>
        <button className="primary" style={{ flex: 1 }} onClick={handleSave}>
          {t.common.save}
        </button>
      </div>
    </>
  );
};

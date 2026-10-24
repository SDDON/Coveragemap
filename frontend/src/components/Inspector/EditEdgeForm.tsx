import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { EditFormData } from '../../types/ui';
import type { StatusName } from '../../types/graph';
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
        <label htmlFor="edgeType" className="form-label">{t.inspector.edgeType}</label>
        {/* data.type도 함께 갱신해야 전파 엔진(edgeTypeOf)이 바뀐 타입(예: Return 전환)을 인식합니다. */}
        <select
          id="edgeType"
          value={editFormData.edgeType || 'Transition'}
          onChange={e => setEditFormData({ ...editFormData, edgeType: e.target.value })}
        >
          <option value="Transition">{t.edgeType.Transition}</option>
          <option value="Contains">{t.edgeType.Contains}</option>
          <option value="Displays">{t.edgeType.Displays}</option>
          <option value="Depends_On">{t.edgeType.Depends_On}</option>
          <option value="Triggers">{t.edgeType.Triggers}</option>
          <option value="Tests">{t.edgeType.Tests}</option>
          <option value="Return">{t.edgeType.Return}</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">{t.inspector.actionTrigger}</label>
        <input
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

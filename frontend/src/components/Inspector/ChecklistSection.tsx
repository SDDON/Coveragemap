import React, { useState } from 'react';
import type { CoverageNode, ChecklistItem, StatusName } from '../../types/graph';
import { checklistStatus } from '../../statusPropagation';
import { CHECKLIST_STATUS_CYCLE, STATUS_ICON } from '../../utils/constants';
import { t } from '../../locales/koKR';

interface ChecklistSectionProps {
  liveEditNode: CoverageNode;
  saveChecklist: (items: ChecklistItem[]) => Promise<void>;
}

/* C. B안 노드 내부 체크리스트 (TESTCASE 스펙 3.3) */
export const ChecklistSection: React.FC<ChecklistSectionProps> = ({
  liveEditNode,
  saveChecklist,
}) => {
  const [openChecklistStatusId, setOpenChecklistStatusId] = useState<string | null>(null);

  const rawList = liveEditNode.data?.properties?.checklist;
  const items: ChecklistItem[] = Array.isArray(rawList) ? rawList : [];
  const passedCount = items.filter(i => i.status === 'Passed').length;
  const overall = checklistStatus(items);

  return (
    <div className="form-group checklist-section">
      <h4 className="inspector-section-title">
        <span>
          {t.checklist.title}
          <span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.checklist}>?</span>
        </span>
        {overall && <span className="checklist-summary">{STATUS_ICON[overall]} {passedCount}/{items.length}</span>}
      </h4>
      {items.length === 0 && <p className="inspector-hint">{t.checklist.empty}</p>}
      {items.map(item => (
        <div key={item.id} className="checklist-item">
          {/* 상태 아이콘 1개 + 클릭 시 팝오버(⚪🟢🔴🟡)로 선택 → 텍스트 영역에 최대한 폭을 양보 */}
          <div
            className="checklist-status-picker"
            onBlur={e => {
              // 팝오버 바깥으로 포커스가 나가면 닫기 (팝오버 내부 버튼 클릭은 유지)
              if (!e.currentTarget.contains(e.relatedTarget as HTMLElement | null)) {
                setOpenChecklistStatusId(prev => (prev === item.id ? null : prev));
              }
            }}
          >
            <button
              type="button"
              className="checklist-status-trigger"
              title={`${t.checklist.changeStatus}: ${t.status[(item.status || 'Untested') as StatusName]}`}
              aria-haspopup="menu"
              aria-expanded={openChecklistStatusId === item.id}
              onClick={() => setOpenChecklistStatusId(prev => (prev === item.id ? null : item.id))}
            >
              {STATUS_ICON[item.status || 'Untested']}
            </button>
            {openChecklistStatusId === item.id && (
              <div className="checklist-status-menu" role="menu">
                {CHECKLIST_STATUS_CYCLE.map(st => (
                  <button
                    key={st}
                    type="button"
                    role="menuitemradio"
                    className={`checklist-status-btn${item.status === st ? ' selected' : ''}`}
                    title={t.status[st]}
                    aria-checked={item.status === st}
                    onClick={() => {
                      setOpenChecklistStatusId(null);
                      if (item.status === st) return;
                      saveChecklist(items.map(i => (i.id === item.id ? { ...i, status: st } : i)));
                    }}
                  >
                    {STATUS_ICON[st]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <textarea
            // 텍스트가 바뀌면(저장/Undo) 다시 마운트되어 최신 값을 보여줍니다.
            key={`${item.id}:${item.text}`}
            rows={1}
            className="checklist-text"
            aria-label={t.checklist.itemLabel}
            placeholder={t.checklist.itemPlaceholder}
            defaultValue={item.text}
            autoFocus={item.text === ''}
            // 내용 길이에 맞춰 높이 자동 조절 (긴 문장은 폭에 맞춰 줄바꿈되어 전부 보임)
            ref={el => {
              if (el) {
                el.style.height = 'auto';
                el.style.height = `${el.scrollHeight}px`;
              }
            }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${el.scrollHeight}px`;
            }}
            onBlur={e => {
              const text = e.target.value.trim();
              if (text !== item.text) saveChecklist(items.map(i => (i.id === item.id ? { ...i, text } : i)));
            }}
            onKeyDown={e => {
              // Enter = 저장(입력 종료), Shift+Enter = 줄바꿈
              // 한글 IME 조합 중 Enter(isComposing)는 글자 확정용이므로 무시
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
          />
          <button
            type="button"
            className="checklist-delete-btn"
            title={t.checklist.deleteItem}
            onClick={() => saveChecklist(items.filter(i => i.id !== item.id))}
          >
            🗑️
          </button>
        </div>
      ))}
      <button
        type="button"
        className="checklist-add-btn"
        onClick={() =>
          saveChecklist([
            ...items,
            { id: `chk_${Date.now().toString(36)}_${items.length + 1}`, text: '', status: 'Untested' },
          ])
        }
      >
        {t.checklist.addItem}
      </button>
      {items.length > 0 && <p className="inspector-hint">{t.checklist.autoStatusHint}</p>}
    </div>
  );
};

import React from 'react';
import { t } from '../../locales/koKR';

export interface TopToolbarProps {
  filterText: string;
  showAllDomains: boolean;
  onAddNode: () => void;
  onSwitchWorkspace: () => void;
  onOpenPresets: () => void;
  onOpenHelp: () => void;
  onRelayout: () => void;
  hasParentNodes?: boolean;
  allParentsCollapsed?: boolean;
  onToggleCollapseAll?: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  filterText,
  showAllDomains,
  onAddNode,
  onSwitchWorkspace,
  onOpenPresets,
  onOpenHelp,
  onRelayout,
  hasParentNodes = false,
  allParentsCollapsed = false,
  onToggleCollapseAll,
}) => {
  const workspaceDisplay = filterText ? filterText : (showAllDomains ? t.workspace.all : t.workspace.none);

  return (
    <div className="top-toolbar">
      <button
        type="button"
        className="toolbar-btn"
        onClick={onAddNode}
      >
        {t.toolbar.addNode}
      </button>
      <div className="toolbar-workspace-pill" title={workspaceDisplay}>
        <span className="toolbar-workspace-label">{t.toolbar.currentWorkspace}</span>
        <span className="toolbar-workspace-value">{workspaceDisplay}</span>
      </div>
      <button
        type="button"
        className="primary toolbar-btn toolbar-btn-bold"
        title={t.toolbar.switchWorkspace}
        onClick={onSwitchWorkspace}
      >
        {t.toolbar.switchWorkspaceBtn}
      </button>
      <button
        type="button"
        className="primary toolbar-btn toolbar-btn-presets"
        title={t.toolbar.presets}
        onClick={onOpenPresets}
      >
        {t.toolbar.presetsBtn}
      </button>
      <button
        type="button"
        className="toolbar-btn toolbar-btn-help"
        title={t.toolbar.help}
        onClick={onOpenHelp}
      >
        ?
      </button>
      <button
        type="button"
        className="toolbar-btn"
        title={t.toolbar.relayout}
        onClick={onRelayout}
      >
        {t.toolbar.relayoutBtn}
      </button>
      {hasParentNodes && onToggleCollapseAll && (
        <button
          type="button"
          className={`toolbar-btn toolbar-collapse-all-btn${allParentsCollapsed ? ' active' : ''}`}
          title={allParentsCollapsed ? t.parentCollapse.expandAllTitle : t.parentCollapse.collapseAllTitle}
          onClick={onToggleCollapseAll}
        >
          {allParentsCollapsed ? t.parentCollapse.expandAllBtn : t.parentCollapse.collapseAllBtn}
        </button>
      )}
    </div>
  );
};


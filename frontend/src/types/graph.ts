import type { Node, Edge } from '@xyflow/react';
import type { CSSProperties } from 'react';

// Living TC 4-Stage Taxonomy
export type StatusName = 'Untested' | 'Passed' | 'Failed' | 'Blocked';

export interface ChecklistItem {
  id: string;
  text: string;
  status: StatusName;
  note?: string;
}

export interface ChildSummary {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
}

export interface BadgeData {
  id: string;
  name: string;
  label?: string;
  test_status: StatusName;
  edgeId?: string;
  edgeType?: string;
  properties?: Record<string, unknown>;
  description?: string;
}

export type GlobalBadge = BadgeData;

export interface NodeProperties {
  is_global?: string | boolean;
  is_manual_override?: string | boolean;
  override_reason?: string;
  is_modified?: string | boolean;
  modified_note?: string;
  modified_at?: string;
  acknowledged_at?: string;
  checklist?: ChecklistItem[];
  description?: string;
  domain?: string;
  [key: string]: unknown;
}

export interface CoverageNodeData extends Record<string, unknown> {
  id?: string;
  label: string;
  name: string;
  aliases?: string[];
  domain?: string;
  test_status: StatusName;
  is_manual_override?: boolean;
  override_reason?: string;
  is_modified?: boolean;
  modified_note?: string;
  is_global?: boolean;
  properties?: NodeProperties;
  badges?: BadgeData[];
  hasChildren?: boolean;
  isCollapsed?: boolean;
  childSummary?: ChildSummary;
  expandedStyle?: CSSProperties;
  impactedChildCount?: number;
  activeImpactSlots?: Record<string, number>;
  description?: string;
}

export type CoverageNode = Node<CoverageNodeData>;

export interface EdgeProperties {
  action?: string;
  test_status?: StatusName;
  [key: string]: unknown;
}

export interface CoverageEdgeData extends Record<string, unknown> {
  type?: string;
  action?: string;
  test_status: StatusName;
  properties?: EdgeProperties;
  underlyingEdgeIds?: string[];
  pathOffset?: number;
  edgeIndex?: number;
  totalEdges?: number;
  isReverse?: boolean;
  markerColor?: string;
}

export type CoverageEdge = Edge<CoverageEdgeData>;

export type ApiNode = {
  id: string;
  label: string;
  name: string;
  aliases: string[];
  properties: Record<string, unknown>;
  test_status: string;
  is_manual_override?: boolean;
  override_reason?: string;
  is_global?: boolean;
  description?: string;
};

export type ApiEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  action?: string;
  properties: Record<string, unknown>;
  test_status: string;
};

export interface GraphResponse {
  nodes: ApiNode[];
  edges: ApiEdge[];
  debounce_id?: string;
}

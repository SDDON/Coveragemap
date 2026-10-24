import type { CoverageEdge } from '../types/graph';

// System reserved keys that have dedicated UI form controls and must be excluded from Custom Properties

/**
 * Geometric bundling algorithm for reciprocal and parallel edges.
 * Bundles edges between the same node pairs and calculates quadratic bezier curve shift offsets.
 */
export const calculateEdgeBundling = (edgesList: CoverageEdge[]): CoverageEdge[] => {
  const edgeBundles: Record<string, CoverageEdge[]> = {};
  edgesList.forEach(e => {
    const key = e.source < e.target ? `${e.source}→${e.target}` : `${e.target}→${e.source}`;
    if (!edgeBundles[key]) edgeBundles[key] = [];
    edgeBundles[key].push(e);
  });

  const bundledEdges: CoverageEdge[] = [];
  Object.values(edgeBundles).forEach(bundle => {
    const N = bundle.length;
    bundle.forEach((e, i) => {
      const isReverse = e.source > e.target;
      const absoluteShift = (i - (N - 1) / 2) * 80;
      const pathOffset = isReverse ? -absoluteShift : absoluteShift;
      bundledEdges.push({
        ...e,
        data: { ...(e.data || { test_status: 'Untested' }), pathOffset, edgeIndex: i, totalEdges: N, isReverse }
      });
    });
  });
  return bundledEdges;
};

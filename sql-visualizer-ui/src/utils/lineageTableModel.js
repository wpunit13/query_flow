/**
 * Derive tabular views from lineage graph nodes/edges.
 */

import { getUpstreamNodes } from './lineagePath';

export const TABLE_TABS = {
  SOURCES: 'sources',
  PIPELINE: 'pipeline',
  OPERATIONS: 'operations',
  OUTPUT: 'output',
};

export const VIEW_MODES = {
  GRAPH: 'graph',
  TABLE: 'table',
};

export const STAGE_KINDS = new Set([
  'cte',
  'subquery',
  'final_output',
  'view',
  'insert_target',
  'merge_target',
]);

export const SOURCE_KINDS = new Set(['physical_table', 'view']);

export function formatOperandLabel(node) {
  if (!node) return '—';
  const alias = node.data?.alias;
  const base = node.data?.label || node.id;
  if (alias && alias.toLowerCase() !== base.toLowerCase() && alias.toLowerCase() !== node.id.toLowerCase()) {
    return `${alias} (${base})`;
  }
  return alias || base;
}

/** Primary header label for table nodes — surfaces SQL alias used in join conditions. */
export function formatTableNodeLabel(node) {
  if (!node) return '—';
  return formatOperandLabel(node);
}

export function isPipelineQuery(nodes) {
  return nodes.some(
    (n) => n.data?.kind === 'cte' || n.data?.kind === 'subquery'
  );
}

export function getSourceNodes(nodes) {
  return nodes
    .filter(
      (n) =>
        n.type !== 'joinNode' &&
        n.type !== 'unionNode' &&
        SOURCE_KINDS.has(n.data?.kind)
    )
    .sort((a, b) => (a.data?.label || a.id).localeCompare(b.data?.label || b.id));
}

export function parseJoinStageId(joinNodeId) {
  const match = joinNodeId.match(/^join_(.+)_(\d+)$/);
  if (!match) return { stageId: null, order: 0 };
  return { stageId: match[1], order: parseInt(match[2], 10) };
}

export function parseUnionStageId(unionNodeId) {
  const match = unionNodeId.match(/^union_(.+)_(\d+)$/);
  if (!match) return { stageId: null, order: 0 };
  return { stageId: match[1], order: parseInt(match[2], 10) };
}

export function getStageNodes(nodes) {
  return nodes.filter(
    (n) =>
      n.type !== 'joinNode' &&
      n.type !== 'unionNode' &&
      STAGE_KINDS.has(n.data?.kind)
  );
}

export function topologicalSortStages(nodes, edges) {
  const stages = getStageNodes(nodes);
  const stageIds = new Set(stages.map((s) => s.id));
  const deps = new Map();
  stages.forEach((s) => deps.set(s.id, new Set()));

  stages.forEach((s) => {
    const upstream = getUpstreamNodes(s.id, edges);
    upstream.forEach((id) => {
      if (stageIds.has(id) && id !== s.id) deps.get(s.id).add(id);
    });
  });

  const sorted = [];
  const remaining = new Set(stageIds);

  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) => {
      const d = deps.get(id);
      return [...d].every((dep) => !remaining.has(dep));
    });
    if (ready.length === 0) {
      [...remaining].sort().forEach((id) => sorted.push(id));
      break;
    }
    ready.sort((a, b) => a.localeCompare(b));
    ready.forEach((id) => {
      sorted.push(id);
      remaining.delete(id);
    });
  }

  const finalIdx = sorted.indexOf('Final_Output');
  if (finalIdx >= 0 && finalIdx !== sorted.length - 1) {
    sorted.splice(finalIdx, 1);
    sorted.push('Final_Output');
  }

  return sorted.map((id) => nodes.find((n) => n.id === id)).filter(Boolean);
}

export function getJoinOperations(nodes, edges) {
  return getAllOperations(nodes, edges);
}

export function getAllOperations(nodes, edges) {
  const joinOps = nodes
    .filter((n) => n.type === 'joinNode')
    .map((jn) => {
      const { stageId, order } = parseJoinStageId(jn.id);
      const storedOperands = jn.data?.join_operands || [];
      const leftStored = storedOperands.find((o) => o.side === 'left');
      const rightStored = storedOperands.find((o) => o.side === 'right');

      const incoming = edges.filter((e) => e.target === jn.id);
      const operands = incoming.map((e) => {
        const src = nodes.find((n) => n.id === e.source);
        return {
          id: e.source,
          label: formatOperandLabel(src) || e.source,
          kind: src?.data?.kind,
        };
      });

      const left = leftStored
        ? { id: leftStored.id, label: leftStored.label, kind: 'operand' }
        : operands[0];
      const right = rightStored
        ? { id: rightStored.id, label: rightStored.label, kind: 'operand' }
        : operands[1];

      return {
        id: jn.id,
        opKind: 'join',
        stageId,
        stageLabel: stageId || '—',
        order,
        opType: jn.data?.join_type || jn.data?.label || 'JOIN',
        joinType: jn.data?.join_type || jn.data?.label || 'JOIN',
        conditions: jn.data?.conditions || [],
        operands: storedOperands.length > 0 ? storedOperands : operands,
        left,
        right,
        branches: [],
      };
    });

  const unionOps = nodes
    .filter((n) => n.type === 'unionNode')
    .map((un) => {
      const { stageId, order } = parseUnionStageId(un.id);
      const branches = un.data?.branches || [];
      const operands = branches.map((b) => ({
        id: b.tail_id,
        label: b.label,
        kind: 'branch',
      }));

      return {
        id: un.id,
        opKind: 'union',
        stageId,
        stageLabel: stageId || '—',
        order,
        opType: un.data?.union_type || un.data?.label || 'UNION',
        joinType: un.data?.union_type || un.data?.label || 'UNION',
        branchCount: un.data?.branch_count || branches.length,
        conditions: [],
        operands,
        branches,
        left: operands[0],
        right: operands[1],
      };
    });

  const clauseOps = [];
  nodes.forEach((n) => {
    if (n.type === 'joinNode' || n.type === 'unionNode') return;
    const stageId = n.id;
    const stageLabel = n.data?.label || n.id;
    const d = n.data || {};

    if (d.where_clause) {
      clauseOps.push({
        id: `where_${stageId}`,
        opKind: 'where',
        stageId,
        stageLabel,
        order: 100,
        opType: 'WHERE',
        detail: d.where_clause,
        operands: [],
        conditions: [d.where_clause],
        branches: [],
      });
    }

    if (d.group_by && d.group_by.length > 0) {
      clauseOps.push({
        id: `groupby_${stageId}`,
        opKind: 'group_by',
        stageId,
        stageLabel,
        order: 200,
        opType: 'GROUP BY',
        detail: d.group_by.join(', '),
        operands: [],
        conditions: [],
        branches: [],
      });
    }

    if (d.having_clause) {
      clauseOps.push({
        id: `having_${stageId}`,
        opKind: 'having',
        stageId,
        stageLabel,
        order: 300,
        opType: 'HAVING',
        detail: d.having_clause,
        operands: [],
        conditions: [d.having_clause],
        branches: [],
      });
    }

    if (d.qualify_clause) {
      clauseOps.push({
        id: `qualify_${stageId}`,
        opKind: 'qualify',
        stageId,
        stageLabel,
        order: 400,
        opType: 'QUALIFY',
        detail: d.qualify_clause,
        operands: [],
        conditions: [d.qualify_clause],
        branches: [],
      });
    }
  });

  return [...unionOps, ...joinOps, ...clauseOps].sort((a, b) => {
    if (a.stageId !== b.stageId) {
      return (a.stageId || '').localeCompare(b.stageId || '');
    }
    return a.order - b.order;
  });
}

export function getStageOperationSummary(stageId, operations) {
  const ops = operations.filter((o) => o.stageId === stageId);
  if (ops.length === 0) return '—';
  const unions = ops.filter((o) => o.opKind === 'union');
  const joins = ops.filter((o) => o.opKind === 'join');
  const groupBys = ops.filter((o) => o.opKind === 'group_by');
  const wheres = ops.filter((o) => o.opKind === 'where');
  const havings = ops.filter((o) => o.opKind === 'having');
  const qualifies = ops.filter((o) => o.opKind === 'qualify');
  const parts = [];
  if (unions.length > 0) {
    const types = [...new Set(unions.map((o) => o.opType))];
    parts.push(`${unions.length} union(s): ${types.join(', ')}`);
  }
  if (joins.length > 0) {
    const types = [...new Set(joins.map((o) => o.opType))];
    parts.push(`${joins.length} join(s): ${types.join(', ')}`);
  }
  if (wheres.length > 0) {
    parts.push('Where filter');
  }
  if (groupBys.length > 0) {
    parts.push('Group By');
  }
  if (havings.length > 0) {
    parts.push('Having filter');
  }
  if (qualifies.length > 0) {
    parts.push('Qualify');
  }
  return parts.join('; ');
}

export function getSourcesUsedInStage(stageId, nodes, edges) {
  const upstream = getUpstreamNodes(stageId, edges);
  return nodes
    .filter((n) => SOURCE_KINDS.has(n.data?.kind) && upstream.has(n.id))
    .map((n) => n.data?.label || n.id);
}

export function getOutputNode(nodes) {
  return (
    nodes.find((n) => n.id === 'Final_Output') ||
    nodes.find((n) => n.data?.kind === 'final_output')
  );
}

export function getColumnSourcesText(entry) {
  const sources = entry?.sources || [];
  return sources.length > 0 ? sources.join(', ') : '—';
}

export function isNodeInColumnPath(nodeId, highlight) {
  if (!highlight) return true;
  return (
    highlight.upstreamNodes.has(nodeId) || highlight.sourceNodeIds.has(nodeId)
  );
}

export function filterOperationsForColumn(operations, highlight) {
  if (!highlight) return operations;
  return operations.filter(
    (op) =>
      highlight.upstreamNodes.has(op.id) ||
      op.operands.some((operand) => highlight.upstreamNodes.has(operand.id)) ||
      (op.branches || []).some((b) => highlight.upstreamNodes.has(b.tail_id))
  );
}

export function filterOperationsForStage(operations, stageId) {
  return operations.filter((op) => op.stageId === stageId);
}

export function getDefaultExpandedStageId(nodes) {
  const output = getOutputNode(nodes);
  if (output) return output.id;
  const stages = topologicalSortStages(nodes, []);
  return stages[stages.length - 1]?.id || null;
}

export function getDefaultTableTab(nodes) {
  return isPipelineQuery(nodes) ? TABLE_TABS.PIPELINE : TABLE_TABS.SOURCES;
}

/** Table tab when a large graph auto-opens table overview (not graph view). */
export function getLargeQueryOverviewTableTab() {
  return TABLE_TABS.OUTPUT;
}

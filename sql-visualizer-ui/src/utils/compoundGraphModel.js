/**
 * Group flat lineage nodes into CTE / pipeline stages for compound graph view.
 */

import { getUpstreamNodes } from './lineagePath';
import {
  getStageNodes,
  topologicalSortStages,
  getJoinOperations,
  getStageOperationSummary,
  getSourcesUsedInStage,
  isPipelineQuery,
  parseJoinStageId,
  parseUnionStageId,
} from './lineageTableModel';
import { isPipelineStageGraphSize } from '../constants/overviewMode';

export const STAGE_GROUP_PREFIX = 'stage_group_';

export function toStageGroupId(stageId) {
  return `${STAGE_GROUP_PREFIX}${stageId}`;
}

export function fromStageGroupId(groupId) {
  if (!groupId?.startsWith(STAGE_GROUP_PREFIX)) return null;
  return groupId.slice(STAGE_GROUP_PREFIX.length);
}

export function isStageGroupNodeId(nodeId) {
  return nodeId?.startsWith(STAGE_GROUP_PREFIX);
}

export function isCompoundGraphEligible(nodes) {
  if (!nodes?.length) return false;
  return isPipelineStageGraphSize(nodes.length) && isPipelineQuery(nodes);
}

/** Pipeline stage outputs that stop inward traversal — inline subqueries stay inside the CTE. */
const COMPOUND_STAGE_BOUNDARY_KINDS = new Set([
  'cte',
  'final_output',
  'view',
  'insert_target',
  'merge_target',
]);

function getCompoundStageBoundaryIds(nodes, activeStageId) {
  return new Set(
    nodes
      .filter(
        (n) =>
          n.type !== 'joinNode' &&
          n.type !== 'unionNode' &&
          COMPOUND_STAGE_BOUNDARY_KINDS.has(n.data?.kind) &&
          n.id !== activeStageId
      )
      .map((n) => n.id)
  );
}

/** Nodes inside one stage — stop at other CTE outputs, not inline subqueries. */
export function getInternalNodesForStage(stageId, nodes, edges) {
  const boundaryIds = getCompoundStageBoundaryIds(nodes, stageId);
  const internal = new Set([stageId]);
  const queue = [stageId];
  const visited = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    edges.forEach((e) => {
      if (e.hidden) return;
      if (e.target !== current) return;
      const src = e.source;
      if (boundaryIds.has(src)) return;
      if (!internal.has(src)) {
        internal.add(src);
        queue.push(src);
      }
    });
  }

  return internal;
}

export function findStageContainingNode(nodeId, nodes, edges) {
  const stages = getStageNodes(nodes);
  for (const stage of stages) {
    const internal = getInternalNodesForStage(stage.id, nodes, edges);
    if (internal.has(nodeId)) return stage.id;
  }
  return null;
}

/** Direct stage-to-stage edges (CTE references another CTE). */
export function buildStageMacroEdges(nodes, edges) {
  const stages = getStageNodes(nodes);
  const stageIds = new Set(stages.map((s) => s.id));
  const macroEdges = [];
  const seen = new Set();

  stages.forEach((stage) => {
    const upstream = getUpstreamNodes(stage.id, edges);
    upstream.forEach((srcId) => {
      if (!stageIds.has(srcId) || srcId === stage.id) return;
      const id = `macro_${srcId}_${stage.id}`;
      if (seen.has(id)) return;
      seen.add(id);
      macroEdges.push({ from: srcId, to: stage.id, id });
    });
  });

  return macroEdges;
}

export function buildStageGroupMeta(nodes, edges) {
  const operations = getJoinOperations(nodes, edges);
  const sorted = topologicalSortStages(nodes, edges);
  const macroEdges = buildStageMacroEdges(nodes, edges);

  return sorted.map((stage) => {
    const stageId = stage.id;
    const internal = getInternalNodesForStage(stageId, nodes, edges);
    const joinCount = [...internal].filter((id) => {
      const n = nodes.find((node) => node.id === id);
      return n?.type === 'joinNode';
    }).length;
    const unionCount = [...internal].filter((id) => {
      const n = nodes.find((node) => node.id === id);
      return n?.type === 'unionNode';
    }).length;
    const sourceNames = getSourcesUsedInStage(stageId, nodes, edges);

    return {
      stageId,
      stageNode: stage,
      groupId: toStageGroupId(stageId),
      label: stage.data?.label || stageId,
      kind: stage.data?.kind,
      columnCount: stage.data?.columns?.length || 0,
      operationSummary: getStageOperationSummary(stageId, operations),
      joinCount,
      unionCount,
      sourceCount: sourceNames.length,
      sourcePreview: sourceNames.slice(0, 3).join(', '),
      upstreamStageIds: macroEdges
        .filter((e) => e.to === stageId)
        .map((e) => e.from),
    };
  });
}

/** Map flat lineage highlight sets onto compound display node ids. */
export function mapHighlightToCompoundDisplay(
  flatNodeIds,
  nodes,
  edges,
  expandedStages
) {
  const stageIds = new Set(getStageNodes(nodes).map((s) => s.id));
  const displayIds = new Set();
  const sourceIds =
    flatNodeIds instanceof Set ? flatNodeIds : new Set(flatNodeIds);

  sourceIds.forEach((id) => {
    if (stageIds.has(id)) {
      displayIds.add(toStageGroupId(id));
      return;
    }

    const ownerStage = findStageContainingNode(id, nodes, edges);
    if (ownerStage && expandedStages.has(ownerStage)) {
      displayIds.add(id);
      displayIds.add(toStageGroupId(ownerStage));
    } else if (ownerStage) {
      displayIds.add(toStageGroupId(ownerStage));
    } else {
      displayIds.add(id);
    }
  });

  return displayIds;
}

/** True when a compound-view edge is on the highlighted lineage path. */
export function isCompoundDisplayEdgeHighlighted(edge, highlightEdges, displayNodeIds) {
  if (displayNodeIds.has(edge.source) && displayNodeIds.has(edge.target)) {
    return true;
  }
  const flatId = edge.id.startsWith('compound_')
    ? edge.id.slice('compound_'.length)
    : edge.id;
  return highlightEdges.has(flatId) || highlightEdges.has(edge.id);
}

export function getJoinOrUnionStageId(node) {
  if (node.type === 'joinNode') {
    return parseJoinStageId(node.id).stageId;
  }
  if (node.type === 'unionNode') {
    return parseUnionStageId(node.id).stageId;
  }
  return null;
}

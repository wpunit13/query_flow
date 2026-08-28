/** Node count at which we default to table overview instead of full graph. */
export const LARGE_GRAPH_NODE_THRESHOLD = 40;

/** Pipeline stage graph (compound) — CTE/subquery queries at or above this size. */
export const PIPELINE_STAGE_NODE_THRESHOLD = 8;

export function isLargeLineageGraph(nodeCount) {
  return nodeCount >= LARGE_GRAPH_NODE_THRESHOLD;
}

export function isPipelineStageGraphSize(nodeCount) {
  return nodeCount >= PIPELINE_STAGE_NODE_THRESHOLD;
}

export function buildOverviewToastMessage(nodeCount, edgeCount) {
  return `Large lineage (${nodeCount} nodes, ${edgeCount} edges). Opened Pipeline table for overview. Graph defaults to pipeline stages — use Full graph in the toolbar for every table node.`;
}

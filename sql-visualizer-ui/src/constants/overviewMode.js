/** Node count at which we default to table overview instead of full graph. */
export const LARGE_GRAPH_NODE_THRESHOLD = 40;

export function isLargeLineageGraph(nodeCount) {
  return nodeCount >= LARGE_GRAPH_NODE_THRESHOLD;
}

export function buildOverviewToastMessage(nodeCount, edgeCount) {
  return `Large lineage (${nodeCount} nodes, ${edgeCount} edges). Opened Pipeline table for overview. Pick a stage, then use Graph or G to see it on the canvas.`;
}

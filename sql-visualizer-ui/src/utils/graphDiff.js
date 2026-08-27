/**
 * Compare two graph snapshots for diff mode.
 */
export function computeGraphDiff(previous, current) {
  const prevNodeIds = new Set((previous?.nodes || []).map((n) => n.id));
  const currNodeIds = new Set((current?.nodes || []).map((n) => n.id));
  const prevEdgeIds = new Set((previous?.edges || []).map((e) => e.id));
  const currEdgeIds = new Set((current?.edges || []).map((e) => e.id));

  const addedNodes = [...currNodeIds].filter((id) => !prevNodeIds.has(id));
  const removedNodes = [...prevNodeIds].filter((id) => !currNodeIds.has(id));
  const addedEdges = [...currEdgeIds].filter((id) => !prevEdgeIds.has(id));
  const removedEdges = [...prevEdgeIds].filter((id) => !currEdgeIds.has(id));

  return {
    addedNodes: new Set(addedNodes),
    removedNodes: new Set(removedNodes),
    addedEdges: new Set(addedEdges),
    removedEdges: new Set(removedEdges),
    hasChanges:
      addedNodes.length > 0 ||
      removedNodes.length > 0 ||
      addedEdges.length > 0 ||
      removedEdges.length > 0,
  };
}

export function applyDiffToNodes(nodes, diff) {
  if (!diff) return nodes;
  return nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      diffStatus: diff.addedNodes.has(n.id) ? 'added' : 'unchanged',
    },
  }));
}

export function applyDiffToEdges(edges, diff) {
  if (!diff) return edges;
  return edges.map((e) => ({
    ...e,
    data: {
      ...e.data,
      diffStatus: diff.addedEdges.has(e.id) ? 'added' : 'unchanged',
    },
  }));
}

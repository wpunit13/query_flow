/**
 * Upstream / downstream traversal and breadcrumb paths.
 */

export function getUpstreamNodes(nodeId, edges) {
  const nodes = new Set([nodeId]);
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    edges.forEach((e) => {
      if (e.hidden) return;
      if (e.target === current && !nodes.has(e.source)) {
        nodes.add(e.source);
        queue.push(e.source);
      }
    });
  }
  return nodes;
}

export function getDownstreamNodes(nodeId, edges) {
  const nodes = new Set([nodeId]);
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    edges.forEach((e) => {
      if (e.hidden) return;
      if (e.source === current && !nodes.has(e.target)) {
        nodes.add(e.target);
        queue.push(e.target);
      }
    });
  }
  return nodes;
}

export function getBreadcrumbPath(nodeId, nodes, edges) {
  const paths = [];

  function walk(currentId, path, visited) {
    if (visited.has(currentId)) return;
    const newVisited = new Set(visited);
    newVisited.add(currentId);
    const newPath = [...path, currentId];

    const incoming = edges.filter((e) => !e.hidden && e.target === currentId);
    if (incoming.length === 0) {
      paths.push(newPath);
      return;
    }
    incoming.forEach((e) => walk(e.source, newPath, newVisited));
  }

  walk(nodeId, [], new Set());

  const longest = paths.sort((a, b) => b.length - a.length)[0] || [nodeId];
  return longest.map((id) => {
    const node = nodes.find((n) => n.id === id);
    return { id, label: node?.data?.label || id };
  });
}

/**
 * Resolve column lineage sources to node ids and highlight upstream path.
 */
export function getColumnLineageHighlight(nodeId, columnName, nodes, edges) {
  const node = nodes.find((n) => n.id === nodeId);
  const entry = node?.data?.column_lineage?.find((c) => c.name === columnName);
  const sources = entry?.sources || [];

  const sourceTableNames = new Set(
    sources.map((s) => s.split('.')[0]?.toLowerCase()).filter(Boolean)
  );

  const upstreamNodes = getUpstreamNodes(nodeId, edges);
  const upstreamEdges = new Set();
  edges.forEach((e) => {
    if (e.hidden) return;
    if (upstreamNodes.has(e.source) && upstreamNodes.has(e.target)) {
      upstreamEdges.add(e.id);
    }
  });

  const sourceNodeIds = new Set();
  nodes.forEach((n) => {
    const label = (n.data?.label || n.id).toLowerCase();
    const id = n.id.toLowerCase();
    if (sourceTableNames.has(label) || sourceTableNames.has(id)) {
      sourceNodeIds.add(n.id);
    }
    sourceTableNames.forEach((ref) => {
      if (id.includes(ref) || label.includes(ref)) sourceNodeIds.add(n.id);
    });
  });

  return {
    upstreamNodes,
    upstreamEdges,
    sourceNodeIds,
    columnName,
    sources,
  };
}

export function getBranchFilterVisibleIds(nodes, edges, filterText) {
  if (!filterText?.trim()) return null;

  const lower = filterText.toLowerCase();
  const matchIds = nodes
    .filter(
      (n) =>
        n.data?.label?.toLowerCase().includes(lower) ||
        n.id.toLowerCase().includes(lower) ||
        n.data?.qualified_name?.toLowerCase().includes(lower)
    )
    .map((n) => n.id);

  if (matchIds.length === 0) return new Set();

  const visible = new Set();
  matchIds.forEach((matchId) => {
    visible.add(matchId);
    getUpstreamNodes(matchId, edges).forEach((id) => visible.add(id));
    getDownstreamNodes(matchId, edges).forEach((id) => visible.add(id));
  });
  return visible;
}

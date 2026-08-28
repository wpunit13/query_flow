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

const STAGE_KINDS = new Set([
  'cte',
  'subquery',
  'final_output',
  'view',
  'insert_target',
  'merge_target',
]);

const SOURCE_KINDS = new Set(['physical_table', 'view']);

function friendlyStageLabel(node) {
  if (!node) return '';
  if (node.id === 'Final_Output' || node.data?.kind === 'final_output') {
    return 'Final output';
  }
  return node.data?.label || node.id;
}

/**
 * Human-readable column trace — pipeline stages + source refs, not raw join hops.
 */
export function getColumnTraceSummary(nodeId, columnName, nodes, edges) {
  const node = nodes.find((n) => n.id === nodeId);
  const entry = node?.data?.column_lineage?.find((c) => c.name === columnName);
  const sources = entry?.sources || [];

  const { upstreamNodes, sourceNodeIds } = getColumnLineageHighlight(
    nodeId,
    columnName,
    nodes,
    edges
  );

  const pipelineStages = nodes
    .filter(
      (n) =>
        upstreamNodes.has(n.id) &&
        n.type !== 'joinNode' &&
        n.type !== 'unionNode' &&
        STAGE_KINDS.has(n.data?.kind) &&
        n.id !== nodeId
    )
    .sort((a, b) => {
      const aDeps = getUpstreamNodes(a.id, edges);
      const bDeps = getUpstreamNodes(b.id, edges);
      if (aDeps.has(b.id)) return 1;
      if (bDeps.has(a.id)) return -1;
      return a.id.localeCompare(b.id);
    })
    .map((n) => ({
      id: n.id,
      label: friendlyStageLabel(n),
      kind: n.data?.kind,
    }));

  const sourceTables = nodes
    .filter((n) => sourceNodeIds.has(n.id) && SOURCE_KINDS.has(n.data?.kind))
    .map((n) => ({
      id: n.id,
      label: n.data?.label || n.id,
    }));

  const sourceRefs = sources.map((ref) => {
    const alias = ref.split('.')[0]?.toLowerCase();
    const col = ref.includes('.') ? ref.split('.').slice(1).join('.') : ref;
    const matched = nodes.find(
      (n) =>
        upstreamNodes.has(n.id) &&
        (n.data?.label?.toLowerCase() === alias ||
          n.id.toLowerCase() === alias ||
          (alias && n.id.toLowerCase().includes(alias)))
    );
    return {
      ref,
      column: col,
      tableLabel: matched
        ? matched.data?.kind === 'physical_table'
          ? matched.data?.label || matched.id
          : `${matched.data?.label || matched.id} (${col})`
        : ref,
      nodeId: matched?.id,
    };
  });

  const unionMerges = nodes
    .filter((n) => n.type === 'unionNode' && upstreamNodes.has(n.id))
    .map((n) => ({
      id: n.id,
      unionType: n.data?.union_type || n.data?.label,
      branchCount: n.data?.branch_count || (n.data?.branches || []).length,
      branches: n.data?.branches || [],
      stageLabel: n.data?.label || n.id,
    }));

  return {
    columnName,
    outputLabel: friendlyStageLabel(node),
    outputNodeId: nodeId,
    pipelineStages,
    unionMerges,
    sourceTables,
    sourceRefs,
  };
}

/**
 * Breadcrumb for node selection — stages only (skip join nodes).
 */
export function getStageBreadcrumbPath(nodeId, nodes, edges) {
  const full = getBreadcrumbPath(nodeId, nodes, edges);
  return full
    .filter((item) => {
      const node = nodes.find((n) => n.id === item.id);
      return node?.type !== 'joinNode';
    })
    .map((item) => {
      const node = nodes.find((n) => n.id === item.id);
      return { id: item.id, label: friendlyStageLabel(node) };
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
    .filter((n) => {
      const label = n.data?.label?.toLowerCase();
      const qualified = n.data?.qualified_name?.toLowerCase();
      return (
        (label && label.includes(lower)) ||
        n.id.toLowerCase().includes(lower) ||
        (qualified && qualified.includes(lower))
      );
    })
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

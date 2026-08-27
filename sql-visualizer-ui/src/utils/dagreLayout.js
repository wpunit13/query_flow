import dagre from 'dagre';

export const LAYOUT_MODES = {
  TB: 'TB',
  LR: 'LR',
  RADIAL: 'RADIAL',
};

export const ensureNodePositions = (nodes) =>
  nodes.map((node) => ({
    ...node,
    position:
      node.position &&
      Number.isFinite(node.position.x) &&
      Number.isFinite(node.position.y)
        ? node.position
        : { x: 0, y: 0 },
  }));

export const getNodeDimensions = (node) => {
  if (node.type === 'joinNode') return { width: 180, height: 40 };
  const colCount = node.data?.columns?.length || 0;
  return { width: 240, height: colCount > 0 ? 48 : 44 };
};

function layoutRadial(nodes, edges) {
  const visibleNodes = nodes.filter((n) => !n.hidden);
  const visibleEdges = edges.filter((e) => !e.hidden);

  const levels = new Map();
  const incomingCount = new Map();
  visibleNodes.forEach((n) => incomingCount.set(n.id, 0));
  visibleEdges.forEach((e) => {
    incomingCount.set(e.target, (incomingCount.get(e.target) || 0) + 1);
  });

  const roots = visibleNodes.filter((n) => incomingCount.get(n.id) === 0).map((n) => n.id);
  roots.forEach((id) => levels.set(id, 0));

  let frontier = [...roots];
  const visited = new Set(roots);
  while (frontier.length > 0) {
    const next = [];
    frontier.forEach((id) => {
      visibleEdges
        .filter((e) => e.source === id)
        .forEach((e) => {
          const newLevel = (levels.get(id) || 0) + 1;
          if (!levels.has(e.target) || levels.get(e.target) < newLevel) {
            levels.set(e.target, newLevel);
          }
          if (!visited.has(e.target)) {
            visited.add(e.target);
            next.push(e.target);
          }
        });
    });
    frontier = next;
  }

  visibleNodes.forEach((n) => {
    if (!levels.has(n.id)) levels.set(n.id, 0);
  });

  const byLevel = {};
  visibleNodes.forEach((n) => {
    const level = levels.get(n.id);
    if (!byLevel[level]) byLevel[level] = [];
    byLevel[level].push(n);
  });

  const centerX = 500;
  const centerY = 450;

  const layoutedNodes = nodes.map((node) => {
    if (node.hidden) {
      return {
        ...node,
        position: node.position ?? { x: 0, y: 0 },
      };
    }
    const level = levels.get(node.id) || 0;
    const group = byLevel[level] || [node];
    const index = group.findIndex((n) => n.id === node.id);
    const count = group.length;
    const radius = 100 + level * 160;
    const angle = (2 * Math.PI * index) / Math.max(count, 1) - Math.PI / 2;
    const { width, height } = getNodeDimensions(node);
    return {
      ...node,
      position: {
        x: centerX + radius * Math.cos(angle) - width / 2,
        y: centerY + radius * Math.sin(angle) - height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export const getLayoutedElements = (nodes, edges, layoutMode = LAYOUT_MODES.TB) => {
  if (layoutMode === LAYOUT_MODES.RADIAL) {
    return layoutRadial(nodes, edges);
  }

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  const rankdir = layoutMode === LAYOUT_MODES.LR ? 'LR' : 'TB';
  dagreGraph.setGraph({ rankdir, nodesep: 80, ranksep: 90 });

  nodes.forEach((node) => {
    if (!node.hidden) {
      const { width, height } = getNodeDimensions(node);
      dagreGraph.setNode(node.id, { width, height });
    }
  });

  edges.forEach((edge) => {
    if (!edge.hidden) dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    if (node.hidden) {
      return {
        ...node,
        position: node.position ?? { x: 0, y: 0 },
      };
    }
    const nodeWithPosition = dagreGraph.node(node.id);
    if (!nodeWithPosition) {
      return {
        ...node,
        position: node.position ?? { x: 0, y: 0 },
      };
    }
    const { width, height } = getNodeDimensions(node);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export const styleApiEdges = (edges) =>
  edges.map((edge) => ({
    ...edge,
    type: 'default',
    animated: false,
    style: { stroke: '#94a3b8', strokeWidth: 2, transition: 'all 0.3s ease' },
  }));

export const initializeApiNodes = (nodes) =>
  nodes.map((n) => ({
    ...n,
    hidden: false,
    data: { ...n.data, collapsed: false },
  }));

export const applyVisibilityFilter = (nodes, edges, visibleIds) => {
  if (!visibleIds) {
    return {
      nodes: nodes.map((n) => ({ ...n, hidden: false })),
      edges: edges.map((e) => ({ ...e, hidden: false })),
    };
  }
  return {
    nodes: nodes.map((n) => ({ ...n, hidden: !visibleIds.has(n.id) })),
    edges: edges.map((e) => ({
      ...e,
      hidden: !visibleIds.has(e.source) || !visibleIds.has(e.target),
    })),
  };
};

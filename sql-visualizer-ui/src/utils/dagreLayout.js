import dagre from 'dagre';

export const LAYOUT_MODES = {
  TB: 'TB',
  LR: 'LR',
  RADIAL: 'RADIAL',
};

const TABLE_WIDTH = 240;
const JOIN_WIDTH_COLLAPSED = 180;
const JOIN_WIDTH_EXPANDED = 220;
const HEADER_HEIGHT = 48;
const COLLAPSED_TABLE_HEIGHT = 48;
const EMPTY_TABLE_HEIGHT = 44;
const JOIN_HEADER_HEIGHT = 40;
const JOIN_CONDITION_ROW = 36;
const COLUMN_ROW_HEIGHT = 28;
const COLUMN_ROW_WITH_SOURCES = 44;
const COLUMN_LIST_PADDING = 8;

function horizontalOverlap(ax, aw, bx, bw) {
  return ax < bx + bw && ax + aw > bx;
}

function columnRowHeight(node, col) {
  const lineage = node.data?.column_lineage || [];
  const entry = lineage.find((e) => e.name === col);
  const sources = entry?.sources?.length || 0;
  return sources > 0 ? COLUMN_ROW_WITH_SOURCES : COLUMN_ROW_HEIGHT;
}

/** Estimated node size for dagre layout and expand/collapse shifts. */
export const getNodeDimensions = (node) => {
  if (node.type === 'joinNode') {
    const conditions = node.data?.conditions?.length || 0;
    if (!node.data?.expanded || conditions === 0) {
      return { width: JOIN_WIDTH_COLLAPSED, height: JOIN_HEADER_HEIGHT };
    }
    return {
      width: JOIN_WIDTH_EXPANDED,
      height: JOIN_HEADER_HEIGHT + conditions * JOIN_CONDITION_ROW,
    };
  }

  const colCount = node.data?.columns?.length || 0;
  if (!colCount) {
    return { width: TABLE_WIDTH, height: EMPTY_TABLE_HEIGHT };
  }

  if (!node.data?.expanded) {
    return { width: TABLE_WIDTH, height: COLLAPSED_TABLE_HEIGHT };
  }

  const columns = node.data.columns || [];
  const rowsHeight = columns.reduce((sum, col) => sum + columnRowHeight(node, col), 0);
  return {
    width: TABLE_WIDTH,
    height: HEADER_HEIGHT + COLUMN_LIST_PADDING + rowsHeight,
  };
};

function getShiftIds(nodes, edges, nodeId, layoutMode, expanded) {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return new Set();

  const toggledExpanded = { ...node, data: { ...node.data, expanded } };
  const collapsedDims = getNodeDimensions({
    ...node,
    data: { ...node.data, expanded: !expanded },
  });
  const expandedDims = getNodeDimensions(toggledExpanded);
  const delta = expandedDims.height - collapsedDims.height;
  if (delta === 0) return new Set();

  const downstream = getDownstreamNodes(nodeId, edges);
  downstream.delete(nodeId);

  const shiftIds = new Set(downstream);
  const oldEdge =
    layoutMode === LAYOUT_MODES.LR
      ? node.position.x + collapsedDims.width
      : node.position.y + collapsedDims.height;
  const newFarEdge =
    layoutMode === LAYOUT_MODES.LR
      ? node.position.x + expandedDims.width
      : node.position.y + expandedDims.height;

  nodes.forEach((n) => {
    if (n.id === nodeId || shiftIds.has(n.id)) return;
    const { width, height } = getNodeDimensions(n);
    if (layoutMode === LAYOUT_MODES.LR) {
      const overlapsVert =
        n.position.y < node.position.y + expandedDims.height &&
        n.position.y + height > node.position.y;
      const overlapsHoriz =
        n.position.x < newFarEdge && n.position.x + width > oldEdge - 1;
      if (overlapsVert && overlapsHoriz) shiftIds.add(n.id);
    } else {
      const overlapsHoriz = horizontalOverlap(
        node.position.x,
        expandedDims.width,
        n.position.x,
        width
      );
      const overlapsVert =
        n.position.y < newFarEdge && n.position.y + height > oldEdge - 1;
      if (overlapsHoriz && overlapsVert) shiftIds.add(n.id);
    }
  });

  return shiftIds;
}

/** Shift nodes to make room when a node expands or collapses (TB/LR). Radial falls back to relayout. */
export function adjustLayoutForExpandedToggle(nodes, edges, nodeId, layoutMode) {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return nodes;

  const expanded = !node.data?.expanded;
  const toggledNodes = nodes.map((n) =>
    n.id === nodeId ? { ...n, data: { ...n.data, expanded } } : n
  );

  if (layoutMode === LAYOUT_MODES.RADIAL) {
    return getLayoutedElements(toggledNodes, edges, layoutMode).nodes;
  }

  const collapsedDims = getNodeDimensions({
    ...node,
    data: { ...node.data, expanded: !expanded },
  });
  const expandedDims = getNodeDimensions({
    ...node,
    data: { ...node.data, expanded },
  });
  const delta =
    layoutMode === LAYOUT_MODES.LR
      ? expandedDims.width - collapsedDims.width
      : expandedDims.height - collapsedDims.height;

  if (delta === 0) return toggledNodes;

  const shiftIds = getShiftIds(nodes, edges, nodeId, layoutMode, expanded);

  return toggledNodes.map((n) => {
    if (!shiftIds.has(n.id)) return n;
    if (layoutMode === LAYOUT_MODES.LR) {
      return { ...n, position: { ...n.position, x: n.position.x + delta } };
    }
    return { ...n, position: { ...n.position, y: n.position.y + delta } };
  });
}

function getDownstreamNodes(nodeId, edges) {
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
  dagreGraph.setGraph({ rankdir, nodesep: 80, ranksep: 100 });

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
    data: { ...n.data, collapsed: false, expanded: false },
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

import dagre from 'dagre';

export const LAYOUT_MODES = {
  TB: 'TB',
  LR: 'LR',
  RADIAL: 'RADIAL',
};

const TABLE_WIDTH = 240;
const TABLE_MIN_WIDTH = 240;
/** Cap header width — longer names truncate with ellipsis + hover tooltip. */
export const TABLE_MAX_WIDTH = 480;
const CHAR_WIDTH_ESTIMATE = 7.5;
const TABLE_ICON_WIDTH = 22;
const KIND_BADGE_WIDTH = 44;
const COL_COUNT_WIDTH = 56;
const HEADER_ACTIONS_WIDTH = 56;
const HEADER_PADDING = 28;
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
const MIN_NODESEP = 100;
const MIN_RANKSEP = 120;
const OVERLAP_GAP = 36;

function horizontalOverlap(ax, aw, bx, bw) {
  return ax < bx + bw && ax + aw > bx;
}

function columnRowHeight(node, col) {
  const lineage = node.data?.column_lineage || [];
  const entry = lineage.find((e) => e.name === col);
  const sources = entry?.sources?.length || 0;
  return sources > 0 ? COLUMN_ROW_WITH_SOURCES : COLUMN_ROW_HEIGHT;
}

/** Header row can grow past minWidth when labels are long — layout must match rendered width. */
function estimateTableWidth(node) {
  const label = String(node.data?.label || '');
  const hasKind = Boolean(node.data?.kind);
  const colCount = node.data?.columns?.length || 0;
  const showColCount = colCount > 0 && !node.data?.expanded;

  let width =
    HEADER_PADDING +
    TABLE_ICON_WIDTH +
    label.length * CHAR_WIDTH_ESTIMATE +
    HEADER_ACTIONS_WIDTH;
  if (hasKind) width += KIND_BADGE_WIDTH;
  if (showColCount) width += COL_COUNT_WIDTH;

  return Math.min(
    TABLE_MAX_WIDTH,
    Math.max(TABLE_MIN_WIDTH, Math.ceil(width))
  );
}

/** Estimated node size for dagre layout and expand/collapse shifts. */
export const getNodeDimensions = (node) => {
  if (node.type === 'joinNode' || node.type === 'unionNode') {
    const conditions = node.data?.conditions?.length || 0;
    const branches = node.data?.branches?.length || 0;
    const expandable = conditions > 0 || branches > 0;
    if (!node.data?.expanded || !expandable) {
      return { width: JOIN_WIDTH_COLLAPSED, height: JOIN_HEADER_HEIGHT };
    }
    const rows = node.type === 'unionNode' ? branches : conditions;
    return {
      width: JOIN_WIDTH_EXPANDED,
      height: JOIN_HEADER_HEIGHT + rows * JOIN_CONDITION_ROW,
    };
  }

  const colCount = node.data?.columns?.length || 0;
  if (!colCount) {
    return { width: estimateTableWidth(node), height: EMPTY_TABLE_HEIGHT };
  }

  if (!node.data?.expanded) {
    return { width: estimateTableWidth(node), height: COLLAPSED_TABLE_HEIGHT };
  }

  const columns = node.data.columns || [];
  const rowsHeight = columns.reduce((sum, col) => sum + columnRowHeight(node, col), 0);
  return {
    width: estimateTableWidth(node),
    height: HEADER_HEIGHT + COLUMN_LIST_PADDING + rowsHeight,
  };
};

/** Spacing scales with largest node so expanded CTEs don't overlap siblings or adjacent ranks. */
function computeGraphSpacing(nodes) {
  const visible = nodes.filter((n) => !n.hidden);
  const maxHeight = visible.reduce(
    (max, n) => Math.max(max, getNodeDimensions(n).height),
    COLLAPSED_TABLE_HEIGHT
  );
  const maxWidth = visible.reduce(
    (max, n) => Math.max(max, getNodeDimensions(n).width),
    TABLE_WIDTH
  );
  return {
    nodesep: Math.max(MIN_NODESEP, Math.ceil(maxWidth * 0.35)),
    ranksep: Math.max(MIN_RANKSEP, Math.ceil(maxHeight * 0.65)),
  };
}

function boxesOverlap(aPos, aDims, bPos, bDims) {
  return (
    horizontalOverlap(aPos.x, aDims.width, bPos.x, bDims.width) &&
    aPos.y < bPos.y + bDims.height &&
    aPos.y + aDims.height > bPos.y
  );
}

/** Nudge overlapping nodes apart after dagre (handles tall expanded nodes). */
function resolveNodeOverlaps(nodes, layoutMode, rankByNodeId = new Map()) {
  const visible = nodes.filter((n) => !n.hidden);
  if (visible.length < 2) return nodes;

  const isLR = layoutMode === LAYOUT_MODES.LR;
  const positions = new Map(
    nodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }])
  );

  const sameRank = (aId, bId) => {
    const aRank = rankByNodeId.get(aId);
    const bRank = rankByNodeId.get(bId);
    return aRank != null && bRank != null && aRank === bRank;
  };

  for (let pass = 0; pass < 8; pass += 1) {
    let moved = false;
    const sorted = [...visible].sort((a, b) => {
      const pa = positions.get(a.id);
      const pb = positions.get(b.id);
      return isLR ? pa.y - pb.y || pa.x - pb.x : pa.x - pb.x || pa.y - pb.y;
    });

    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const a = sorted[i];
        const b = sorted[j];
        const aPos = positions.get(a.id);
        const bPos = positions.get(b.id);
        const aDims = getNodeDimensions(a);
        const bDims = getNodeDimensions(b);
        if (!boxesOverlap(aPos, aDims, bPos, bDims)) continue;

        if (isLR) {
          if (sameRank(a.id, b.id)) {
            positions.set(b.id, {
              x: bPos.x,
              y: aPos.y + aDims.height + OVERLAP_GAP,
            });
          } else {
            positions.set(b.id, {
              x: aPos.x + aDims.width + OVERLAP_GAP,
              y: bPos.y,
            });
          }
        } else if (sameRank(a.id, b.id)) {
          positions.set(b.id, {
            x: aPos.x + aDims.width + OVERLAP_GAP,
            y: bPos.y,
          });
        } else {
          positions.set(b.id, {
            x: bPos.x,
            y: aPos.y + aDims.height + OVERLAP_GAP,
          });
        }
        moved = true;
      }
    }
    if (!moved) break;
  }

  return nodes.map((n) => ({
    ...n,
    position: positions.get(n.id) ?? n.position,
  }));
}

/** Ensure siblings in the same dagre rank don't overlap (TB = horizontal, LR = vertical). */
function tightenRankSpacing(nodes, layoutMode, rankByNodeId) {
  const isLR = layoutMode === LAYOUT_MODES.LR;
  const byRank = new Map();

  nodes.forEach((n) => {
    if (n.hidden) return;
    const rank = rankByNodeId.get(n.id);
    if (rank == null) return;
    if (!byRank.has(rank)) byRank.set(rank, []);
    byRank.get(rank).push(n);
  });

  const positions = new Map(
    nodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }])
  );

  byRank.forEach((rankNodes) => {
    const sorted = [...rankNodes].sort((a, b) => {
      const pa = positions.get(a.id);
      const pb = positions.get(b.id);
      return isLR ? pa.y - pb.y : pa.x - pb.x;
    });

    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const prevPos = positions.get(prev.id);
      const currPos = positions.get(curr.id);
      const prevDims = getNodeDimensions(prev);
      const minStart = isLR
        ? prevPos.y + prevDims.height + OVERLAP_GAP
        : prevPos.x + prevDims.width + OVERLAP_GAP;

      if (isLR) {
        if (currPos.y < minStart) {
          positions.set(curr.id, { x: currPos.x, y: minStart });
        }
      } else if (currPos.x < minStart) {
        positions.set(curr.id, { x: minStart, y: currPos.y });
      }
    }
  });

  return nodes.map((n) => ({
    ...n,
    position: positions.get(n.id) ?? n.position,
  }));
}

/** Relayout after expand/collapse so spacing matches current node sizes. */
export function adjustLayoutForExpandedToggle(nodes, edges, nodeId, layoutMode) {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return nodes;

  const expanded = !node.data?.expanded;
  const toggledNodes = nodes.map((n) =>
    n.id === nodeId ? { ...n, data: { ...n.data, expanded } } : n
  );

  return getLayoutedElements(toggledNodes, edges, layoutMode).nodes;
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
    const spacing = computeGraphSpacing(visibleNodes);
    const ringStep = Math.max(180, spacing.ranksep + spacing.nodesep);
    const radius = 100 + level * ringStep;
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

  return {
    nodes: resolveNodeOverlaps(layoutedNodes, LAYOUT_MODES.RADIAL),
    edges,
  };
}

export const getLayoutedElements = (nodes, edges, layoutMode = LAYOUT_MODES.TB) => {
  if (layoutMode === LAYOUT_MODES.RADIAL) {
    return layoutRadial(nodes, edges);
  }

  const spacing = computeGraphSpacing(nodes);
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  const rankdir = layoutMode === LAYOUT_MODES.LR ? 'LR' : 'TB';
  dagreGraph.setGraph({
    rankdir,
    nodesep: spacing.nodesep,
    ranksep: spacing.ranksep,
    marginx: 48,
    marginy: 48,
    ranker: 'network-simplex',
  });

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

  const rankByNodeId = new Map();
  nodes.forEach((node) => {
    if (node.hidden) return;
    const pos = dagreGraph.node(node.id);
    if (!pos) return;
    rankByNodeId.set(
      node.id,
      Math.round(layoutMode === LAYOUT_MODES.LR ? pos.x : pos.y)
    );
  });

  let layoutedNodes = nodes.map((node) => {
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

  layoutedNodes = tightenRankSpacing(layoutedNodes, layoutMode, rankByNodeId);
  layoutedNodes = resolveNodeOverlaps(layoutedNodes, layoutMode, rankByNodeId);

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

import dagre from 'dagre';
import { Position } from '@xyflow/react';
import { theme } from '../theme';
import { formatTableNodeLabel } from './lineageTableModel';

export const LAYOUT_MODES = {
  TB: 'TB',
  LR: 'LR',
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
const JOIN_WIDTH_COLLAPSED = 248;
const JOIN_WIDTH_EXPANDED = 320;
const HEADER_HEIGHT = 48;
const COLLAPSED_TABLE_HEIGHT = 48;
const EMPTY_TABLE_HEIGHT = 44;
const JOIN_HEADER_HEIGHT = 47;
const JOIN_OPERANDS_HEIGHT = 72;
const JOIN_CONDITION_ROW = 56;
const COLUMN_ROW_HEIGHT = 28;
const COLUMN_ROW_WITH_SOURCES = 44;
const COLUMN_LIST_PADDING = 8;
const MIN_NODESEP = 100;
const MIN_RANKSEP = 120;
const LR_MIN_RANKSEP = 64;
const LR_MIN_NODESEP = 140;
const OVERLAP_GAP = 36;

/** Edge attachment: TB = top/bottom, LR = left/right. */
export function getHandlePositionsForLayout(layoutMode) {
  if (layoutMode === LAYOUT_MODES.LR) {
    return { sourcePosition: Position.Right, targetPosition: Position.Left };
  }
  return { sourcePosition: Position.Bottom, targetPosition: Position.Top };
}

export function applyLayoutHandlePositions(nodes, layoutMode) {
  const { sourcePosition, targetPosition } = getHandlePositionsForLayout(layoutMode);
  return nodes.map((node) => ({
    ...node,
    sourcePosition,
    targetPosition,
    data: { ...node.data, layoutMode },
  }));
}

function horizontalOverlap(ax, aw, bx, bw) {
  return ax < bx + bw && ax + aw > bx;
}

function tableHeaderExtraHeight(node) {
  const alias = node.data?.alias;
  const base = String(node.data?.label || node.id || '');
  const id = String(node.id || '');
  if (
    alias &&
    alias.toLowerCase() !== base.toLowerCase() &&
    alias.toLowerCase() !== id.toLowerCase()
  ) {
    return 14;
  }
  return 0;
}

function columnRowHeight(node, col) {
  const lineage = node.data?.column_lineage || [];
  const entry = lineage.find((e) => e.name === col);
  const sources = entry?.sources?.length || 0;
  return sources > 0 ? COLUMN_ROW_WITH_SOURCES : COLUMN_ROW_HEIGHT;
}

/** Header row can grow past minWidth when labels are long — layout must match rendered width. */
function estimateTableWidth(node) {
  const label = String(formatTableNodeLabel(node));
  const hasKind = Boolean(node.data?.kind);
  const colCount = node.data?.columns?.length || 0;
  const showColCount = colCount > 0 && !node.data?.expanded;

  let width =
    HEADER_PADDING +
    TABLE_ICON_WIDTH +
    label.length * CHAR_WIDTH_ESTIMATE +
    HEADER_ACTIONS_WIDTH;
  if (tableHeaderExtraHeight(node) > 0) {
    width += 24;
  }
  const alias = node.data?.alias;
  if (alias && String(alias).length > 0) {
    width += 36;
  }
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
    const operandLines =
      node.type === 'joinNode' ? node.data?.join_operands?.length || 0 : 0;
    const expandable =
      node.type === 'joinNode'
        ? conditions > 0 || operandLines > 0
        : conditions > 0 || branches > 0;

    if (!node.data?.expanded || !expandable) {
      return { width: JOIN_WIDTH_COLLAPSED, height: JOIN_HEADER_HEIGHT };
    }

    const operandHeight =
      node.type === 'joinNode' && operandLines > 0 ? JOIN_OPERANDS_HEIGHT : 0;
    const rows = node.type === 'unionNode' ? branches : conditions;
    const rawSqlExtra = node.type === 'joinNode' && conditions > 0 ? conditions * 18 : 0;

    return {
      width: JOIN_WIDTH_EXPANDED,
      height: JOIN_HEADER_HEIGHT + operandHeight + rows * JOIN_CONDITION_ROW + rawSqlExtra,
    };
  }

  const colCount = node.data?.columns?.length || 0;
  const headerExtra = tableHeaderExtraHeight(node);
  if (!colCount) {
    return {
      width: estimateTableWidth(node),
      height: EMPTY_TABLE_HEIGHT + headerExtra,
    };
  }

  if (!node.data?.expanded) {
    return {
      width: estimateTableWidth(node),
      height: COLLAPSED_TABLE_HEIGHT + headerExtra,
    };
  }

  const columns = node.data.columns || [];
  const rowsHeight = columns.reduce((sum, col) => sum + columnRowHeight(node, col), 0);
  return {
    width: estimateTableWidth(node),
    height: HEADER_HEIGHT + COLUMN_LIST_PADDING + rowsHeight,
  };
};

/** Spacing scales with largest node — axis-aware for TB vs LR dagre rankdir. */
function computeGraphSpacing(nodes, layoutMode = LAYOUT_MODES.TB) {
  const visible = nodes.filter((n) => !n.hidden);
  const maxHeight = visible.reduce(
    (max, n) => Math.max(max, getNodeDimensions(n).height),
    COLLAPSED_TABLE_HEIGHT
  );
  const maxWidth = visible.reduce(
    (max, n) => Math.max(max, getNodeDimensions(n).width),
    TABLE_WIDTH
  );

  if (layoutMode === LAYOUT_MODES.LR) {
    // LR: ranksep = horizontal between columns, nodesep = vertical between siblings
    return {
      nodesep: Math.max(
        LR_MIN_NODESEP,
        Math.ceil(maxHeight * 0.7),
        maxHeight + OVERLAP_GAP * 2,
        Math.ceil(maxWidth * 0.25)
      ),
      // Compact horizontal start — tightenColumnSpacing fixes wide-node columns
      ranksep: Math.max(
        LR_MIN_RANKSEP,
        Math.ceil(maxHeight * 0.65),
        maxHeight + OVERLAP_GAP
      ),
    };
  }

  // TB: ranksep = vertical between ranks, nodesep = horizontal between siblings
  return {
    nodesep: Math.max(MIN_NODESEP, Math.ceil(maxWidth * 0.35)),
    ranksep: Math.max(
      MIN_RANKSEP,
      Math.ceil(maxHeight * 0.65),
      maxHeight + OVERLAP_GAP
    ),
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
            moved = true;
          }
          // Cross-column overlaps are handled by tightenColumnSpacing
        } else if (sameRank(a.id, b.id)) {
          positions.set(b.id, {
            x: aPos.x + aDims.width + OVERLAP_GAP,
            y: bPos.y,
          });
          moved = true;
        } else {
          positions.set(b.id, {
            x: bPos.x,
            y: aPos.y + aDims.height + OVERLAP_GAP,
          });
          moved = true;
        }
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

/** LR: shift whole columns right only as needed — prevents overlap-resolver horizontal sprawl. */
function tightenColumnSpacing(nodes, rankByNodeId) {
  const visible = nodes.filter((n) => !n.hidden);
  if (visible.length < 2) return nodes;

  const byRank = new Map();
  visible.forEach((n) => {
    const rank = rankByNodeId.get(n.id);
    if (rank == null) return;
    if (!byRank.has(rank)) byRank.set(rank, []);
    byRank.get(rank).push(n);
  });

  const ranks = [...byRank.keys()].sort((a, b) => a - b);
  const positions = new Map(nodes.map((n) => [n.id, { ...n.position }]));

  for (let i = 1; i < ranks.length; i += 1) {
    const prevNodes = byRank.get(ranks[i - 1]) || [];
    const currNodes = byRank.get(ranks[i]) || [];
    if (!prevNodes.length || !currNodes.length) continue;

    let prevRight = 0;
    prevNodes.forEach((n) => {
      const pos = positions.get(n.id);
      const { width } = getNodeDimensions(n);
      prevRight = Math.max(prevRight, pos.x + width);
    });

    let currMinX = Infinity;
    currNodes.forEach((n) => {
      currMinX = Math.min(currMinX, positions.get(n.id).x);
    });

    const minStart = prevRight + OVERLAP_GAP;
    if (currMinX < minStart) {
      const shift = minStart - currMinX;
      currNodes.forEach((n) => {
        const pos = positions.get(n.id);
        positions.set(n.id, { x: pos.x + shift, y: pos.y });
      });
    }
  }

  return nodes.map((n) => ({
    ...n,
    position: positions.get(n.id) ?? n.position,
  }));
}

/** Downstream node ids (targets reachable from nodeId). */
export function getDownstreamNodeIds(nodeId, edges) {
  const out = new Set();
  const queue = [nodeId];
  const visited = new Set([nodeId]);

  while (queue.length > 0) {
    const id = queue.shift();
    edges.forEach((e) => {
      if (e.source === id && !visited.has(e.target)) {
        visited.add(e.target);
        out.add(e.target);
        queue.push(e.target);
      }
    });
  }

  return out;
}

/** Infer dagre-like ranks from current positions (for overlap resolution). */
function buildRankIndex(nodes, layoutMode) {
  const isLR = layoutMode === LAYOUT_MODES.LR;
  const visible = nodes.filter((n) => !n.hidden);
  const coords = visible.map((n) =>
    isLR ? Math.round(n.position.x) : Math.round(n.position.y)
  );
  const unique = [...new Set(coords)].sort((a, b) => a - b);
  const rankMap = new Map(unique.map((c, i) => [c, i]));
  const map = new Map();

  visible.forEach((n) => {
    const coord = isLR ? Math.round(n.position.x) : Math.round(n.position.y);
    map.set(n.id, rankMap.get(coord) ?? 0);
  });

  return map;
}

/** Relayout after expand/collapse — anchor top-left, push downstream, avoid full dagre jump. */
export function adjustLayoutForExpandedToggle(nodes, edges, nodeId, layoutMode) {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return nodes;

  const oldDims = getNodeDimensions(node);
  const expanded = !node.data?.expanded;
  const toggledNodes = nodes.map((n) =>
    n.id === nodeId ? { ...n, data: { ...n.data, expanded } } : n
  );
  const toggledNode = toggledNodes.find((n) => n.id === nodeId);
  const newDims = getNodeDimensions(toggledNode);

  const deltaH = newDims.height - oldDims.height;
  const deltaW = newDims.width - oldDims.width;

  if (deltaH === 0 && deltaW === 0) {
    return applyLayoutHandlePositions(toggledNodes, layoutMode);
  }

  const isLR = layoutMode === LAYOUT_MODES.LR;
  const positions = new Map(nodes.map((n) => [n.id, { ...n.position }]));
  const downstream = getDownstreamNodeIds(nodeId, edges);

  if (isLR) {
    downstream.forEach((id) => {
      const pos = positions.get(id);
      if (pos) positions.set(id, { x: pos.x + deltaW, y: pos.y });
    });
  } else {
    downstream.forEach((id) => {
      const pos = positions.get(id);
      if (pos) positions.set(id, { x: pos.x, y: pos.y + deltaH });
    });
  }

  let resultNodes = toggledNodes.map((n) => ({
    ...n,
    position: positions.get(n.id) ?? n.position,
  }));

  const rankByNodeId = buildRankIndex(resultNodes, layoutMode);
  resultNodes = tightenRankSpacing(resultNodes, layoutMode, rankByNodeId);
  resultNodes = resolveNodeOverlaps(resultNodes, layoutMode, rankByNodeId);

  return applyLayoutHandlePositions(resultNodes, layoutMode);
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

export const getLayoutedElements = (nodes, edges, layoutMode = LAYOUT_MODES.TB) => {
  const spacing = computeGraphSpacing(nodes, layoutMode);
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  const rankdir = layoutMode === LAYOUT_MODES.LR ? 'LR' : 'TB';
  const graphOpts = {
    rankdir,
    nodesep: spacing.nodesep,
    ranksep: spacing.ranksep,
    marginx: layoutMode === LAYOUT_MODES.LR ? 32 : 48,
    marginy: layoutMode === LAYOUT_MODES.LR ? 64 : 48,
    ranker: layoutMode === LAYOUT_MODES.LR ? 'tight-tree' : 'network-simplex',
    align: layoutMode === LAYOUT_MODES.LR ? 'UL' : undefined,
  };
  dagreGraph.setGraph(graphOpts);

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
  if (layoutMode === LAYOUT_MODES.LR) {
    layoutedNodes = tightenColumnSpacing(layoutedNodes, rankByNodeId);
  }
  layoutedNodes = resolveNodeOverlaps(layoutedNodes, layoutMode, rankByNodeId);

  return {
    nodes: applyLayoutHandlePositions(layoutedNodes, layoutMode),
    edges,
  };
};

export const styleApiEdges = (edges) =>
  edges.map((edge) => ({
    ...edge,
    type: 'default',
    animated: false,
    style: { stroke: theme.edgeStroke, strokeWidth: 2.75, transition: 'all 0.3s ease' },
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

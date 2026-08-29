/**
 * Macro pipeline stage layout + per-stage internal dagre layout for compound graph.
 */

import { theme } from '../theme';
import {
  getLayoutedElements,
  LAYOUT_MODES,
  getHandlePositionsForLayout,
  getNodeDimensions,
} from './dagreLayout';
import {
  buildStageGroupMeta,
  buildStageMacroEdges,
  getInternalNodesForStage,
  toStageGroupId,
} from './compoundGraphModel';
import {
  STAGE_CARD_WIDTH,
  STAGE_CARD_HEIGHT,
  STAGE_GROUP_INTERNAL_TOP,
  STAGE_GROUP_PADDING,
  MACRO_GAP_X,
  MACRO_GAP_Y,
} from '../constants/compoundGraphConstants';

const GROUP_PADDING = STAGE_GROUP_PADDING;

function computeStageDepths(stageMeta, macroEdges) {
  const depths = new Map();
  stageMeta.forEach((s) => depths.set(s.stageId, 0));

  let changed = true;
  let guard = 0;
  while (changed && guard < stageMeta.length + 2) {
    changed = false;
    guard += 1;
    macroEdges.forEach(({ from, to }) => {
      const next = (depths.get(from) || 0) + 1;
      if (next > (depths.get(to) || 0)) {
        depths.set(to, next);
        changed = true;
      }
    });
  }

  return depths;
}

function buildUpstreamMap(stageMeta, macroEdges) {
  const upstreamByStage = new Map();
  stageMeta.forEach((m) => upstreamByStage.set(m.stageId, []));
  macroEdges.forEach(({ from, to }) => {
    upstreamByStage.get(to).push(from);
  });
  return upstreamByStage;
}

function defaultStageSize() {
  return { width: STAGE_CARD_WIDTH, height: STAGE_CARD_HEIGHT };
}

function stageBoxCenter(pos, size) {
  return {
    x: pos.x + size.width / 2,
    y: pos.y + size.height / 2,
  };
}

function measureExpandedStageInternals(stageId, nodes, edges, layoutMode) {
  const internalIds = getInternalNodesForStage(stageId, nodes, edges);
  const internalNodes = nodes
    .filter((n) => internalIds.has(n.id) && n.id !== stageId)
    .map((n) => ({ ...n, hidden: false }));

  if (internalNodes.length === 0) {
    return defaultStageSize();
  }

  const internalEdges = edges.filter(
    (e) => internalIds.has(e.source) && internalIds.has(e.target)
  );

  const { nodes: laidOut } = getLayoutedElements(
    internalNodes,
    internalEdges,
    layoutMode
  );

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  laidOut.forEach((n) => {
    const x = n.position?.x ?? 0;
    const y = n.position?.y ?? 0;
    const { width, height } = getNodeDimensions(n);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  });

  if (!Number.isFinite(minX)) {
    return defaultStageSize();
  }

  return {
    width: Math.max(STAGE_CARD_WIDTH, maxX - minX + GROUP_PADDING * 2),
    height: Math.max(
      STAGE_CARD_HEIGHT,
      maxY - minY + STAGE_GROUP_INTERNAL_TOP + GROUP_PADDING
    ),
  };
}

function computeStageSizes(stageMeta, nodes, edges, layoutMode, expandedStages) {
  const sizes = new Map();
  stageMeta.forEach((meta) => {
    if (expandedStages.has(meta.stageId)) {
      sizes.set(meta.stageId, measureExpandedStageInternals(
        meta.stageId,
        nodes,
        edges,
        layoutMode
      ));
    } else {
      sizes.set(meta.stageId, defaultStageSize());
    }
  });
  return sizes;
}

function crossAxisOffset(depth, depthKeys, maxCrossByDepth, isLR) {
  let offset = 0;
  for (const d of depthKeys) {
    if (d >= depth) break;
    offset += (maxCrossByDepth.get(d) || STAGE_CARD_WIDTH) + (isLR ? MACRO_GAP_X : MACRO_GAP_Y);
  }
  return offset;
}

function maxCrossPerDepth(stageMeta, depths, sizes, isLR) {
  const maxCross = new Map();
  stageMeta.forEach((meta) => {
    const d = depths.get(meta.stageId) || 0;
    const size = sizes.get(meta.stageId) || defaultStageSize();
    const cross = isLR ? size.width : size.height;
    maxCross.set(d, Math.max(maxCross.get(d) || 0, cross));
  });
  return maxCross;
}

/** Nudge same-column stages apart using actual box sizes. */
function resolveColumnOverlaps(row, positions, sizes, isLR) {
  if (row.length <= 1) return;

  const sorted = [...row].sort((a, b) => {
    const pa = positions.get(a.groupId);
    const pb = positions.get(b.groupId);
    return isLR ? pa.y - pb.y : pa.x - pb.x;
  });

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevPos = positions.get(prev.groupId);
    const currPos = positions.get(curr.groupId);
    const prevSize = sizes.get(prev.stageId) || defaultStageSize();
    const gap = isLR ? MACRO_GAP_Y : MACRO_GAP_X;

    if (isLR) {
      const minY = prevPos.y + prevSize.height + gap;
      if (currPos.y < minY) currPos.y = minY;
    } else {
      const minX = prevPos.x + prevSize.width + gap;
      if (currPos.x < minX) currPos.x = minX;
    }
  }
}

function layoutMacroStagePositions(
  stageMeta,
  macroEdges,
  layoutMode,
  sizes
) {
  const isLR = layoutMode === LAYOUT_MODES.LR;
  const depths = computeStageDepths(stageMeta, macroEdges);
  const upstreamByStage = buildUpstreamMap(stageMeta, macroEdges);
  const maxCrossByDepth = maxCrossPerDepth(stageMeta, depths, sizes, isLR);

  const byDepth = new Map();
  stageMeta.forEach((meta) => {
    const d = depths.get(meta.stageId) || 0;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d).push(meta);
  });

  const positions = new Map();
  const depthKeys = [...byDepth.keys()].sort((a, b) => a - b);
  if (depthKeys.length === 0) return positions;

  const placeStage = (meta, depth, primaryCenter) => {
    const size = sizes.get(meta.stageId) || defaultStageSize();
    const cross = crossAxisOffset(depth, depthKeys, maxCrossByDepth, isLR);
    if (isLR) {
      positions.set(meta.groupId, {
        x: cross,
        y: primaryCenter - size.height / 2,
      });
    } else {
      positions.set(meta.groupId, {
        x: primaryCenter - size.width / 2,
        y: cross,
      });
    }
  };

  const upstreamCentroid = (meta) => {
    const upstreamIds = upstreamByStage.get(meta.stageId) || [];
    const centers = upstreamIds
      .map((id) => {
        const upstreamMeta = stageMeta.find((s) => s.stageId === id);
        if (!upstreamMeta) return null;
        const pos = positions.get(upstreamMeta.groupId);
        const size = sizes.get(id) || defaultStageSize();
        if (!pos) return null;
        return stageBoxCenter(pos, size);
      })
      .filter(Boolean);

    if (centers.length === 0) return null;

    const sumX = centers.reduce((acc, c) => acc + c.x, 0);
    const sumY = centers.reduce((acc, c) => acc + c.y, 0);
    return { x: sumX / centers.length, y: sumY / centers.length };
  };

  // Depth 0: stack with actual heights / widths.
  const firstRow = byDepth.get(depthKeys[0]) || [];
  let cursor = 0;
  firstRow.forEach((meta) => {
    const size = sizes.get(meta.stageId) || defaultStageSize();
    if (isLR) {
      positions.set(meta.groupId, { x: 0, y: cursor });
      cursor += size.height + MACRO_GAP_Y;
    } else {
      positions.set(meta.groupId, { x: cursor, y: 0 });
      cursor += size.width + MACRO_GAP_X;
    }
  });

  for (let i = 1; i < depthKeys.length; i++) {
    const depth = depthKeys[i];
    const row = byDepth.get(depth) || [];

    row.forEach((meta) => {
      const centroid = upstreamCentroid(meta);
      if (centroid) {
        placeStage(meta, depth, isLR ? centroid.y : centroid.x);
      } else {
        const prevRow = byDepth.get(depthKeys[i - 1]) || [];
        const prevCenters = prevRow
          .map((m) => {
            const pos = positions.get(m.groupId);
            const size = sizes.get(m.stageId) || defaultStageSize();
            return pos ? stageBoxCenter(pos, size) : null;
          })
          .filter(Boolean);
        const avg =
          prevCenters.length > 0
            ? prevCenters.reduce(
                (acc, c) => ({ x: acc.x + c.x, y: acc.y + c.y }),
                { x: 0, y: 0 }
              )
            : { x: STAGE_CARD_WIDTH / 2, y: STAGE_CARD_HEIGHT / 2 };
        if (prevCenters.length > 0) {
          avg.x /= prevCenters.length;
          avg.y /= prevCenters.length;
        }
        placeStage(meta, depth, isLR ? avg.y : avg.x);
      }
    });

    resolveColumnOverlaps(row, positions, sizes, isLR);
  }

  return positions;
}

function layoutExpandedStageInternals(stageId, nodes, edges, layoutMode, measuredSize) {
  const internalIds = getInternalNodesForStage(stageId, nodes, edges);
  const internalNodes = nodes
    .filter((n) => internalIds.has(n.id) && n.id !== stageId)
    .map((n) => ({ ...n, hidden: false }));

  if (internalNodes.length === 0) {
    return {
      groupWidth: STAGE_CARD_WIDTH,
      groupHeight: STAGE_CARD_HEIGHT,
      children: [],
      internalEdges: [],
    };
  }

  const internalEdges = edges.filter(
    (e) => internalIds.has(e.source) && internalIds.has(e.target)
  );

  const { nodes: laidOut, edges: laidOutEdges } = getLayoutedElements(
    internalNodes,
    internalEdges,
    layoutMode
  );

  let minX = Infinity;
  let minY = Infinity;

  laidOut.forEach((n) => {
    const x = n.position?.x ?? 0;
    const y = n.position?.y ?? 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
  });

  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
  }

  const groupWidth = measuredSize?.width ?? STAGE_CARD_WIDTH;
  const groupHeight = measuredSize?.height ?? STAGE_CARD_HEIGHT;

  const { sourcePosition, targetPosition } = getHandlePositionsForLayout(layoutMode);

  const children = laidOut.map((n) => {
    const dims = getNodeDimensions(n);
    const expanded = Boolean(n.data?.expanded);
    return {
      ...n,
      parentId: toStageGroupId(stageId),
      expandParent: true,
      draggable: false,
      width: dims.width,
      height: dims.height,
      position: {
        x: n.position.x - minX + GROUP_PADDING,
        y: n.position.y - minY + STAGE_GROUP_INTERNAL_TOP,
      },
      sourcePosition,
      targetPosition,
      zIndex: expanded ? 8 : 3,
      style: {
        ...(n.style || {}),
        width: dims.width,
        height: dims.height,
      },
    };
  });

  return {
    groupWidth,
    groupHeight,
    children,
    internalEdges: laidOutEdges,
  };
}

export function buildCompoundGraphDisplay({
  nodes,
  edges,
  layoutMode = LAYOUT_MODES.LR,
  expandedStages = new Set(),
}) {
  const stageMeta = buildStageGroupMeta(nodes, edges);
  const macroEdgeDefs = buildStageMacroEdges(nodes, edges);
  const stageSizes = computeStageSizes(
    stageMeta,
    nodes,
    edges,
    layoutMode,
    expandedStages
  );
  const macroPositions = layoutMacroStagePositions(
    stageMeta,
    macroEdgeDefs,
    layoutMode,
    stageSizes
  );
  const { sourcePosition, targetPosition } = getHandlePositionsForLayout(layoutMode);

  const displayNodes = [];
  const displayEdges = [];
  const edgeStyle = { stroke: theme.edgeStroke, strokeWidth: 2.75 };

  stageMeta.forEach((meta) => {
    const expanded = expandedStages.has(meta.stageId);
    const basePos = macroPositions.get(meta.groupId) || { x: 0, y: 0 };
    const measuredSize = stageSizes.get(meta.stageId) || defaultStageSize();

    if (expanded) {
      const {
        groupWidth,
        groupHeight,
        children,
        internalEdges,
      } = layoutExpandedStageInternals(
        meta.stageId,
        nodes,
        edges,
        layoutMode,
        measuredSize
      );

      displayNodes.push({
        id: meta.groupId,
        type: 'stageGroupNode',
        position: basePos,
        draggable: true,
        width: groupWidth,
        height: groupHeight,
        style: {
          width: groupWidth,
          height: groupHeight,
          zIndex: 0,
        },
        data: {
          ...meta.stageNode.data,
          stageId: meta.stageId,
          groupId: meta.groupId,
          label: meta.label,
          kind: meta.kind,
          expanded: true,
          operationSummary: meta.operationSummary,
          joinCount: meta.joinCount,
          unionCount: meta.unionCount,
          sourceCount: meta.sourceCount,
          sourcePreview: meta.sourcePreview,
          columnCount: meta.columnCount,
          layoutMode,
        },
        sourcePosition,
        targetPosition,
      });

      displayNodes.push(...children);

      internalEdges.forEach((e) => {
        displayEdges.push({
          ...e,
          id: `compound_${e.id}`,
          style: edgeStyle,
          hidden: false,
          zIndex: 1,
        });
      });
    } else {
      displayNodes.push({
        id: meta.groupId,
        type: 'stageGroupNode',
        position: basePos,
        draggable: true,
        style: {
          width: measuredSize.width,
          height: measuredSize.height,
          zIndex: 2,
        },
        data: {
          ...meta.stageNode.data,
          stageId: meta.stageId,
          groupId: meta.groupId,
          label: meta.label,
          kind: meta.kind,
          expanded: false,
          operationSummary: meta.operationSummary,
          joinCount: meta.joinCount,
          unionCount: meta.unionCount,
          sourceCount: meta.sourceCount,
          sourcePreview: meta.sourcePreview,
          columnCount: meta.columnCount,
          layoutMode,
        },
        sourcePosition,
        targetPosition,
      });
    }
  });

  macroEdgeDefs.forEach((def) => {
    displayEdges.push({
      id: def.id,
      source: toStageGroupId(def.from),
      target: toStageGroupId(def.to),
      type: 'default',
      animated: false,
      style: edgeStyle,
      hidden: false,
      data: { macro: true },
      zIndex: 0,
    });
  });

  return {
    nodes: displayNodes,
    edges: displayEdges,
  };
}

import { useState, useCallback, useRef } from 'react';
import { useNodesState, useEdgesState } from '@xyflow/react';
import { theme } from '../theme';
import {
  getLayoutedElements,
  LAYOUT_MODES,
  applyVisibilityFilter,
  ensureNodePositions,
  adjustLayoutForExpandedToggle,
  getDownstreamNodeIds,
  getNodeDimensions,
} from '../utils/dagreLayout';
import {
  getBranchFilterVisibleIds,
  getUpstreamNodes,
  getDownstreamNodes,
} from '../utils/lineagePath';
import { GRAPH_DETAIL_MODES } from '../constants/graphDetailMode';
import {
  isCompoundGraphEligible,
  mapHighlightToCompoundDisplay,
  isCompoundDisplayEdgeHighlighted,
  toStageGroupId,
  findStageContainingNode,
} from '../utils/compoundGraphModel';
import { buildCompoundGraphDisplay } from '../utils/compoundGraphLayout';
import { resolveGraphDetailModeFromSession } from '../utils/lineageSession';

const STAGE_KINDS = new Set([
  'cte',
  'subquery',
  'final_output',
  'view',
  'insert_target',
  'merge_target',
]);

const GRAPH_UI_STORAGE_KEY = 'ls_graph_ui';

function readGraphUiState() {
  try {
    return JSON.parse(sessionStorage.getItem(GRAPH_UI_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function persistGraphUiState(patch) {
  try {
    const next = { ...readGraphUiState(), ...patch };
    sessionStorage.setItem(GRAPH_UI_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode / blocked storage */
  }
}

function readInitialLayoutMode() {
  const stored = readGraphUiState().layoutMode;
  if (stored === LAYOUT_MODES.LR || stored === LAYOUT_MODES.TB) {
    return stored;
  }
  return LAYOUT_MODES.TB;
}

function resolveGraphDetailMode(nodes) {
  if (!nodes?.length || !isCompoundGraphEligible(nodes)) {
    return GRAPH_DETAIL_MODES.FLAT;
  }
  return resolveGraphDetailModeFromSession(true);
}

function getHighlightEdgeStyle() {
  return { stroke: theme.primary, strokeWidth: 3, opacity: 1 };
}

function getDimEdgeStyle() {
  return { stroke: theme.edgeStroke, strokeWidth: 1.5, opacity: 0.45 };
}

function getDefaultEdgeStyle() {
  return { stroke: theme.edgeStroke, strokeWidth: 2.75, opacity: 1 };
}

/**
 * Base graph storage, layout, compound/flat display, filters, and highlight styling.
 */
export function useGraphDisplay({ selectedNodeId }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [baseNodes, setBaseNodes] = useState([]);
  const [baseEdges, setBaseEdges] = useState([]);

  const [layoutMode, setLayoutMode] = useState(readInitialLayoutMode);
  const [branchFilter, setBranchFilter] = useState('');
  const [focusMode, setFocusMode] = useState(null);
  const [filterNoMatches, setFilterNoMatches] = useState(false);

  const [graphDetailMode, setGraphDetailMode] = useState(GRAPH_DETAIL_MODES.FLAT);
  const graphDetailModeRef = useRef(GRAPH_DETAIL_MODES.FLAT);
  const [compoundExpandedStageIds, setCompoundExpandedStageIds] = useState([]);

  graphDetailModeRef.current = graphDetailMode;

  const layoutFullGraph = useCallback(
    (nodeList, edgeList, mode = layoutMode) => {
      const expandedNodes = nodeList.map((n) => ({ ...n, hidden: false }));
      const expandedEdges = edgeList.map((e) => ({ ...e, hidden: false }));
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        expandedNodes,
        expandedEdges,
        mode
      );
      const positioned = ensureNodePositions(layoutedNodes);
      setBaseNodes(positioned);
      setBaseEdges(layoutedEdges);
      return { nodes: positioned, edges: layoutedEdges };
    },
    [layoutMode]
  );

  const applyDisplayFromBase = useCallback(
    (mode = layoutMode, focusOverride = focusMode, overrides = {}) => {
      const sourceNodes = overrides.baseNodes ?? baseNodes;
      const sourceEdges = overrides.baseEdges ?? baseEdges;
      if (!sourceNodes.length) return;

      let visibleIds = getBranchFilterVisibleIds(sourceNodes, sourceEdges, branchFilter);
      const noMatches = Boolean(branchFilter.trim() && visibleIds && visibleIds.size === 0);
      setFilterNoMatches(noMatches);
      if (noMatches) visibleIds = null;

      let displayNodes = sourceNodes;
      let displayEdges = sourceEdges;

      if (visibleIds) {
        const result = applyVisibilityFilter(sourceNodes, sourceEdges, visibleIds);
        displayNodes = result.nodes;
        displayEdges = result.edges;
      }

      const detailMode =
        overrides.graphDetailMode ??
        (sourceNodes.length
          ? resolveGraphDetailMode(sourceNodes)
          : graphDetailModeRef.current);
      const expandedStages = overrides.compoundExpandedStages
        ? overrides.compoundExpandedStages
        : new Set(compoundExpandedStageIds);

      const useCompound =
        detailMode === GRAPH_DETAIL_MODES.COMPOUND &&
        isCompoundGraphEligible(sourceNodes);

      let focusSet = null;
      if (focusOverride && selectedNodeId) {
        focusSet =
          focusOverride === 'upstream'
            ? getUpstreamNodes(selectedNodeId, sourceEdges)
            : getDownstreamNodes(selectedNodeId, sourceEdges);
        focusSet.add(selectedNodeId);

        if (!useCompound) {
          const focused = applyVisibilityFilter(displayNodes, displayEdges, focusSet);
          displayNodes = focused.nodes;
          displayEdges = focused.edges;
        }
      }

      if (useCompound) {
        const compound = buildCompoundGraphDisplay({
          nodes: displayNodes,
          edges: displayEdges,
          layoutMode: mode,
          expandedStages,
        });

        let finalNodes = compound.nodes;
        let finalEdges = compound.edges;

        if (focusSet) {
          const displayNodeIds = mapHighlightToCompoundDisplay(
            focusSet,
            sourceNodes,
            sourceEdges,
            expandedStages
          );
          const focusEdges = new Set();
          sourceEdges.forEach((e) => {
            if (e.hidden) return;
            if (focusSet.has(e.source) && focusSet.has(e.target)) {
              focusEdges.add(e.id);
            }
          });

          finalNodes = compound.nodes.map((n) => ({
            ...n,
            hidden: false,
            style: {
              ...n.style,
              opacity: displayNodeIds.has(n.id) ? 1 : 0.15,
              transition: 'opacity 0.3s ease',
            },
          }));

          finalEdges = compound.edges.map((e) => {
            const inPath = isCompoundDisplayEdgeHighlighted(
              e,
              focusEdges,
              displayNodeIds
            );
            return {
              ...e,
              hidden: false,
              animated: inPath,
              style: {
                ...e.style,
                ...(inPath ? getHighlightEdgeStyle() : getDimEdgeStyle()),
              },
            };
          });
        }

        setNodes(
          ensureNodePositions(finalNodes).map((n) => ({
            ...n,
            data: {
              ...n.data,
              isSearchMatch: false,
              isActiveSearchMatch: false,
              searchQuery: '',
            },
          }))
        );
        setEdges(finalEdges);
        return;
      }

      setNodes(
        ensureNodePositions(displayNodes).map((n) => ({
          ...n,
          data: {
            ...n.data,
            isSearchMatch: false,
            isActiveSearchMatch: false,
            searchQuery: '',
          },
        }))
      );
      setEdges(displayEdges);
    },
    [
      baseNodes,
      baseEdges,
      branchFilter,
      focusMode,
      selectedNodeId,
      layoutMode,
      graphDetailMode,
      compoundExpandedStageIds,
      setNodes,
      setEdges,
    ]
  );

  const applyGraphHighlight = useCallback(
    (highlightNodes, highlightEdges, sourceNodeIds = null, columnName = null) => {
      const useCompound =
        graphDetailModeRef.current === GRAPH_DETAIL_MODES.COMPOUND &&
        isCompoundGraphEligible(baseNodes);

      const displayNodeIds = useCompound
        ? mapHighlightToCompoundDisplay(
            highlightNodes,
            baseNodes,
            baseEdges,
            new Set(compoundExpandedStageIds)
          )
        : null;

      setNodes((nds) =>
        nds.map((n) => {
          const inPath = useCompound
            ? displayNodeIds.has(n.id)
            : highlightNodes.has(n.id);
          const isSource = sourceNodeIds?.has(n.id);
          return {
            ...n,
            style: {
              ...n.style,
              opacity: inPath ? 1 : 0.2,
            },
            data: {
              ...n.data,
              isLineageHighlight: inPath,
              isColumnSource: isSource,
              highlightedColumn: columnName,
            },
          };
        })
      );

      setEdges((eds) =>
        eds.map((e) => {
          const inPath = useCompound
            ? isCompoundDisplayEdgeHighlighted(e, highlightEdges, displayNodeIds)
            : highlightEdges.has(e.id);
          return {
            ...e,
            animated: inPath,
            style: {
              ...e.style,
              ...(inPath ? getHighlightEdgeStyle() : getDimEdgeStyle()),
            },
          };
        })
      );
    },
    [setNodes, setEdges, baseNodes, baseEdges, compoundExpandedStageIds]
  );

  const clearHighlight = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        style: { ...n.style, opacity: 1 },
        data: {
          ...n.data,
          isLineageHighlight: false,
          isColumnSource: false,
          highlightedColumn: null,
        },
      }))
    );
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        animated: false,
        style: { ...e.style, ...getDefaultEdgeStyle() },
      }))
    );
  }, [setNodes, setEdges]);

  const handleLayoutChange = useCallback(
    (mode, fitGraphToView) => {
      setLayoutMode(mode);
      persistGraphUiState({ layoutMode: mode });
      const laidOut = layoutFullGraph(baseNodes, baseEdges, mode);
      applyDisplayFromBase(mode, focusMode, {
        baseNodes: laidOut.nodes,
        baseEdges: laidOut.edges,
      });
      fitGraphToView?.();
    },
    [baseNodes, baseEdges, focusMode, layoutFullGraph, applyDisplayFromBase]
  );

  const handleBranchFilterChange = useCallback(
    (value, { searchActive } = {}) => {
      setBranchFilter(value);
      if (!baseNodes.length || searchActive) return;
      applyDisplayFromBase(layoutMode, focusMode);
    },
    [baseNodes, layoutMode, focusMode, applyDisplayFromBase]
  );

  const handleFocusUpstream = useCallback(
    (fitGraphToView) => {
      if (!selectedNodeId) return;
      setFocusMode('upstream');
      applyDisplayFromBase(layoutMode, 'upstream');
      fitGraphToView?.();
    },
    [selectedNodeId, layoutMode, applyDisplayFromBase]
  );

  const handleFocusDownstream = useCallback(
    (fitGraphToView) => {
      if (!selectedNodeId) return;
      setFocusMode('downstream');
      applyDisplayFromBase(layoutMode, 'downstream');
      fitGraphToView?.();
    },
    [selectedNodeId, layoutMode, applyDisplayFromBase]
  );

  const handleClearFocus = useCallback(() => {
    setFocusMode(null);
    applyDisplayFromBase(layoutMode, null);
  }, [layoutMode, applyDisplayFromBase]);

  const setGraphDetailModeFromNodes = useCallback((nodeList) => {
    const next = resolveGraphDetailMode(nodeList);
    setGraphDetailMode(next);
    graphDetailModeRef.current = next;
    return next;
  }, []);

  const toggleGraphDetailMode = useCallback(() => {
    const next =
      graphDetailMode === GRAPH_DETAIL_MODES.COMPOUND
        ? GRAPH_DETAIL_MODES.FLAT
        : GRAPH_DETAIL_MODES.COMPOUND;
    setGraphDetailMode(next);
    graphDetailModeRef.current = next;
    persistGraphUiState({ userChoseFlat: next === GRAPH_DETAIL_MODES.FLAT });
    return next;
  }, [graphDetailMode]);

  const setSpecificGraphDetailMode = useCallback((mode) => {
    setGraphDetailMode(mode);
    graphDetailModeRef.current = mode;
    persistGraphUiState({ userChoseFlat: mode === GRAPH_DETAIL_MODES.FLAT });
    return mode;
  }, []);

  const resetViewFilters = useCallback(() => {
    setBranchFilter('');
    setFilterNoMatches(false);
    setFocusMode(null);
    setGraphDetailMode(GRAPH_DETAIL_MODES.FLAT);
    graphDetailModeRef.current = GRAPH_DETAIL_MODES.FLAT;
    setCompoundExpandedStageIds([]);
  }, []);

  const resetBaseGraphPresentation = useCallback(
    (nodeList, edgeList) => {
      const resetNodes = nodeList.map((n) => ({
        ...n,
        hidden: false,
        style: { opacity: 1 },
        data: {
          ...n.data,
          collapsed: false,
          expanded: false,
          isLineageHighlight: false,
          isColumnSource: false,
          highlightedColumn: null,
        },
      }));

      const resetEdges = edgeList.map((e) => ({
        ...e,
        hidden: false,
        animated: false,
        style: { ...getDefaultEdgeStyle(), transition: 'all 0.3s ease' },
      }));

      return layoutFullGraph(resetNodes, resetEdges, layoutMode);
    },
    [layoutMode, layoutFullGraph]
  );

  const toggleCompoundStage = useCallback(
    (stageId, rfInstance) => {
      const viewport = rfInstance?.getViewport?.();
      const next = new Set(compoundExpandedStageIds);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      setCompoundExpandedStageIds([...next]);

      applyDisplayFromBase(layoutMode, focusMode, {
        compoundExpandedStages: next,
        graphDetailMode: GRAPH_DETAIL_MODES.COMPOUND,
      });

      setTimeout(() => {
        if (rfInstance) {
          rfInstance.updateNodeInternals?.(toStageGroupId(stageId));
          baseNodes.forEach((n) => {
            if (STAGE_KINDS.has(n.data?.kind)) {
              rfInstance.updateNodeInternals?.(toStageGroupId(n.id));
            }
          });
          if (viewport) {
            rfInstance.setViewport(viewport, { duration: 0 });
          }
        }
      }, 50);
    },
    [
      compoundExpandedStageIds,
      layoutMode,
      focusMode,
      applyDisplayFromBase,
      baseNodes,
    ]
  );

  const onNodeExpandedToggle = useCallback(
    (nodeId, rfInstance) => {
      if (!baseNodes.length) return;

      const inCompound =
        graphDetailModeRef.current === GRAPH_DETAIL_MODES.COMPOUND &&
        isCompoundGraphEligible(baseNodes);

      const layoutedNodes = inCompound
        ? baseNodes.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, expanded: !n.data?.expanded } }
              : n
          )
        : adjustLayoutForExpandedToggle(baseNodes, baseEdges, nodeId, layoutMode);

      setBaseNodes(layoutedNodes);
      applyDisplayFromBase(layoutMode, focusMode, {
        baseNodes: layoutedNodes,
        baseEdges,
        graphDetailMode: graphDetailModeRef.current,
        compoundExpandedStages: new Set(compoundExpandedStageIds),
      });

      const ownerStage = findStageContainingNode(nodeId, layoutedNodes, baseEdges);
      setTimeout(() => {
        rfInstance?.updateNodeInternals?.(nodeId);
        if (ownerStage) {
          rfInstance?.updateNodeInternals?.(toStageGroupId(ownerStage));
        }
        if (!inCompound) {
          getDownstreamNodeIds(nodeId, baseEdges).forEach((id) => {
            rfInstance?.updateNodeInternals?.(id);
          });
        }
      }, 50);
    },
    [
      baseNodes,
      baseEdges,
      layoutMode,
      focusMode,
      applyDisplayFromBase,
      compoundExpandedStageIds,
    ]
  );

  const panToNode = useCallback((rfInstance, targetId, nodeList) => {
    if (!rfInstance || !targetId) return;
    const targetNode =
      rfInstance.getNode(targetId) ||
      nodeList.find((n) => n.id === targetId);

    if (!targetNode?.position) return;

    const { width, height } = getNodeDimensions(targetNode);
    rfInstance.setCenter(
      targetNode.position.x + width / 2,
      targetNode.position.y + height / 2,
      { zoom: 1.2, duration: 800 }
    );
  }, []);

  const handleNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);

      const settled = changes.filter(
        (c) => c.type === 'position' && c.position && c.dragging === false
      );
      if (!settled.length) return;

      setBaseNodes((prev) => {
        const positions = new Map(settled.map((c) => [c.id, c.position]));
        let changed = false;
        const next = prev.map((n) => {
          if (!positions.has(n.id)) return n;
          changed = true;
          return { ...n, position: positions.get(n.id) };
        });
        return changed ? next : prev;
      });
    },
    [onNodesChange, setBaseNodes]
  );

  return {
    nodes,
    edges,
    onNodesChange: handleNodesChange,
    onEdgesChange,
    setNodes,
    setEdges,
    baseNodes,
    setBaseNodes,
    baseEdges,
    setBaseEdges,
    layoutMode,
    branchFilter,
    focusMode,
    setFocusMode,
    filterNoMatches,
    graphDetailMode,
    setGraphDetailMode,
    graphDetailModeRef,
    compoundExpandedStageIds,
    setCompoundExpandedStageIds,
    layoutFullGraph,
    applyDisplayFromBase,
    applyGraphHighlight,
    clearHighlight,
    handleLayoutChange,
    handleBranchFilterChange,
    handleFocusUpstream,
    handleFocusDownstream,
    handleClearFocus,
    setGraphDetailModeFromNodes,
    toggleGraphDetailMode,
    setSpecificGraphDetailMode,
    resetViewFilters,
    resetBaseGraphPresentation,
    toggleCompoundStage,
    onNodeExpandedToggle,
    panToNode,
    resolveGraphDetailModeForNodes: resolveGraphDetailMode,
  };
}

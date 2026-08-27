import { useState, useCallback, useRef } from 'react';
import { useNodesState, useEdgesState } from '@xyflow/react';
import { parseSql } from '../api/lineageClient';
import { theme } from '../theme';
import {
  getLayoutedElements,
  initializeApiNodes,
  styleApiEdges,
  LAYOUT_MODES,
  applyVisibilityFilter,
} from '../utils/dagreLayout';
import { getConnectedElements } from '../utils/graphVisibility';
import {
  getBreadcrumbPath,
  getColumnLineageHighlight,
  getBranchFilterVisibleIds,
  getUpstreamNodes,
  getDownstreamNodes,
} from '../utils/lineagePath';
import {
  computeGraphDiff,
  applyDiffToNodes,
  applyDiffToEdges,
} from '../utils/graphDiff';

const DEFAULT_SQL =
  'WITH cte1 AS (SELECT id, name FROM users JOIN orders ON users.id = orders.user_id) SELECT id FROM cte1';

const HIGHLIGHT_EDGE_STYLE = {
  stroke: theme.primary,
  strokeWidth: 3,
  opacity: 1,
};

const DIM_EDGE_STYLE = {
  stroke: '#e2e8f0',
  strokeWidth: 1,
  opacity: 0.2,
};

const DEFAULT_EDGE_STYLE = {
  stroke: '#94a3b8',
  strokeWidth: 2,
  opacity: 1,
};

export function useLineageGraph(fitGraphToView) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [baseNodes, setBaseNodes] = useState([]);
  const [baseEdges, setBaseEdges] = useState([]);

  const [sql, setSql] = useState(DEFAULT_SQL);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [rfInstance, setRfInstance] = useState(null);
  const [warnings, setWarnings] = useState([]);

  const [layoutMode, setLayoutMode] = useState(LAYOUT_MODES.TB);
  const [branchFilter, setBranchFilter] = useState('');
  const [focusMode, setFocusMode] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([]);

  const [diffMode, setDiffMode] = useState(false);
  const [baselineGraph, setBaselineGraph] = useState(null);
  const [diffSummary, setDiffSummary] = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const searchInputRef = useRef(null);

  const relayout = useCallback(
    (nodeList, edgeList, mode = layoutMode) => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodeList,
        edgeList,
        mode
      );
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    },
    [layoutMode, setNodes, setEdges]
  );

  const applyBranchAndFocus = useCallback(
    (nodeList, edgeList) => {
      let visibleIds = getBranchFilterVisibleIds(nodeList, edgeList, branchFilter);
      let filteredNodes = nodeList;
      let filteredEdges = edgeList;

      if (visibleIds) {
        const result = applyVisibilityFilter(nodeList, edgeList, visibleIds);
        filteredNodes = result.nodes;
        filteredEdges = result.edges;
      }

      if (focusMode && selectedNodeId) {
        const focusSet =
          focusMode === 'upstream'
            ? getUpstreamNodes(selectedNodeId, edgeList)
            : getDownstreamNodes(selectedNodeId, edgeList);
        focusSet.add(selectedNodeId);
        const focused = applyVisibilityFilter(filteredNodes, filteredEdges, focusSet);
        filteredNodes = focused.nodes;
        filteredEdges = focused.edges;
      }

      return { filteredNodes, filteredEdges };
    },
    [branchFilter, focusMode, selectedNodeId]
  );

  const applyGraphHighlight = useCallback(
    (highlightNodes, highlightEdges, sourceNodeIds = null, columnName = null) => {
      setNodes((nds) =>
        nds.map((n) => {
          const inPath = highlightNodes.has(n.id);
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
        eds.map((e) => ({
          ...e,
          animated: highlightEdges.has(e.id),
          style: {
            ...e.style,
            ...(highlightEdges.has(e.id) ? HIGHLIGHT_EDGE_STYLE : DIM_EDGE_STYLE),
          },
        }))
      );
    },
    [setNodes, setEdges]
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
        style: { ...e.style, ...DEFAULT_EDGE_STYLE },
      }))
    );
  }, [setNodes, setEdges]);

  const handleParseSql = async () => {
    setLoading(true);
    setSearchQuery('');
    setSearchResults([]);
    setWarnings([]);
    setSelectedNodeId(null);
    setSelectedColumn(null);
    setBreadcrumb([]);
    setFocusMode(null);

    try {
      const data = await parseSql(sql);
      setWarnings(data.warnings || []);

      const styledEdges = styleApiEdges(data.edges);
      const initializedNodes = initializeApiNodes(data.nodes);

      let diff = null;
      if (diffMode && baselineGraph) {
        diff = computeGraphDiff(baselineGraph, {
          nodes: initializedNodes,
          edges: styledEdges,
        });
        setDiffSummary({
          addedNodes: diff.addedNodes.size,
          removedNodes: diff.removedNodes.size,
          addedEdges: diff.addedEdges.size,
          removedEdges: diff.removedEdges.size,
        });
      } else if (diffMode) {
        setBaselineGraph({ nodes: initializedNodes, edges: styledEdges });
        setDiffSummary(null);
      }

      const diffNodes = diff ? applyDiffToNodes(initializedNodes, diff) : initializedNodes;
      let diffEdges = diff ? applyDiffToEdges(styledEdges, diff) : styledEdges;
      if (diff) {
        diffEdges = diffEdges.map((e) =>
          e.data?.diffStatus === 'added'
            ? { ...e, style: { ...e.style, stroke: '#10b981', strokeWidth: 3 } }
            : e
        );
      }

      setBaseNodes(diffNodes);
      setBaseEdges(diffEdges);

      const { filteredNodes, filteredEdges } = applyBranchAndFocus(diffNodes, diffEdges);
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        filteredNodes,
        filteredEdges,
        layoutMode
      );

      setNodes(
        layoutedNodes.map((n) => ({
          ...n,
          style: { opacity: 1, transition: 'opacity 0.3s ease' },
        }))
      );
      setEdges(layoutedEdges);
      fitGraphToView();
    } catch (error) {
      alert(error.message || 'Error parsing SQL. Is your FastAPI server running?');
    }

    setLoading(false);
  };

  const handleResetCanvas = () => {
    setBranchFilter('');
    setFocusMode(null);
    setSelectedNodeId(null);
    setSelectedColumn(null);
    setBreadcrumb([]);
    setDiffSummary(null);
    if (diffMode) setBaselineGraph(null);

    const resetNodes = baseNodes.map((n) => ({
      ...n,
      hidden: false,
      style: { opacity: 1 },
      data: {
        ...n.data,
        collapsed: false,
        isLineageHighlight: false,
        isColumnSource: false,
        highlightedColumn: null,
      },
    }));

    const resetEdges = baseEdges.map((e) => ({
      ...e,
      hidden: false,
      animated: false,
      style: { ...DEFAULT_EDGE_STYLE, transition: 'all 0.3s ease' },
    }));

    relayout(resetNodes, resetEdges);
    fitGraphToView();
  };

  const handleLayoutChange = (mode) => {
    setLayoutMode(mode);
    const { filteredNodes, filteredEdges } = applyBranchAndFocus(baseNodes, baseEdges);
    relayout(filteredNodes, filteredEdges, mode);
    fitGraphToView();
  };

  const handleBranchFilterChange = (value) => {
    setBranchFilter(value);
    const { filteredNodes, filteredEdges } = applyBranchAndFocus(baseNodes, baseEdges);
    // applyBranchAndFocus uses stale branchFilter - need to compute with new value
    let visibleIds = getBranchFilterVisibleIds(baseNodes, baseEdges, value);
    let fn = baseNodes;
    let fe = baseEdges;
    if (visibleIds) {
      const r = applyVisibilityFilter(baseNodes, baseEdges, visibleIds);
      fn = r.nodes;
      fe = r.edges;
    }
    if (focusMode && selectedNodeId) {
      const focusSet =
        focusMode === 'upstream'
          ? getUpstreamNodes(selectedNodeId, baseEdges)
          : getDownstreamNodes(selectedNodeId, baseEdges);
      focusSet.add(selectedNodeId);
      const r = applyVisibilityFilter(fn, fe, focusSet);
      fn = r.nodes;
      fe = r.edges;
    }
    relayout(fn, fe);
    fitGraphToView();
  };

  const handleFocusUpstream = () => {
    if (!selectedNodeId) return;
    setFocusMode('upstream');
    const focusSet = getUpstreamNodes(selectedNodeId, baseEdges);
    focusSet.add(selectedNodeId);
    let fn = baseNodes;
    let fe = baseEdges;
    const visibleIds = getBranchFilterVisibleIds(baseNodes, baseEdges, branchFilter);
    if (visibleIds) {
      const r = applyVisibilityFilter(fn, fe, visibleIds);
      fn = r.nodes;
      fe = r.edges;
    }
    const r = applyVisibilityFilter(fn, fe, focusSet);
    relayout(r.nodes, r.edges);
    fitGraphToView();
  };

  const handleFocusDownstream = () => {
    if (!selectedNodeId) return;
    setFocusMode('downstream');
    const focusSet = getDownstreamNodes(selectedNodeId, baseEdges);
    focusSet.add(selectedNodeId);
    let fn = baseNodes;
    let fe = baseEdges;
    const visibleIds = getBranchFilterVisibleIds(baseNodes, baseEdges, branchFilter);
    if (visibleIds) {
      const r = applyVisibilityFilter(fn, fe, visibleIds);
      fn = r.nodes;
      fe = r.edges;
    }
    const r = applyVisibilityFilter(fn, fe, focusSet);
    relayout(r.nodes, r.edges);
    fitGraphToView();
  };

  const handleClearFocus = () => {
    setFocusMode(null);
    handleBranchFilterChange(branchFilter);
  };

  const handleToggleDiffMode = () => {
    setDiffMode((prev) => !prev);
    setBaselineGraph(null);
    setDiffSummary(null);
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      setNodes((nds) =>
        nds.map((n) => ({ ...n, data: { ...n.data, isSearchMatch: false } }))
      );
      return;
    }

    const lowerQuery = query.toLowerCase();
    const matches = [];

    setNodes((nds) =>
      nds.map((n) => {
        const colMatch =
          n.data.columns &&
          n.data.columns.some((col) => col.toLowerCase().includes(lowerQuery));
        const lineageMatch =
          n.data.column_lineage &&
          n.data.column_lineage.some(
            (entry) =>
              entry.name?.toLowerCase().includes(lowerQuery) ||
              entry.sources?.some((src) => src.toLowerCase().includes(lowerQuery))
          );
        const isMatch =
          (n.data.label && n.data.label.toLowerCase().includes(lowerQuery)) ||
          colMatch ||
          lineageMatch;
        if (isMatch) matches.push(n.id);
        return { ...n, data: { ...n.data, isSearchMatch: isMatch } };
      })
    );

    setSearchResults(matches);
    setSearchIndex(0);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchResults.length > 0 && rfInstance) {
      const nextIndex = (searchIndex + 1) % searchResults.length;
      setSearchIndex(nextIndex);
      const targetNode = rfInstance.getNode(searchResults[searchIndex]);
      if (targetNode) {
        rfInstance.setCenter(
          targetNode.position.x + 110,
          targetNode.position.y + 75,
          { zoom: 1.2, duration: 800 }
        );
      }
    }
  };

  const selectNode = useCallback(
    (node) => {
      if (node.hidden) return;
      setSelectedNodeId(node.id);
      setSelectedColumn(null);
      setBreadcrumb(getBreadcrumbPath(node.id, nodes, edges));

      const { connectedNodes, connectedEdges } = getConnectedElements(node.id, edges);
      applyGraphHighlight(connectedNodes, connectedEdges);
    },
    [nodes, edges, applyGraphHighlight]
  );

  const onNodeClick = useCallback(
    (_event, node) => selectNode(node),
    [selectNode]
  );

  const onColumnSelect = useCallback(
    (nodeId, columnName) => {
      setSelectedNodeId(nodeId);
      setSelectedColumn(columnName);
      setBreadcrumb(getBreadcrumbPath(nodeId, nodes, edges));

      const { upstreamNodes, upstreamEdges, sourceNodeIds } = getColumnLineageHighlight(
        nodeId,
        columnName,
        nodes,
        edges
      );
      applyGraphHighlight(upstreamNodes, upstreamEdges, sourceNodeIds, columnName);
    },
    [nodes, edges, applyGraphHighlight]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedColumn(null);
    setBreadcrumb([]);
    clearHighlight();
  }, [clearHighlight]);

  const handleInit = (instance) => {
    setRfInstance(instance);
    if (nodes.length > 0) fitGraphToView(instance);
  };

  const handleClearSelection = () => {
    onPaneClick();
    setFocusMode(null);
    handleBranchFilterChange(branchFilter);
  };

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    sql,
    setSql,
    loading,
    searchQuery,
    searchResults,
    searchIndex,
    handleParseSql,
    handleResetCanvas,
    handleSearchChange,
    handleSearchKeyDown,
    onNodeClick,
    onPaneClick,
    onColumnSelect,
    handleInit,
    warnings,
    layoutMode,
    handleLayoutChange,
    branchFilter,
    handleBranchFilterChange,
    focusMode,
    handleFocusUpstream,
    handleFocusDownstream,
    handleClearFocus,
    selectedNodeId,
    selectedColumn,
    breadcrumb,
    diffMode,
    handleToggleDiffMode,
    diffSummary,
    showShortcuts,
    setShowShortcuts,
    searchInputRef,
    fitGraphToView,
    handleClearSelection,
  };
}

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNodesState, useEdgesState } from '@xyflow/react';
import { parseSql } from '../api/lineageClient';
import { DEFAULT_DIALECT, detectDialect, fetchDialects } from '../api/dialectClient';
import { theme } from '../theme';
import {
  getLayoutedElements,
  initializeApiNodes,
  styleApiEdges,
  LAYOUT_MODES,
  applyVisibilityFilter,
  ensureNodePositions,
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
import { computeSearchMatches, getSearchVisibilityIds } from '../utils/searchGraph';
import { getNodeDimensions } from '../utils/dagreLayout';

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

const FALLBACK_DIALECTS = [
  { id: 'bigquery', label: 'BigQuery', limitations: '' },
  { id: 'snowflake', label: 'Snowflake', limitations: '' },
  { id: 'postgres', label: 'PostgreSQL', limitations: '' },
  { id: 'spark', label: 'Spark', limitations: '' },
  { id: 'redshift', label: 'Redshift', limitations: '' },
  { id: 'duckdb', label: 'DuckDB', limitations: '' },
];

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
  const [parseError, setParseError] = useState(null);
  const [dialect, setDialect] = useState(DEFAULT_DIALECT);
  const [dialects, setDialects] = useState(FALLBACK_DIALECTS);
  const [detectingDialect, setDetectingDialect] = useState(false);
  const [detectHint, setDetectHint] = useState('');

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
  const [filterNoMatches, setFilterNoMatches] = useState(false);

  const searchInputRef = useRef(null);
  const sqlEditorRef = useRef(null);
  const sqlRef = useRef(DEFAULT_SQL);

  useEffect(() => {
    fetchDialects()
      .then((list) => setDialects(list))
      .catch(() => setDialects(FALLBACK_DIALECTS));
  }, []);

  /** Layout full graph and persist positions on baseNodes/baseEdges. */
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
    [layoutMode, setBaseNodes, setBaseEdges]
  );

  /** Apply branch/focus filters using base graph positions (no relayout). */
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

      if (focusOverride && selectedNodeId) {
        const focusSet =
          focusOverride === 'upstream'
            ? getUpstreamNodes(selectedNodeId, sourceEdges)
            : getDownstreamNodes(selectedNodeId, sourceEdges);
        focusSet.add(selectedNodeId);
        const focused = applyVisibilityFilter(displayNodes, displayEdges, focusSet);
        displayNodes = focused.nodes;
        displayEdges = focused.edges;
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
      setNodes,
      setEdges,
    ]
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

  /** Always read live editor text — React state can lag behind paste/typing. */
  const getSqlForAction = () => {
    const fromEditor = sqlEditorRef.current?.getValue?.();
    if (typeof fromEditor === 'string') {
      return fromEditor;
    }
    return sqlRef.current;
  };

  const handleParseSql = async () => {
    const sqlToParse = getSqlForAction();
    if (sqlToParse !== sqlRef.current) {
      sqlRef.current = sqlToParse;
      setSql(sqlToParse);
    }

    setLoading(true);
    setSearchQuery('');
    setSearchResults([]);
    setWarnings([]);
    setParseError(null);
    setSelectedNodeId(null);
    setSelectedColumn(null);
    setBreadcrumb([]);
    setFocusMode(null);

    try {
      const data = await parseSql(sqlToParse, dialect);
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

      const laidOut = layoutFullGraph(diffNodes, diffEdges, layoutMode);
      applyDisplayFromBase(layoutMode, null, {
        baseNodes: laidOut.nodes,
        baseEdges: laidOut.edges,
      });

      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          style: { opacity: 1, transition: 'opacity 0.3s ease' },
        }))
      );
      fitGraphToView();
    } catch (error) {
      setWarnings([]);
      if (error.name === 'ParseSqlError') {
        setParseError({
          message: error.message,
          errors: error.errors,
          guidance: error.guidance,
        });
      } else {
        setParseError({
          message: error.message || 'Failed to parse SQL',
          errors: [
            {
              message:
                error.message || 'Error parsing SQL. Is your FastAPI server running?',
              line: null,
              column: null,
            },
          ],
        });
      }
    }

    setLoading(false);
  };

  const handleDismissParseError = () => setParseError(null);

  const handleJumpToError = (line, column) => {
    sqlEditorRef.current?.jumpToLine(line, column);
  };

  const handleSqlChange = (value) => {
    sqlRef.current = value;
    setSql(value);
    if (parseError) setParseError(null);
    if (detectHint) setDetectHint('');
  };

  const handleDialectChange = (value) => {
    setDialect(value);
    setDetectHint('');
  };

  const handleDetectDialect = async () => {
    const sqlToDetect = getSqlForAction();
    if (!sqlToDetect.trim()) return;
    if (sqlToDetect !== sqlRef.current) {
      sqlRef.current = sqlToDetect;
      setSql(sqlToDetect);
    }
    setDetectingDialect(true);
    try {
      const result = await detectDialect(sqlToDetect);
      setDialect(result.dialect);
      const label = dialects.find((d) => d.id === result.dialect)?.label || result.dialect;
      const signalText =
        result.signals?.length > 0
          ? result.signals.map((s) => s.reason).join('; ')
          : 'No strong signals — defaulting to best guess';
      setDetectHint(`Detected ${label} (${result.confidence} confidence): ${signalText}`);
    } catch {
      setDetectHint('Could not detect dialect — check API connection.');
    }
    setDetectingDialect(false);
  };

  const handleResetCanvas = () => {
    setBranchFilter('');
    setFilterNoMatches(false);
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

    const laidOut = layoutFullGraph(resetNodes, resetEdges, layoutMode);
    applyDisplayFromBase(layoutMode, null, {
      baseNodes: laidOut.nodes,
      baseEdges: laidOut.edges,
    });
    fitGraphToView();
  };

  const handleLayoutChange = (mode) => {
    setLayoutMode(mode);
    const laidOut = layoutFullGraph(baseNodes, baseEdges, mode);
    applyDisplayFromBase(mode, focusMode, {
      baseNodes: laidOut.nodes,
      baseEdges: laidOut.edges,
    });
    fitGraphToView();
  };

  const handleBranchFilterChange = (value) => {
    setBranchFilter(value);
    if (!baseNodes.length || searchQuery.trim()) return;
    applyDisplayFromBase(layoutMode, focusMode);
  };

  const handleFocusUpstream = () => {
    if (!selectedNodeId) return;
    setFocusMode('upstream');
    applyDisplayFromBase(layoutMode, 'upstream');
    fitGraphToView();
  };

  const handleFocusDownstream = () => {
    if (!selectedNodeId) return;
    setFocusMode('downstream');
    applyDisplayFromBase(layoutMode, 'downstream');
    fitGraphToView();
  };

  const handleClearFocus = () => {
    setFocusMode(null);
    applyDisplayFromBase(layoutMode, null);
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
      setSearchIndex(0);
      applyDisplayFromBase(layoutMode, focusMode);
      return;
    }

    if (!baseNodes.length) {
      setSearchResults([]);
      return;
    }

    const matches = computeSearchMatches(baseNodes, query);
    setSearchResults(matches);
    setSearchIndex(0);

    if (matches.length === 0) {
      applyDisplayFromBase(layoutMode, focusMode);
      return;
    }

    const visibleIds = getSearchVisibilityIds(matches, baseEdges);
    const { nodes: filteredNodes, edges: filteredEdges } = applyVisibilityFilter(
      baseNodes,
      baseEdges,
      visibleIds
    );
    const displayNodes = ensureNodePositions(filteredNodes);

    setNodes(
      displayNodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isSearchMatch: matches.includes(n.id),
          isActiveSearchMatch: n.id === matches[0],
          searchQuery: query,
        },
      }))
    );
    setEdges(filteredEdges);

    if (rfInstance) {
      const targetNode = displayNodes.find((n) => n.id === matches[0]);
      if (targetNode?.position) {
        setTimeout(() => {
          const { width, height } = getNodeDimensions(targetNode);
          rfInstance.setCenter(
            targetNode.position.x + width / 2,
            targetNode.position.y + height / 2,
            { zoom: 1.2, duration: 600 }
          );
        }, 50);
      }
    }
  };

  const panToSearchResult = (index) => {
    if (!rfInstance || !searchResults.length) return;
    const targetId = searchResults[index];
    const targetNode =
      rfInstance.getNode(targetId) ||
      nodes.find((n) => n.id === targetId) ||
      baseNodes.find((n) => n.id === targetId);

    if (!targetNode?.position) return;

    const { width, height } = getNodeDimensions(targetNode);
    rfInstance.setCenter(
      targetNode.position.x + width / 2,
      targetNode.position.y + height / 2,
      { zoom: 1.2, duration: 800 }
    );
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchResults.length > 0) {
      e.preventDefault();
      const targetId = searchResults[searchIndex];
      panToSearchResult(searchIndex);
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            isActiveSearchMatch: n.id === targetId,
          },
        }))
      );
      setSearchIndex((searchIndex + 1) % searchResults.length);
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
    setSql: handleSqlChange,
    loading,
    parseError,
    handleDismissParseError,
    handleJumpToError,
    sqlEditorRef,
    dialect,
    dialects,
    handleDialectChange,
    handleDetectDialect,
    detectingDialect,
    detectHint,
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
    filterNoMatches,
  };
}

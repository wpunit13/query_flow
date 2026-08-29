import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
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
  adjustLayoutForExpandedToggle,
  getDownstreamNodeIds,
} from '../utils/dagreLayout';
import { getConnectedElements } from '../utils/graphVisibility';
import {
  getBreadcrumbPath,
  getColumnLineageHighlight,
  getStageBreadcrumbPath,
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
import {
  buildClientExportPayload,
  downloadCsvFromLineage,
  downloadGraphPdf,
  downloadGraphPng,
  downloadGraphSvg,
  downloadJsonExport,
  downloadOpenLineageExport,
} from '../utils/exportGraph';

import {
  getDefaultExpandedStageId,
  getDefaultTableTab,
  VIEW_MODES,
  TABLE_TABS,
  isPipelineQuery,
} from '../utils/lineageTableModel';
import {
  isLargeLineageGraph,
  buildOverviewToastMessage,
} from '../constants/overviewMode';
import { GRAPH_DETAIL_MODES } from '../constants/graphDetailMode';
import {
  isCompoundGraphEligible,
  mapHighlightToCompoundDisplay,
  isCompoundDisplayEdgeHighlighted,
  fromStageGroupId,
  toStageGroupId,
  findStageContainingNode,
} from '../utils/compoundGraphModel';
import { buildCompoundGraphDisplay } from '../utils/compoundGraphLayout';
import {
  persistLineageSession,
  readLineageParseResult,
  shouldAutoRestore,
  readInitialSql,
  readInitialStudioMode,
  readInitialTableTab,
  readInitialViewMode,
  readLineageSessionMeta,
  readStoredSql,
  resolveGraphDetailModeFromSession,
  shouldPreferTableOverview,
} from '../utils/lineageSession';

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

function persistGraphUiState(patch) {
  try {
    const next = { ...readGraphUiState(), ...patch };
    sessionStorage.setItem(GRAPH_UI_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode / blocked storage */
  }
}

function resolveGraphDetailMode(nodes) {
  if (!nodes?.length || !isCompoundGraphEligible(nodes)) {
    return GRAPH_DETAIL_MODES.FLAT;
  }
  return resolveGraphDetailModeFromSession(true);
}

function readInitialDialect() {
  const meta = readLineageSessionMeta();
  return meta?.dialect || DEFAULT_DIALECT;
}

function readInitialLayoutMode() {
  const stored = readGraphUiState().layoutMode;
  if (stored === LAYOUT_MODES.LR || stored === LAYOUT_MODES.TB) {
    return stored;
  }
  return LAYOUT_MODES.TB;
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

const FALLBACK_DIALECTS = [
  { id: 'bigquery', label: 'BigQuery', limitations: '' },
  { id: 'snowflake', label: 'Snowflake', limitations: '' },
  { id: 'postgres', label: 'PostgreSQL', limitations: '' },
  { id: 'spark', label: 'Spark', limitations: '' },
  { id: 'redshift', label: 'Redshift', limitations: '' },
  { id: 'duckdb', label: 'DuckDB', limitations: '' },
];

export function useLineageGraph(fitGraphToView, embedOptions = null) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [baseNodes, setBaseNodes] = useState([]);
  const [baseEdges, setBaseEdges] = useState([]);

  const [sql, setSql] = useState(readInitialSql);
  const [loading, setLoading] = useState(() => shouldAutoRestore());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [rfInstance, setRfInstance] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [parseError, setParseError] = useState(null);
  const [dialect, setDialect] = useState(readInitialDialect);
  const [dialects, setDialects] = useState(FALLBACK_DIALECTS);
  const [detectingDialect, setDetectingDialect] = useState(false);
  const [detectHint, setDetectHint] = useState('');
  const [studioMode, setStudioMode] = useState(readInitialStudioMode);
  const [zenMode, setZenMode] = useState(false);

  const [layoutMode, setLayoutMode] = useState(readInitialLayoutMode);
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

  const [viewMode, setViewMode] = useState(readInitialViewMode);
  const [tableTab, setTableTab] = useState(readInitialTableTab);
  const [expandedStageId, setExpandedStageId] = useState(null);
  const [showAllOperations, setShowAllOperations] = useState(false);
  const [overviewToast, setOverviewToast] = useState(null);
  const [graphDetailMode, setGraphDetailMode] = useState(GRAPH_DETAIL_MODES.FLAT);
  const graphDetailModeRef = useRef(GRAPH_DETAIL_MODES.FLAT);
  const [compoundExpandedStageIds, setCompoundExpandedStageIds] = useState([]);

  const [lastParseResult, setLastParseResult] = useState(null);
  const embedBootstrapped = useRef(false);
  const searchInputRef = useRef(null);
  const sqlEditorRef = useRef(null);
  const sqlRef = useRef(readInitialSql());
  const [lastParsedSql, setLastParsedSql] = useState(null);
  const handleParseSqlRef = useRef(null);
  const applyParsedLineageRef = useRef(null);
  const parseGenerationRef = useRef(0);
  const restoredFromCacheRef = useRef(false);

  graphDetailModeRef.current = graphDetailMode;

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

      if (useCompound) {
        const compound = buildCompoundGraphDisplay({
          nodes: displayNodes,
          edges: displayEdges,
          layoutMode: mode,
          expandedStages,
        });
        setNodes(
          ensureNodePositions(compound.nodes).map((n) => ({
            ...n,
            data: {
              ...n.data,
              isSearchMatch: false,
              isActiveSearchMatch: false,
              searchQuery: '',
            },
          }))
        );
        setEdges(compound.edges);
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
    [
      setNodes,
      setEdges,
      baseNodes,
      baseEdges,
      compoundExpandedStageIds,
    ]
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

  /** Always read live editor text — React state can lag behind paste/typing. */
  const getSqlForAction = () => {
    const fromEditor = sqlEditorRef.current?.getValue?.();
    if (typeof fromEditor === 'string' && fromEditor.trim().length > 0) {
      return fromEditor;
    }
    return sqlRef.current;
  };

  const applyParsedLineage = (data, sqlToParse, { persist = true, applyDiff = true } = {}) => {
    setLastParseResult(data);
    setWarnings(data.warnings || []);

    const styledEdges = styleApiEdges(data.edges);
    const initializedNodes = initializeApiNodes(data.nodes);

    let diff = null;
    if (applyDiff && diffMode && baselineGraph) {
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
    } else if (applyDiff && diffMode) {
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

    const nodeCount = data.stats?.node_count ?? initializedNodes.length;
    const edgeCount = data.stats?.edge_count ?? styledEdges.length;
    const useTableOverview = isLargeLineageGraph(nodeCount);
    const nextGraphDetailMode = resolveGraphDetailMode(initializedNodes);
    const overviewTableTab = isPipelineQuery(initializedNodes)
      ? TABLE_TABS.PIPELINE
      : getDefaultTableTab(initializedNodes);

    setGraphDetailMode(nextGraphDetailMode);
    graphDetailModeRef.current = nextGraphDetailMode;

    if (persist) {
      const sessionSaved = persistLineageSession({
        sql: sqlToParse,
        dialect,
        preferTableOverview: useTableOverview,
        tableTab: useTableOverview ? overviewTableTab : readLineageSessionMeta()?.tableTab,
        pendingRestore: true,
        userChoseFlat: false,
        parseResult: data,
      });
      if (!sessionSaved) {
        console.warn(
          '[lineage] Could not save session to browser storage — refresh will not restore this query.'
        );
      }
    }

    const laidOut = layoutFullGraph(diffNodes, diffEdges, layoutMode);
    applyDisplayFromBase(layoutMode, null, {
      baseNodes: laidOut.nodes,
      baseEdges: laidOut.edges,
      graphDetailMode: nextGraphDetailMode,
    });

    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        style: { opacity: 1, transition: 'opacity 0.3s ease' },
      }))
    );

    if (useTableOverview) {
      setViewMode(VIEW_MODES.TABLE);
      setTableTab(overviewTableTab);
      setOverviewToast(buildOverviewToastMessage(nodeCount, edgeCount));
    } else {
      setViewMode(VIEW_MODES.GRAPH);
      setOverviewToast(null);
      fitGraphToView();
    }

    setLastParsedSql(sqlToParse);
    setExpandedStageId(getDefaultExpandedStageId(initializedNodes));
    setStudioMode('explore');
    setZenMode(false);
    setLoading(false);
  };

  applyParsedLineageRef.current = applyParsedLineage;

  const handleParseSql = async (sqlOverride) => {
    const parseGeneration = ++parseGenerationRef.current;
    const isStaleParse = () => parseGeneration !== parseGenerationRef.current;

    const sqlToParse =
      typeof sqlOverride === 'string' && sqlOverride.trim().length > 0
        ? sqlOverride
        : getSqlForAction();
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
    setExpandedStageId(null);
    setShowAllOperations(false);
    setOverviewToast(null);
    setCompoundExpandedStageIds([]);

    try {
      const data = await parseSql(sqlToParse, dialect);
      if (isStaleParse()) return;
      applyParsedLineage(data, sqlToParse);
    } catch (error) {
      if (isStaleParse()) return;
      setStudioMode('author');
      setZenMode(false);
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
      if (!isStaleParse()) {
        setLoading(false);
      }
    }
  };

  handleParseSqlRef.current = handleParseSql;

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
    setStudioMode('author');
    setZenMode(false);
    setLastParsedSql(null);
    setBranchFilter('');
    setFilterNoMatches(false);
    setFocusMode(null);
    setSelectedNodeId(null);
    setSelectedColumn(null);
    setBreadcrumb([]);
    setDiffSummary(null);
    setLastParseResult(null);
    setViewMode(VIEW_MODES.GRAPH);
    setTableTab(TABLE_TABS.SOURCES);
    setExpandedStageId(null);
    setShowAllOperations(false);
    setOverviewToast(null);
    setGraphDetailMode(GRAPH_DETAIL_MODES.FLAT);
    graphDetailModeRef.current = GRAPH_DETAIL_MODES.FLAT;
    setCompoundExpandedStageIds([]);
    if (diffMode) setBaselineGraph(null);

    const resetNodes = baseNodes.map((n) => ({
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

    const resetEdges = baseEdges.map((e) => ({
      ...e,
      hidden: false,
      animated: false,
      style: { ...getDefaultEdgeStyle(), transition: 'all 0.3s ease' },
    }));

    const laidOut = layoutFullGraph(resetNodes, resetEdges, layoutMode);
    applyDisplayFromBase(layoutMode, null, {
      baseNodes: laidOut.nodes,
      baseEdges: laidOut.edges,
      graphDetailMode: GRAPH_DETAIL_MODES.FLAT,
    });
    fitGraphToView();
  };

  const handleLayoutChange = (mode) => {
    setLayoutMode(mode);
    persistGraphUiState({ layoutMode: mode });
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

  const selectNodeById = useCallback(
    (nodeId) => {
      const node = baseNodes.find((n) => n.id === nodeId);
      if (!node) return;
      setSelectedNodeId(nodeId);
      setSelectedColumn(null);
      setBreadcrumb(getStageBreadcrumbPath(nodeId, baseNodes, baseEdges));
      if (STAGE_KINDS.has(node.data?.kind)) {
        setExpandedStageId(nodeId);
      }
      if (viewMode === VIEW_MODES.GRAPH) {
        const { connectedNodes, connectedEdges } = getConnectedElements(
          nodeId,
          baseEdges
        );
        applyGraphHighlight(connectedNodes, connectedEdges);
      }
    },
    [baseNodes, baseEdges, viewMode, applyGraphHighlight]
  );

  const selectNode = useCallback(
    (node) => {
      if (node.hidden) return;
      selectNodeById(node.id);
    },
    [selectNodeById]
  );

  const onNodeClick = useCallback(
    (_event, node) => {
      const stageId = fromStageGroupId(node.id);
      if (stageId) {
        selectNodeById(stageId);
        return;
      }
      selectNode(node);
    },
    [selectNode, selectNodeById]
  );

  const onColumnSelect = useCallback(
    (nodeId, columnName) => {
      setSelectedNodeId(nodeId);
      setSelectedColumn(columnName);
      setBreadcrumb(getStageBreadcrumbPath(nodeId, baseNodes, baseEdges));
      setExpandedStageId(nodeId);

      const { upstreamNodes, upstreamEdges, sourceNodeIds } =
        getColumnLineageHighlight(nodeId, columnName, baseNodes, baseEdges);

      if (viewMode === VIEW_MODES.GRAPH) {
        applyGraphHighlight(
          upstreamNodes,
          upstreamEdges,
          sourceNodeIds,
          columnName
        );
      }
    },
    [baseNodes, baseEdges, viewMode, applyGraphHighlight]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedColumn(null);
    setExpandedStageId(null);
    setBreadcrumb([]);
    clearHighlight();
  }, [clearHighlight]);

  const clearTableSelection = useCallback(() => {
    onPaneClick();
  }, [onPaneClick]);

  const handleStageExpand = useCallback((stageId) => {
    setExpandedStageId(stageId);
  }, []);

  const handleCompoundStageToggle = useCallback(
    (stageId) => {
      const viewport = rfInstance?.getViewport?.();
      const next = new Set(compoundExpandedStageIds);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      const nextIds = [...next];
      setCompoundExpandedStageIds(nextIds);

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
      rfInstance,
      baseNodes,
    ]
  );

  const handleToggleGraphDetail = useCallback(() => {
    const next =
      graphDetailMode === GRAPH_DETAIL_MODES.COMPOUND
        ? GRAPH_DETAIL_MODES.FLAT
        : GRAPH_DETAIL_MODES.COMPOUND;
    setGraphDetailMode(next);
    graphDetailModeRef.current = next;
    persistGraphUiState({
      userChoseFlat: next === GRAPH_DETAIL_MODES.FLAT,
    });
    const meta = readLineageSessionMeta();
    persistLineageSession({
      sql: readStoredSql() || sqlRef.current,
      dialect,
      preferTableOverview:
        meta?.preferTableOverview ??
        shouldPreferTableOverview(meta, readStoredSql() || sqlRef.current),
      tableTab: meta?.tableTab ?? readInitialTableTab(),
      userChoseFlat: next === GRAPH_DETAIL_MODES.FLAT,
    });
    applyDisplayFromBase(layoutMode, focusMode, { graphDetailMode: next });
    setTimeout(() => fitGraphToView(), 80);
  }, [graphDetailMode, layoutMode, focusMode, applyDisplayFromBase, fitGraphToView]);

  const handleViewModeChange = useCallback(
    (mode) => {
      if (mode === VIEW_MODES.TABLE) {
        setZenMode(false);
      }
      setViewMode(mode);
      if (mode === VIEW_MODES.GRAPH) {
        const detailMode = resolveGraphDetailMode(baseNodes);
        setGraphDetailMode(detailMode);
        graphDetailModeRef.current = detailMode;
        applyDisplayFromBase(layoutMode, focusMode, {
          graphDetailMode: detailMode,
        });
        if (selectedNodeId) {
          if (selectedColumn) {
            const { upstreamNodes, upstreamEdges, sourceNodeIds } =
              getColumnLineageHighlight(
                selectedNodeId,
                selectedColumn,
                baseNodes,
                baseEdges
              );
            applyGraphHighlight(
              upstreamNodes,
              upstreamEdges,
              sourceNodeIds,
              selectedColumn
            );
          } else {
            const { connectedNodes, connectedEdges } = getConnectedElements(
              selectedNodeId,
              baseEdges
            );
            applyGraphHighlight(connectedNodes, connectedEdges);
          }
        }
        setTimeout(() => fitGraphToView(), 80);
      }
    },
    [
      selectedNodeId,
      selectedColumn,
      baseNodes,
      baseEdges,
      layoutMode,
      focusMode,
      applyDisplayFromBase,
      applyGraphHighlight,
      fitGraphToView,
    ]
  );

  const handleToggleShowAllOperations = useCallback(() => {
    setShowAllOperations((prev) => !prev);
  }, []);

  const onNodeExpandedToggle = useCallback(
    (nodeId) => {
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
        : adjustLayoutForExpandedToggle(
            baseNodes,
            baseEdges,
            nodeId,
            layoutMode
          );

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
      rfInstance,
      compoundExpandedStageIds,
    ]
  );

  const handleInit = (instance) => {
    setRfInstance(instance);
    if (nodes.length > 0) fitGraphToView(instance);
  };

  const handleEnterAuthor = () => {
    setStudioMode('author');
    setZenMode(false);
  };

  const handleEnterExplore = () => {
    if (!baseNodes.length) return;
    setStudioMode('explore');
    setZenMode(false);
    setTimeout(() => fitGraphToView(), 80);
  };

  const handleToggleStudioMode = () => {
    if (studioMode === 'explore') {
      handleEnterAuthor();
    } else if (baseNodes.length > 0) {
      handleEnterExplore();
    }
  };

  const handleToggleZen = () => {
    if (studioMode !== 'explore') return;
    setZenMode((prev) => !prev);
    setTimeout(() => fitGraphToView(), 80);
  };

  const handleClearSelection = () => {
    if (zenMode) {
      setZenMode(false);
      return;
    }
    onPaneClick();
    setFocusMode(null);
    handleBranchFilterChange(branchFilter);
  };

  const handleExportPng = useCallback(async () => {
    if (!rfInstance) throw new Error('Graph not ready — render a query first');
    await downloadGraphPng(rfInstance);
  }, [rfInstance]);

  const handleExportSvg = useCallback(async () => {
    if (!rfInstance) throw new Error('Graph not ready — render a query first');
    await downloadGraphSvg(rfInstance);
  }, [rfInstance]);

  const handleExportPdf = useCallback(async () => {
    if (!rfInstance) throw new Error('Graph not ready — render a query first');
    await downloadGraphPdf(rfInstance);
  }, [rfInstance]);

  const handleExportJson = useCallback(() => {
    if (!lastParseResult) throw new Error('No lineage data — render a query first');
    const payload = buildClientExportPayload(
      lastParseResult,
      getSqlForAction(),
      dialect
    );
    downloadJsonExport(payload);
  }, [lastParseResult, dialect]);

  const handleExportCsv = useCallback(() => {
    if (!lastParseResult) throw new Error('No lineage data — render a query first');
    downloadCsvFromLineage(lastParseResult);
  }, [lastParseResult]);

  const handleExportOpenLineage = useCallback(async () => {
    const sqlToExport = getSqlForAction();
    if (!sqlToExport?.trim()) throw new Error('No SQL to export');
    await downloadOpenLineageExport(sqlToExport, dialect);
  }, [dialect]);

  useLayoutEffect(() => {
    if (embedOptions?.embed) return;

    const cached = readLineageParseResult();
    const storedSql = readStoredSql();
    if (cached?.nodes && storedSql?.trim()) {
      restoredFromCacheRef.current = true;
      sqlRef.current = storedSql;
      setSql(storedSql);
      const meta = readLineageSessionMeta();
      if (meta?.dialect) setDialect(meta.dialect);
      applyParsedLineageRef.current?.(cached, storedSql, {
        persist: false,
        applyDiff: false,
      });
      return;
    }

    if (!shouldAutoRestore()) return;

    const meta = readLineageSessionMeta();
    if (shouldPreferTableOverview(meta, storedSql)) {
      setViewMode(VIEW_MODES.TABLE);
      setTableTab(meta?.tableTab || readInitialTableTab());
    }
    setStudioMode('explore');
    setLoading(true);
  }, [embedOptions]);

  useEffect(() => {
    if (embedOptions?.embed) {
      if (embedBootstrapped.current) return;
      embedBootstrapped.current = true;
      if (embedOptions.dialect) {
        setDialect(embedOptions.dialect);
      }
      if (embedOptions.sql) {
        sqlRef.current = embedOptions.sql;
        setSql(embedOptions.sql);
        setLoading(true);
        handleParseSqlRef.current?.(embedOptions.sql);
      }
      return;
    }

    if (restoredFromCacheRef.current) return;
    if (!shouldAutoRestore()) return;

    const meta = readLineageSessionMeta();
    const storedSql = readStoredSql();
    if (!storedSql?.trim()) return;

    sqlRef.current = storedSql;
    setSql(storedSql);
    if (meta?.dialect) setDialect(meta.dialect);

    let cancelled = false;
    (async () => {
      await handleParseSqlRef.current?.(storedSql);
      if (cancelled) {
        parseGenerationRef.current += 1;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [embedOptions]);

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
    onNodeExpandedToggle,
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
    studioMode,
    zenMode,
    hasRenderedGraph: baseNodes.length > 0,
    sqlIsStale: lastParsedSql !== null && sql !== lastParsedSql,
    handleEnterAuthor,
    handleEnterExplore,
    handleToggleStudioMode,
    handleToggleZen,
    handleExportPng,
    handleExportSvg,
    handleExportPdf,
    handleExportJson,
    handleExportCsv,
    handleExportOpenLineage,
    embedMode: Boolean(embedOptions?.embed),
    viewMode,
    handleViewModeChange,
    tableTab,
    setTableTab,
    expandedStageId,
    clearTableSelection,
    handleStageExpand,
    showAllOperations,
    handleToggleShowAllOperations,
    overviewToast,
    dismissOverviewToast: () => setOverviewToast(null),
    graphDetailMode,
    compoundGraphEligible: isCompoundGraphEligible(baseNodes),
    handleToggleGraphDetail,
    handleCompoundStageToggle,
    selectNodeById,
    baseNodes,
    baseEdges,
  };
}

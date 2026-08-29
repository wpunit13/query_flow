import { useState, useCallback, useRef } from 'react';
import { useParseLineage } from './useParseLineage';
import { useGraphDisplay } from './useGraphDisplay';
import {
  initializeApiNodes,
  styleApiEdges,
  applyVisibilityFilter,
  ensureNodePositions,
} from '../utils/dagreLayout';
import { getConnectedElements } from '../utils/graphVisibility';
import {
  getColumnLineageHighlight,
  getStageBreadcrumbPath,
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
  getLargeQueryOverviewTableTab,
  VIEW_MODES,
  TABLE_TABS,
} from '../utils/lineageTableModel';
import {
  isLargeLineageGraph,
  buildOverviewToastMessage,
} from '../constants/overviewMode';
import { GRAPH_DETAIL_MODES } from '../constants/graphDetailMode';
import {
  isCompoundGraphEligible,
  fromStageGroupId,
} from '../utils/compoundGraphModel';
import {
  readInitialStudioMode,
  readInitialTableTab,
  readInitialViewMode,
  readLineageSessionMeta,
  readStoredSql,
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

export function useLineageGraph(fitGraphToView, embedOptions = null) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [rfInstance, setRfInstance] = useState(null);
  const [studioMode, setStudioMode] = useState(readInitialStudioMode);
  const [zenMode, setZenMode] = useState(false);

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([]);

  const [diffMode, setDiffMode] = useState(false);
  const [baselineGraph, setBaselineGraph] = useState(null);
  const [diffSummary, setDiffSummary] = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const [viewMode, setViewMode] = useState(readInitialViewMode);
  const [tableTab, setTableTab] = useState(readInitialTableTab);
  const [expandedStageId, setExpandedStageId] = useState(null);
  const [showAllOperations, setShowAllOperations] = useState(false);
  const [overviewToast, setOverviewToast] = useState(null);

  const searchInputRef = useRef(null);
  const onParseSuccessRef = useRef(null);
  const onBeforeParseRef = useRef(null);
  const onParseFailedRef = useRef(null);
  const onPrepareSessionRestoreRef = useRef(null);

  const graph = useGraphDisplay({ selectedNodeId });

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    setNodes,
    baseNodes,
    baseEdges,
    layoutMode,
    branchFilter,
    focusMode,
    setFocusMode,
    filterNoMatches,
    graphDetailMode,
    setGraphDetailMode,
    graphDetailModeRef,
    setCompoundExpandedStageIds,
    layoutFullGraph,
    applyDisplayFromBase,
    applyGraphHighlight,
    clearHighlight,
    resetViewFilters,
    resetBaseGraphPresentation,
    toggleGraphDetailMode,
    resolveGraphDetailModeForNodes,
    panToNode,
  } = graph;

  const parse = useParseLineage({
    embedOptions,
    onBeforeParse: () => onBeforeParseRef.current?.(),
    onParseSuccess: (data, sql, opts) => onParseSuccessRef.current?.(data, sql, opts),
    onParseFailed: () => onParseFailedRef.current?.(),
    onPrepareSessionRestore: (payload) => onPrepareSessionRestoreRef.current?.(payload),
  });

  /** Always read live editor text — React state can lag behind paste/typing. */
  const getSqlForAction = parse.getSqlForAction;

  const applyParsedLineage = (data, sqlToParse, { persist = true, applyDiff = true } = {}) => {
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
    const nextGraphDetailMode = resolveGraphDetailModeForNodes(initializedNodes);
    const overviewTableTab = getLargeQueryOverviewTableTab();

    setGraphDetailMode(nextGraphDetailMode);
    graphDetailModeRef.current = nextGraphDetailMode;

    if (persist) {
      const sessionSaved = parse.persistSession({
        sql: sqlToParse,
        dialect: parse.dialect,
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

    parse.setLastParsedSql(sqlToParse);
    setExpandedStageId(getDefaultExpandedStageId(initializedNodes));
    setStudioMode('explore');
    setZenMode(false);
    parse.finishLoading();
  };

  onParseSuccessRef.current = applyParsedLineage;
  onBeforeParseRef.current = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedNodeId(null);
    setSelectedColumn(null);
    setBreadcrumb([]);
    setFocusMode(null);
    setExpandedStageId(null);
    setShowAllOperations(false);
    setOverviewToast(null);
    setCompoundExpandedStageIds([]);
  };
  onParseFailedRef.current = () => {
    setStudioMode('author');
    setZenMode(false);
  };
  onPrepareSessionRestoreRef.current = ({ preferTableOverview, tableTab }) => {
    if (preferTableOverview) {
      setViewMode(VIEW_MODES.TABLE);
      setTableTab(tableTab || readInitialTableTab());
    }
    setStudioMode('explore');
  };

  const handleResetCanvas = () => {
    setStudioMode('author');
    setZenMode(false);
    parse.clearParseResults();
    resetViewFilters();
    setSelectedNodeId(null);
    setSelectedColumn(null);
    setBreadcrumb([]);
    setDiffSummary(null);
    setViewMode(VIEW_MODES.GRAPH);
    setTableTab(TABLE_TABS.SOURCES);
    setExpandedStageId(null);
    setShowAllOperations(false);
    setOverviewToast(null);
    if (diffMode) setBaselineGraph(null);

    const laidOut = resetBaseGraphPresentation(baseNodes, baseEdges);
    applyDisplayFromBase(layoutMode, null, {
      baseNodes: laidOut.nodes,
      baseEdges: laidOut.edges,
      graphDetailMode: GRAPH_DETAIL_MODES.FLAT,
    });
    fitGraphToView();
  };

  const handleLayoutChange = (mode) => {
    graph.handleLayoutChange(mode, fitGraphToView);
  };

  const handleBranchFilterChange = (value) => {
    graph.handleBranchFilterChange(value, { searchActive: searchQuery.trim() });
  };

  const handleFocusUpstream = () => {
    graph.handleFocusUpstream(fitGraphToView);
  };

  const handleFocusDownstream = () => {
    graph.handleFocusDownstream(fitGraphToView);
  };

  const handleClearFocus = () => {
    graph.handleClearFocus();
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
    graph.setEdges(filteredEdges);

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
    panToNode(rfInstance, searchResults[index], nodes);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setSearchQuery('');
      setSearchResults([]);
      setSearchIndex(0);
      applyDisplayFromBase(layoutMode, focusMode);
      searchInputRef.current?.blur();
      return;
    }
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
      graph.toggleCompoundStage(stageId, rfInstance);
    },
    [graph, rfInstance]
  );

  const handleToggleGraphDetail = useCallback(() => {
    const next = toggleGraphDetailMode();
    const meta = readLineageSessionMeta();
    parse.persistSession({
      sql: readStoredSql() || parse.sqlRef.current,
      dialect: parse.dialect,
      preferTableOverview:
        meta?.preferTableOverview ??
        shouldPreferTableOverview(meta, readStoredSql() || parse.sqlRef.current),
      tableTab: meta?.tableTab ?? readInitialTableTab(),
      userChoseFlat: next === GRAPH_DETAIL_MODES.FLAT,
    });
    applyDisplayFromBase(layoutMode, focusMode, { graphDetailMode: next });
    setTimeout(() => fitGraphToView(), 80);
  }, [
    toggleGraphDetailMode,
    layoutMode,
    focusMode,
    applyDisplayFromBase,
    fitGraphToView,
    parse,
  ]);

  const handleViewModeChange = useCallback(
    (mode) => {
      if (mode === VIEW_MODES.TABLE) {
        setZenMode(false);
      }
      setViewMode(mode);
      if (mode === VIEW_MODES.GRAPH) {
        const detailMode = resolveGraphDetailModeForNodes(baseNodes);
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
      resolveGraphDetailModeForNodes,
      setGraphDetailMode,
      graphDetailModeRef,
    ]
  );

  const handleToggleShowAllOperations = useCallback(() => {
    setShowAllOperations((prev) => !prev);
  }, []);

  const onNodeExpandedToggle = useCallback(
    (nodeId) => {
      graph.onNodeExpandedToggle(nodeId, rfInstance);
    },
    [graph, rfInstance]
  );

  const handleInit = (instance) => {
    setRfInstance(instance);
    if (nodes.length > 0) fitGraphToView(instance);
  };

  const handleEnterAuthor = useCallback(() => {
    setStudioMode('author');
    setZenMode(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchIndex(0);
    applyDisplayFromBase(layoutMode, focusMode);
  }, [layoutMode, focusMode, applyDisplayFromBase]);

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
    if (!parse.lastParseResult) throw new Error('No lineage data — render a query first');
    const payload = buildClientExportPayload(
      parse.lastParseResult,
      getSqlForAction(),
      parse.dialect
    );
    downloadJsonExport(payload);
  }, [parse.lastParseResult, parse.dialect, getSqlForAction]);

  const handleExportCsv = useCallback(() => {
    if (!parse.lastParseResult) throw new Error('No lineage data — render a query first');
    downloadCsvFromLineage(parse.lastParseResult);
  }, [parse.lastParseResult]);

  const handleExportOpenLineage = useCallback(async () => {
    const sqlToExport = getSqlForAction();
    if (!sqlToExport?.trim()) throw new Error('No SQL to export');
    await downloadOpenLineageExport(sqlToExport, parse.dialect);
  }, [parse.dialect, getSqlForAction]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    sql: parse.sql,
    setSql: parse.setSql,
    loading: parse.loading,
    parseError: parse.parseError,
    handleDismissParseError: parse.handleDismissParseError,
    handleDismissWarnings: parse.handleDismissWarnings,
    handleJumpToError: parse.handleJumpToError,
    sqlEditorRef: parse.sqlEditorRef,
    dialect: parse.dialect,
    dialects: parse.dialects,
    handleDialectChange: parse.handleDialectChange,
    handleDetectDialect: parse.handleDetectDialect,
    detectingDialect: parse.detectingDialect,
    detectHint: parse.detectHint,
    searchQuery,
    searchResults,
    searchIndex,
    handleParseSql: parse.handleParseSql,
    handleResetCanvas,
    handleSearchChange,
    handleSearchKeyDown,
    onNodeClick,
    onPaneClick,
    onColumnSelect,
    onNodeExpandedToggle,
    handleInit,
    warnings: parse.warnings,
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
    sqlIsStale:
      parse.lastParsedSql !== null && parse.sql !== parse.lastParsedSql,
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

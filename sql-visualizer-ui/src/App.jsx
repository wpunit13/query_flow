import { useState, useMemo } from 'react';
import { useTheme } from './context/ThemeContext';
import { useGraphLayout } from './hooks/useGraphLayout';
import { useLineageGraph } from './hooks/useLineageGraph';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { GraphActionsContext } from './context/GraphActionsContext';
import StudioHeader from './components/StudioHeader';
import GraphCanvas from './components/GraphCanvas';
import GraphToolbar from './components/GraphToolbar';
import LineageTableView from './components/LineageTableView';
import BreadcrumbBar from './components/BreadcrumbBar';
import ShortcutsModal from './components/ShortcutsModal';
import OverviewToast from './components/OverviewToast';
import ZenFloatingControls from './components/ZenFloatingControls';
import { LAYOUT_MODES } from './utils/dagreLayout';
import { VIEW_MODES } from './utils/lineageTableModel';

export default function App() {
  const { theme } = useTheme();
  const embedOptions = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const sqlParam = params.get('sql');
    return {
      embed: params.get('embed') === '1',
      sql: sqlParam ? decodeURIComponent(sqlParam) : null,
      dialect: params.get('dialect') || null,
    };
  }, []);

  const [rfInstance, setRfInstance] = useState(null);
  const { fitGraphToView } = useGraphLayout(rfInstance);

  const graph = useLineageGraph(fitGraphToView, embedOptions);

  useKeyboardShortcuts({
    onFocusSearch: () => graph.searchInputRef.current?.focus(),
    onFitView: () => graph.fitGraphToView(),
    onReset: graph.handleResetCanvas,
    onClearSelection: graph.handleClearSelection,
    onFocusUpstream: graph.handleFocusUpstream,
    onFocusDownstream: graph.handleFocusDownstream,
    onLayoutTB: () => graph.handleLayoutChange(LAYOUT_MODES.TB),
    onLayoutLR: () => graph.handleLayoutChange(LAYOUT_MODES.LR),
    onToggleDiff: () => graph.setShowShortcuts(true),
    onToggleStudioMode: graph.handleToggleStudioMode,
    onToggleZen: graph.handleToggleZen,
    onViewGraph: () => graph.handleViewModeChange(VIEW_MODES.GRAPH),
    onViewTable: () => graph.handleViewModeChange(VIEW_MODES.TABLE),
    canSwitchView: graph.hasRenderedGraph && graph.studioMode === 'explore',
    enabled: !graph.showShortcuts,
    zenMode: graph.zenMode,
    studioMode: graph.studioMode,
  });

  const onFlowInit = (instance) => {
    setRfInstance(instance);
    graph.handleInit(instance);
  };

  const graphActions = {
    onColumnSelect: graph.onColumnSelect,
    onNodeExpandedToggle: graph.onNodeExpandedToggle,
    onCompoundStageToggle: graph.handleCompoundStageToggle,
  };

  const isExplore = graph.studioMode === 'explore';
  const shellPadding = graph.embedMode ? '0' : isExplore ? '8px' : '20px';

  const isTableView =
    graph.viewMode === VIEW_MODES.TABLE &&
    !graph.zenMode &&
    (graph.hasRenderedGraph || graph.loading);

  return (
    <GraphActionsContext.Provider value={graphActions}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: shellPadding,
          fontFamily: '"Inter", sans-serif',
          background: theme.shellBg,
        }}
      >
        {!graph.embedMode && (
          <StudioHeader
          studioMode={graph.studioMode}
          onEnterAuthor={graph.handleEnterAuthor}
          onEnterExplore={graph.handleEnterExplore}
          hasRenderedGraph={graph.hasRenderedGraph}
          sqlIsStale={graph.sqlIsStale}
          sql={graph.sql}
          onSqlChange={graph.setSql}
          dialect={graph.dialect}
          dialects={graph.dialects}
          onDialectChange={graph.handleDialectChange}
          onDetectDialect={graph.handleDetectDialect}
          detectingDialect={graph.detectingDialect}
          detectHint={graph.detectHint}
          searchQuery={graph.searchQuery}
          onSearchChange={graph.handleSearchChange}
          onSearchKeyDown={graph.handleSearchKeyDown}
          searchResults={graph.searchResults}
          searchIndex={graph.searchIndex}
          onReset={graph.handleResetCanvas}
          onParse={graph.handleParseSql}
          loading={graph.loading}
          warnings={graph.warnings}
          parseError={graph.parseError}
          onDismissError={graph.handleDismissParseError}
          onJumpToError={graph.handleJumpToError}
          sqlEditorRef={graph.sqlEditorRef}
          searchInputRef={graph.searchInputRef}
        />
        )}
        <div
          style={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            border: `1px solid ${theme.border}`,
            borderRadius: graph.embedMode ? '0' : '8px',
            background: theme.bg,
            overflow: 'hidden',
            position: 'relative',
            minHeight: 0,
          }}
        >
          {!graph.zenMode && (
            <>
              <GraphToolbar
                viewMode={graph.viewMode}
                onViewModeChange={graph.handleViewModeChange}
                layoutMode={graph.layoutMode}
                onLayoutChange={graph.handleLayoutChange}
                branchFilter={graph.branchFilter}
                onBranchFilterChange={graph.handleBranchFilterChange}
                focusMode={graph.focusMode}
                onFocusUpstream={graph.handleFocusUpstream}
                onFocusDownstream={graph.handleFocusDownstream}
                onClearFocus={graph.handleClearFocus}
                diffMode={graph.diffMode}
                onToggleDiffMode={graph.handleToggleDiffMode}
                diffSummary={graph.diffSummary}
                selectedNodeId={graph.selectedNodeId}
                onShowShortcuts={() => graph.setShowShortcuts(true)}
                filterNoMatches={graph.filterNoMatches}
                studioMode={graph.studioMode}
                onToggleZen={graph.handleToggleZen}
                zenMode={graph.zenMode}
                onExportPng={graph.handleExportPng}
                onExportSvg={graph.handleExportSvg}
                onExportPdf={graph.handleExportPdf}
                onExportJson={graph.handleExportJson}
                onExportCsv={graph.handleExportCsv}
                onExportOpenLineage={graph.handleExportOpenLineage}
                canExport={graph.hasRenderedGraph}
                compoundGraphEligible={graph.compoundGraphEligible}
                graphDetailMode={graph.graphDetailMode}
                onToggleGraphDetail={graph.handleToggleGraphDetail}
              />
              <BreadcrumbBar
                breadcrumb={graph.breadcrumb}
                selectedColumn={graph.selectedColumn}
                selectedNodeId={graph.selectedNodeId}
                nodes={graph.baseNodes}
                edges={graph.baseEdges}
                onClear={graph.clearTableSelection}
              />
            </>
          )}
          {graph.loading && !graph.hasRenderedGraph ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.textMuted,
                fontSize: 14,
              }}
            >
              Restoring lineage…
            </div>
          ) : isTableView ? (
            <LineageTableView
              nodes={graph.baseNodes}
              edges={graph.baseEdges}
              selectedNodeId={graph.selectedNodeId}
              selectedColumn={graph.selectedColumn}
              expandedStageId={graph.expandedStageId}
              tableTab={graph.tableTab}
              onTableTabChange={graph.setTableTab}
              showAllOperations={graph.showAllOperations}
              onToggleShowAllOperations={graph.handleToggleShowAllOperations}
              onNodeSelect={graph.selectNodeById}
              onColumnSelect={graph.onColumnSelect}
              onClearSelection={graph.clearTableSelection}
            />
          ) : (
            <GraphCanvas
              nodes={graph.nodes}
              edges={graph.edges}
              onNodesChange={graph.onNodesChange}
              onEdgesChange={graph.onEdgesChange}
              onInit={onFlowInit}
              onNodeClick={graph.onNodeClick}
              onPaneClick={graph.onPaneClick}
              showMinimap={!graph.zenMode}
            />
          )}
          {graph.zenMode && (
            <ZenFloatingControls
              onFitView={() => graph.fitGraphToView()}
              onToggleZen={graph.handleToggleZen}
              onEnterAuthor={graph.handleEnterAuthor}
            />
          )}
        </div>
        <ShortcutsModal
          open={graph.showShortcuts}
          onClose={() => graph.setShowShortcuts(false)}
        />
        <OverviewToast
          message={graph.overviewToast}
          onDismiss={graph.dismissOverviewToast}
        />
      </div>
    </GraphActionsContext.Provider>
  );
}

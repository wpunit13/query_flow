import { useState } from 'react';
import { theme } from './theme';
import { useGraphLayout } from './hooks/useGraphLayout';
import { useLineageGraph } from './hooks/useLineageGraph';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { GraphActionsContext } from './context/GraphActionsContext';
import StudioHeader from './components/StudioHeader';
import GraphCanvas from './components/GraphCanvas';
import GraphToolbar from './components/GraphToolbar';
import BreadcrumbBar from './components/BreadcrumbBar';
import ShortcutsModal from './components/ShortcutsModal';
import { LAYOUT_MODES } from './utils/dagreLayout';

export default function App() {
  const [rfInstance, setRfInstance] = useState(null);
  const { fitGraphToView } = useGraphLayout(rfInstance);

  const graph = useLineageGraph(fitGraphToView);

  useKeyboardShortcuts({
    onFocusSearch: () => graph.searchInputRef.current?.focus(),
    onFitView: () => graph.fitGraphToView(),
    onReset: graph.handleResetCanvas,
    onClearSelection: graph.handleClearSelection,
    onFocusUpstream: graph.handleFocusUpstream,
    onFocusDownstream: graph.handleFocusDownstream,
    onLayoutTB: () => graph.handleLayoutChange(LAYOUT_MODES.TB),
    onLayoutLR: () => graph.handleLayoutChange(LAYOUT_MODES.LR),
    onLayoutRadial: () => graph.handleLayoutChange(LAYOUT_MODES.RADIAL),
    onToggleDiff: () => graph.setShowShortcuts(true),
    enabled: !graph.showShortcuts,
  });

  const onFlowInit = (instance) => {
    setRfInstance(instance);
    graph.handleInit(instance);
  };

  const graphActions = {
    onColumnSelect: graph.onColumnSelect,
  };

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
          padding: '20px',
          fontFamily: '"Inter", sans-serif',
          background: '#f1f5f9',
        }}
      >
        <StudioHeader
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
        <div
          style={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            border: `1px solid ${theme.border}`,
            borderRadius: '8px',
            background: theme.bg,
            overflow: 'hidden',
          }}
        >
          <GraphToolbar
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
          />
          <BreadcrumbBar
            breadcrumb={graph.breadcrumb}
            selectedColumn={graph.selectedColumn}
          />
          <GraphCanvas
            nodes={graph.nodes}
            edges={graph.edges}
            onNodesChange={graph.onNodesChange}
            onEdgesChange={graph.onEdgesChange}
            onInit={onFlowInit}
            onNodeClick={graph.onNodeClick}
            onPaneClick={graph.onPaneClick}
          />
        </div>
        <ShortcutsModal
          open={graph.showShortcuts}
          onClose={() => graph.setShowShortcuts(false)}
        />
      </div>
    </GraphActionsContext.Provider>
  );
}

import { LAYOUT_MODES } from '../utils/dagreLayout';
import {
  VIEW_MODES,
  TABLE_TABS,
  isPipelineQuery,
  getSourceNodes,
  topologicalSortStages,
  getJoinOperations,
  getOutputNode,
} from '../utils/lineageTableModel';
import { GRAPH_DETAIL_MODES } from '../constants/graphDetailMode';
import { useTheme } from '../context/ThemeContext';
import { inputFieldStyle } from '../theme/uiStyles';
import ExportMenu from './ExportMenu';
import ViewModeToggle from './ViewModeToggle';
import SegmentedToggle from './SegmentedToggle';

export default function GraphToolbar({
  viewMode,
  onViewModeChange,
  layoutMode,
  onLayoutChange,
  branchFilter,
  onBranchFilterChange,
  focusMode,
  onFocusUpstream,
  onFocusDownstream,
  onClearFocus,
  diffMode,
  onToggleDiffMode,
  diffSummary,
  selectedNodeId,
  onShowShortcuts,
  filterNoMatches,
  studioMode,
  onToggleZen,
  zenMode,
  onExportPng,
  onExportSvg,
  onExportPdf,
  onExportJson,
  onExportCsv,
  onExportOpenLineage,
  canExport,
  compoundGraphEligible,
  graphDetailMode,
  onToggleGraphDetail,
  tableTab,
  onTableTabChange,
  showAllOperations,
  onToggleShowAllOperations,
  expandedStageId,
  nodes = [],
  edges = [],
}) {
  const { theme: t } = useTheme();
  const isGraph = viewMode === VIEW_MODES.GRAPH;
  const isTable = viewMode === VIEW_MODES.TABLE;
  const pipelineQuery = isPipelineQuery(nodes);
  const sourceCount = getSourceNodes(nodes).length;
  const stageCount = topologicalSortStages(nodes, edges).length;
  const operationCount = getJoinOperations(nodes, edges).length;
  const outputCount = getOutputNode(nodes)?.data?.column_lineage?.length || 0;

  const tableTabOptions = [
    { value: TABLE_TABS.SOURCES, label: `Sources ${sourceCount}` },
    ...(pipelineQuery
      ? [{ value: TABLE_TABS.PIPELINE, label: `Pipeline ${stageCount}` }]
      : []),
    { value: TABLE_TABS.OPERATIONS, label: `Operations ${operationCount}` },
    { value: TABLE_TABS.OUTPUT, label: `Target ${outputCount}` },
  ];

  const actionBtn = (active, disabled = false) => ({
    padding: '6px 10px',
    fontSize: '11px',
    fontWeight: '600',
    border: `1px solid ${active ? t.primary : t.border}`,
    borderRadius: '6px',
    background: active ? t.buttonActiveBg : t.buttonBg,
    color: active ? t.primary : t.textMain,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    whiteSpace: 'nowrap',
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
        padding: '8px 12px',
        background: t.toolbarBg,
        borderBottom: `1px solid ${t.border}`,
        fontSize: '12px',
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <ViewModeToggle
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          disabled={!canExport}
        />
      </div>

      <span style={{ color: t.border, margin: '0 4px', flexShrink: 0 }}>|</span>

      {isTable && (
        <SegmentedToggle
          value={
            !pipelineQuery && tableTab === TABLE_TABS.PIPELINE
              ? TABLE_TABS.OUTPUT
              : tableTab
          }
          onChange={onTableTabChange}
          minWidth={pipelineQuery ? '420px' : '340px'}
          title="Table inspect tabs"
          options={tableTabOptions}
        />
      )}

      {isGraph && (
        <>
          <SegmentedToggle
            value={layoutMode}
            onChange={onLayoutChange}
            minWidth="132px"
            options={[
              { value: LAYOUT_MODES.TB, label: '↓ TB', title: 'Top to bottom (1)' },
              { value: LAYOUT_MODES.LR, label: '→ LR', title: 'Left to right (2)' },
            ]}
          />

          {compoundGraphEligible && (
            <SegmentedToggle
              value={graphDetailMode}
              onChange={(next) => {
                if (next !== graphDetailMode) onToggleGraphDetail();
              }}
              minWidth="220px"
              title="Pipeline stages vs whole graph (P / W)"
              options={[
                {
                  value: GRAPH_DETAIL_MODES.COMPOUND,
                  label: 'Pipeline stages',
                  title: 'Macro stage boxes (P)',
                },
                {
                  value: GRAPH_DETAIL_MODES.FLAT,
                  label: 'Whole graph',
                  title: 'Every table and join node (W)',
                },
              ]}
            />
          )}

          <span style={{ color: t.border, margin: '0 4px' }}>|</span>

          <input
            type="text"
            placeholder="Filter branch…"
            value={branchFilter}
            onChange={(e) => onBranchFilterChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onBranchFilterChange('');
                e.currentTarget.blur();
              }
            }}
            style={inputFieldStyle(t, { error: filterNoMatches, width: '140px' })}
          />
          {filterNoMatches && (
            <span style={{ fontSize: '11px', color: t.error }}>No matches</span>
          )}

          <span style={{ color: t.border, margin: '0 4px' }}>|</span>

          <button
            style={actionBtn(focusMode === 'upstream', !selectedNodeId)}
            onClick={onFocusUpstream}
            disabled={!selectedNodeId}
            title="Focus upstream (U)"
          >
            ↑ Upstream
          </button>
          <button
            style={actionBtn(focusMode === 'downstream', !selectedNodeId)}
            onClick={onFocusDownstream}
            disabled={!selectedNodeId}
            title="Focus downstream (D)"
          >
            ↓ Downstream
          </button>
          {focusMode && (
            <button style={actionBtn(false)} onClick={onClearFocus} title="Clear focus (Esc)">
              Clear focus
            </button>
          )}

          <span style={{ color: t.border, margin: '0 4px' }}>|</span>
        </>
      )}

      {isGraph && (
        <button
          style={actionBtn(diffMode)}
          onClick={onToggleDiffMode}
          title="Diff mode — compare with previous render"
        >
          ± Diff
        </button>
      )}
      {isGraph && diffMode && diffSummary && (
        <span style={{ color: t.textMuted, fontSize: '11px' }}>
          +{diffSummary.addedNodes} nodes, −{diffSummary.removedNodes} removed
        </span>
      )}

      {studioMode === 'explore' && isGraph && (
        <button
          style={actionBtn(zenMode)}
          onClick={onToggleZen}
          title="Zen mode — full-screen graph (Z)"
        >
          {zenMode ? 'Exit Zen' : 'Zen'}
        </button>
      )}

      <span style={{ color: t.border, margin: '0 4px' }}>|</span>

      <ExportMenu
        disabled={!canExport}
        onExportPng={onExportPng}
        onExportSvg={onExportSvg}
        onExportPdf={onExportPdf}
        onExportJson={onExportJson}
        onExportCsv={onExportCsv}
        onExportOpenLineage={onExportOpenLineage}
      />

      <span style={{ color: t.border, margin: '0 4px' }}>|</span>

      <div
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <button
          style={actionBtn(false)}
          onClick={onShowShortcuts}
          title="Keyboard shortcuts"
        >
          ?
        </button>
      </div>
    </div>
  );
}

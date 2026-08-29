import { LAYOUT_MODES } from '../utils/dagreLayout';
import { VIEW_MODES } from '../utils/lineageTableModel';
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
}) {
  const { theme: t } = useTheme();
  const isGraph = viewMode === VIEW_MODES.GRAPH;

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
              title="Pipeline stages vs full table graph"
              options={[
                {
                  value: GRAPH_DETAIL_MODES.COMPOUND,
                  label: 'Pipeline stages',
                  title: 'Macro stage boxes (current)',
                },
                {
                  value: GRAPH_DETAIL_MODES.FLAT,
                  label: 'Full graph',
                  title: 'Every table and join node (current)',
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

      <button
        style={actionBtn(diffMode)}
        onClick={onToggleDiffMode}
        title="Diff mode — compare with previous render"
      >
        ± Diff
      </button>
      {diffMode && diffSummary && (
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

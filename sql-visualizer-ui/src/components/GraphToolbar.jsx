import { LAYOUT_MODES } from '../utils/dagreLayout';
import { VIEW_MODES } from '../utils/lineageTableModel';
import { useTheme } from '../context/ThemeContext';
import { toolbarButtonStyle, inputFieldStyle } from '../theme/uiStyles';
import ExportMenu from './ExportMenu';
import ViewModeToggle from './ViewModeToggle';

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
}) {
  const { theme: t } = useTheme();
  const isGraph = viewMode === VIEW_MODES.GRAPH;
  const btn = (active, disabled = false) => toolbarButtonStyle(t, active, disabled);

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
          <span style={{ color: t.textMuted, fontWeight: '600' }}>Layout</span>
          <button
            style={btn(layoutMode === LAYOUT_MODES.TB)}
            onClick={() => onLayoutChange(LAYOUT_MODES.TB)}
            title="Top to bottom (1)"
          >
            ↓ TB
          </button>
          <button
            style={btn(layoutMode === LAYOUT_MODES.LR)}
            onClick={() => onLayoutChange(LAYOUT_MODES.LR)}
            title="Left to right (2)"
          >
            → LR
          </button>

          <span style={{ color: t.border, margin: '0 4px' }}>|</span>

          <input
            type="text"
            placeholder="Filter branch…"
            value={branchFilter}
            onChange={(e) => onBranchFilterChange(e.target.value)}
            style={inputFieldStyle(t, { error: filterNoMatches, width: '140px' })}
          />
          {filterNoMatches && (
            <span style={{ fontSize: '11px', color: t.error }}>No matches</span>
          )}

          <span style={{ color: t.border, margin: '0 4px' }}>|</span>

          <button
            style={btn(focusMode === 'upstream', !selectedNodeId)}
            onClick={onFocusUpstream}
            disabled={!selectedNodeId}
            title="Focus upstream (U)"
          >
            ↑ Upstream
          </button>
          <button
            style={btn(focusMode === 'downstream', !selectedNodeId)}
            onClick={onFocusDownstream}
            disabled={!selectedNodeId}
            title="Focus downstream (D)"
          >
            ↓ Downstream
          </button>
          {focusMode && (
            <button style={btn(false)} onClick={onClearFocus} title="Clear focus (Esc)">
              Clear focus
            </button>
          )}

          <span style={{ color: t.border, margin: '0 4px' }}>|</span>
        </>
      )}

      <button
        style={btn(diffMode)}
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
          style={btn(zenMode)}
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
          style={btn(false)}
          onClick={onShowShortcuts}
          title="Keyboard shortcuts"
        >
          ?
        </button>
      </div>
    </div>
  );
}

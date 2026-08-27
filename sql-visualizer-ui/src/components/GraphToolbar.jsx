import { theme } from '../theme';
import { LAYOUT_MODES } from '../utils/dagreLayout';

const btnStyle = (active) => ({
  padding: '6px 10px',
  fontSize: '11px',
  fontWeight: '600',
  border: `1px solid ${active ? theme.primary : theme.border}`,
  borderRadius: '6px',
  background: active ? '#eff6ff' : 'white',
  color: active ? theme.primary : theme.textMain,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
});

export default function GraphToolbar({
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
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
        padding: '8px 12px',
        background: 'white',
        borderBottom: `1px solid ${theme.border}`,
        fontSize: '12px',
      }}
    >
      <span style={{ color: theme.textMuted, fontWeight: '600' }}>Layout</span>
      <button
        style={btnStyle(layoutMode === LAYOUT_MODES.TB)}
        onClick={() => onLayoutChange(LAYOUT_MODES.TB)}
        title="Top to bottom (1)"
      >
        ↓ TB
      </button>
      <button
        style={btnStyle(layoutMode === LAYOUT_MODES.LR)}
        onClick={() => onLayoutChange(LAYOUT_MODES.LR)}
        title="Left to right (2)"
      >
        → LR
      </button>
      <button
        style={btnStyle(layoutMode === LAYOUT_MODES.RADIAL)}
        onClick={() => onLayoutChange(LAYOUT_MODES.RADIAL)}
        title="Radial (3)"
      >
        ◎ Radial
      </button>

      <span style={{ color: theme.border, margin: '0 4px' }}>|</span>

      <input
        type="text"
        placeholder="Filter branch…"
        value={branchFilter}
        onChange={(e) => onBranchFilterChange(e.target.value)}
        style={{
          padding: '6px 10px',
          border: `1px solid ${theme.border}`,
          borderRadius: '6px',
          fontSize: '12px',
          width: '140px',
        }}
      />

      <span style={{ color: theme.border, margin: '0 4px' }}>|</span>

      <button
        style={btnStyle(focusMode === 'upstream')}
        onClick={onFocusUpstream}
        disabled={!selectedNodeId}
        title="Focus upstream (U)"
      >
        ↑ Upstream
      </button>
      <button
        style={btnStyle(focusMode === 'downstream')}
        onClick={onFocusDownstream}
        disabled={!selectedNodeId}
        title="Focus downstream (D)"
      >
        ↓ Downstream
      </button>
      {focusMode && (
        <button style={btnStyle(false)} onClick={onClearFocus} title="Clear focus (Esc)">
          Clear focus
        </button>
      )}

      <span style={{ color: theme.border, margin: '0 4px' }}>|</span>

      <button
        style={btnStyle(diffMode)}
        onClick={onToggleDiffMode}
        title="Diff mode — compare with previous render"
      >
        ± Diff
      </button>
      {diffMode && diffSummary && (
        <span style={{ color: theme.textMuted, fontSize: '11px' }}>
          +{diffSummary.addedNodes} nodes, −{diffSummary.removedNodes} removed
        </span>
      )}

      <button
        style={{ ...btnStyle(false), marginLeft: 'auto' }}
        onClick={onShowShortcuts}
        title="Keyboard shortcuts"
      >
        ?
      </button>
    </div>
  );
}

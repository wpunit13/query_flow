import { theme } from '../theme';

export default function ZenFloatingControls({
  onFitView,
  onToggleZen,
  onEnterAuthor,
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        zIndex: 10,
        display: 'flex',
        gap: '6px',
        background: 'white',
        padding: '6px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        border: `1px solid ${theme.border}`,
      }}
    >
      <button
        type="button"
        onClick={onFitView}
        style={btnStyle()}
        title="Fit view (F)"
      >
        Fit
      </button>
      <button
        type="button"
        onClick={onEnterAuthor}
        style={btnStyle()}
        title="Edit SQL (E)"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onToggleZen}
        style={{ ...btnStyle(), background: theme.primary, color: 'white', border: 'none' }}
        title="Exit zen (Z or Esc)"
      >
        Exit Zen
      </button>
    </div>
  );
}

function btnStyle() {
  return {
    padding: '6px 10px',
    fontSize: '11px',
    fontWeight: '600',
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    background: 'white',
    color: theme.textMain,
    cursor: 'pointer',
  };
}

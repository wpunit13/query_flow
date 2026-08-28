import { theme } from '../theme';
import { VIEW_MODES } from '../utils/lineageTableModel';

function GraphIcon({ active }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="2.5" fill={active ? theme.primary : theme.textMuted} />
      <circle cx="18" cy="8" r="2.5" fill={active ? theme.primary : theme.textMuted} />
      <circle cx="10" cy="18" r="2.5" fill={active ? theme.primary : theme.textMuted} />
      <path
        d="M8 6.5L16 7.5M7.5 8.5L9.5 16M16.5 9.5L11.5 16.5"
        stroke={active ? theme.primary : theme.textMuted}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TableIcon({ active }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="2"
        stroke={active ? theme.primary : theme.textMuted}
        strokeWidth="1.5"
      />
      <path
        d="M4 10h16M4 14h16M10 5v14"
        stroke={active ? theme.primary : theme.textMuted}
        strokeWidth="1.5"
      />
    </svg>
  );
}

export default function ViewModeToggle({ viewMode, onViewModeChange, disabled }) {
  const isGraph = viewMode === VIEW_MODES.GRAPH;

  const optionStyle = (active) => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: '600',
    border: 'none',
    borderRadius: '6px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: 'transparent',
    color: active ? theme.primary : theme.textMuted,
    zIndex: 1,
    transition: 'color 0.2s ease',
    whiteSpace: 'nowrap',
  });

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        opacity: disabled ? 0.45 : 1,
      }}
      title={disabled ? 'Render a query first' : 'Switch graph / table view (G / T)'}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          width: '168px',
          background: '#e2e8f0',
          borderRadius: '9px',
          padding: '3px',
          boxShadow: 'inset 0 1px 2px rgb(0 0 0 / 0.06)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '3px',
            bottom: '3px',
            left: isGraph ? '3px' : 'calc(50% + 1px)',
            width: 'calc(50% - 4px)',
            background: 'white',
            borderRadius: '7px',
            boxShadow: '0 1px 3px rgb(0 0 0 / 0.12), 0 1px 2px rgb(0 0 0 / 0.06)',
            transition: 'left 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
        <button
          type="button"
          style={optionStyle(isGraph)}
          onClick={() => !disabled && onViewModeChange(VIEW_MODES.GRAPH)}
          disabled={disabled}
          aria-pressed={isGraph}
        >
          <GraphIcon active={isGraph} />
          Graph
        </button>
        <button
          type="button"
          style={optionStyle(!isGraph)}
          onClick={() => !disabled && onViewModeChange(VIEW_MODES.TABLE)}
          disabled={disabled}
          aria-pressed={!isGraph}
        >
          <TableIcon active={!isGraph} />
          Table
        </button>
      </div>
    </div>
  );
}

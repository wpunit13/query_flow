import { VIEW_MODES } from '../utils/lineageTableModel';
import { useTheme } from '../context/ThemeContext';
import SegmentedToggle from './SegmentedToggle';

function GraphIcon({ active, color, muted }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="2.5" fill={active ? color : muted} />
      <circle cx="18" cy="8" r="2.5" fill={active ? color : muted} />
      <circle cx="10" cy="18" r="2.5" fill={active ? color : muted} />
      <path
        d="M8 6.5L16 7.5M7.5 8.5L9.5 16M16.5 9.5L11.5 16.5"
        stroke={active ? color : muted}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TableIcon({ active, color, muted }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="2"
        stroke={active ? color : muted}
        strokeWidth="1.5"
      />
      <path
        d="M4 10h16M4 14h16M10 5v14"
        stroke={active ? color : muted}
        strokeWidth="1.5"
      />
    </svg>
  );
}

export default function ViewModeToggle({ viewMode, onViewModeChange, disabled }) {
  const { theme } = useTheme();
  const isGraph = viewMode === VIEW_MODES.GRAPH;

  const graphLabel = (
    <>
      <GraphIcon active={isGraph} color={theme.primary} muted={theme.textMuted} />
      Graph
    </>
  );
  const tableLabel = (
    <>
      <TableIcon active={!isGraph} color={theme.primary} muted={theme.textMuted} />
      Table
    </>
  );

  return (
    <SegmentedToggle
      value={viewMode}
      onChange={onViewModeChange}
      disabled={disabled}
      title={disabled ? 'Render a query first' : 'Switch graph / table view (G / T)'}
      minWidth="168px"
      options={[
        { value: VIEW_MODES.GRAPH, label: graphLabel },
        { value: VIEW_MODES.TABLE, label: tableLabel },
      ]}
    />
  );
}

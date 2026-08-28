import { useTheme } from '../context/ThemeContext';
import { inputFieldStyle, toolbarButtonStyle } from '../theme/uiStyles';

export default function DialectSelector({
  dialect,
  dialects,
  onDialectChange,
  onDetectDialect,
  detecting,
  detectHint,
}) {
  const { theme } = useTheme();
  const selected = dialects.find((d) => d.id === dialect);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <label
        style={{
          fontSize: '12px',
          fontWeight: '600',
          color: theme.textMuted,
          whiteSpace: 'nowrap',
        }}
      >
        Dialect
      </label>
      <select
        value={dialect}
        onChange={(e) => onDialectChange(e.target.value)}
        style={{
          ...inputFieldStyle(theme),
          minWidth: '130px',
        }}
        title={selected?.limitations || ''}
      >
        {dialects.map((d) => (
          <option key={d.id} value={d.id} title={d.limitations}>
            {d.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onDetectDialect}
        disabled={detecting}
        style={{
          ...toolbarButtonStyle(theme, false, detecting),
          fontSize: '11px',
        }}
        title="Guess dialect from SQL keywords (heuristic)"
      >
        {detecting ? 'Detecting…' : 'Detect'}
      </button>
      {detectHint && (
        <span style={{ fontSize: '11px', color: theme.textMuted, maxWidth: '320px' }}>
          {detectHint}
        </span>
      )}
    </div>
  );
}

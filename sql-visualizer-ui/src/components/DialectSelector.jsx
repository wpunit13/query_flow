import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { inputFieldStyle, secondaryButtonStyle, toolbarButtonStyle } from '../theme/uiStyles';

function ChevronToggle({ open }) {
  return (
    <span
      style={{
        fontSize: '13px',
        fontWeight: 700,
        letterSpacing: '-0.06em',
        lineHeight: 1,
      }}
    >
      {open ? '‹‹' : '››'}
    </span>
  );
}

export default function DialectSelector({
  dialect,
  dialects,
  onDialectChange,
  onDetectDialect,
  detecting,
  detectHint,
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = dialects.find((d) => d.id === dialect);

  const toggleBtnStyle = {
    ...secondaryButtonStyle(theme),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    height: '34px',
    padding: '0 12px',
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
  };

  const dialectLabel = selected?.label || dialect;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={toggleBtnStyle}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = theme.cardBg)}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = theme.buttonBg)}
        title={
          open
            ? 'Hide dialect options'
            : `${dialectLabel} — click to change dialect or detect from SQL`
        }
        aria-label={`SQL dialect: ${dialectLabel}. Click to change`}
        aria-expanded={open}
      >
        <span>Dialect</span>
        <span style={{ color: theme.textMuted, fontWeight: 500 }}>{dialectLabel}</span>
        <ChevronToggle open={open} />
      </button>

      {open && (
        <>
          <select
            value={dialect}
            onChange={(e) => onDialectChange(e.target.value)}
            aria-label="SQL dialect"
            style={{
              ...inputFieldStyle(theme),
              minWidth: '130px',
              height: '34px',
              boxSizing: 'border-box',
            }}
            title={selected?.limitations || 'SQL dialect'}
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
              height: '34px',
              fontSize: '12px',
              padding: '0 12px',
              boxSizing: 'border-box',
            }}
            title="Guess dialect from SQL keywords (heuristic)"
          >
            {detecting ? 'Detecting…' : 'Detect'}
          </button>

          {detectHint && (
            <span
              style={{
                fontSize: '11px',
                color: theme.textMuted,
                maxWidth: 'min(420px, 40vw)',
              }}
            >
              {detectHint}
            </span>
          )}
        </>
      )}
    </div>
  );
}

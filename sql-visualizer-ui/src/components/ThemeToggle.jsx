import { useTheme } from '../context/ThemeContext';

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/** Shows current theme; click to switch. Icon-only by default — use title for label. */
export default function ThemeToggle({ size = 'md', showLabel = false }) {
  const { theme, isDark, toggleMode } = useTheme();
  const iconOnly = !showLabel;
  const padding = iconOnly ? 0 : size === 'sm' ? '6px 10px' : '8px 12px';
  const fontSize = size === 'sm' ? '11px' : '12px';
  const modeLabel = isDark ? 'Dark' : 'Light';
  const title = isDark
    ? 'Dark mode — click to switch to light'
    : 'Light mode — click to switch to dark';

  return (
    <button
      type="button"
      onClick={toggleMode}
      title={title}
      aria-label={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: showLabel ? '6px' : 0,
        width: iconOnly ? '34px' : undefined,
        height: iconOnly ? '34px' : undefined,
        padding,
        border: `1px solid ${theme.border}`,
        borderRadius: '6px',
        background: theme.buttonBg,
        color: theme.textMain,
        cursor: 'pointer',
        lineHeight: 1.2,
        flexShrink: 0,
        fontSize,
        fontWeight: 600,
        fontFamily: '"Inter", sans-serif',
      }}
    >
      {isDark ? <MoonIcon /> : <SunIcon />}
      {showLabel && <span>{modeLabel}</span>}
    </button>
  );
}

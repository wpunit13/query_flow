import { useTheme } from '../context/ThemeContext';

/**
 * Pill-style segmented control (matches Graph / Table toggle).
 */
export default function SegmentedToggle({
  value,
  onChange,
  options,
  disabled = false,
  title,
  minWidth = '168px',
}) {
  const { theme } = useTheme();
  const count = options.length;
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const segmentWidth = 100 / count;

  const optionStyle = (active) => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    padding: '6px 10px',
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
        opacity: disabled ? 0.45 : 1,
      }}
      title={title}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          minWidth,
          background: theme.toggleTrack,
          borderRadius: '9px',
          padding: '3px',
          border: `1px solid ${theme.border}`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '3px',
            bottom: '3px',
            left: `calc(${activeIndex * segmentWidth}% + 3px)`,
            width: `calc(${segmentWidth}% - 6px)`,
            background: theme.toggleThumb,
            borderRadius: '7px',
            boxShadow: theme.shadowSubtle,
            transition: 'left 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              style={optionStyle(active)}
              onClick={() => !disabled && onChange(option.value)}
              disabled={disabled}
              title={option.title}
              aria-pressed={active}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useTheme } from '../context/ThemeContext';
import { toolbarButtonStyle, primaryButtonStyle } from '../theme/uiStyles';

export default function ZenFloatingControls({
  onFitView,
  onToggleZen,
  onEnterAuthor,
}) {
  const { theme } = useTheme();

  return (
    <div
      style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        zIndex: 10,
        display: 'flex',
        gap: '6px',
        background: theme.cardBg,
        padding: '6px',
        borderRadius: '8px',
        boxShadow: theme.shadowMenu,
        border: `1px solid ${theme.border}`,
      }}
    >
      <button
        type="button"
        onClick={onFitView}
        style={toolbarButtonStyle(theme, false)}
        title="Fit view (F)"
      >
        Fit
      </button>
      <button
        type="button"
        onClick={onEnterAuthor}
        style={toolbarButtonStyle(theme, false)}
        title="Edit SQL (E)"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onToggleZen}
        style={{
          ...primaryButtonStyle(theme),
          padding: '6px 10px',
          fontSize: '11px',
        }}
        title="Exit zen (Z or Esc)"
      >
        Exit Zen
      </button>
    </div>
  );
}

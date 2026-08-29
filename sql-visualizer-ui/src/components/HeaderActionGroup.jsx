import { useTheme } from '../context/ThemeContext';
import {
  secondaryButtonStyle,
  primaryButtonStyle,
} from '../theme/uiStyles';
import { ResetIcon } from '../icons';
import ThemeToggle from './ThemeToggle';

const pillStyle = (theme) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flexShrink: 0,
  padding: '4px',
  borderRadius: '8px',
  border: `1px solid ${theme.border}`,
  background: theme.headerBg,
});

const toolbarBtnHeight = {
  height: '34px',
  padding: '6px 12px',
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
};

const secondaryToolbarBtn = (theme) => ({
  ...secondaryButtonStyle(theme),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  ...toolbarBtnHeight,
});

const secondaryToolbarHover = (theme, e, entering) => {
  e.currentTarget.style.backgroundColor = entering ? theme.cardBg : theme.buttonBg;
};

/**
 * Shared action pill: theme · mode switch · reset · render.
 * Studio: Explore (when graph exists). Explore: Edit.
 */
export default function HeaderActionGroup({
  modeSwitchLabel,
  onModeSwitch,
  showModeSwitch = true,
  modeSwitchTitle,
  onReset,
  onParse,
  loading,
}) {
  const { theme } = useTheme();

  return (
    <div style={pillStyle(theme)}>
      <ThemeToggle size="sm" />

      {showModeSwitch && (
        <button
          type="button"
          onClick={onModeSwitch}
          style={{
            ...secondaryToolbarBtn(theme),
            minWidth: '80px',
            width: '80px',
          }}
          onMouseOver={(e) => secondaryToolbarHover(theme, e, true)}
          onMouseOut={(e) => secondaryToolbarHover(theme, e, false)}
          title={modeSwitchTitle}
        >
          {modeSwitchLabel}
        </button>
      )}

      <button
        type="button"
        onClick={onReset}
        style={{
          ...secondaryToolbarBtn(theme),
          gap: '6px',
        }}
        onMouseOver={(e) => secondaryToolbarHover(theme, e, true)}
        onMouseOut={(e) => secondaryToolbarHover(theme, e, false)}
        title="Reset canvas (R)"
      >
        <ResetIcon />
        Reset
      </button>

      <button
        type="button"
        onClick={onParse}
        disabled={loading}
        style={{
          ...primaryButtonStyle(theme, loading),
          padding: '6px 16px',
          height: '34px',
          minWidth: '108px',
          whiteSpace: 'nowrap',
        }}
      >
        {loading ? 'Parsing…' : 'Render DAG'}
      </button>
    </div>
  );
}

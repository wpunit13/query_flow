/** Consistent control styles driven by active theme tokens. */

export function toolbarButtonStyle(theme, active, disabled = false) {
  return {
    padding: '6px 10px',
    fontSize: '11px',
    fontWeight: '600',
    border: `1px solid ${active ? theme.primary : theme.border}`,
    borderRadius: '6px',
    background: active ? theme.buttonActiveBg : theme.buttonBg,
    color: active ? theme.primary : theme.textMain,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    whiteSpace: 'nowrap',
  };
}

export function secondaryButtonStyle(theme) {
  return {
    padding: '8px 16px',
    background: theme.buttonBg,
    color: theme.textMain,
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '12px',
  };
}

export function outlinePrimaryButtonStyle(theme) {
  return {
    padding: '8px 16px',
    background: theme.buttonBg,
    color: theme.primary,
    border: `1px solid ${theme.primary}`,
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '12px',
  };
}

export function primaryButtonStyle(theme, disabled = false) {
  return {
    padding: '8px 18px',
    background: disabled ? theme.disabled : theme.primary,
    color: theme.onPrimary,
    border: 'none',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '12px',
  };
}

export function inputFieldStyle(theme, { error = false, width } = {}) {
  const style = {
    padding: '6px 10px',
    border: `1px solid ${error ? theme.error : theme.border}`,
    borderRadius: '6px',
    fontSize: '12px',
    background: theme.inputBg,
    color: theme.textMain,
    outline: 'none',
  };
  if (width) style.width = width;
  return style;
}

export function panelHeaderStyle(theme) {
  return {
    marginBottom: '20px',
    background: theme.cardBg,
    padding: '16px 20px',
    borderRadius: '8px',
    boxShadow: theme.shadowSubtle,
    border: `1px solid ${theme.border}`,
  };
}

export function chipStyle(theme, accent = false) {
  return {
    padding: '2px 8px',
    borderRadius: '4px',
    background: accent ? theme.primaryMuted : theme.buttonBg,
    border: `1px solid ${accent ? theme.primary : theme.border}`,
    color: accent ? theme.primary : theme.textMain,
    fontWeight: accent ? '600' : '500',
  };
}

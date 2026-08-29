import { useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function OverviewToast({ message, onDismiss, autoHideMs = 8000 }) {
  const { theme } = useTheme();

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => onDismiss?.(), autoHideMs);
    return () => clearTimeout(timer);
  }, [message, autoHideMs, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        maxWidth: 'min(520px, calc(100vw - 32px))',
        padding: '12px 16px',
        borderRadius: '8px',
        background: theme.cardBg,
        border: `1px solid ${theme.border}`,
        boxShadow: theme.shadowMenu,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        fontSize: '13px',
        lineHeight: 1.45,
        color: theme.textMain,
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          flexShrink: 0,
          padding: '4px 10px',
          fontSize: '12px',
          fontWeight: 600,
          border: `1px solid ${theme.border}`,
          borderRadius: '6px',
          background: theme.buttonBg,
          color: theme.textMuted,
          cursor: 'pointer',
        }}
      >
        OK
      </button>
    </div>
  );
}

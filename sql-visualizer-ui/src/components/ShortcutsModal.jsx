import { useTheme } from '../context/ThemeContext';
import { primaryButtonStyle } from '../theme/uiStyles';

export default function ShortcutsModal({ open, onClose }) {
  const { theme } = useTheme();

  if (!open) return null;

  const shortcuts = [
    { keys: '/', desc: 'Focus search (explore mode)' },
    { keys: 'G', desc: 'Graph view' },
    { keys: 'T', desc: 'Table view (or Target tab)' },
    { keys: 'S', desc: 'Sources tab (Table)' },
    { keys: 'P', desc: 'Pipeline graph / tab' },
    { keys: 'O', desc: 'Operations tab (Table)' },
    { keys: 'W', desc: 'Whole graph (Graph)' },
    { keys: 'U', desc: 'Focus upstream (Graph)' },
    { keys: 'D', desc: 'Focus downstream (Graph)' },
    { keys: '1', desc: 'Layout top-to-bottom (Graph)' },
    { keys: '2', desc: 'Layout left-to-right (Graph)' },
    { keys: 'F', desc: 'Fit graph to view' },
    { keys: 'R', desc: 'Reset canvas' },
    { keys: 'Esc', desc: 'Exit zen, or clear selection / focus' },
    { keys: 'E', desc: 'Toggle Author ↔ Explore' },
    { keys: 'Z', desc: 'Toggle zen mode (explore)' },
    { keys: '?', desc: 'Show this help' },
    { keys: 'Enter', desc: 'Cycle search matches (in search box)' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: theme.overlayBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: theme.cardBg,
          border: `1px solid ${theme.border}`,
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
          boxShadow: theme.shadowMenu,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', color: theme.textMain }}>Keyboard shortcuts</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {shortcuts.map((s) => (
            <div
              key={s.keys}
              style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}
            >
              <kbd
                style={{
                  background: theme.headerBg,
                  border: `1px solid ${theme.border}`,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: theme.textMain,
                }}
              >
                {s.keys}
              </kbd>
              <span style={{ color: theme.textMuted }}>{s.desc}</span>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          style={{
            ...primaryButtonStyle(theme),
            marginTop: '20px',
            width: '100%',
            padding: '8px',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

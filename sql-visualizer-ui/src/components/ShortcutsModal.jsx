import { theme } from '../theme';

export default function ShortcutsModal({ open, onClose }) {
  if (!open) return null;

  const shortcuts = [
    { keys: '/', desc: 'Focus search' },
    { keys: 'F', desc: 'Fit graph to view' },
    { keys: 'R', desc: 'Reset canvas' },
    { keys: 'Esc', desc: 'Clear selection / focus' },
    { keys: 'U', desc: 'Focus upstream of selected node' },
    { keys: 'D', desc: 'Focus downstream of selected node' },
    { keys: '1', desc: 'Layout: top-to-bottom' },
    { keys: '2', desc: 'Layout: left-to-right' },
    { keys: '3', desc: 'Layout: radial' },
    { keys: '?', desc: 'Show this help' },
    { keys: 'Enter', desc: 'Cycle search matches (in search box)' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
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
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
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
            marginTop: '20px',
            width: '100%',
            padding: '8px',
            background: theme.primary,
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

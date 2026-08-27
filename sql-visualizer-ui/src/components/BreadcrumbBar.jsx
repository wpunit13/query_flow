import { theme } from '../theme';

export default function BreadcrumbBar({ breadcrumb, selectedColumn }) {
  if (!breadcrumb?.length) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        background: '#f8fafc',
        borderBottom: `1px solid ${theme.border}`,
        fontSize: '12px',
        color: theme.textMuted,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontWeight: '600', color: theme.textMain }}>Path</span>
      {breadcrumb.map((item, idx) => (
        <span key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {idx > 0 && <span style={{ color: theme.border }}>→</span>}
          <span
            style={{
              color: idx === breadcrumb.length - 1 ? theme.primary : theme.textMain,
              fontWeight: idx === breadcrumb.length - 1 ? '600' : '500',
            }}
          >
            {item.label}
          </span>
        </span>
      ))}
      {selectedColumn && (
        <span style={{ marginLeft: '8px', color: theme.joinBg, fontWeight: '600' }}>
          · column: {selectedColumn}
        </span>
      )}
    </div>
  );
}

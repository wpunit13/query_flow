import { theme } from '../theme';
import { getColumnTraceSummary } from '../utils/lineagePath';

function Chip({ children, accent }) {
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: '4px',
        background: accent ? '#eff6ff' : theme.cardBg,
        border: `1px solid ${accent ? theme.primary : theme.border}`,
        color: accent ? theme.primary : theme.textMain,
        fontWeight: accent ? '600' : '500',
      }}
    >
      {children}
    </span>
  );
}

export default function BreadcrumbBar({
  breadcrumb,
  selectedColumn,
  selectedNodeId,
  nodes,
  edges,
}) {
  if (selectedColumn && selectedNodeId && nodes?.length) {
    const trace = getColumnTraceSummary(
      selectedNodeId,
      selectedColumn,
      nodes,
      edges
    );

    return (
      <div
        style={{
          padding: '8px 12px',
          background: '#f8fafc',
          borderBottom: `1px solid ${theme.border}`,
          fontSize: '12px',
          color: theme.textMuted,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: '600', color: theme.textMain }}>Column trace</span>
          <Chip accent>{trace.columnName}</Chip>
          <span>in</span>
          <Chip>{trace.outputLabel}</Chip>
        </div>

        {trace.pipelineStages.length > 0 && (
          <div
            style={{
              marginTop: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontWeight: '600', color: theme.textMain }}>Via stages</span>
            {trace.pipelineStages.map((stage, idx) => (
              <span key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {idx > 0 && <span style={{ color: theme.border }}>→</span>}
                <Chip>{stage.label}</Chip>
              </span>
            ))}
          </div>
        )}

        {trace.unionMerges?.length > 0 && (
          <div style={{ marginTop: '6px' }}>
            {trace.unionMerges.map((union) => (
              <div
                key={union.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexWrap: 'wrap',
                  marginBottom: '4px',
                }}
              >
                <span style={{ fontWeight: '600', color: theme.textMain }}>Merged by</span>
                <Chip accent>{union.unionType}</Chip>
                <span style={{ fontSize: '11px' }}>
                  {union.branchCount} branch{union.branchCount !== 1 ? 'es' : ''}:
                </span>
                {union.branches.map((branch, idx) => (
                  <Chip key={branch.tail_id || idx}>
                    Branch {branch.index + 1}: {branch.label}
                  </Chip>
                ))}
              </div>
            ))}
          </div>
        )}

        {trace.sourceRefs.length > 0 && (
          <div
            style={{
              marginTop: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontWeight: '600', color: theme.textMain }}>From sources</span>
            {trace.sourceRefs.map((src) => (
              <Chip key={src.ref}>
                {src.tableLabel}
                <span style={{ color: theme.textMuted, fontWeight: '400' }}> ({src.ref})</span>
              </Chip>
            ))}
          </div>
        )}

        <div style={{ marginTop: '6px', fontSize: '11px', color: theme.textMuted }}>
          Join nodes are omitted from this bar; UNION merges are shown when present.
        </div>
      </div>
    );
  }

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
    </div>
  );
}

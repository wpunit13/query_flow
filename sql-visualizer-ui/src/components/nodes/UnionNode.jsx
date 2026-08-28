import { Handle, Position, useReactFlow } from '@xyflow/react';
import { theme } from '../../theme';
import { EyeIcon, EyeOffIcon } from '../../icons';
import { toggleNodeCollapse } from '../../utils/graphVisibility';
import { useGraphActions } from '../../context/GraphActionsContext';

export default function UnionNode({
  id,
  data,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
}) {
  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow();
  const graphActions = useGraphActions();

  const expanded = Boolean(data.expanded);
  const branches = data.branches || [];
  const hasBranches = branches.length > 0;
  const isHighlighted = data.isSearchMatch;
  const hasIncoming = getEdges().some((e) => e.target === id);
  const branchCount = data.branch_count || branches.length;

  return (
    <div
      style={{
        background: theme.cardBg,
        border: `2px solid ${isHighlighted ? theme.highlight : theme.unionBg}`,
        borderRadius: expanded ? '8px' : '20px',
        minWidth: expanded ? '200px' : 'auto',
        boxShadow: isHighlighted
          ? `0 0 15px ${theme.highlight}`
          : theme.shadowSubtle,
        fontFamily: '"Inter", sans-serif',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: expanded ? 6 : 2,
      }}
    >
      <Handle type="target" position={targetPosition} style={{ opacity: 0 }} />

      <div
        style={{
          padding: '6px 12px',
          background: theme.cardBg,
          color: theme.unionBg,
          fontSize: '11px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: hasBranches ? 'pointer' : 'default',
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (hasBranches) graphActions?.onNodeExpandedToggle?.(id);
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
          {data.label || data.union_type || 'UNION'}
          {branchCount > 0 && (
            <span style={{ fontSize: '9px', opacity: 0.75 }}>({branchCount})</span>
          )}
          {hasBranches && (
            <span style={{ fontSize: '9px', opacity: 0.7 }}>{expanded ? '▲' : '▼'}</span>
          )}
        </div>

        {hasIncoming && (
          <button
            title={data.collapsed ? 'Show Upstream' : 'Hide Upstream'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleNodeCollapse(id, getNodes(), getEdges(), setNodes, setEdges);
            }}
            style={{
              cursor: 'pointer',
              backgroundColor: data.collapsed ? theme.unionBg : theme.unionSurface,
              color: data.collapsed ? theme.cardBg : theme.unionBg,
              border: 'none',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '4px',
            }}
          >
            {data.collapsed ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>

      {expanded && hasBranches && (
        <div
          style={{
            padding: '8px 12px',
            background: theme.unionSurface,
            color: theme.unionText,
            fontSize: '11px',
            borderTop: `1px solid ${theme.unionBg}40`,
          }}
        >
          {branches.map((branch) => (
            <div key={branch.index ?? branch.tail_id} style={{ padding: '2px 0' }}>
              <strong>Branch {branch.index + 1}:</strong> {branch.label}
            </div>
          ))}
        </div>
      )}

      <Handle type="source" position={sourcePosition} style={{ opacity: 0 }} />
    </div>
  );
}

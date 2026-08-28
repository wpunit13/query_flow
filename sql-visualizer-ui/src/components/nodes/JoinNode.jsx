import { Handle, Position, useReactFlow } from '@xyflow/react';
import { theme } from '../../theme';
import { EyeIcon, EyeOffIcon } from '../../icons';
import { toggleNodeCollapse } from '../../utils/graphVisibility';
import { useGraphActions } from '../../context/GraphActionsContext';

export default function JoinNode({
  id,
  data,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
}) {
  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow();
  const graphActions = useGraphActions();

  const expanded = Boolean(data.expanded);

  const hasConditions = data.conditions && data.conditions.length > 0;
  const isHighlighted = data.isSearchMatch;
  const hasIncoming = getEdges().some((e) => e.target === id);

  return (
    <div
      style={{
        background: theme.cardBg,
        border: `2px solid ${isHighlighted ? theme.highlight : theme.joinBg}`,
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
          color: theme.joinBg,
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
            cursor: hasConditions ? 'pointer' : 'default',
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (hasConditions) graphActions?.onNodeExpandedToggle?.(id);
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="16" cy="16" r="6"></circle>
            <circle cx="8" cy="8" r="6"></circle>
          </svg>
          {data.label}
          {hasConditions && (
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
              backgroundColor: data.collapsed ? theme.joinBg : 'rgba(245, 158, 11, 0.15)',
              color: data.collapsed ? 'white' : theme.joinBg,
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

      {expanded && hasConditions && (
        <div
          style={{
            padding: '8px 12px',
            background: theme.joinSurface,
            color: theme.joinText,
            fontSize: '11px',
            fontFamily: '"JetBrains Mono", monospace',
            borderTop: `1px solid ${theme.joinBg}40`,
            wordBreak: 'break-word',
            textAlign: 'center',
          }}
        >
          {data.conditions.map((cond, idx) => (
            <div key={idx} style={{ padding: '2px 0' }}>
              <strong style={{ opacity: 0.7 }}>ON</strong>
              <br />
              {cond}
            </div>
          ))}
        </div>
      )}

      <Handle type="source" position={sourcePosition} style={{ opacity: 0 }} />
    </div>
  );
}

import { Handle, Position, useReactFlow } from '@xyflow/react';
import { theme } from '../../theme';
import { EyeIcon, EyeOffIcon } from '../../icons';
import { toggleNodeCollapse } from '../../utils/graphVisibility';
import { useGraphActions } from '../../context/GraphActionsContext';
import {
  annotateJoinCondition,
  formatOperandDisplay,
} from '../../utils/joinLabelUtils';
import { getNodeDimensions } from '../../utils/dagreLayout';
import TruncatedText from '../TruncatedText';

const aliasBadgeStyle = {
  display: 'inline-block',
  marginTop: 4,
  fontSize: '10px',
  fontWeight: 700,
  fontFamily: '"JetBrains Mono", monospace',
  color: theme.joinBg,
  background: 'rgba(245, 158, 11, 0.12)',
  padding: '2px 6px',
  borderRadius: 4,
};

function sideLabel(side) {
  if (side === 'left') return 'Left';
  if (side === 'right') return 'Right';
  return side;
}

function OperandColumn({ side, label }) {
  const display = formatOperandDisplay(label);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: '9px',
          fontWeight: 600,
          color: theme.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {sideLabel(side)}
      </div>
      {display.nested ? (
        <TruncatedText
          text={display.table}
          style={{
            display: 'block',
            marginTop: 4,
            fontSize: '10px',
            fontWeight: 500,
            color: theme.textMain,
            lineHeight: 1.35,
            fontFamily: '"JetBrains Mono", monospace',
          }}
        />
      ) : (
        <>
          <TruncatedText
            text={display.table}
            style={{
              display: 'block',
              marginTop: 4,
              fontSize: '12px',
              fontWeight: 600,
              color: theme.textMain,
              lineHeight: 1.3,
            }}
          />
          {display.alias && <span style={aliasBadgeStyle}>as {display.alias}</span>}
        </>
      )}
    </div>
  );
}

function JoinConditionBlock({
  condition,
  operands,
  joinId,
  graphNodes,
  graphEdges,
  showRawSql,
}) {
  const annotated = annotateJoinCondition(
    condition,
    operands,
    joinId,
    graphNodes,
    graphEdges
  );
  const isTrivial = /^\s*TRUE\s*$/i.test(condition);

  return (
    <div
      style={{
        padding: '8px 12px',
        background: theme.nodeBg,
        borderTop: `1px solid ${theme.nodeBorder}`,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span
          style={{
            flexShrink: 0,
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: theme.textMuted,
            background: theme.nodeHeaderBg,
            padding: '3px 6px',
            borderRadius: 4,
            lineHeight: 1.2,
          }}
        >
          ON
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '10px',
              fontFamily: '"JetBrains Mono", monospace',
              color: isTrivial ? theme.textMuted : theme.textMain,
              lineHeight: 1.45,
              wordBreak: 'break-word',
              fontWeight: isTrivial ? 500 : 600,
            }}
          >
            {annotated}
          </div>
          {showRawSql && annotated !== condition && (
            <div
              style={{
                marginTop: 6,
                fontSize: '9px',
                color: theme.textMuted,
                fontFamily: '"JetBrains Mono", monospace',
                lineHeight: 1.4,
              }}
            >
              SQL: {condition}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function JoinNode({
  id,
  data,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
}) {
  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow();
  const graphActions = useGraphActions();

  const expanded = Boolean(data.expanded);
  const graphNodes = getNodes();
  const graphEdges = getEdges();

  const hasConditions = data.conditions && data.conditions.length > 0;
  const operands = data.join_operands || [];
  const hasOperands = operands.length > 0;
  const canExpand = hasOperands || hasConditions;
  const isHighlighted = data.isSearchMatch;
  const hasIncoming = graphEdges.some((e) => e.target === id);
  const { width: nodeWidth } = getNodeDimensions({ id, data, type: 'joinNode' });

  const handleToggleExpand = (e) => {
    e.stopPropagation();
    if (canExpand) graphActions?.onNodeExpandedToggle?.(id);
  };

  return (
    <div
      style={{
        background: theme.nodeBg,
        border: `2px solid ${isHighlighted ? theme.highlight : theme.nodeBorder}`,
        borderRadius: expanded ? '8px' : '20px',
        width: expanded ? nodeWidth : undefined,
        maxWidth: nodeWidth,
        boxSizing: 'border-box',
        minWidth: expanded ? nodeWidth : 'auto',
        boxShadow: isHighlighted
          ? `0 0 15px ${theme.highlight}`
          : theme.shadowCard,
        fontFamily: '"Inter", sans-serif',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Handle type="target" position={targetPosition} style={{ opacity: 0 }} />

      {expanded && (
        <div
          style={{
            height: 3,
            background: theme.joinBg,
            flexShrink: 0,
          }}
        />
      )}

      <div
        style={{
          padding: expanded ? '10px 12px' : '6px 12px',
          background: expanded ? theme.nodeHeaderBg : theme.nodeBg,
          borderBottom:
            expanded && (hasOperands || hasConditions)
              ? `1px solid ${theme.nodeBorder}`
              : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 0,
            flex: 1,
            cursor: canExpand ? 'pointer' : 'default',
          }}
          onClick={handleToggleExpand}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={theme.joinBg}
            strokeWidth="2"
            style={{ flexShrink: 0 }}
          >
            <circle cx="16" cy="16" r="6" />
            <circle cx="8" cy="8" r="6" />
          </svg>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: theme.joinBg,
              letterSpacing: '0.02em',
            }}
          >
            {data.label}
          </span>
          {canExpand && (
            <span style={{ fontSize: '9px', color: theme.textMuted, lineHeight: 1 }}>
              {expanded ? '▲' : '▼'}
            </span>
          )}
          {!expanded && hasConditions && (
            <span
              style={{
                fontSize: '9px',
                color: theme.textMuted,
                fontWeight: 500,
                marginLeft: 2,
              }}
            >
              · {data.conditions.length} ON
            </span>
          )}
        </div>

        {hasIncoming && (
          <button
            type="button"
            title={data.collapsed ? 'Show upstream' : 'Hide upstream'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleNodeCollapse(id, graphNodes, graphEdges, setNodes, setEdges);
            }}
            style={{
              cursor: 'pointer',
              backgroundColor: data.collapsed ? theme.joinBg : theme.mutedSurface,
              color: data.collapsed ? 'white' : theme.textMuted,
              border: 'none',
              borderRadius: expanded ? 4 : '50%',
              width: expanded ? '26px' : '24px',
              height: expanded ? '26px' : '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {data.collapsed ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>

      {expanded && hasOperands && (
        <div
          style={{
            padding: '10px 12px',
            display: 'flex',
            gap: 12,
            background: theme.nodeBg,
            borderBottom: hasConditions ? `1px solid ${theme.nodeBorder}` : 'none',
          }}
        >
          {operands.map((op) => (
            <OperandColumn key={`${op.side}-${op.id}`} side={op.side} label={op.label} />
          ))}
        </div>
      )}

      {expanded &&
        hasConditions &&
        data.conditions.map((cond, idx) => (
          <JoinConditionBlock
            key={idx}
            condition={cond}
            operands={operands}
            joinId={id}
            graphNodes={graphNodes}
            graphEdges={graphEdges}
            showRawSql
          />
        ))}

      <Handle type="source" position={sourcePosition} style={{ opacity: 0 }} />
    </div>
  );
}

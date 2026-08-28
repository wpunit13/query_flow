import { Handle, Position } from '@xyflow/react';
import { theme, kindLabels, kindColors } from '../../theme';
import { useGraphActions } from '../../context/GraphActionsContext';
import {
  STAGE_CARD_WIDTH,
  STAGE_CARD_HEIGHT,
  STAGE_GROUP_HEADER_HEIGHT,
} from '../../constants/compoundGraphConstants';
import TruncatedText from '../TruncatedText';

export default function StageGroupNode({
  data,
  sourcePosition = Position.Right,
  targetPosition = Position.Left,
}) {
  const graphActions = useGraphActions();
  const expanded = Boolean(data.expanded);
  const kindLabel = kindLabels[data.kind] || data.kind;
  const kindColor = kindColors[data.kind] || theme.textMuted;

  const stats = [];
  if (data.joinCount > 0) stats.push(`${data.joinCount} join(s)`);
  if (data.unionCount > 0) stats.push(`${data.unionCount} union(s)`);
  if (data.sourceCount > 0) stats.push(`${data.sourceCount} source(s)`);
  const statsLine = stats.join(' · ') || data.operationSummary || '—';

  const isSelected = data.isLineageHighlight;
  const borderColor = isSelected ? theme.primary : theme.nodeBorder;

  const handleToggleExpand = (e) => {
    e.stopPropagation();
    graphActions?.onCompoundStageToggle?.(data.stageId);
  };

  return (
    <div
      style={{
        width: expanded ? '100%' : STAGE_CARD_WIDTH,
        minWidth: expanded ? undefined : STAGE_CARD_WIDTH,
        height: expanded ? '100%' : undefined,
        minHeight: expanded ? undefined : STAGE_CARD_HEIGHT,
        boxSizing: 'border-box',
        background: expanded ? theme.nodeBg : theme.nodeHeaderBg,
        border: `2px solid ${borderColor}`,
        borderRadius: '10px',
        boxShadow: isSelected ? `0 0 16px ${theme.primary}40` : theme.shadowCard,
        fontFamily: '"Inter", sans-serif',
        overflow: 'hidden',
        position: 'relative',
        pointerEvents: expanded ? 'none' : 'auto',
      }}
    >
      <div style={{ pointerEvents: 'auto' }}>
        <Handle
          type="target"
          position={targetPosition}
          style={{ background: theme.border, width: 8, height: 8 }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: STAGE_GROUP_HEADER_HEIGHT,
            minHeight: STAGE_GROUP_HEADER_HEIGHT,
            maxHeight: STAGE_GROUP_HEADER_HEIGHT,
            boxSizing: 'border-box',
            padding: '0 12px',
            background: theme.nodeHeaderBg,
            borderBottom: expanded ? `1px solid ${theme.border}` : 'none',
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <TruncatedText
              text={data.label || data.stageId}
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: theme.textMain,
                display: 'block',
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 4,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: kindColor,
                  background: `${kindColor}18`,
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                {kindLabel}
              </span>
              {data.columnCount > 0 && (
                <span style={{ fontSize: 10, color: theme.textMuted }}>
                  {data.columnCount} cols
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleExpand}
            title={expanded ? 'Collapse stage' : 'Expand internals'}
            style={{
              flexShrink: 0,
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 600,
              border: `1px solid ${theme.border}`,
              borderRadius: 6,
              background: theme.buttonBg,
              color: theme.textMuted,
              cursor: 'pointer',
            }}
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>

        {!expanded && (
          <div
            style={{
              padding: '10px 12px',
              fontSize: 11,
              color: theme.textMuted,
              lineHeight: 1.45,
            }}
          >
            <TruncatedText text={statsLine} style={{ display: 'block' }} />
            {data.sourcePreview && (
              <TruncatedText
                text={`Sources: ${data.sourcePreview}`}
                style={{ display: 'block', marginTop: 4, fontSize: 10 }}
              />
            )}
          </div>
        )}

        <Handle
          type="source"
          position={sourcePosition}
          style={{ background: theme.border, width: 8, height: 8 }}
        />
      </div>
    </div>
  );
}

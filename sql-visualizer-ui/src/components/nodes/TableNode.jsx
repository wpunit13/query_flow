import { Handle, Position, useReactFlow } from '@xyflow/react';
import { theme, kindLabels, kindColors } from '../../theme';
import { TableIcon, EyeIcon, EyeOffIcon } from '../../icons';
import { toggleNodeCollapse } from '../../utils/graphVisibility';
import { useGraphActions } from '../../context/GraphActionsContext';
import { getNodeDimensions } from '../../utils/dagreLayout';
import TruncatedText from '../TruncatedText';

export default function TableNode({
  id,
  data,
  type = 'tableNode',
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
}) {
  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow();
  const graphActions = useGraphActions();

  const expanded = Boolean(data.expanded);

  const hasColumns = data.columns && data.columns.length > 0;
  const isHighlighted = data.isSearchMatch;
  const isActiveSearch = data.isActiveSearchMatch;
  const searchLower = data.searchQuery?.toLowerCase() || '';
  const isColumnSource = data.isColumnSource;
  const hasIncoming = getEdges().some((e) => e.target === id);
  const kindLabel = kindLabels[data.kind] || data.kind;
  const kindColor = kindColors[data.kind] || theme.textMuted;

  const borderColor = data.diffStatus === 'added'
    ? theme.success
    : isActiveSearch
      ? theme.warning
      : isHighlighted
        ? theme.highlight
        : isColumnSource
          ? theme.joinBg
        : theme.nodeBorder;

  const lineageByColumn = {};
  if (data.column_lineage) {
    data.column_lineage.forEach((entry) => {
      lineageByColumn[entry.name] = entry.sources || [];
    });
  }

  const { width: nodeWidth } = getNodeDimensions({ id, data, type });
  const alias = data?.alias;
  const baseName = data?.label || id;
  const showAliasHeader =
    alias &&
    alias.toLowerCase() !== String(baseName).toLowerCase() &&
    alias.toLowerCase() !== String(id).toLowerCase();
  const showAliasLine = Boolean(alias && (showAliasHeader || data?.kind === 'subquery'));

  return (
    <div
      style={{
        background: theme.nodeBg,
        border: `2px solid ${borderColor}`,
        borderRadius: '8px',
        width: nodeWidth,
        minWidth: nodeWidth,
        boxSizing: 'border-box',
        boxShadow: data.diffStatus === 'added'
          ? '0 0 12px rgba(16, 185, 129, 0.35)'
          : isActiveSearch
            ? `0 0 20px ${theme.highlight}`
            : isHighlighted
              ? `0 0 15px ${theme.highlight}80`
              : theme.shadowCard,
        fontFamily: '"Inter", sans-serif',
        transition: 'all 0.3s ease',
        zIndex: expanded ? 8 : 1,
      }}
    >
      <Handle
        type="target"
        position={targetPosition}
        style={{ background: theme.nodeBorder, width: '8px', height: '8px' }}
      />

      <div
        style={{
          padding: '12px',
          background: isHighlighted ? theme.highlightBg : theme.nodeHeaderBg,
          borderBottom: expanded && hasColumns ? `1px solid ${theme.border}` : 'none',
          borderTopLeftRadius: '6px',
          borderTopRightRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '13px',
            fontWeight: '600',
            color: theme.textMain,
            minWidth: 0,
            flex: 1,
            gap: '0',
          }}
        >
          <TableIcon />
          <div style={{ flex: 1, minWidth: 0, marginLeft: '4px', lineHeight: 1.3 }}>
            <TruncatedText
              text={baseName}
              style={{ display: 'block', fontWeight: 600 }}
            />
            {showAliasLine && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    fontFamily: '"JetBrains Mono", monospace',
                    color: theme.joinBg,
                    background: 'rgba(245, 158, 11, 0.15)',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  as {alias}
                </span>
              </div>
            )}
          </div>
          {data.kind && (
            <span
              style={{
                fontSize: '9px',
                fontWeight: '700',
                color: kindColor,
                marginLeft: '8px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: `${kindColor}24`,
                flexShrink: 0,
              }}
            >
              {kindLabel}
            </span>
          )}
          {data.diffStatus === 'added' && (
            <span
              style={{
                fontSize: '9px',
                color: theme.success,
                marginLeft: '6px',
                fontWeight: '700',
                flexShrink: 0,
              }}
            >
              NEW
            </span>
          )}
          {hasColumns && !expanded && (
            <span
              style={{
                fontSize: '10px',
                color: theme.textMuted,
                marginLeft: '6px',
                fontWeight: '500',
                flexShrink: 0,
              }}
            >
              ({data.columns.length} cols)
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {hasIncoming && (
            <button
              title={
                data.collapsed
                  ? 'Show Upstream Dependencies'
                  : 'Hide Upstream Dependencies'
              }
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleNodeCollapse(id, getNodes(), getEdges(), setNodes, setEdges);
              }}
              style={{
                cursor: 'pointer',
                backgroundColor: data.collapsed ? theme.primary : theme.mutedSurface,
                color: data.collapsed ? 'white' : theme.textMuted,
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
                fontWeight: 'bold',
                transition: 'background-color 0.2s',
              }}
            >
              {data.collapsed ? <EyeOffIcon /> : <EyeIcon />}
              {data.collapsed ? 'HIDDEN' : 'HIDE'}
            </button>
          )}
          {hasColumns && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                graphActions?.onNodeExpandedToggle?.(id);
              }}
              style={{
                cursor: 'pointer',
                color: theme.textMuted,
                fontSize: '10px',
                padding: '4px',
              }}
            >
              {expanded ? '▲' : '▼'}
            </div>
          )}
        </div>
      </div>

      {(expanded || isHighlighted) && hasColumns && (
        <div style={{ padding: '8px 0', fontSize: '12px' }}>
          {data.columns.map((col, idx) => {
            const sources = lineageByColumn[col] || [];
            const isSelectedCol = data.highlightedColumn === col;
            const isSearchCol =
              searchLower &&
              typeof col === 'string' &&
              col.toLowerCase().includes(searchLower);
            return (
              <div
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  graphActions?.onColumnSelect?.(id, col);
                }}
                style={{
                  padding: '6px 12px',
                  color: theme.textMuted,
                  borderBottom:
                    idx === data.columns.length - 1 ? 'none' : `1px solid ${theme.nodeHeaderBg}`,
                  cursor: 'pointer',
                  background: isSelectedCol || isSearchCol ? theme.highlightBg : 'transparent',
                }}
              >
                <TruncatedText
                  text={col}
                  style={{
                    fontWeight: '600',
                    color: isSearchCol ? theme.warning : theme.textMain,
                    display: 'block',
                  }}
                />
                <span style={{ fontSize: '9px', color: theme.primary, marginLeft: '6px' }}>
                  trace
                </span>
                {sources.length > 0 && (
                  <div
                    style={{
                      fontSize: '10px',
                      marginTop: '4px',
                      fontFamily: '"JetBrains Mono", monospace',
                      color: theme.textMuted,
                    }}
                  >
                    ← {sources.join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Handle
        type="source"
        position={sourcePosition}
        style={{ background: theme.nodeBorder, width: '8px', height: '8px' }}
      />
    </div>
  );
}

import { Handle, Position, useReactFlow } from '@xyflow/react';
import { theme, kindLabels, kindColors } from '../../theme';
import { TableIcon, EyeIcon, EyeOffIcon } from '../../icons';
import { toggleNodeCollapse } from '../../utils/graphVisibility';
import { useGraphActions } from '../../context/GraphActionsContext';
import { getNodeDimensions } from '../../utils/dagreLayout';
import TruncatedText from '../TruncatedText';

export default function TableNode({ id, data, type = 'tableNode' }) {
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
    ? '#10b981'
    : isActiveSearch
      ? '#d97706'
      : isHighlighted
        ? theme.highlight
        : isColumnSource
          ? theme.joinBg
          : theme.border;

  const lineageByColumn = {};
  if (data.column_lineage) {
    data.column_lineage.forEach((entry) => {
      lineageByColumn[entry.name] = entry.sources || [];
    });
  }

  const { width: nodeWidth } = getNodeDimensions({ id, data, type });

  return (
    <div
      style={{
        background: theme.cardBg,
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
              : '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        fontFamily: '"Inter", sans-serif',
        transition: 'all 0.3s ease',
        zIndex: expanded ? 8 : 1,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: theme.border, width: '8px', height: '8px' }}
      />

      <div
        style={{
          padding: '12px',
          background: isHighlighted ? '#fef3c7' : theme.headerBg,
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
          <TruncatedText
            text={data.label}
            subtitle={data.kind ? kindLabel : undefined}
            subtitleColor={kindColor}
            style={{ flex: 1, minWidth: 0, marginLeft: '4px' }}
          />
          {data.kind && (
            <span
              style={{
                fontSize: '9px',
                fontWeight: '700',
                color: kindColor,
                marginLeft: '8px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: `${kindColor}18`,
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
                color: '#10b981',
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
                backgroundColor: data.collapsed ? theme.primary : '#e2e8f0',
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
                    idx === data.columns.length - 1 ? 'none' : `1px solid ${theme.bg}`,
                  cursor: 'pointer',
                  background: isSelectedCol || isSearchCol ? '#fef3c7' : 'transparent',
                }}
              >
                <TruncatedText
                  text={col}
                  style={{
                    fontWeight: '600',
                    color: isSearchCol ? '#d97706' : theme.textMain,
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
        position={Position.Bottom}
        style={{ background: theme.border, width: '8px', height: '8px' }}
      />
    </div>
  );
}

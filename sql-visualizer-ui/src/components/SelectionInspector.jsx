import { useEffect, useState } from 'react';
import { kindLabels, kindColors } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { secondaryButtonStyle } from '../theme/uiStyles';
import { getColumnTraceSummary } from '../utils/lineagePath';
import { formatJoinStepLine } from '../utils/joinLabelUtils';
import {
  getSourcesUsedInStage,
  filterOperationsForStage,
  isNodeInColumnPath,
} from '../utils/lineageTableModel';

const TYPE = {
  size: '12px',
  primaryWeight: 500,
  secondaryWeight: 400,
};

function KindBadge({ kind }) {
  const { theme } = useTheme();
  const label = kindLabels[kind] || kind;
  const color = kindColors[kind] || theme.textMuted;
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        color,
        background: `${color}18`,
        padding: '2px 6px',
        borderRadius: '4px',
      }}
    >
      {label}
    </span>
  );
}

function Chip({ children, active, muted, onClick }) {
  const { theme } = useTheme();
  return (
    <span
      onClick={onClick}
      style={{
        fontSize: TYPE.size,
        fontWeight: TYPE.secondaryWeight,
        lineHeight: 1.4,
        padding: '1px 7px',
        borderRadius: '4px',
        background: active ? theme.primary : 'transparent',
        color: active ? theme.onPrimary : theme.textMuted,
        border: `1px solid ${active ? theme.primary : theme.border}`,
        opacity: muted ? 0.4 : 1,
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        fontSize: TYPE.size,
        fontWeight: TYPE.primaryWeight,
        color: theme.textMuted,
        marginBottom: '6px',
      }}
    >
      {children}
    </div>
  );
}

function ColumnPath({ nodeId, columnName, nodes, edges }) {
  const { theme } = useTheme();
  const trace = getColumnTraceSummary(nodeId, columnName, nodes, edges);

  return (
    <div style={{ marginBottom: '14px' }}>
      <SectionLabel>Path</SectionLabel>
      <div style={{ fontSize: TYPE.size, color: theme.textMuted, lineHeight: 1.5 }}>
        <div>
          <span style={{ fontWeight: TYPE.primaryWeight, color: theme.textMain }}>
            {trace.columnName}
          </span>
          {' in '}
          {trace.outputLabel}
        </div>
        {trace.pipelineStages.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            Via stages
            <ol style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
              {trace.pipelineStages.map((stage) => (
                <li key={stage.id} style={{ marginBottom: '2px', color: theme.textMain }}>
                  {stage.label}
                </li>
              ))}
            </ol>
          </div>
        )}
        {trace.unionMerges?.length > 0 &&
          trace.unionMerges.map((union) => (
            <div key={union.id} style={{ marginTop: '8px' }}>
              Merged by {union.unionType} ({union.branchCount} branches)
              <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                {union.branches.map((branch, idx) => (
                  <li key={branch.tail_id || idx}>
                    Branch {branch.index + 1}: {branch.label}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        {trace.sourceRefs.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            From sources
            <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
              {trace.sourceRefs.map((src) => (
                <li key={src.ref} style={{ color: theme.textMain }}>
                  {src.tableLabel}
                  <span style={{ fontWeight: TYPE.secondaryWeight, color: theme.textMuted }}>
                    {' '}
                    ({src.ref})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function ColumnChips({
  columns,
  selectedColumn,
  columnHighlight,
  onColumnClick,
}) {
  if (!columns.length) return null;
  return (
    <div style={{ marginBottom: '14px' }}>
      <SectionLabel>Columns ({columns.length})</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {columns.map((col) => {
          const inPath =
            !columnHighlight ||
            col === selectedColumn ||
            columnHighlight.sources?.some((s) =>
              String(s).toLowerCase().includes(col.toLowerCase())
            );
          return (
            <Chip
              key={col}
              active={col === selectedColumn}
              muted={!inPath}
              onClick={onColumnClick ? () => onColumnClick(col) : undefined}
            >
              {col}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}

export default function SelectionInspector({
  model,
  nodes,
  edges,
  operations,
  columnHighlight,
  selectedColumn,
  onColumnClick,
  onNodeSelect,
  onClear,
}) {
  const { theme } = useTheme();

  if (!model) return null;

  const node = model.node;
  const op = model.op;
  const title =
    model.variant === 'column-path'
      ? model.column
      : model.variant === 'operation'
        ? op.opType
        : node?.data?.label || node?.id;
  const kind =
    model.variant === 'column-path'
      ? 'final_output'
      : model.variant === 'operation'
        ? op.opKind === 'union'
          ? 'union'
          : 'join'
        : node?.data?.kind;

  const showPath =
    Boolean(model.column) &&
    (model.variant === 'stage' ||
      model.variant === 'source' ||
      model.variant === 'column-path');
  const pathNodeId =
    model.variant === 'column-path' ? node.id : node?.id;

  const stageOps =
    model.variant === 'stage'
      ? filterOperationsForStage(operations, node.id)
      : [];
  const joinOps = stageOps.filter((o) => o.opKind === 'join');
  const unionOps = stageOps.filter((o) => o.opKind === 'union');
  const sourcesUsed =
    model.variant === 'stage' ? getSourcesUsedInStage(node.id, nodes, edges) : [];
  const columns =
    model.variant === 'source' || model.variant === 'stage'
      ? node.data?.columns || []
      : [];

  return (
    <aside
      className="ls-inspector-panel"
      aria-label="Selection details"
      style={{
        borderLeft: `1px solid ${theme.border}`,
        background: theme.cardBg,
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 12px',
          borderBottom: `1px solid ${theme.border}`,
          flexShrink: 0,
        }}
      >
        <span
          title={title}
          style={{
            fontWeight: TYPE.primaryWeight,
            fontSize: TYPE.size,
            color: theme.textMain,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {title}
        </span>
        {kind && <KindBadge kind={kind} />}
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            style={{
              ...secondaryButtonStyle(theme),
              marginLeft: 'auto',
              height: '28px',
              padding: '0 10px',
              fontSize: '11px',
              boxSizing: 'border-box',
              flexShrink: 0,
            }}
          >
            Close
          </button>
        )}
      </div>

      <div style={{ padding: '12px 14px 16px', overflow: 'auto', flex: 1, minHeight: 0 }}>
        {showPath && (
          <ColumnPath
            nodeId={pathNodeId}
            columnName={model.column}
            nodes={nodes}
            edges={edges}
          />
        )}

        {model.variant === 'operation' && (
          <div style={{ marginBottom: '14px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: TYPE.size, color: theme.textMuted }}>
                Stage:{' '}
                <span
                  style={{
                    fontWeight: TYPE.primaryWeight,
                    color: theme.textMain,
                    cursor: onNodeSelect ? 'pointer' : 'default',
                    textDecoration: onNodeSelect ? 'underline' : 'none',
                  }}
                  onClick={() => op.stageId && onNodeSelect?.(op.stageId)}
                >
                  {op.stageLabel}
                </span>
              </span>
              <KindBadge kind={op.opKind === 'union' ? 'union' : op.opKind === 'join' ? 'join' : (node?.data?.kind || 'cte')} />
            </div>

            <SectionLabel>{op.opType || 'Operation Detail'}</SectionLabel>
            <div
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                fontSize: '12px',
                color: theme.textMain,
                background: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                padding: '8px 10px',
                borderRadius: '6px',
                lineHeight: 1.45,
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
                marginBottom: '10px',
                border: `1px solid ${theme.border}`,
              }}
            >
              {op.detail || (op.opKind === 'join' ? formatJoinStepLine(op) : op.opType)}
            </div>

            {op.opKind === 'join' && op.operands?.length > 0 && (
              <div style={{ marginTop: '8px', fontSize: TYPE.size, color: theme.textMuted }}>
                <span style={{ fontWeight: TYPE.primaryWeight, color: theme.textMain }}>Operands: </span>
                {op.operands.map((o) => o.label || o.id).join(' ⟕ ')}
              </div>
            )}

            {op.opKind === 'union' && op.branches?.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <SectionLabel>Union Branches ({op.branchCount || op.branches.length})</SectionLabel>
                <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: TYPE.size, color: theme.textMain }}>
                  {op.branches.map((b, idx) => (
                    <li key={b.tail_id || idx} style={{ marginBottom: '2px' }}>
                      Branch {b.index + 1}: {b.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {sourcesUsed.length > 0 && (
          <div
            style={{
              fontSize: TYPE.size,
              fontWeight: TYPE.secondaryWeight,
              color: theme.textMuted,
              marginBottom: '14px',
            }}
          >
            Sources: {sourcesUsed.join(', ')}
          </div>
        )}

        <ColumnChips
          columns={columns}
          selectedColumn={selectedColumn}
          columnHighlight={columnHighlight}
          onColumnClick={onColumnClick}
        />

        {unionOps.length > 0 && (
          <div style={{ marginBottom: joinOps.length ? '12px' : 0 }}>
            <SectionLabel>Unions in this stage</SectionLabel>
            <ul
              style={{
                margin: 0,
                paddingLeft: '18px',
                fontSize: TYPE.size,
                fontWeight: TYPE.secondaryWeight,
                color: theme.textMuted,
              }}
            >
              {unionOps.map((unionOp) => {
                const dimmed =
                  columnHighlight &&
                  !isNodeInColumnPath(unionOp.id, columnHighlight) &&
                  !unionOp.branches.some((b) =>
                    isNodeInColumnPath(b.tail_id, columnHighlight)
                  );
                return (
                  <li key={unionOp.id} style={{ opacity: dimmed ? 0.4 : 1, marginBottom: '4px' }}>
                    <span style={{ fontWeight: TYPE.primaryWeight, color: theme.textMain }}>
                      {unionOp.opType}
                    </span>{' '}
                    ({unionOp.branchCount} branches)
                    {unionOp.branches.map((b) => ` — ${b.label}`).join('')}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {joinOps.length > 0 && (
          <div style={{ marginBottom: (node?.data?.where_clause || (node?.data?.group_by && node.data.group_by.length > 0) || node?.data?.having_clause || node?.data?.qualify_clause) ? '12px' : 0 }}>
            <SectionLabel>Joins in this stage ({joinOps.length})</SectionLabel>
            <ul
              style={{
                margin: 0,
                paddingLeft: '18px',
                fontSize: TYPE.size,
                fontWeight: TYPE.secondaryWeight,
                color: theme.textMuted,
              }}
            >
              {joinOps.map((joinOp) => {
                const dimmed =
                  columnHighlight &&
                  !isNodeInColumnPath(joinOp.id, columnHighlight) &&
                  !joinOp.operands.some((o) =>
                    isNodeInColumnPath(o.id, columnHighlight)
                  );
                return (
                  <li key={joinOp.id} style={{ opacity: dimmed ? 0.4 : 1, marginBottom: '4px' }}>
                    <span style={{ fontWeight: TYPE.primaryWeight, color: theme.textMain }}>
                      {formatJoinStepLine(joinOp)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {node?.data?.where_clause && (
          <div style={{ marginBottom: '12px' }}>
            <SectionLabel>Filter (WHERE)</SectionLabel>
            <div
              style={{
                fontSize: TYPE.size,
                color: theme.textMain,
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                background: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                padding: '6px 8px',
                borderRadius: '4px',
              }}
            >
              {node.data.where_clause}
            </div>
          </div>
        )}

        {node?.data?.group_by && node.data.group_by.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <SectionLabel>Group By</SectionLabel>
            <div
              style={{
                fontSize: TYPE.size,
                color: theme.textMain,
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                background: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                padding: '6px 8px',
                borderRadius: '4px',
              }}
            >
              {node.data.group_by.join(', ')}
            </div>
          </div>
        )}

        {node?.data?.having_clause && (
          <div style={{ marginBottom: '12px' }}>
            <SectionLabel>Filter (HAVING)</SectionLabel>
            <div
              style={{
                fontSize: TYPE.size,
                color: theme.textMain,
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                background: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                padding: '6px 8px',
                borderRadius: '4px',
              }}
            >
              {node.data.having_clause}
            </div>
          </div>
        )}

        {node?.data?.qualify_clause && (
          <div>
            <SectionLabel>Filter (QUALIFY)</SectionLabel>
            <div
              style={{
                fontSize: TYPE.size,
                color: theme.textMain,
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                background: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                padding: '6px 8px',
                borderRadius: '4px',
              }}
            >
              {node.data.qualify_clause}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

const EXIT_MS = 260;

function inspectorPresenceKey(model) {
  if (!model) return null;
  return `${model.variant}:${model.node?.id || model.op?.id || ''}:${model.column || ''}`;
}

/** Keeps the panel mounted through the close animation. */
export function InspectorRail({ model, children }) {
  const key = inspectorPresenceKey(model);
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState(model);

  useEffect(() => {
    if (model) setHeld(model);
  }, [model]);

  useEffect(() => {
    if (!key) {
      setOpen(false);
      const timer = setTimeout(() => setHeld(null), EXIT_MS);
      return () => clearTimeout(timer);
    }
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setOpen(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [key]);

  if (!held) return null;

  return (
    <div className={`ls-inspector-rail${open ? ' is-open' : ''}`}>
      {children(held)}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { kindLabels } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { getColumnLineageHighlight } from '../utils/lineagePath';
import {
  TABLE_TABS,
  getSourceNodes,
  topologicalSortStages,
  getJoinOperations,
  getStageOperationSummary,
  getSourcesUsedInStage,
  getOutputNode,
  isNodeInColumnPath,
  filterOperationsForColumn,
  filterOperationsForStage,
  isPipelineQuery,
} from '../utils/lineageTableModel';
import { resolveTableInspector } from '../utils/lineageTableInspector';
import { formatJoinStepDetail } from '../utils/joinLabelUtils';
import SelectionInspector, { InspectorRail } from './SelectionInspector';

const TYPE = {
  headerSize: '11px',
  headerWeight: 600,
  bodySize: '12px',
  primaryWeight: 500,
  secondaryWeight: 400,
};

/** Fit = shrink to content. Fill = take leftover, ellipsis. Resizable cols can replace `fit` later. */
const COL = {
  sources: [
    { key: 'name', label: 'Table' },
    { key: 'kind', label: 'Kind', fit: true },
    { key: 'qualified', label: 'Qualified name' },
    { key: 'columns', label: 'Cols', fit: true, align: 'right' },
    { key: 'usedIn', label: 'Used in' },
  ],
  pipeline: [
    { key: 'step', label: '#', fit: true, align: 'right' },
    { key: 'name', label: 'Stage' },
    { key: 'kind', label: 'Kind', fit: true },
    { key: 'columns', label: 'Cols', fit: true, align: 'right' },
    { key: 'ops', label: 'Operations' },
  ],
  operations: [
    { key: 'stage', label: 'Stage' },
    { key: 'kind', label: 'Kind', fit: true },
    { key: 'op', label: 'Operation', fit: true },
    { key: 'detail', label: 'Details' },
  ],
  output: [
    { key: 'column', label: 'Column' },
    { key: 'sources', label: 'Source refs' },
  ],
};

function KindBadge({ kind }) {
  const { theme } = useTheme();
  const label = kindLabels[kind] || kind;
  const color = theme.textMuted;
  const bg = theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        color,
        background: bg,
        padding: '2px 6px',
        borderRadius: '4px',
      }}
    >
      {label}
    </span>
  );
}

function PrimaryCell({ children }) {
  const { theme } = useTheme();
  return (
    <span
      title={typeof children === 'string' ? children : undefined}
      style={{
        fontSize: TYPE.bodySize,
        fontWeight: TYPE.primaryWeight,
        color: theme.textMain,
        lineHeight: 1.4,
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function SecondaryCell({ children, title }) {
  const { theme } = useTheme();
  const empty = children == null || children === '';
  return (
    <span
      title={title}
      style={{
        fontSize: TYPE.bodySize,
        fontWeight: TYPE.secondaryWeight,
        color: theme.textMuted,
        lineHeight: 1.4,
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '100%',
      }}
    >
      {empty ? '—' : children}
    </span>
  );
}

function MetaCell({ children }) {
  const { theme } = useTheme();
  return (
    <span
      style={{
        fontSize: TYPE.bodySize,
        fontWeight: TYPE.secondaryWeight,
        color: theme.textMuted,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.4,
      }}
    >
      {children == null || children === '' ? '—' : children}
    </span>
  );
}

function CodeCell({ children, title }) {
  const { theme } = useTheme();
  const empty = children == null || children === '';
  if (empty) {
    return <SecondaryCell />;
  }
  return (
    <span
      title={title}
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '12px',
        fontWeight: 400,
        color: theme.textMuted,
        background: 'transparent',
        padding: 0,
        borderRadius: '4px',
        lineHeight: 1.4,
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      {children}
    </span>
  );
}

function DataTable({ columns, rows, emptyMessage }) {
  const { theme } = useTheme();
  const [hoveredKey, setHoveredKey] = useState(null);
  const rowDivider = theme.mode === 'dark' ? theme.mutedSurface : theme.bg;

  const thStyle = (col) => ({
    textAlign: col.align || 'left',
    padding: '8px 12px',
    fontSize: TYPE.headerSize,
    fontWeight: TYPE.headerWeight,
    color: theme.textMuted,
    borderBottom: `1px solid ${theme.border}`,
    background: theme.headerBg,
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    zIndex: 1,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    width: col.fit ? '1%' : undefined,
  });

  const tdStyle = (col, isLastRow) => ({
    padding: '8px 12px',
    fontSize: TYPE.bodySize,
    fontWeight: TYPE.secondaryWeight,
    color: theme.textMain,
    borderBottom: isLastRow ? 'none' : `1px solid ${rowDivider}`,
    verticalAlign: 'middle',
    lineHeight: 1.4,
    textAlign: col.align || 'left',
    width: col.fit ? '1%' : undefined,
    minWidth: col.fit ? undefined : 0,
    whiteSpace: 'nowrap',
    overflow: col.fit ? 'visible' : 'hidden',
  });

  const cardStyle = {
    background: theme.cardBg,
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: theme.shadowSubtle,
  };

  if (!rows.length) {
    return (
      <div style={{ padding: '8px' }}>
        <div
          style={{
            ...cardStyle,
            padding: '20px 12px',
            color: theme.textMuted,
            fontSize: TYPE.bodySize,
          }}
        >
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px' }}>
      <div style={cardStyle}>
        <table
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'auto',
          }}
        >
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={thStyle(col)}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const hovered = hoveredKey === row.key && !row.selected;
              const isLastRow = rowIndex === rows.length - 1;
              return (
                <tr
                  key={row.key}
                  onClick={(e) => {
                    e.stopPropagation();
                    row.onClick?.(e);
                  }}
                  onMouseEnter={() => setHoveredKey(row.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  style={{
                    cursor: row.onClick ? 'pointer' : 'default',
                    background: row.selected
                      ? theme.rowSelectedBg
                      : hovered
                        ? theme.headerBg
                        : theme.cardBg,
                    boxShadow: row.selected
                      ? `inset 2px 0 0 ${theme.primary}`
                      : 'none',
                    opacity: row.dimmed ? 0.5 : 1,
                    transition: 'background-color 0.15s ease-in-out',
                  }}
                >
                  {columns.map((col) => (
                    <td key={col.key} style={tdStyle(col, isLastRow)}>
                      {row.cells[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function OperationsTable({
  stages,
  operations,
  nodes,
  selectedNodeId,
  columnHighlight,
  onNodeSelect,
  onClearSelection,
  emptyMessage,
}) {
  const { theme } = useTheme();
  // Default to all stages collapsed, except if a stage is currently selected
  const [collapsedStages, setCollapsedStages] = useState(() => {
    const set = new Set(stages.map((s) => s.id));
    if (selectedNodeId) {
      set.delete(selectedNodeId);
    }
    return set;
  });
  const [hoveredKey, setHoveredKey] = useState(null);

  useEffect(() => {
    if (selectedNodeId) {
      setCollapsedStages((prev) => {
        if (!prev.has(selectedNodeId)) return prev;
        const next = new Set(prev);
        next.delete(selectedNodeId);
        return next;
      });
    }
  }, [selectedNodeId]);

  const toggleStageCollapse = (stageId, e) => {
    if (e) e.stopPropagation();
    setCollapsedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  };

  const expandAll = () => setCollapsedStages(new Set());
  const collapseAll = () => setCollapsedStages(new Set(stages.map((s) => s.id)));

  const toTitleCase = (str) =>
    str
      ? str
          .toLowerCase()
          .split(/[\s_]+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
      : '—';

  // Group operations by stageId
  const opsByStage = useMemo(() => {
    const map = new Map();
    stages.forEach((s) => map.set(s.id, []));
    operations.forEach((op) => {
      const list = map.get(op.stageId);
      if (list) list.push(op);
      else {
        if (!map.has(op.stageId)) map.set(op.stageId, []);
        map.get(op.stageId).push(op);
      }
    });
    return map;
  }, [stages, operations]);

  const activeStageEntries = stages.filter((s) => (opsByStage.get(s.id) || []).length > 0);

  const cardStyle = {
    background: theme.cardBg,
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: theme.shadowSubtle,
  };

  if (!activeStageEntries.length) {
    return (
      <div style={{ padding: '8px' }}>
        <div
          style={{
            ...cardStyle,
            padding: '20px 12px',
            color: theme.textMuted,
            fontSize: TYPE.bodySize,
          }}
        >
          {emptyMessage}
        </div>
      </div>
    );
  }

  const thStyle = (col) => ({
    textAlign: col.align || 'left',
    padding: '8px 12px',
    fontSize: TYPE.headerSize,
    fontWeight: TYPE.headerWeight,
    color: theme.textMuted,
    borderBottom: `1px solid ${theme.border}`,
    background: theme.headerBg,
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    zIndex: 1,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    width: col.fit ? '1%' : undefined,
  });

  const rowDivider = theme.mode === 'dark' ? theme.mutedSurface : theme.bg;

  return (
    <div style={{ padding: '8px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
          paddingRight: '4px',
        }}
      >
        <button
          type="button"
          onClick={expandAll}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '11px',
            color: theme.primary,
            cursor: 'pointer',
            padding: '2px 6px',
            fontWeight: 500,
          }}
        >
          Expand All
        </button>
        <span style={{ color: theme.border, fontSize: '11px' }}>•</span>
        <button
          type="button"
          onClick={collapseAll}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '11px',
            color: theme.textMuted,
            cursor: 'pointer',
            padding: '2px 6px',
            fontWeight: 500,
          }}
        >
          Collapse All
        </button>
      </div>

      <div style={cardStyle}>
        <table
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'auto',
          }}
        >
          <thead>
            <tr>
              <th style={thStyle({ key: 'stage', label: 'Stage' })}>Stage</th>
              <th style={thStyle({ key: 'kind', label: 'Kind', fit: true })}>Kind</th>
              <th style={thStyle({ key: 'op', label: 'Operation', fit: true })}>Operation</th>
              <th style={thStyle({ key: 'detail', label: 'Details' })}>Details</th>
            </tr>
          </thead>
          <tbody>
            {activeStageEntries.map((stage, stageIdx) => {
              const stageId = stage.id;
              const stageOps = opsByStage.get(stageId) || [];
              const isCollapsed = collapsedStages.has(stageId);
              const isStageSelected = selectedNodeId === stageId;
              const isLastStage = stageIdx === activeStageEntries.length - 1;

              if (isCollapsed) {
                const isHovered = hoveredKey === stageId && !isStageSelected;
                return (
                  <tr
                    key={stageId}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectedNodeId === stageId) onClearSelection?.();
                      else onNodeSelect?.(stageId);
                    }}
                    onMouseEnter={() => setHoveredKey(stageId)}
                    onMouseLeave={() => setHoveredKey(null)}
                    style={{
                      cursor: 'pointer',
                      background: isStageSelected
                        ? theme.rowSelectedBg
                        : isHovered
                          ? theme.headerBg
                          : theme.cardBg,
                      boxShadow: isStageSelected ? `inset 2px 0 0 ${theme.primary}` : 'none',
                      borderBottom: isLastStage ? 'none' : `1px solid ${rowDivider}`,
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <td
                      style={{
                        padding: '8px 12px',
                        verticalAlign: 'middle',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          onClick={(e) => toggleStageCollapse(stageId, e)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '18px',
                            height: '18px',
                            borderRadius: '4px',
                            color: theme.textMuted,
                            fontSize: '10px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                            flexShrink: 0,
                          }}
                          title="Expand stage"
                        >
                          ▶
                        </span>
                        <PrimaryCell>{stage.data?.label || stageId}</PrimaryCell>
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', verticalAlign: 'middle', width: '1%', whiteSpace: 'nowrap' }}>
                      <KindBadge kind={stage.data?.kind} />
                    </td>
                    <td style={{ padding: '8px 12px', verticalAlign: 'middle', width: '1%', whiteSpace: 'nowrap' }}>
                      <SecondaryCell>—</SecondaryCell>
                    </td>
                    <td style={{ padding: '8px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <SecondaryCell>
                        {stageOps.length} {stageOps.length === 1 ? 'operation' : 'operations'}
                      </SecondaryCell>
                    </td>
                  </tr>
                );
              }

              // Expanded: Render child rows with the first row showing Stage & Kind spanning the group
              const isAnyStageOpHovered = stageOps.some((o) => o.id === hoveredKey);
              const isStageGroupHovered = (hoveredKey === stageId || isAnyStageOpHovered);

              // Subtle background for expanded stage block to clearly demarcate boundaries
              const expandedBaseBg = theme.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.025)'
                : 'rgba(0, 0, 0, 0.015)';

              return stageOps.map((op, opIdx) => {
                const isFirstOp = opIdx === 0;
                const isLastOp = opIdx === stageOps.length - 1;
                const isOpSelected = selectedNodeId === op.id;
                const isOpHovered = hoveredKey === op.id;
                const dimmed =
                  columnHighlight &&
                  !isNodeInColumnPath(op.id, columnHighlight) &&
                  !op.operands?.some((o) => isNodeInColumnPath(o.id, columnHighlight)) &&
                  !(op.branches || []).some((b) => isNodeInColumnPath(b.tail_id, columnHighlight));

                const opDisplay = toTitleCase(op.opType);
                const detail =
                  op.detail ||
                  (op.opKind === 'union'
                    ? (op.branches || []).map((b) => `B${b.index + 1}: ${b.label}`).join(' · ') ||
                      `${op.branchCount || 0} branches`
                    : formatJoinStepDetail(op));

                const borderTopStyle = (isFirstOp && stageIdx > 0)
                  ? `1px solid ${theme.border}`
                  : 'none';

                const borderBottomStyle = (isLastOp && !isLastStage)
                  ? `1px solid ${theme.border}`
                  : isLastOp && isLastStage
                    ? 'none'
                    : `1px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'}`;

                // Row background logic:
                // 1. Specific operation selected: primary row selected color
                // 2. Stage selected: stage tint
                // 3. Operation hovered: hover highlight
                // 4. Base expanded block background: subtle darker/tinted boundary
                const rowBg = isOpSelected
                  ? theme.rowSelectedBg
                  : isOpHovered
                    ? theme.headerBg
                    : isStageSelected
                      ? (theme.mode === 'dark' ? 'rgba(30, 58, 95, 0.18)' : 'rgba(239, 246, 255, 0.45)')
                      : isStageGroupHovered
                        ? (theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)')
                        : expandedBaseBg;

                return (
                  <tr
                    key={op.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectedNodeId === op.id) onClearSelection?.();
                      else onNodeSelect?.(op.id);
                    }}
                    onMouseEnter={() => setHoveredKey(op.id)}
                    onMouseLeave={() => setHoveredKey(null)}
                    style={{
                      cursor: 'pointer',
                      background: rowBg,
                      boxShadow: isOpSelected ? `inset 2px 0 0 ${theme.primary}` : 'none',
                      borderTop: borderTopStyle,
                      borderBottom: borderBottomStyle,
                      opacity: dimmed ? 0.4 : 1,
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    {isFirstOp ? (
                      <td
                        rowSpan={stageOps.length}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedNodeId === stageId) onClearSelection?.();
                          else onNodeSelect?.(stageId);
                        }}
                        onMouseEnter={() => setHoveredKey(stageId)}
                        onMouseLeave={() => setHoveredKey(null)}
                        style={{
                          padding: '8px 12px',
                          verticalAlign: 'top',
                          borderTop: isFirstOp && stageIdx > 0 ? `1px solid ${theme.border}` : 'none',
                          borderBottom: isLastStage ? 'none' : `1px solid ${theme.border}`,
                          background: isStageSelected
                            ? theme.rowSelectedBg
                            : isStageGroupHovered
                              ? (theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.035)')
                              : expandedBaseBg,
                          whiteSpace: 'nowrap',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            onClick={(e) => toggleStageCollapse(stageId, e)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              color: theme.textMuted,
                              fontSize: '10px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              background: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                              flexShrink: 0,
                            }}
                            title="Collapse stage"
                          >
                            ▼
                          </span>
                          <PrimaryCell>{stage.data?.label || stageId}</PrimaryCell>
                        </div>
                      </td>
                    ) : null}

                    {isFirstOp ? (
                      <td
                        rowSpan={stageOps.length}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedNodeId === stageId) onClearSelection?.();
                          else onNodeSelect?.(stageId);
                        }}
                        onMouseEnter={() => setHoveredKey(stageId)}
                        onMouseLeave={() => setHoveredKey(null)}
                        style={{
                          padding: '8px 12px',
                          verticalAlign: 'top',
                          borderTop: isFirstOp && stageIdx > 0 ? `1px solid ${theme.border}` : 'none',
                          borderBottom: isLastStage ? 'none' : `1px solid ${theme.border}`,
                          background: isStageSelected
                            ? theme.rowSelectedBg
                            : isStageGroupHovered
                              ? (theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.035)')
                              : expandedBaseBg,
                          width: '1%',
                          whiteSpace: 'nowrap',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        <KindBadge kind={stage.data?.kind} />
                      </td>
                    ) : null}

                    <td
                      style={{
                        padding: '8px 12px',
                        verticalAlign: 'middle',
                        width: '1%',
                        whiteSpace: 'nowrap',
                        borderTop: isFirstOp && stageIdx > 0 ? `1px solid ${theme.border}` : 'none',
                      }}
                    >
                      <PrimaryCell>{opDisplay}</PrimaryCell>
                    </td>

                    <td
                      style={{
                        padding: '8px 12px',
                        verticalAlign: 'middle',
                        whiteSpace: 'nowrap',
                        borderTop: isFirstOp && stageIdx > 0 ? `1px solid ${theme.border}` : 'none',
                      }}
                    >
                      <CodeCell title={detail}>{detail}</CodeCell>
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function LineageTableView({
  nodes,
  edges,
  selectedNodeId,
  selectedColumn,
  tableTab,
  onTableTabChange,
  onNodeSelect,
  onColumnSelect,
  onClearSelection,
}) {
  const { theme } = useTheme();

  const toggleNodeSelection = (id) => {
    if (selectedNodeId === id && !selectedColumn) {
      onClearSelection?.();
    } else {
      onNodeSelect(id);
    }
  };

  const pipelineQuery = isPipelineQuery(nodes);
  const sourceNodes = getSourceNodes(nodes);
  const pipelineStages = topologicalSortStages(nodes, edges);
  const operations = getJoinOperations(nodes, edges);
  const outputNode = getOutputNode(nodes);

  const activeTab =
    !pipelineQuery && tableTab === TABLE_TABS.PIPELINE
      ? TABLE_TABS.OUTPUT
      : tableTab;

  useEffect(() => {
    if (tableTab !== activeTab) {
      onTableTabChange(activeTab);
    }
  }, [activeTab, tableTab, onTableTabChange]);

  const columnHighlight = useMemo(() => {
    if (!selectedColumn || !selectedNodeId) return null;
    return getColumnLineageHighlight(selectedNodeId, selectedColumn, nodes, edges);
  }, [selectedColumn, selectedNodeId, nodes, edges]);

  const inspector = resolveTableInspector({
    activeTab,
    selectedNodeId,
    selectedColumn,
    nodes,
    operations,
    outputNode,
  });

  const visibleOperations = useMemo(() => {
    let ops = operations;
    if (selectedColumn && columnHighlight) {
      ops = filterOperationsForColumn(ops, columnHighlight);
    }
    return ops;
  }, [
    operations,
    selectedColumn,
    columnHighlight,
  ]);

  const sourcesRows = sourceNodes.map((n) => {
    const id = n.id;
    const dimmed = columnHighlight && !isNodeInColumnPath(id, columnHighlight);
    const usedIn = pipelineStages
      .filter((s) => getSourcesUsedInStage(s.id, nodes, edges).includes(n.data?.label || id))
      .map((s) => s.data?.label || s.id);
    const colCount = n.data?.columns?.length || 0;

    return {
      key: id,
      selected: selectedNodeId === id,
      dimmed,
      onClick: () => toggleNodeSelection(id),
      cells: {
        name: <PrimaryCell>{n.data?.label || id}</PrimaryCell>,
        kind: <KindBadge kind={n.data?.kind} />,
        qualified: (
          <SecondaryCell title={n.data?.qualified_name || ''}>
            {n.data?.qualified_name}
          </SecondaryCell>
        ),
        columns: <MetaCell>{colCount > 0 ? colCount : null}</MetaCell>,
        usedIn: (
          <SecondaryCell title={usedIn.join(', ')}>
            {usedIn.length ? usedIn.join(', ') : null}
          </SecondaryCell>
        ),
      },
    };
  });

  const pipelineRows = pipelineStages.map((n, index) => {
    const id = n.id;
    const dimmed = columnHighlight && !isNodeInColumnPath(id, columnHighlight);
    const colCount = n.data?.columns?.length || 0;
    const summary = getStageOperationSummary(id, operations);

    return {
      key: id,
      selected: selectedNodeId === id,
      dimmed,
      onClick: () => toggleNodeSelection(id),
      cells: {
        step: <MetaCell>{index + 1}</MetaCell>,
        name: <PrimaryCell>{n.data?.label || id}</PrimaryCell>,
        kind: <KindBadge kind={n.data?.kind} />,
        columns: <MetaCell>{colCount > 0 ? colCount : null}</MetaCell>,
        ops: <SecondaryCell title={summary}>{summary}</SecondaryCell>,
      },
    };
  });

  const outputRows = (outputNode?.data?.column_lineage || []).map((entry) => {
    const colName = entry.name;
    const isSelected =
      selectedColumn === colName && selectedNodeId === outputNode?.id;

    return {
      key: colName,
      selected: isSelected,
      dimmed: false,
      onClick: () => {
        if (!outputNode) return;
        if (isSelected) onClearSelection?.();
        else onColumnSelect(outputNode.id, colName);
      },
      cells: {
        column: <PrimaryCell>{colName}</PrimaryCell>,
        sources: (
          <CodeCell title={(entry.sources || []).join(', ')}>
            {(entry.sources || []).length ? (entry.sources || []).join(', ') : null}
          </CodeCell>
        ),
      },
    };
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        minHeight: 0,
        background: theme.bg,
      }}
    >
      <div
        style={{ flex: 1, overflow: 'auto', minHeight: 0, minWidth: 0 }}
        onClick={() => inspector && onClearSelection?.()}
      >
        {activeTab === TABLE_TABS.SOURCES && (
          <DataTable
            columns={COL.sources}
            rows={sourcesRows}
            emptyMessage="No source tables in this query."
          />
        )}

        {activeTab === TABLE_TABS.PIPELINE && (
          <DataTable
            columns={COL.pipeline}
            rows={pipelineRows}
            emptyMessage="No pipeline stages — output is a simple SELECT."
          />
        )}

        {activeTab === TABLE_TABS.OPERATIONS && (
          <OperationsTable
            stages={pipelineStages}
            operations={visibleOperations}
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            columnHighlight={columnHighlight}
            onNodeSelect={onNodeSelect}
            onClearSelection={onClearSelection}
            emptyMessage="No join, union, or filter operations in this query."
          />
        )}

        {activeTab === TABLE_TABS.OUTPUT && (
          <DataTable
            columns={COL.output}
            rows={outputRows}
            emptyMessage="No output columns — parse a query first."
          />
        )}
      </div>

      <InspectorRail model={inspector}>
        {(held) => (
          <SelectionInspector
            model={held}
            nodes={nodes}
            edges={edges}
            operations={operations}
            columnHighlight={columnHighlight}
            selectedColumn={selectedColumn}
            onColumnClick={
              held.node
                ? (col) => onColumnSelect(held.node.id, col)
                : undefined
            }
            onNodeSelect={onNodeSelect}
            onClear={onClearSelection}
          />
        )}
      </InspectorRail>
    </div>
  );
}

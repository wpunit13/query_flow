import { useMemo } from 'react';
import { theme, kindLabels, kindColors } from '../theme';
import { getColumnLineageHighlight } from '../utils/lineagePath';
import {
  TABLE_TABS,
  getSourceNodes,
  topologicalSortStages,
  getJoinOperations,
  getStageOperationSummary,
  getSourcesUsedInStage,
  getOutputNode,
  getColumnSourcesText,
  isNodeInColumnPath,
  filterOperationsForColumn,
  filterOperationsForStage,
  isPipelineQuery,
} from '../utils/lineageTableModel';

const thStyle = {
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: '11px',
  fontWeight: '600',
  color: theme.textMuted,
  borderBottom: `1px solid ${theme.border}`,
  background: theme.headerBg,
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '8px 12px',
  fontSize: '12px',
  color: theme.textMain,
  borderBottom: `1px solid ${theme.border}`,
  verticalAlign: 'top',
};

function KindBadge({ kind }) {
  const label = kindLabels[kind] || kind;
  const color = kindColors[kind] || theme.textMuted;
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: '700',
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

function DataTable({ columns, rows, emptyMessage }) {
  if (!rows.length) {
    return (
      <div style={{ padding: '24px', color: theme.textMuted, fontSize: '13px' }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} style={thStyle}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.key}
            onClick={row.onClick}
            style={{
              cursor: row.onClick ? 'pointer' : 'default',
              background: row.selected ? '#eff6ff' : row.dimmed ? '#f8fafc' : 'white',
              opacity: row.dimmed ? 0.45 : 1,
            }}
          >
            {columns.map((col) => (
              <td key={col.key} style={tdStyle}>
                {row.cells[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StageDetailPanel({
  stageNode,
  operations,
  nodes,
  edges,
  selectedColumn,
  columnHighlight,
}) {
  if (!stageNode) return null;

  const stageId = stageNode.id;
  const columns = stageNode.data?.columns || [];
  const stageOps = filterOperationsForStage(operations, stageId);
  const sourcesUsed = getSourcesUsedInStage(stageId, nodes, edges);

  return (
    <div
      style={{
        borderTop: `1px solid ${theme.border}`,
        background: theme.headerBg,
        padding: '12px 16px',
        maxHeight: '40%',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '10px',
        }}
      >
        <span style={{ fontWeight: '600', fontSize: '13px', color: theme.textMain }}>
          {stageNode.data?.label || stageId}
        </span>
        <KindBadge kind={stageNode.data?.kind} />
        {selectedColumn && (
          <span style={{ fontSize: '11px', color: theme.textMuted }}>
            Column trace: <strong>{selectedColumn}</strong>
          </span>
        )}
      </div>

      {sourcesUsed.length > 0 && (
        <div style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '8px' }}>
          Sources: {sourcesUsed.join(', ')}
        </div>
      )}

      {columns.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: '600',
              color: theme.textMuted,
              marginBottom: '4px',
            }}
          >
            Columns ({columns.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {columns.map((col) => {
              const inPath =
                !columnHighlight ||
                col === selectedColumn ||
                columnHighlight.sources.some((s) =>
                  s.toLowerCase().includes(col.toLowerCase())
                );
              return (
                <span
                  key={col}
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: col === selectedColumn ? theme.primary : theme.cardBg,
                    color: col === selectedColumn ? 'white' : theme.textMain,
                    border: `1px solid ${theme.border}`,
                    opacity: inPath ? 1 : 0.4,
                  }}
                >
                  {col}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {(stageOps.length > 0) && (
        <div>
          {stageOps.filter((op) => op.opKind === 'union').length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: theme.textMuted,
                  marginBottom: '4px',
                }}
              >
                Unions in this stage
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: theme.textMain }}>
                {stageOps
                  .filter((op) => op.opKind === 'union')
                  .map((op) => {
                    const dimmed =
                      columnHighlight &&
                      !isNodeInColumnPath(op.id, columnHighlight) &&
                      !op.branches.some((b) => isNodeInColumnPath(b.tail_id, columnHighlight));
                    return (
                      <li key={op.id} style={{ opacity: dimmed ? 0.4 : 1, marginBottom: '4px' }}>
                        <strong>{op.opType}</strong> ({op.branchCount} branches)
                        {op.branches.map((b) => ` — ${b.label}`).join('')}
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}
          {stageOps.filter((op) => op.opKind === 'join').length > 0 && (
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: '600',
              color: theme.textMuted,
              marginBottom: '4px',
            }}
          >
            Joins in this stage ({stageOps.filter((op) => op.opKind === 'join').length})
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: theme.textMain }}>
            {stageOps
              .filter((op) => op.opKind === 'join')
              .map((op) => {
              const dimmed =
                columnHighlight &&
                !isNodeInColumnPath(op.id, columnHighlight) &&
                !op.operands.some((o) => isNodeInColumnPath(o.id, columnHighlight));
              return (
                <li key={op.id} style={{ opacity: dimmed ? 0.4 : 1, marginBottom: '4px' }}>
                  <strong>{op.opType}</strong>
                  {op.left && op.right
                    ? ` — ${op.left.label} × ${op.right.label}`
                    : ''}
                  {op.conditions[0] ? ` ON ${op.conditions[0]}` : ''}
                </li>
              );
            })}
          </ul>
        </div>
          )}
        </div>
      )}
    </div>
  );
}

const SOURCE_KINDS = new Set(['physical_table', 'view']);

export default function LineageTableView({
  nodes,
  edges,
  selectedNodeId,
  selectedColumn,
  expandedStageId,
  tableTab,
  onTableTabChange,
  showAllOperations,
  onToggleShowAllOperations,
  onNodeSelect,
  onColumnSelect,
  onStageExpand,
}) {
  const pipelineQuery = isPipelineQuery(nodes);
  const sourceNodes = getSourceNodes(nodes);
  const pipelineStages = topologicalSortStages(nodes, edges);
  const operations = getJoinOperations(nodes, edges);
  const outputNode = getOutputNode(nodes);

  const columnHighlight = useMemo(() => {
    if (!selectedColumn || !selectedNodeId) return null;
    return getColumnLineageHighlight(selectedNodeId, selectedColumn, nodes, edges);
  }, [selectedColumn, selectedNodeId, nodes, edges]);

  const expandedStage = nodes.find((n) => n.id === expandedStageId);

  const tabs = [
    { id: TABLE_TABS.SOURCES, label: 'Sources' },
    { id: TABLE_TABS.PIPELINE, label: 'Pipeline' },
    { id: TABLE_TABS.OPERATIONS, label: 'Operations' },
    { id: TABLE_TABS.OUTPUT, label: 'Output' },
  ];

  const visibleOperations = useMemo(() => {
    let ops = operations;
    if (selectedColumn && columnHighlight) {
      ops = filterOperationsForColumn(ops, columnHighlight);
    } else if (!showAllOperations && expandedStageId) {
      ops = filterOperationsForStage(ops, expandedStageId);
    }
    return ops;
  }, [
    operations,
    selectedColumn,
    columnHighlight,
    showAllOperations,
    expandedStageId,
  ]);

  const sourcesRows = sourceNodes.map((n) => {
    const id = n.id;
    const dimmed = columnHighlight && !isNodeInColumnPath(id, columnHighlight);
    const usedIn = pipelineStages
      .filter((s) => getSourcesUsedInStage(s.id, nodes, edges).includes(n.data?.label || id))
      .map((s) => s.data?.label || s.id);

    return {
      key: id,
      selected: selectedNodeId === id,
      dimmed,
      onClick: () => onNodeSelect(id),
      cells: {
        name: (
          <span style={{ fontWeight: '600' }}>{n.data?.label || id}</span>
        ),
        kind: <KindBadge kind={n.data?.kind} />,
        qualified: n.data?.qualified_name || '—',
        columns: (n.data?.columns?.length || 0) > 0
          ? n.data.columns.join(', ')
          : '—',
        usedIn: usedIn.length > 0 ? usedIn.join(', ') : '—',
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
      selected: expandedStageId === id || selectedNodeId === id,
      dimmed,
      onClick: () => {
        onStageExpand(id);
        onNodeSelect(id);
      },
      cells: {
        step: index + 1,
        name: (
          <span style={{ fontWeight: '600' }}>{n.data?.label || id}</span>
        ),
        kind: <KindBadge kind={n.data?.kind} />,
        columns: colCount > 0 ? colCount : '—',
        ops: summary,
      },
    };
  });

  const operationsRows = visibleOperations.map((op) => {
    const dimmed =
      columnHighlight &&
      !isNodeInColumnPath(op.id, columnHighlight) &&
      !op.operands.some((o) => isNodeInColumnPath(o.id, columnHighlight)) &&
      !(op.branches || []).some((b) => isNodeInColumnPath(b.tail_id, columnHighlight));

    const leftLabel =
      op.opKind === 'union'
        ? op.branches?.map((b) => `B${b.index + 1}: ${b.label}`).join(', ') || '—'
        : op.left?.label || '—';
    const rightLabel = op.opKind === 'union' ? '—' : op.right?.label || '—';
    const onLabel =
      op.opKind === 'union'
        ? `${op.branchCount || op.branches?.length || 0} branches`
        : op.conditions[0] || '—';

    return {
      key: op.id,
      selected: selectedNodeId === op.id,
      dimmed,
      onClick: () => onNodeSelect(op.id),
      cells: {
        stage: op.stageLabel,
        op: op.opType,
        left: leftLabel,
        right: rightLabel,
        on: onLabel,
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
        if (outputNode) {
          onColumnSelect(outputNode.id, colName);
        }
      },
      cells: {
        column: (
          <span style={{ fontWeight: '600' }}>{colName}</span>
        ),
        sources: getColumnSourcesText(entry),
        trace: (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (outputNode) onColumnSelect(outputNode.id, colName);
            }}
            style={{
              fontSize: '11px',
              padding: '4px 8px',
              border: `1px solid ${theme.primary}`,
              borderRadius: '4px',
              background: isSelected ? theme.primary : 'white',
              color: isSelected ? 'white' : theme.primary,
              cursor: 'pointer',
            }}
          >
            Trace
          </button>
        ),
      },
    };
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: theme.bg,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '8px 12px',
          borderBottom: `1px solid ${theme.border}`,
          background: 'white',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTableTabChange(tab.id)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '600',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              background: tableTab === tab.id ? '#eff6ff' : 'transparent',
              color: tableTab === tab.id ? theme.primary : theme.textMuted,
            }}
          >
            {tab.label}
          </button>
        ))}
        {pipelineQuery && tableTab === TABLE_TABS.PIPELINE && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '11px',
              color: theme.textMuted,
            }}
          >
            Pipeline query — {pipelineStages.length} stages
          </span>
        )}
        {tableTab === TABLE_TABS.OPERATIONS && (
          <button
            type="button"
            onClick={onToggleShowAllOperations}
            style={{
              marginLeft: 'auto',
              fontSize: '11px',
              padding: '4px 10px',
              border: `1px solid ${theme.border}`,
              borderRadius: '6px',
              background: showAllOperations ? '#eff6ff' : 'white',
              color: showAllOperations ? theme.primary : theme.textMuted,
              cursor: 'pointer',
            }}
          >
            {showAllOperations ? 'All stages' : 'Current stage only'}
          </button>
        )}
        {selectedColumn && (
          <span style={{ fontSize: '11px', color: theme.textMuted, marginLeft: '8px' }}>
            Tracing <strong>{selectedColumn}</strong>
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {tableTab === TABLE_TABS.SOURCES && (
          <DataTable
            columns={[
              { key: 'name', label: 'Table' },
              { key: 'kind', label: 'Kind' },
              { key: 'qualified', label: 'Qualified name' },
              { key: 'columns', label: 'Columns' },
              { key: 'usedIn', label: 'Used in stages' },
            ]}
            rows={sourcesRows}
            emptyMessage="No source tables in this query."
          />
        )}

        {tableTab === TABLE_TABS.PIPELINE && (
          <DataTable
            columns={[
              { key: 'step', label: '#' },
              { key: 'name', label: 'Stage' },
              { key: 'kind', label: 'Type' },
              { key: 'columns', label: 'Cols' },
              { key: 'ops', label: 'Operations' },
            ]}
            rows={pipelineRows}
            emptyMessage="No pipeline stages — output is a simple SELECT."
          />
        )}

        {tableTab === TABLE_TABS.OPERATIONS && (
          <DataTable
            columns={[
              { key: 'stage', label: 'Stage' },
              { key: 'op', label: 'Operation' },
              { key: 'left', label: 'Left' },
              { key: 'right', label: 'Right' },
              { key: 'on', label: 'Condition' },
            ]}
            rows={operationsRows}
            emptyMessage="No join or union operations in this query."
          />
        )}

        {tableTab === TABLE_TABS.OUTPUT && (
          <DataTable
            columns={[
              { key: 'column', label: 'Output column' },
              { key: 'sources', label: 'Source refs' },
              { key: 'trace', label: '' },
            ]}
            rows={outputRows}
            emptyMessage="No output columns — parse a query first."
          />
        )}
      </div>

      {(tableTab === TABLE_TABS.PIPELINE && expandedStage) && (
          <StageDetailPanel
            stageNode={expandedStage}
            operations={operations}
            nodes={nodes}
            edges={edges}
            selectedColumn={selectedColumn}
            columnHighlight={columnHighlight}
          />
        )}

      {tableTab === TABLE_TABS.SOURCES && selectedNodeId && (
        (() => {
          const sourceNode = nodes.find((n) => n.id === selectedNodeId);
          if (!sourceNode || !SOURCE_KINDS.has(sourceNode.data?.kind)) return null;
          const cols = sourceNode.data?.columns || [];
          return (
            <div
              style={{
                borderTop: `1px solid ${theme.border}`,
                background: theme.headerBg,
                padding: '12px 16px',
              }}
            >
              <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '8px' }}>
                {sourceNode.data?.label || selectedNodeId}
              </div>
              {cols.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {cols.map((col) => (
                    <span
                      key={col}
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: theme.cardBg,
                        border: `1px solid ${theme.border}`,
                      }}
                    >
                      {col}
                    </span>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: '12px', color: theme.textMuted }}>
                  No column list from parse — catalog enrichment may add columns later.
                </span>
              )}
            </div>
          );
        })()
      )}
    </div>
  );
}

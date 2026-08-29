import {
  TABLE_TABS,
  SOURCE_KINDS,
  STAGE_KINDS,
} from './lineageTableModel';

/**
 * What the table-mode right panel should show for the current tab + selection.
 * Returns null when the panel is hidden.
 */
export function resolveTableInspector({
  activeTab,
  selectedNodeId,
  selectedColumn,
  nodes = [],
  operations = [],
  outputNode = null,
}) {
  if (activeTab === TABLE_TABS.SOURCES) {
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node || !SOURCE_KINDS.has(node.data?.kind)) return null;
    return {
      variant: 'source',
      node,
      column: selectedColumn || null,
    };
  }

  if (activeTab === TABLE_TABS.PIPELINE) {
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node || !STAGE_KINDS.has(node.data?.kind)) return null;
    return {
      variant: 'stage',
      node,
      column: selectedColumn || null,
    };
  }

  if (activeTab === TABLE_TABS.OPERATIONS) {
    const op = operations.find((o) => o.id === selectedNodeId);
    if (op) {
      const parentStage = nodes.find((n) => n.id === op.stageId);
      return { variant: 'operation', op, node: parentStage };
    }
    const stageNode = nodes.find((n) => n.id === selectedNodeId);
    if (stageNode && STAGE_KINDS.has(stageNode.data?.kind)) {
      return { variant: 'stage', node: stageNode, column: selectedColumn || null };
    }
    return null;
  }

  if (activeTab === TABLE_TABS.OUTPUT) {
    if (!selectedColumn || !outputNode || selectedNodeId !== outputNode.id) {
      return null;
    }
    return {
      variant: 'column-path',
      node: outputNode,
      column: selectedColumn,
    };
  }

  return null;
}

import { describe, expect, it } from 'vitest';
import { TABLE_TABS } from './lineageTableModel';
import { resolveTableInspector } from './lineageTableInspector';

const regions = { id: 'regions', data: { kind: 'physical_table', label: 'regions' } };
const cte = { id: 'RegionalStorePerformance', data: { kind: 'cte', label: 'RegionalStorePerformance' } };
const output = {
  id: 'Final_Output',
  data: { kind: 'final_output', label: 'Final_Output', column_lineage: [{ name: 'store_revenue' }] },
};
const joinOp = { id: 'join_RegionalStorePerformance_1', opKind: 'join' };

const nodes = [regions, cte, output];

describe('resolveTableInspector', () => {
  it('Sources: table row opens source panel', () => {
    expect(
      resolveTableInspector({
        activeTab: TABLE_TABS.SOURCES,
        selectedNodeId: 'regions',
        nodes,
      })
    ).toMatchObject({ variant: 'source', node: regions, column: null });
  });

  it('Sources: stage selection hides panel', () => {
    expect(
      resolveTableInspector({
        activeTab: TABLE_TABS.SOURCES,
        selectedNodeId: 'RegionalStorePerformance',
        nodes,
      })
    ).toBeNull();
  });

  it('Pipeline: stage row opens stage panel', () => {
    expect(
      resolveTableInspector({
        activeTab: TABLE_TABS.PIPELINE,
        selectedNodeId: 'RegionalStorePerformance',
        nodes,
      })
    ).toMatchObject({ variant: 'stage', node: cte });
  });

  it('Pipeline: default expanded stage without selection hides panel', () => {
    expect(
      resolveTableInspector({
        activeTab: TABLE_TABS.PIPELINE,
        selectedNodeId: null,
        nodes,
      })
    ).toBeNull();
  });

  it('Operations: join row opens operation panel', () => {
    expect(
      resolveTableInspector({
        activeTab: TABLE_TABS.OPERATIONS,
        selectedNodeId: joinOp.id,
        operations: [joinOp],
        nodes,
      })
    ).toMatchObject({ variant: 'operation', op: joinOp });
  });

  it('Output: output column opens path panel', () => {
    expect(
      resolveTableInspector({
        activeTab: TABLE_TABS.OUTPUT,
        selectedNodeId: 'Final_Output',
        selectedColumn: 'store_revenue',
        outputNode: output,
        nodes,
      })
    ).toMatchObject({ variant: 'column-path', column: 'store_revenue' });
  });

  it('Output: column traced from a CTE does not open the output panel', () => {
    expect(
      resolveTableInspector({
        activeTab: TABLE_TABS.OUTPUT,
        selectedNodeId: 'RegionalStorePerformance',
        selectedColumn: 'store_revenue',
        outputNode: output,
        nodes,
      })
    ).toBeNull();
  });
});

/** Minimal lineage graphs for unit tests (not API fixtures). */

export const simpleChainNodes = [
  { id: 'users', type: 'tableNode', data: { label: 'users', kind: 'physical_table' } },
  { id: 'join_1', type: 'joinNode', data: { kind: 'join', label: 'INNER JOIN' } },
  { id: 'cte1', type: 'tableNode', data: { label: 'cte1', kind: 'cte', columns: ['id'] } },
  {
    id: 'Final_Output',
    type: 'tableNode',
    data: {
      label: 'Final View Output',
      kind: 'final_output',
      columns: ['department_path', 'id'],
      column_lineage: [
        { name: 'department_path', sources: ['d.department_name', 'dh.department_path'] },
        { name: 'id', sources: ['users.id'] },
      ],
    },
  },
];

export const simpleChainEdges = [
  { id: 'e_users_join', source: 'users', target: 'join_1' },
  { id: 'e_join_cte', source: 'join_1', target: 'cte1' },
  { id: 'e_cte_out', source: 'cte1', target: 'Final_Output' },
];

/** Two-CTE pipeline for compound graph tests. */
export const pipelineNodes = [
  { id: 'departments', type: 'tableNode', data: { label: 'departments', kind: 'physical_table', alias: 'd' } },
  { id: 'employees', type: 'tableNode', data: { label: 'employees', kind: 'physical_table', alias: 'e' } },
  { id: 'join_cte_a_1', type: 'joinNode', data: { kind: 'join', label: 'INNER JOIN' } },
  { id: 'cte_a', type: 'tableNode', data: { label: 'cte_a', kind: 'cte', columns: ['a', 'b'] } },
  { id: 'orders', type: 'tableNode', data: { label: 'orders', kind: 'physical_table', alias: 'o' } },
  { id: 'join_cte_b_1', type: 'joinNode', data: { kind: 'join', label: 'LEFT JOIN' } },
  { id: 'cte_b', type: 'tableNode', data: { label: 'cte_b', kind: 'cte', columns: ['x'] } },
  { id: 'join_final_1', type: 'joinNode', data: { kind: 'join', label: 'INNER JOIN' } },
  {
    id: 'Final_Output',
    type: 'tableNode',
    data: { label: 'Final View Output', kind: 'final_output', columns: ['out_col'] },
  },
];

export const pipelineEdges = [
  { id: 'e1', source: 'departments', target: 'join_cte_a_1' },
  { id: 'e2', source: 'employees', target: 'join_cte_a_1' },
  { id: 'e3', source: 'join_cte_a_1', target: 'cte_a' },
  { id: 'e4', source: 'cte_a', target: 'join_cte_b_1' },
  { id: 'e5', source: 'orders', target: 'join_cte_b_1' },
  { id: 'e6', source: 'join_cte_b_1', target: 'cte_b' },
  { id: 'e7', source: 'cte_a', target: 'join_final_1' },
  { id: 'e8', source: 'cte_b', target: 'join_final_1' },
  { id: 'e9', source: 'join_final_1', target: 'Final_Output' },
];

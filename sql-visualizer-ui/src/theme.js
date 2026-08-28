export const theme = {
  bg: '#f8fafc',
  cardBg: '#ffffff',
  border: '#e2e8f0',
  headerBg: '#f1f5f9',
  textMain: '#0f172a',
  textMuted: '#64748b',
  primary: '#3b82f6',
  joinBg: '#f59e0b',
  unionBg: '#6366f1',
  highlight: '#fbbf24',
};

export const minimapNodeColor = (node) => {
  if (node.data?.isSearchMatch) return '#fbbf24';
  if (node.type === 'joinNode') return '#fcd34d';
  if (node.type === 'unionNode') return '#a5b4fc';
  if (node.id === 'Final_Output') return '#93c5fd';
  return '#94a3b8';
};

export const minimapNodeStrokeColor = (node) => {
  if (node.data?.isSearchMatch) return '#d97706';
  if (node.type === 'joinNode') return '#f59e0b';
  if (node.type === 'unionNode') return '#6366f1';
  if (node.id === 'Final_Output') return '#2563eb';
  return '#475569';
};

export const kindLabels = {
  physical_table: 'TABLE',
  cte: 'CTE',
  subquery: 'SUBQUERY',
  view: 'VIEW',
  final_output: 'OUTPUT',
  insert_target: 'INSERT',
  merge_target: 'MERGE',
  join: 'JOIN',
  union: 'UNION',
};

export const kindColors = {
  physical_table: theme.textMuted,
  cte: '#6366f1',
  subquery: '#8b5cf6',
  view: '#0ea5e9',
  final_output: theme.primary,
  insert_target: '#10b981',
  merge_target: '#ec4899',
  join: theme.joinBg,
  union: theme.unionBg,
};

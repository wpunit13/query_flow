/**
 * Frontend Performance & Micro-Benchmark Suite for QueryFlow (sql-visualizer-ui)
 * Runs natively via Vitest without modifying any application source files.
 */

import { describe, it } from 'vitest';
import { performance } from 'perf_hooks';
import { getLayoutedElements, adjustLayoutForExpandedToggle, getNodeDimensions, LAYOUT_MODES } from '../utils/dagreLayout';
import {
  getColumnLineageHighlight,
  getColumnTraceSummary,
  getBreadcrumbPath,
  getUpstreamNodes,
  getDownstreamNodes,
  getBranchFilterVisibleIds,
} from '../utils/lineagePath';
import { buildStageGroupMeta } from '../utils/compoundGraphModel';
import { buildCompoundGraphDisplay } from '../utils/compoundGraphLayout';
import { getAllOperations, getStageOperationSummary, TABLE_TABS } from '../utils/lineageTableModel';
import { resolveTableInspector } from '../utils/lineageTableInspector';
import { computeSearchMatches, getSearchVisibilityIds } from '../utils/searchGraph';
import {
  persistLineageSession,
  readLineageSessionMeta,
  isLargeStoredSql,
} from '../utils/lineageSession';

// --- Synthetic Graph Generator ---
function generateSyntheticGraph(nodeCount, colsPerTable = 8) {
  const nodes = [];
  const edges = [];
  const cteCount = Math.max(1, Math.floor(nodeCount / 4));

  // Physical tables
  for (let i = 0; i < cteCount; i++) {
    const cols = Array.from({ length: colsPerTable }, (_, c) => `col_${c}`);
    nodes.push({
      id: `raw_table_${i}`,
      type: 'tableNode',
      data: {
        label: `raw_source_${i}`,
        kind: 'physical_table',
        columns: cols,
      },
    });
  }

  // CTE nodes and Joins
  for (let i = 0; i < cteCount; i++) {
    const cteId = `cte_stage_${i}`;
    const joinId = `join_${cteId}_1`;
    nodes.push({
      id: joinId,
      type: 'joinNode',
      data: { kind: 'join', label: i % 2 === 0 ? 'INNER JOIN' : 'LEFT JOIN' },
    });

    const cols = Array.from({ length: colsPerTable }, (_, c) => `transformed_col_${c}`);
    const colLineage = cols.map((col, idx) => ({
      name: col,
      sources: [`raw_source_${i % cteCount}.col_${idx % colsPerTable}`],
    }));

    nodes.push({
      id: cteId,
      type: 'tableNode',
      data: {
        label: `cte_stage_${i}`,
        kind: 'cte',
        columns: cols,
        column_lineage: colLineage,
      },
    });

    const srcTableId = `raw_table_${i % cteCount}`;
    edges.push({ id: `e_raw_${i}`, source: srcTableId, target: joinId });
    edges.push({ id: `e_join_${i}`, source: joinId, target: cteId });

    if (i > 0) {
      const prevCteId = `cte_stage_${i - 1}`;
      edges.push({ id: `e_chain_${i}`, source: prevCteId, target: joinId });
    }
  }

  // Final Output node
  const finalCols = Array.from({ length: colsPerTable * 2 }, (_, c) => `final_metric_${c}`);
  nodes.push({
    id: 'final_output',
    type: 'tableNode',
    data: {
      label: 'final_view',
      kind: 'final_output',
      columns: finalCols,
      column_lineage: finalCols.map((c, idx) => ({
        name: c,
        sources: [`cte_stage_${idx % cteCount}.transformed_col_${idx % colsPerTable}`],
      })),
    },
  });

  const lastCteId = `cte_stage_${cteCount - 1}`;
  edges.push({ id: 'e_final', source: lastCteId, target: 'final_output' });

  return { nodes, edges };
}

function runBenchmark(name, fn, minRuns = 20) {
  for (let i = 0; i < 5; i++) fn(); // warmup

  const latencies = [];
  const start = performance.now();
  let iterations = 0;

  while (performance.now() - start < 100 || iterations < minRuns) {
    const t0 = performance.now();
    fn();
    const t1 = performance.now();
    latencies.push(t1 - t0);
    iterations++;
  }

  latencies.sort((a, b) => a - b);
  const total = latencies.reduce((sum, v) => sum + v, 0);
  const avg = total / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const opsSec = (iterations / (total / 1000)).toFixed(0);

  return {
    name,
    opsSec: Number(opsSec).toLocaleString(),
    avgMs: avg.toFixed(3),
    p50Ms: p50.toFixed(3),
    p95Ms: p95.toFixed(3),
  };
}

describe('Frontend Performance & Micro-Benchmarks', () => {
  it('measures layout, traversal, and state throughput', () => {
    const smallGraph = generateSyntheticGraph(8, 4);
    const mediumGraph = generateSyntheticGraph(28, 8);
    const largeGraph = generateSyntheticGraph(80, 12);
    const stressGraph = generateSyntheticGraph(200, 16);

    const results = [];

    // 1. Dagre Layout Engine
    results.push(runBenchmark('Dagre Layout (Small: 8 nodes, TB)', () => {
      getLayoutedElements(smallGraph.nodes, smallGraph.edges, LAYOUT_MODES.TB);
    }));
    results.push(runBenchmark('Dagre Layout (Medium: 28 nodes, TB)', () => {
      getLayoutedElements(mediumGraph.nodes, mediumGraph.edges, LAYOUT_MODES.TB);
    }));
    results.push(runBenchmark('Dagre Layout (Large: 80 nodes, TB)', () => {
      getLayoutedElements(largeGraph.nodes, largeGraph.edges, LAYOUT_MODES.TB);
    }));
    results.push(runBenchmark('Dagre Layout (Stress: 200 nodes, TB)', () => {
      getLayoutedElements(stressGraph.nodes, stressGraph.edges, LAYOUT_MODES.TB);
    }));

    const layoutedMedium = getLayoutedElements(mediumGraph.nodes, mediumGraph.edges, LAYOUT_MODES.TB);
    results.push(runBenchmark('Node Expansion Layout Adjust', () => {
      adjustLayoutForExpandedToggle(layoutedMedium.nodes, layoutedMedium.edges, layoutedMedium.nodes[2].id, LAYOUT_MODES.TB);
    }));

    results.push(runBenchmark('Dynamic Node Dimensions', () => {
      for (const node of mediumGraph.nodes) getNodeDimensions(node);
    }));

    // 2. Lineage Path & Traversal
    results.push(runBenchmark('Column Lineage Highlight Traversal', () => {
      getColumnLineageHighlight('final_output', 'final_metric_0', largeGraph.nodes, largeGraph.edges);
    }));
    results.push(runBenchmark('Column Trace Summary', () => {
      getColumnTraceSummary('final_output', 'final_metric_0', largeGraph.nodes, largeGraph.edges);
    }));
    results.push(runBenchmark('Breadcrumb Path Calculation', () => {
      getBreadcrumbPath('final_output', largeGraph.nodes, largeGraph.edges);
    }));
    results.push(runBenchmark('Branch Filter Subgraph Indexing', () => {
      getBranchFilterVisibleIds(largeGraph.nodes, largeGraph.edges, 'cte_stage_5');
    }));
    results.push(runBenchmark('Graph Upstream BFS Traversal', () => {
      getUpstreamNodes('final_output', largeGraph.edges);
    }));
    results.push(runBenchmark('Graph Downstream BFS Traversal', () => {
      getDownstreamNodes('raw_table_0', largeGraph.edges);
    }));

    // 3. Compound Graph
    results.push(runBenchmark('Build Stage Group Meta (80 nodes)', () => {
      buildStageGroupMeta(largeGraph.nodes, largeGraph.edges);
    }));
    results.push(runBenchmark('Compound Graph Display Build', () => {
      buildCompoundGraphDisplay({
        nodes: largeGraph.nodes,
        edges: largeGraph.edges,
        expandedStages: new Set(['cte_stage_0']),
        layoutMode: LAYOUT_MODES.TB,
      });
    }));

    // 4. Tabular Model & Search
    results.push(runBenchmark('CTE Operations Parsing (Large)', () => {
      getAllOperations(largeGraph.nodes, largeGraph.edges);
    }));
    const operations = getAllOperations(largeGraph.nodes, largeGraph.edges);
    results.push(runBenchmark('Stage Operation Summarizer', () => {
      getStageOperationSummary('cte_stage_0', operations);
    }));
    results.push(runBenchmark('Table Inspector Resolution', () => {
      resolveTableInspector({
        tab: TABLE_TABS.STAGES,
        selectedNodeId: 'cte_stage_0',
        nodes: largeGraph.nodes,
        edges: largeGraph.edges,
      });
    }));
    results.push(runBenchmark('Search Match ("metric")', () => {
      computeSearchMatches(largeGraph.nodes, 'metric');
    }));
    const matches = computeSearchMatches(largeGraph.nodes, 'metric');
    results.push(runBenchmark('Search Visibility Neighborhood BFS', () => {
      getSearchVisibilityIds(matches, largeGraph.edges);
    }));

    // 5. Session Storage
    const sampleSql = 'WITH cte_1 AS (SELECT id FROM users) SELECT * FROM cte_1';
    results.push(runBenchmark('Session Persistence', () => {
      persistLineageSession({
        sql: sampleSql,
        viewMode: 'graph',
        tableTab: TABLE_TABS.STAGES,
        studioMode: 'studio',
      });
    }));
    results.push(runBenchmark('Session Metadata Read', () => {
      readLineageSessionMeta();
    }));
    results.push(runBenchmark('Large SQL Check', () => {
      isLargeStoredSql(sampleSql);
    }));

    // Print summary table to console
    console.log('\n┌──────────────────────────────────────────────┬──────────────┬──────────────┬──────────────┬──────────────┐');
    console.log('│ Benchmark Operation                          │ Ops / sec    │ Avg Latency  │ p50 Latency  │ p95 Latency  │');
    console.log('├──────────────────────────────────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤');
    for (const r of results) {
      const name = r.name.padEnd(44);
      const ops = r.opsSec.padStart(12);
      const avg = `${r.avgMs} ms`.padStart(12);
      const p50 = `${r.p50Ms} ms`.padStart(12);
      const p95 = `${r.p95Ms} ms`.padStart(12);
      console.log(`│ ${name} │ ${ops} │ ${avg} │ ${p50} │ ${p95} │`);
    }
    console.log('└──────────────────────────────────────────────┴──────────────┴──────────────┴──────────────┴──────────────┘\n');
  });
});

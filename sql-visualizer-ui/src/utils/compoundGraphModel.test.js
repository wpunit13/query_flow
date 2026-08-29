import { describe, expect, it } from 'vitest';
import {
  fromStageGroupId,
  getInternalNodesForStage,
  isCompoundDisplayEdgeHighlighted,
  isStageGroupNodeId,
  mapHighlightToCompoundDisplay,
  toStageGroupId,
} from './compoundGraphModel';
import { pipelineEdges, pipelineNodes } from '../test/fixtures/lineageGraph';

describe('stage group id helpers', () => {
  it('round-trips stage group ids', () => {
    expect(toStageGroupId('cte_a')).toBe('stage_group_cte_a');
    expect(fromStageGroupId('stage_group_cte_a')).toBe('cte_a');
    expect(fromStageGroupId('cte_a')).toBeNull();
    expect(isStageGroupNodeId('stage_group_cte_a')).toBe(true);
    expect(isStageGroupNodeId('cte_a')).toBe(false);
  });
});

describe('getInternalNodesForStage', () => {
  it('includes tables and joins inside a CTE but not other CTE outputs', () => {
    const internal = getInternalNodesForStage('cte_a', pipelineNodes, pipelineEdges);
    expect(internal.has('cte_a')).toBe(true);
    expect(internal.has('departments')).toBe(true);
    expect(internal.has('employees')).toBe(true);
    expect(internal.has('join_cte_a_1')).toBe(true);
    expect(internal.has('cte_b')).toBe(false);
    expect(internal.has('Final_Output')).toBe(false);
  });
});

describe('mapHighlightToCompoundDisplay', () => {
  it('maps stage ids to stage group boxes when collapsed', () => {
    const display = mapHighlightToCompoundDisplay(
      new Set(['cte_a', 'cte_b']),
      pipelineNodes,
      pipelineEdges,
      new Set()
    );
    expect(display.has('stage_group_cte_a')).toBe(true);
    expect(display.has('stage_group_cte_b')).toBe(true);
    expect(display.has('cte_a')).toBe(false);
  });

  it('includes internal node ids when stage is expanded', () => {
    const display = mapHighlightToCompoundDisplay(
      new Set(['departments']),
      pipelineNodes,
      pipelineEdges,
      new Set(['cte_a'])
    );
    expect(display.has('departments')).toBe(true);
    expect(display.has('stage_group_cte_a')).toBe(true);
  });
});

describe('isCompoundDisplayEdgeHighlighted', () => {
  it('highlights when both endpoints are in display set', () => {
    const edge = { id: 'compound_e1', source: 'stage_group_cte_a', target: 'stage_group_cte_b' };
    const displayIds = new Set(['stage_group_cte_a', 'stage_group_cte_b']);
    expect(isCompoundDisplayEdgeHighlighted(edge, new Set(), displayIds)).toBe(true);
  });

  it('highlights via flat edge id when prefixed with compound_', () => {
    const edge = { id: 'compound_e3', source: 'a', target: 'b' };
    const highlightEdges = new Set(['e3']);
    expect(isCompoundDisplayEdgeHighlighted(edge, highlightEdges, new Set())).toBe(true);
  });

  it('does not highlight unrelated display edges', () => {
    const edge = { id: 'stage_group_cte_a-stage_group_Final_Output', source: 'stage_group_cte_a', target: 'stage_group_Final_Output' };
    const highlightEdges = new Set(['e1']);
    const displayIds = new Set(['stage_group_cte_a', 'stage_group_Final_Output']);
    // Both nodes in display set — macro edge between stages is highlighted
    expect(isCompoundDisplayEdgeHighlighted(edge, highlightEdges, displayIds)).toBe(true);
  });
});

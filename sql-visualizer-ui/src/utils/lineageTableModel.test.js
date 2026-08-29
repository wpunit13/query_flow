import { describe, expect, it } from 'vitest';
import { getAllOperations, getStageOperationSummary } from './lineageTableModel';

describe('lineageTableModel', () => {
  describe('getAllOperations', () => {
    it('should extract clause operations (WHERE, GROUP BY, HAVING, QUALIFY) from stage nodes', () => {
      const nodes = [
        {
          id: 'stage_1',
          type: 'tableNode',
          data: {
            label: 'Stage_1',
            where_clause: 'id > 10',
            group_by: ['category', 'region'],
            having_clause: 'count(*) > 5',
            qualify_clause: 'ROW_NUMBER() OVER(PARTITION BY region ORDER BY revenue DESC) = 1',
          },
        },
      ];

      const ops = getAllOperations(nodes, []);

      expect(ops).toHaveLength(4);

      // Verify order and extraction
      expect(ops[0]).toMatchObject({
        opKind: 'where',
        opType: 'WHERE',
        stageId: 'stage_1',
        detail: 'id > 10',
        order: 100,
      });

      expect(ops[1]).toMatchObject({
        opKind: 'group_by',
        opType: 'GROUP BY',
        stageId: 'stage_1',
        detail: 'category, region',
        order: 200,
      });

      expect(ops[2]).toMatchObject({
        opKind: 'having',
        opType: 'HAVING',
        stageId: 'stage_1',
        detail: 'count(*) > 5',
        order: 300,
      });

      expect(ops[3]).toMatchObject({
        opKind: 'qualify',
        opType: 'QUALIFY',
        stageId: 'stage_1',
        detail: 'ROW_NUMBER() OVER(PARTITION BY region ORDER BY revenue DESC) = 1',
        order: 400,
      });
    });

    it('should extract and sort join and union operations alongside clause operations', () => {
      const nodes = [
        {
          id: 'stage_1',
          data: { label: 'Stage_1', where_clause: 'id = 1' },
        },
        {
          id: 'join_stage_1_150',
          type: 'joinNode',
          data: { join_type: 'LEFT JOIN' },
        },
      ];
      
      const ops = getAllOperations(nodes, []);

      expect(ops).toHaveLength(2);
      
      // Where (order 100) should come before join (order 150)
      expect(ops[0].opKind).toBe('where');
      expect(ops[1].opKind).toBe('join');
    });
  });

  describe('getStageOperationSummary', () => {
    it('should summarize unions and joins', () => {
      const ops = [
        { stageId: 's1', opKind: 'join', opType: 'LEFT JOIN' },
        { stageId: 's1', opKind: 'join', opType: 'INNER JOIN' },
        { stageId: 's1', opKind: 'union', opType: 'UNION ALL' },
      ];
      const summary = getStageOperationSummary('s1', ops);
      expect(summary).toBe('1 union(s): UNION ALL; 2 join(s): LEFT JOIN, INNER JOIN');
    });

    it('should summarize clause filters (where, group by, having, qualify)', () => {
      const ops = [
        { stageId: 's2', opKind: 'where' },
        { stageId: 's2', opKind: 'group_by' },
        { stageId: 's2', opKind: 'having' },
        { stageId: 's2', opKind: 'qualify' },
      ];
      const summary = getStageOperationSummary('s2', ops);
      expect(summary).toBe('Where filter; Group By; Having filter; Qualify');
    });

    it('should return "—" for empty operations', () => {
      expect(getStageOperationSummary('s3', [])).toBe('—');
    });
  });
});

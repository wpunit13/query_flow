import { describe, expect, it } from 'vitest';
import {
  annotateJoinCondition,
  aliasesReferencedInCondition,
  buildAliasLegend,
  buildAliasMap,
  collectAliasEntriesFromOperands,
  formatJoinStepDetail,
  formatJoinStepLine,
  formatOperandDisplay,
  formatTableAliasPhrase,
  parseAliasFromOperandLabel,
} from './joinLabelUtils';

describe('parseAliasFromOperandLabel', () => {
  it('parses alias (table) format', () => {
    expect(parseAliasFromOperandLabel('p (products)')).toEqual({
      alias: 'p',
      table: 'products',
    });
  });

  it('returns same value when no parentheses', () => {
    expect(parseAliasFromOperandLabel('users')).toEqual({
      alias: 'users',
      table: 'users',
    });
  });

  it('handles empty label', () => {
    expect(parseAliasFromOperandLabel('')).toEqual({ alias: '—', table: '—' });
  });
});

describe('formatOperandDisplay', () => {
  it('detects nested join label', () => {
    const display = formatOperandDisplay('INNER JOIN: p (products) + c (cats)');
    expect(display.nested).toBe(true);
    expect(display.table).toContain('p (products)');
  });

  it('shows alias when different from table', () => {
    const display = formatOperandDisplay('roh (RecursiveDepartmentHierarchy)');
    expect(display.alias).toBe('roh');
    expect(display.table).toBe('RecursiveDepartmentHierarchy');
  });

  it('hides alias when same as table name', () => {
    const display = formatOperandDisplay('users');
    expect(display.alias).toBeNull();
    expect(display.table).toBe('users');
  });
});

describe('formatJoinStepLine', () => {
  it('describes the table being joined in, not a × formula', () => {
    expect(
      formatJoinStepLine({
        opType: 'INNER JOIN',
        right: { label: 's (stores)' },
        conditions: ['s.region_code = r.region_code'],
      })
    ).toBe('INNER JOIN stores (s) ON s.region_code = r.region_code');
  });

  it('ignores nested left-join labels from chained joins', () => {
    expect(
      formatJoinStepLine({
        opType: 'INNER JOIN',
        left: { label: 'INNER JOIN: r (regions) + s (stores)' },
        right: { label: 'sa (store_sales)' },
        conditions: ['sa.store_id = s.store_id'],
      })
    ).toBe('INNER JOIN store_sales (sa) ON sa.store_id = s.store_id');
  });
});

describe('formatJoinStepDetail', () => {
  it('omits join type already shown in the Operation column', () => {
    expect(
      formatJoinStepDetail({
        opType: 'INNER JOIN',
        right: { label: 'sa (store_sales)' },
        conditions: ['sa.store_id = s.store_id'],
      })
    ).toBe('store_sales (sa) ON sa.store_id = s.store_id');
  });
});

describe('formatTableAliasPhrase', () => {
  it('puts table first', () => {
    expect(formatTableAliasPhrase('s (stores)')).toBe('stores (s)');
  });
});

describe('collectAliasEntriesFromOperands', () => {
  it('splits nested join operand labels', () => {
    const entries = collectAliasEntriesFromOperands([
      { label: 'INNER JOIN: p (products) + c (cats)' },
    ]);
    expect(entries).toEqual([
      { alias: 'p', table: 'products' },
      { alias: 'c', table: 'cats' },
    ]);
  });

  it('splits plus-separated labels', () => {
    const entries = collectAliasEntriesFromOperands([
      { label: 'u (users) + o (orders)' },
    ]);
    expect(entries.length).toBe(2);
  });
});

describe('buildAliasLegend', () => {
  it('formats alias → table pairs', () => {
    const legend = buildAliasLegend([
      { label: 'p (products)' },
      { label: 'c (cats)' },
    ]);
    expect(legend).toContain('p → products');
    expect(legend).toContain('c → cats');
  });
});

describe('aliasesReferencedInCondition', () => {
  it('finds aliases used in ON clause', () => {
    const refs = aliasesReferencedInCondition('p.id = c.category_id', [
      { label: 'p (products)' },
      { label: 'c (cats)' },
    ]);
    expect(refs.map((r) => r.alias)).toEqual(expect.arrayContaining(['p', 'c']));
  });
});

describe('buildAliasMap', () => {
  it('merges operands with upstream graph nodes', () => {
    const nodes = [
      { id: 'products', data: { label: 'products', alias: 'p' } },
    ];
    const edges = [{ id: 'e1', source: 'products', target: 'join_1' }];
    const map = buildAliasMap([{ label: 'c (cats)' }], 'join_1', nodes, edges);
    expect(map.get('c')).toBe('cats');
    expect(map.get('p')).toBe('products');
  });
});

describe('annotateJoinCondition', () => {
  it('rewrites alias.column to table (alias).column', () => {
    const result = annotateJoinCondition(
      'p.id = c.category_id',
      [{ label: 'p (products)' }, { label: 'c (cats)' }]
    );
    expect(result).toBe('products (p).id = cats (c).category_id');
  });

  it('returns original when no alias map', () => {
    expect(annotateJoinCondition('a.id = b.id', [])).toBe('a.id = b.id');
  });
});

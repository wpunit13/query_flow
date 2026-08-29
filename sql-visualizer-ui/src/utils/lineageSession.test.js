import { describe, expect, it } from 'vitest';
import { GRAPH_DETAIL_MODES } from '../constants/graphDetailMode';
import { TABLE_TABS, VIEW_MODES } from './lineageTableModel';
import {
  clearLineageSession,
  hasRestorableLineageSession,
  persistLineageSession,
  readInitialSql,
  readInitialStudioMode,
  readInitialTableTab,
  readInitialViewMode,
  readLineageParseResult,
  readLineageSessionMeta,
  readStoredSql,
  resolveGraphDetailModeFromSession,
  shouldAutoRestore,
  shouldPreferTableOverview,
} from './lineageSession';

const CUSTOM_SQL = 'SELECT custom_col FROM my_table';

describe('persistLineageSession', () => {
  it('writes sql and meta to storage', () => {
    const ok = persistLineageSession({
      sql: CUSTOM_SQL,
      dialect: 'bigquery',
      preferTableOverview: false,
      tableTab: TABLE_TABS.SOURCES,
      parseResult: { version: '1.0', nodes: [], edges: [], stats: { node_count: 0, edge_count: 0, parse_ms: 1 } },
    });
    expect(ok).toBe(true);
    expect(readStoredSql()).toBe(CUSTOM_SQL);
    expect(readLineageSessionMeta()).toMatchObject({
      dialect: 'bigquery',
      preferTableOverview: false,
      tableTab: TABLE_TABS.SOURCES,
    });
    expect(readLineageParseResult()?.version).toBe('1.0');
  });

  it('returns false for empty sql', () => {
    expect(persistLineageSession({ sql: '   ' })).toBe(false);
  });

  it('preserves userChoseFlat from previous meta when omitted', () => {
    persistLineageSession({
      sql: CUSTOM_SQL,
      dialect: 'postgres',
      userChoseFlat: true,
    });
    persistLineageSession({
      sql: CUSTOM_SQL,
      dialect: 'postgres',
    });
    expect(readLineageSessionMeta()?.userChoseFlat).toBe(true);
  });
});

describe('clearLineageSession', () => {
  it('removes all session keys', () => {
    persistLineageSession({ sql: CUSTOM_SQL, dialect: 'bigquery' });
    clearLineageSession();
    expect(readStoredSql()).toBeNull();
    expect(readLineageSessionMeta()).toBeNull();
    expect(readLineageParseResult()).toBeNull();
  });
});

describe('hasRestorableLineageSession', () => {
  it('is true when meta exists', () => {
    persistLineageSession({ sql: CUSTOM_SQL, dialect: 'bigquery' });
    expect(hasRestorableLineageSession()).toBe(true);
    expect(shouldAutoRestore()).toBe(true);
  });

  it('is false for default sql without meta', () => {
    clearLineageSession();
    const defaultSql = readInitialSql();
    sessionStorage.setItem('ls_session_sql', defaultSql);
    expect(hasRestorableLineageSession()).toBe(false);
  });
});

describe('readInitialViewMode', () => {
  it('returns TABLE when preferTableOverview is set', () => {
    persistLineageSession({
      sql: CUSTOM_SQL,
      dialect: 'bigquery',
      preferTableOverview: true,
    });
    expect(readInitialViewMode()).toBe(VIEW_MODES.TABLE);
    expect(readInitialStudioMode()).toBe('explore');
  });

  it('returns GRAPH by default for small sql', () => {
    persistLineageSession({
      sql: CUSTOM_SQL,
      dialect: 'bigquery',
      preferTableOverview: false,
    });
    expect(readInitialViewMode()).toBe(VIEW_MODES.GRAPH);
    expect(readInitialStudioMode()).toBe('author');
  });
});

describe('readInitialTableTab', () => {
  it('restores pipeline tab from meta', () => {
    persistLineageSession({
      sql: CUSTOM_SQL,
      dialect: 'bigquery',
      tableTab: TABLE_TABS.PIPELINE,
    });
    expect(readInitialTableTab()).toBe(TABLE_TABS.PIPELINE);
  });

  it('restores output tab from meta', () => {
    persistLineageSession({
      sql: CUSTOM_SQL,
      dialect: 'bigquery',
      tableTab: TABLE_TABS.OUTPUT,
    });
    expect(readInitialTableTab()).toBe(TABLE_TABS.OUTPUT);
  });

  it('defaults large stored sql to output tab', () => {
    clearLineageSession();
    const large = 'x'.repeat(5000);
    sessionStorage.setItem('ls_session_sql', large);
    expect(readInitialTableTab()).toBe(TABLE_TABS.OUTPUT);
  });
});

describe('shouldPreferTableOverview', () => {
  it('uses meta flag', () => {
    expect(
      shouldPreferTableOverview({ preferTableOverview: true }, 'SELECT 1')
    ).toBe(true);
  });

  it('uses large sql heuristic', () => {
    const large = 'x'.repeat(5000);
    expect(shouldPreferTableOverview(null, large)).toBe(true);
  });
});

describe('resolveGraphDetailModeFromSession', () => {
  it('returns FLAT when not compound eligible', () => {
    expect(resolveGraphDetailModeFromSession(false)).toBe(GRAPH_DETAIL_MODES.FLAT);
  });

  it('returns COMPOUND by default when eligible', () => {
    expect(resolveGraphDetailModeFromSession(true)).toBe(GRAPH_DETAIL_MODES.COMPOUND);
  });

  it('returns FLAT when user chose flat graph', () => {
    persistLineageSession({
      sql: CUSTOM_SQL,
      dialect: 'bigquery',
      userChoseFlat: true,
    });
    expect(resolveGraphDetailModeFromSession(true)).toBe(GRAPH_DETAIL_MODES.FLAT);
  });
});

import { GRAPH_DETAIL_MODES } from '../constants/graphDetailMode';
import { TABLE_TABS, VIEW_MODES } from './lineageTableModel';

export const GRAPH_SQL_STORAGE_KEY = 'ls_session_sql';
export const LINEAGE_SESSION_META_KEY = 'ls_lineage_session_meta';
export const LINEAGE_SESSION_RESULT_KEY = 'ls_lineage_session_result';

const DEFAULT_SQL =
  'WITH cte1 AS (SELECT id, name FROM users JOIN orders ON users.id = orders.user_id) SELECT id FROM cte1';

const LARGE_SQL_CHAR_THRESHOLD = 4000;

function stores() {
  const list = [];
  try {
    if (typeof sessionStorage !== 'undefined') list.push(sessionStorage);
  } catch {
    /* ignore */
  }
  try {
    if (typeof localStorage !== 'undefined') list.push(localStorage);
  } catch {
    /* ignore */
  }
  return list;
}

function readJson(key) {
  for (const store of stores()) {
    try {
      const raw = store.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
  }
  return null;
}

function writeJson(key, value) {
  const payload = JSON.stringify(value);
  let anyOk = false;
  for (const store of stores()) {
    try {
      store.setItem(key, payload);
      anyOk = true;
    } catch {
      /* try next store */
    }
  }
  return anyOk;
}

function writeText(key, value) {
  let anyOk = false;
  for (const store of stores()) {
    try {
      store.setItem(key, value);
      anyOk = true;
    } catch {
      /* try next store */
    }
  }
  return anyOk;
}

function readText(key) {
  for (const store of stores()) {
    try {
      const value = store.getItem(key);
      if (typeof value === 'string' && value.trim()) return value;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function readStoredSql() {
  return readText(GRAPH_SQL_STORAGE_KEY);
}

export function readLineageSessionMeta() {
  return readJson(LINEAGE_SESSION_META_KEY);
}

export function shouldAutoRestore() {
  return hasRestorableLineageSession();
}

export function persistLineageSession({
  sql,
  dialect,
  preferTableOverview,
  tableTab,
  userChoseFlat,
  pendingRestore,
  parseResult,
}) {
  if (!sql?.trim()) return false;

  const prev = readLineageSessionMeta() || {};
  const meta = {
    dialect,
    preferTableOverview,
    tableTab,
    pendingRestore: pendingRestore !== undefined ? pendingRestore : true,
    userChoseFlat:
      userChoseFlat !== undefined ? userChoseFlat : prev.userChoseFlat ?? false,
  };

  const sqlOk = writeText(GRAPH_SQL_STORAGE_KEY, sql);
  const metaOk = writeJson(LINEAGE_SESSION_META_KEY, meta);
  let resultOk = true;
  if (parseResult) {
    resultOk = writeJson(LINEAGE_SESSION_RESULT_KEY, parseResult);
  }
  return sqlOk && metaOk && resultOk;
}

export function readLineageParseResult() {
  return readJson(LINEAGE_SESSION_RESULT_KEY);
}

export function clearLineageSession() {
  for (const store of stores()) {
    try {
      store.removeItem(GRAPH_SQL_STORAGE_KEY);
      store.removeItem(LINEAGE_SESSION_META_KEY);
      store.removeItem(LINEAGE_SESSION_RESULT_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function hasRestorableLineageSession() {
  const sql = readStoredSql();
  if (!sql?.trim()) return false;
  if (readLineageSessionMeta()) return true;
  return sql.trim() !== DEFAULT_SQL.trim();
}

export function readInitialSql() {
  return readStoredSql() || DEFAULT_SQL;
}

export function isLargeStoredSql(sql = readStoredSql()) {
  return Boolean(sql && sql.trim().length > LARGE_SQL_CHAR_THRESHOLD);
}

export function readInitialViewMode() {
  const meta = readLineageSessionMeta();
  if (meta?.preferTableOverview) return VIEW_MODES.TABLE;
  if (isLargeStoredSql()) return VIEW_MODES.TABLE;
  return VIEW_MODES.GRAPH;
}

export function readInitialStudioMode() {
  const meta = readLineageSessionMeta();
  if (meta?.preferTableOverview) return 'explore';
  if (isLargeStoredSql()) return 'explore';
  return 'author';
}

export function readInitialTableTab() {
  const meta = readLineageSessionMeta();
  if (meta?.tableTab) {
    return meta.tableTab;
  }
  if (isLargeStoredSql()) return TABLE_TABS.OUTPUT;
  return TABLE_TABS.SOURCES;
}

export function shouldPreferTableOverview(meta = readLineageSessionMeta(), sql = readStoredSql()) {
  if (meta?.preferTableOverview) return true;
  return isLargeStoredSql(sql);
}

export function resolveGraphDetailModeFromSession(isCompoundEligible) {
  if (!isCompoundEligible) return GRAPH_DETAIL_MODES.FLAT;
  const meta = readLineageSessionMeta();
  if (meta?.userChoseFlat) return GRAPH_DETAIL_MODES.FLAT;
  return GRAPH_DETAIL_MODES.COMPOUND;
}

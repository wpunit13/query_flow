import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { parseSql } from '../api/lineageClient';
import { DEFAULT_DIALECT, detectDialect, fetchDialects } from '../api/dialectClient';
import { FALLBACK_DIALECTS } from '../constants/dialects';
import {
  persistLineageSession,
  readLineageParseResult,
  shouldAutoRestore,
  readInitialSql,
  readInitialTableTab,
  readLineageSessionMeta,
  readStoredSql,
  shouldPreferTableOverview,
} from '../utils/lineageSession';

function readInitialDialect() {
  const meta = readLineageSessionMeta();
  return meta?.dialect || DEFAULT_DIALECT;
}

/**
 * SQL text, dialect, API parse, warnings/errors, and session restore.
 * Graph layout/display stays in useLineageGraph via onParseSuccess.
 */
export function useParseLineage({
  embedOptions,
  onBeforeParse,
  onParseSuccess,
  onParseFailed,
  onPrepareSessionRestore,
}) {
  const [sql, setSql] = useState(readInitialSql);
  const [loading, setLoading] = useState(() => shouldAutoRestore());
  const [warnings, setWarnings] = useState([]);
  const [parseError, setParseError] = useState(null);
  const [dialect, setDialect] = useState(readInitialDialect);
  const [dialects, setDialects] = useState(FALLBACK_DIALECTS);
  const [detectingDialect, setDetectingDialect] = useState(false);
  const [detectHint, setDetectHint] = useState('');
  const [lastParseResult, setLastParseResult] = useState(null);
  const [lastParsedSql, setLastParsedSql] = useState(null);

  const sqlEditorRef = useRef(null);
  const sqlRef = useRef(readInitialSql());
  const parseGenerationRef = useRef(0);
  const embedBootstrapped = useRef(false);
  const restoredFromCacheRef = useRef(false);
  const handleParseSqlRef = useRef(null);

  const onBeforeParseRef = useRef(onBeforeParse);
  const onParseSuccessRef = useRef(onParseSuccess);
  const onParseFailedRef = useRef(onParseFailed);
  const onPrepareSessionRestoreRef = useRef(onPrepareSessionRestore);

  onBeforeParseRef.current = onBeforeParse;
  onParseSuccessRef.current = onParseSuccess;
  onParseFailedRef.current = onParseFailed;
  onPrepareSessionRestoreRef.current = onPrepareSessionRestore;

  useEffect(() => {
    fetchDialects()
      .then((list) => setDialects(list))
      .catch(() => setDialects(FALLBACK_DIALECTS));
  }, []);

  const getSqlForAction = useCallback(() => {
    const fromEditor = sqlEditorRef.current?.getValue?.();
    if (typeof fromEditor === 'string' && fromEditor.trim().length > 0) {
      return fromEditor;
    }
    return sqlRef.current;
  }, []);

  const handleParseSql = useCallback(async (sqlOverride) => {
    const parseGeneration = ++parseGenerationRef.current;
    const isStaleParse = () => parseGeneration !== parseGenerationRef.current;

    const sqlToParse =
      typeof sqlOverride === 'string' && sqlOverride.trim().length > 0
        ? sqlOverride
        : getSqlForAction();

    if (sqlToParse !== sqlRef.current) {
      sqlRef.current = sqlToParse;
      setSql(sqlToParse);
    }

    setLoading(true);
    setWarnings([]);
    setParseError(null);
    onBeforeParseRef.current?.();

    try {
      const data = await parseSql(sqlToParse, dialect);
      if (isStaleParse()) return;
      setLastParseResult(data);
      setWarnings(data.warnings || []);
      setLastParsedSql(sqlToParse);
      onParseSuccessRef.current?.(data, sqlToParse);
    } catch (error) {
      if (isStaleParse()) return;
      setWarnings([]);
      onParseFailedRef.current?.(error);
      if (error.name === 'ParseSqlError') {
        setParseError({
          message: error.message,
          errors: error.errors,
          guidance: error.guidance,
        });
      } else {
        setParseError({
          message: error.message || 'Failed to parse SQL',
          errors: [
            {
              message:
                error.message || 'Error parsing SQL. Is your FastAPI server running?',
              line: null,
              column: null,
            },
          ],
        });
      }
      if (!isStaleParse()) {
        setLoading(false);
      }
    }
  }, [dialect, getSqlForAction]);

  handleParseSqlRef.current = handleParseSql;

  const handleDismissParseError = useCallback(() => setParseError(null), []);

  const handleDismissWarnings = useCallback(() => setWarnings([]), []);

  const handleJumpToError = useCallback((line, column) => {
    sqlEditorRef.current?.jumpToLine(line, column);
  }, []);

  const handleSqlChange = useCallback((value) => {
    sqlRef.current = value;
    setSql(value);
    setParseError(null);
    setDetectHint('');
  }, []);

  const handleDialectChange = useCallback((value) => {
    setDialect(value);
    setDetectHint('');
  }, []);

  const handleDetectDialect = useCallback(async () => {
    const sqlToDetect = getSqlForAction();
    if (!sqlToDetect.trim()) return;
    if (sqlToDetect !== sqlRef.current) {
      sqlRef.current = sqlToDetect;
      setSql(sqlToDetect);
    }
    setDetectingDialect(true);
    try {
      const result = await detectDialect(sqlToDetect);
      setDialect(result.dialect);
      const label = dialects.find((d) => d.id === result.dialect)?.label || result.dialect;
      const signalText =
        result.signals?.length > 0
          ? result.signals.map((s) => s.reason).join('; ')
          : 'No strong signals — defaulting to best guess';
      setDetectHint(`Detected ${label} (${result.confidence} confidence): ${signalText}`);
    } catch {
      setDetectHint('Could not detect dialect — check API connection.');
    }
    setDetectingDialect(false);
  }, [dialects, getSqlForAction]);

  const clearParseResults = useCallback(() => {
    setLastParsedSql(null);
    setLastParseResult(null);
    setWarnings([]);
    setParseError(null);
  }, []);

  const finishLoading = useCallback(() => setLoading(false), []);

  useLayoutEffect(() => {
    if (embedOptions?.embed) return;

    const cached = readLineageParseResult();
    const storedSql = readStoredSql();
    if (cached?.nodes && storedSql?.trim()) {
      restoredFromCacheRef.current = true;
      sqlRef.current = storedSql;
      setSql(storedSql);
      const meta = readLineageSessionMeta();
      if (meta?.dialect) setDialect(meta.dialect);
      setLastParseResult(cached);
      setWarnings(cached.warnings || []);
      setLastParsedSql(storedSql);
      onParseSuccessRef.current?.(cached, storedSql, {
        persist: false,
        applyDiff: false,
      });
      return;
    }

    if (!shouldAutoRestore()) return;

    const meta = readLineageSessionMeta();
    onPrepareSessionRestoreRef.current?.({
      preferTableOverview: shouldPreferTableOverview(meta, storedSql),
      tableTab: meta?.tableTab || readInitialTableTab(),
      dialect: meta?.dialect,
    });
    setLoading(true);
  }, [embedOptions]);

  useEffect(() => {
    if (embedOptions?.embed) {
      if (embedBootstrapped.current) return;
      embedBootstrapped.current = true;
      if (embedOptions.dialect) {
        setDialect(embedOptions.dialect);
      }
      if (embedOptions.sql) {
        sqlRef.current = embedOptions.sql;
        setSql(embedOptions.sql);
        setLoading(true);
        handleParseSqlRef.current?.(embedOptions.sql);
      }
      return;
    }

    if (restoredFromCacheRef.current) return;
    if (!shouldAutoRestore()) return;

    const meta = readLineageSessionMeta();
    const storedSql = readStoredSql();
    if (!storedSql?.trim()) return;

    sqlRef.current = storedSql;
    setSql(storedSql);
    if (meta?.dialect) setDialect(meta.dialect);
    setLoading(true);

    let cancelled = false;
    (async () => {
      await handleParseSqlRef.current?.(storedSql);
      if (cancelled) {
        parseGenerationRef.current += 1;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [embedOptions]);

  return {
    sql,
    setSql: handleSqlChange,
    loading,
    setLoading,
    finishLoading,
    warnings,
    parseError,
    handleDismissParseError,
    handleDismissWarnings,
    handleJumpToError,
    sqlEditorRef,
    sqlRef,
    dialect,
    setDialect,
    dialects,
    handleDialectChange,
    handleDetectDialect,
    detectingDialect,
    detectHint,
    lastParseResult,
    setLastParseResult,
    lastParsedSql,
    setLastParsedSql,
    getSqlForAction,
    handleParseSql,
    clearParseResults,
    persistSession: persistLineageSession,
  };
}

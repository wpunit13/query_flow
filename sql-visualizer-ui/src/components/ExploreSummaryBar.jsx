import { useTheme } from '../context/ThemeContext';
import { panelHeaderStyle } from '../theme/uiStyles';
import { SearchIcon } from '../icons';
import ThemeToggle from './ThemeToggle';

function sqlSummary(sql) {
  const lines = sql.split('\n');
  const first = lines.find((l) => l.trim())?.trim() || 'Empty query';
  const preview = first.length > 72 ? `${first.slice(0, 72)}…` : first;
  return { preview, lineCount: lines.length };
}

export default function ExploreSummaryBar({
  sql,
  dialect,
  dialects,
  searchQuery,
  onSearchChange,
  onSearchKeyDown,
  searchResults,
  searchIndex,
  onEnterAuthor,
  onParse,
  onReset,
  loading,
  parseError,
  warnings,
  sqlIsStale,
  searchInputRef,
}) {
  const { theme } = useTheme();
  const { preview, lineCount } = sqlSummary(sql);
  const dialectLabel = dialects.find((d) => d.id === dialect)?.label || dialect;

  return (
    <div
      style={{
        ...panelHeaderStyle(theme),
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        marginBottom: '8px',
      }}
    >
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: theme.textMain }}>
          Explore mode
        </div>
        <div
          style={{
            fontSize: '11px',
            color: theme.textMuted,
            fontFamily: '"JetBrains Mono", monospace',
            marginTop: '2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={preview}
        >
          {preview}
        </div>
        <div style={{ fontSize: '10px', color: theme.textMuted, marginTop: '2px' }}>
          {lineCount} lines · {dialectLabel}
          {parseError && (
            <span style={{ color: '#dc2626', marginLeft: '8px', fontWeight: '600' }}>
              Parse error
            </span>
          )}
          {warnings?.length > 0 && !parseError && (
            <span style={{ color: '#a16207', marginLeft: '8px' }}>
              {warnings.length} warning{warnings.length > 1 ? 's' : ''}
            </span>
          )}
          {sqlIsStale && (
            <span style={{ color: theme.primary, marginLeft: '8px', fontWeight: '600' }}>
              SQL changed — Render to update
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          border: `1px solid ${theme.border}`,
          borderRadius: '6px',
          padding: '6px 10px',
          background: theme.bg,
          minWidth: '180px',
          flex: '0 1 220px',
        }}
      >
        <SearchIcon />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search… (/)"
          value={searchQuery}
          onChange={onSearchChange}
          onKeyDown={onSearchKeyDown}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            width: '100%',
            fontSize: '12px',
            color: theme.textMain,
          }}
        />
        {searchResults.length > 0 && (
          <span style={{ fontSize: '10px', color: theme.textMuted, marginLeft: '6px' }}>
            {searchIndex + 1}/{searchResults.length}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <ThemeToggle size="sm" />
        <button
          type="button"
          onClick={onEnterAuthor}
          style={{
            padding: '7px 14px',
            background: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            color: theme.textMain,
          }}
          title="Edit SQL (E)"
        >
          Edit SQL
        </button>
        <button
          type="button"
          onClick={onReset}
          style={{
            padding: '7px 12px',
            background: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            color: theme.textMain,
          }}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onParse}
          disabled={loading}
          style={{
            padding: '7px 18px',
            background: loading ? theme.disabled : theme.primary,
            color: theme.onPrimary,
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Parsing…' : 'Render DAG'}
        </button>
      </div>
    </div>
  );
}

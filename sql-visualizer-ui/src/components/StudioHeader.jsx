import { theme } from '../theme';
import { ResetIcon, SearchIcon } from '../icons';
import SqlEditor from './SqlEditor';
import ParseFeedback from './ParseFeedback';
import DialectSelector from './DialectSelector';
import ExploreSummaryBar from './ExploreSummaryBar';

export default function StudioHeader({
  studioMode,
  onEnterAuthor,
  onEnterExplore,
  hasRenderedGraph,
  sqlIsStale,
  sql,
  onSqlChange,
  dialect,
  dialects,
  onDialectChange,
  onDetectDialect,
  detectingDialect,
  detectHint,
  searchQuery,
  onSearchChange,
  onSearchKeyDown,
  searchResults,
  searchIndex,
  onReset,
  onParse,
  loading,
  warnings,
  parseError,
  onDismissError,
  onJumpToError,
  sqlEditorRef,
  searchInputRef,
}) {
  if (studioMode === 'explore') {
    return (
      <ExploreSummaryBar
        sql={sql}
        dialect={dialect}
        dialects={dialects}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onSearchKeyDown={onSearchKeyDown}
        searchResults={searchResults}
        searchIndex={searchIndex}
        onEnterAuthor={onEnterAuthor}
        onParse={onParse}
        onReset={onReset}
        loading={loading}
        parseError={parseError}
        warnings={warnings}
        sqlIsStale={sqlIsStale}
        searchInputRef={searchInputRef}
      />
    );
  }

  return (
    <div
      style={{
        marginBottom: '20px',
        background: 'white',
        padding: '16px 20px',
        borderRadius: '8px',
        boxShadow: '0 1px 2px rgb(0 0 0 / 0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '18px', color: theme.textMain }}>
          SQL Lineage Studio
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              border: `1px solid ${theme.border}`,
              borderRadius: '6px',
              padding: '8px 12px',
              background: theme.bg,
              minWidth: '240px',
            }}
          >
            <SearchIcon />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search table or column... (/ to focus)"
              value={searchQuery}
              onChange={onSearchChange}
              onKeyDown={onSearchKeyDown}
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                width: '100%',
                fontSize: '13px',
                color: theme.textMain,
              }}
            />
            {searchResults.length > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  color: theme.textMuted,
                  whiteSpace: 'nowrap',
                  marginLeft: '8px',
                }}
              >
                {searchIndex + 1} / {searchResults.length} (Enter ↵)
              </span>
            )}
            {searchQuery.trim() && searchResults.length === 0 && (
              <span
                style={{
                  fontSize: '11px',
                  color: '#dc2626',
                  whiteSpace: 'nowrap',
                  marginLeft: '8px',
                }}
              >
                No matches
              </span>
            )}
          </div>

          {hasRenderedGraph && (
            <button
              type="button"
              onClick={onEnterExplore}
              style={{
                padding: '8px 16px',
                backgroundColor: 'white',
                color: theme.primary,
                border: `1px solid ${theme.primary}`,
                borderRadius: '6px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                height: '36px',
              }}
              title="Back to graph without re-rendering (E)"
            >
              Back to Explore
            </button>
          )}

          <button
            onClick={onReset}
            style={{
              padding: '8px 16px',
              backgroundColor: 'white',
              color: theme.textMain,
              border: `1px solid ${theme.border}`,
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
              whiteSpace: 'nowrap',
              height: '36px',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = theme.headerBg)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'white')}
          >
            <ResetIcon />
            Reset
          </button>
          <button
            onClick={onParse}
            disabled={loading}
            style={{
              padding: '8px 24px',
              backgroundColor: loading ? '#94a3b8' : theme.primary,
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: loading ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
              height: '36px',
              minWidth: '120px',
            }}
          >
            {loading ? 'Parsing…' : 'Render DAG'}
          </button>
        </div>
      </div>

      <DialectSelector
        dialect={dialect}
        dialects={dialects}
        onDialectChange={onDialectChange}
        onDetectDialect={onDetectDialect}
        detecting={detectingDialect}
        detectHint={detectHint}
      />

      <ParseFeedback
        parseError={parseError}
        warnings={warnings}
        onJumpToError={onJumpToError}
        onDismissError={onDismissError}
      />

      <div style={{ position: 'relative' }}>
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: theme.headerBg,
              borderRadius: '6px 6px 0 0',
              overflow: 'hidden',
              zIndex: 1,
            }}
          >
            <div
              style={{
                height: '100%',
                width: '40%',
                background: theme.primary,
                animation: 'sqlParseProgress 1.2s ease-in-out infinite',
              }}
            />
          </div>
        )}
        <SqlEditor ref={sqlEditorRef} value={sql} onChange={onSqlChange} dialect={dialect} />
      </div>

      <style>
        {`
          @keyframes sqlParseProgress {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(350%); }
          }
        `}
      </style>
    </div>
  );
}
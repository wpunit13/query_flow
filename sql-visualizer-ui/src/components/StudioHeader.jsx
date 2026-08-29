import { useTheme } from '../context/ThemeContext';
import { panelHeaderStyle } from '../theme/uiStyles';
import SqlEditor from './SqlEditor';
import ParseFeedback from './ParseFeedback';
import DialectSelector from './DialectSelector';
import ExploreSummaryBar from './ExploreSummaryBar';
import HeaderActionGroup from './HeaderActionGroup';

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
  onDismissWarnings,
  onJumpToError,
  sqlEditorRef,
  searchInputRef,
}) {
  const { theme } = useTheme();

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
        ...panelHeaderStyle(theme),
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: theme.textMain }}>
            SQL Lineage Studio
          </h2>
        </div>

        <span
          style={{
            width: '1px',
            height: '28px',
            background: theme.border,
            flexShrink: 0,
          }}
          aria-hidden="true"
        />

        <DialectSelector
          dialect={dialect}
          dialects={dialects}
          onDialectChange={onDialectChange}
          onDetectDialect={onDetectDialect}
          detecting={detectingDialect}
          detectHint={detectHint}
        />

        <div style={{ flex: '1 1 24px', minWidth: '8px' }} />

        <HeaderActionGroup
          modeSwitchLabel="Explore"
          showModeSwitch={hasRenderedGraph}
          onModeSwitch={onEnterExplore}
          modeSwitchTitle="Back to graph without re-rendering (E)"
          onReset={onReset}
          onParse={onParse}
          loading={loading}
        />
      </div>

      <ParseFeedback
        parseError={parseError}
        warnings={warnings}
        onJumpToError={onJumpToError}
        onDismissError={onDismissError}
        onDismissWarnings={onDismissWarnings}
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

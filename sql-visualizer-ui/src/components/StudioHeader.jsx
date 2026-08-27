import { theme } from '../theme';
import { ResetIcon, SearchIcon } from '../icons';

export default function StudioHeader({
  sql,
  onSqlChange,
  searchQuery,
  onSearchChange,
  onSearchKeyDown,
  searchResults,
  searchIndex,
  onReset,
  onParse,
  loading,
  warnings,
  searchInputRef,
}) {
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
                {searchIndex === 0 && searchResults.length > 0
                  ? searchResults.length
                  : searchIndex}{' '}
                / {searchResults.length} (Enter ↵)
              </span>
            )}
          </div>

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
              backgroundColor: theme.primary,
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              height: '36px',
            }}
          >
            {loading ? 'Analyzing...' : 'Render DAG'}
          </button>
        </div>
      </div>

      {warnings.length > 0 && (
        <div
          style={{
            padding: '10px 12px',
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#92400e',
          }}
        >
          <strong>Parse warnings ({warnings.length})</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
            {warnings.map((warning, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <textarea
        value={sql}
        onChange={(e) => onSqlChange(e.target.value)}
        rows={4}
        style={{
          width: '100%',
          padding: '12px',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '12px',
          border: `1px solid ${theme.border}`,
          borderRadius: '6px',
          outline: 'none',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

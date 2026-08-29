import { theme } from '../theme';

function ErrorContextBlock({ contextLines, onJumpToLine }) {
  if (!contextLines?.length) return null;

  return (
    <pre
      style={{
        margin: '8px 0 0',
        padding: '8px 10px',
        background: '#fff',
        border: '1px solid #fecaca',
        borderRadius: '4px',
        fontSize: '11px',
        lineHeight: '1.45',
        overflowX: 'auto',
        fontFamily: '"JetBrains Mono", monospace',
        color: theme.textMain,
      }}
    >
      {contextLines.map((row) => (
        <div
          key={row.line}
          onClick={() => onJumpToLine?.(row.line, 1)}
          style={{
            cursor: onJumpToLine ? 'pointer' : 'default',
            background: row.is_error_line ? '#fee2e2' : 'transparent',
            whiteSpace: 'pre',
          }}
        >
          <span style={{ color: theme.textMuted, userSelect: 'none' }}>
            {String(row.line).padStart(4, ' ')} │{' '}
          </span>
          {row.text || ' '}
        </div>
      ))}
    </pre>
  );
}

function ErrorSnippet({ snippet, highlight }) {
  if (!snippet) return null;

  if (!highlight || !snippet.includes(highlight)) {
    return (
      <code
        style={{
          display: 'block',
          marginTop: '6px',
          padding: '6px 8px',
          background: '#fff',
          border: '1px solid #fecaca',
          borderRadius: '4px',
          fontSize: '11px',
          fontFamily: '"JetBrains Mono", monospace',
        }}
      >
        {snippet}
      </code>
    );
  }

  const [before, after] = snippet.split(highlight);
  return (
    <code
      style={{
        display: 'block',
        marginTop: '6px',
        padding: '6px 8px',
        background: '#fff',
        border: '1px solid #fecaca',
        borderRadius: '4px',
        fontSize: '11px',
        fontFamily: '"JetBrains Mono", monospace',
      }}
    >
      {before}
      <strong style={{ background: '#fecaca', color: '#7f1d1d' }}>{highlight}</strong>
      {after}
    </code>
  );
}

export default function ParseFeedback({
  parseError,
  warnings,
  onJumpToError,
  onDismissError,
  onDismissWarnings,
}) {
  const hasWarnings = warnings?.length > 0;
  const hasErrors = parseError?.errors?.length > 0;

  if (!hasWarnings && !hasErrors) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {hasErrors && (
        <div
          style={{
            padding: '10px 12px',
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#991b1b',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <strong>Parse error</strong>
            {onDismissError && (
              <button
                type="button"
                onClick={onDismissError}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#991b1b',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '600',
                }}
              >
                Dismiss
              </button>
            )}
          </div>

          {parseError.guidance && (
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#b91c1c' }}>
              {parseError.guidance}
            </p>
          )}

          <ul style={{ margin: '8px 0 0', paddingLeft: '0', listStyle: 'none' }}>
            {parseError.errors.map((err, idx) => {
              const canJump = err.line != null;
              return (
                <li
                  key={idx}
                  style={{
                    marginBottom: idx < parseError.errors.length - 1 ? '12px' : 0,
                    paddingBottom: idx < parseError.errors.length - 1 ? '12px' : 0,
                    borderBottom:
                      idx < parseError.errors.length - 1 ? '1px solid #fecaca' : 'none',
                  }}
                >
                  {canJump ? (
                    <button
                      type="button"
                      onClick={() => onJumpToError?.(err.line, err.column)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#b91c1c',
                        cursor: 'pointer',
                        textAlign: 'left',
                        padding: 0,
                        fontSize: '12px',
                        fontFamily: 'inherit',
                        fontWeight: '600',
                      }}
                    >
                      Line {err.line}, column {err.column ?? 1}
                    </button>
                  ) : null}
                  <div style={{ marginTop: canJump ? '4px' : 0 }}>{err.message}</div>
                  <ErrorSnippet snippet={err.snippet} highlight={err.highlight} />
                  <ErrorContextBlock
                    contextLines={err.context_lines}
                    onJumpToLine={onJumpToError}
                  />
                  {err.technical_message &&
                    err.technical_message !== err.message && (
                      <details style={{ marginTop: '6px', fontSize: '10px', color: '#9f1239' }}>
                        <summary style={{ cursor: 'pointer' }}>Parser details</summary>
                        <code
                          style={{
                            display: 'block',
                            marginTop: '4px',
                            whiteSpace: 'pre-wrap',
                            fontFamily: '"JetBrains Mono", monospace',
                          }}
                        >
                          {err.technical_message}
                        </code>
                      </details>
                    )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {hasWarnings && (
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
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <strong>Parse warnings ({warnings.length})</strong>
            {onDismissWarnings && (
              <button
                type="button"
                onClick={onDismissWarnings}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#92400e',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '600',
                }}
              >
                Dismiss
              </button>
            )}
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#a16207' }}>
            Non-fatal — the graph may still render. Review before trusting lineage.
          </p>
          <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
            {warnings.map((warning, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

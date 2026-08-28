import { useRef, useImperativeHandle, forwardRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { theme } from '../theme';
import { getCodeMirrorSqlDialect } from '../utils/sqlDialect';

const editorTheme = EditorView.theme({
  '&': {
    fontSize: '12px',
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  },
  '.cm-scroller': {
    lineHeight: '1.5',
  },
  '.cm-gutters': {
    backgroundColor: theme.headerBg,
    color: theme.textMuted,
    borderRight: `1px solid ${theme.border}`,
  },
  '.cm-content': {
    padding: '8px 0',
  },
});

function SqlEditor({ value, onChange, dialect = 'bigquery', minHeight = '160px' }, ref) {
  const viewRef = useRef(null);
  const cmDialect = getCodeMirrorSqlDialect(dialect);

  useImperativeHandle(ref, () => ({
    getValue() {
      return viewRef.current?.state.doc.toString() ?? '';
    },
    jumpToLine(line, column = 1) {
      const view = viewRef.current;
      if (!view || !line) return;

      const safeLine = Math.min(Math.max(1, line), view.state.doc.lines);
      const lineInfo = view.state.doc.line(safeLine);
      const col = Math.max(0, (column || 1) - 1);
      const pos = Math.min(lineInfo.from + col, lineInfo.to);

      view.dispatch({
        selection: { anchor: pos },
        effects: EditorView.scrollIntoView(pos, { y: 'center' }),
      });
      view.focus();
    },
  }));

  return (
    <div
      style={{
        border: `1px solid ${theme.border}`,
        borderRadius: '6px',
        overflow: 'hidden',
        minHeight,
      }}
    >
      <CodeMirror
        value={value}
        height={minHeight}
        extensions={[sql({ dialect: cmDialect }), editorTheme]}
        onChange={onChange}
        onCreateEditor={(view) => {
          viewRef.current = view;
        }}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          foldGutter: false,
          autocompletion: false,
        }}
        placeholder={`SQL (${dialect}) — paste query and Render DAG`}
      />
    </div>
  );
}

export default forwardRef(SqlEditor);

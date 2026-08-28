import { useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { EditorView } from '@codemirror/view';
import { useTheme } from '../context/ThemeContext';
import { getCodeMirrorSqlDialect } from '../utils/sqlDialect';

function SqlEditor({ value, onChange, dialect = 'bigquery', minHeight = '160px' }, ref) {
  const { theme, mode } = useTheme();
  const viewRef = useRef(null);
  const cmDialect = getCodeMirrorSqlDialect(dialect);

  const highlightStyle = useMemo(
    () =>
      HighlightStyle.define([
        { tag: t.keyword, color: theme.codeKeyword },
        { tag: t.operator, color: theme.textMuted },
        { tag: t.string, color: theme.codeString },
        { tag: t.comment, color: theme.codeComment, fontStyle: 'italic' },
        { tag: t.name, color: theme.codeName },
        { tag: t.variableName, color: theme.codeName },
        { tag: t.typeName, color: theme.codeName },
        { tag: t.literal, color: theme.codeString },
        { tag: t.number, color: theme.codeName },
        { tag: t.punctuation, color: theme.textMuted },
        { tag: t.bracket, color: theme.textMuted },
        { tag: t.special(t.string), color: theme.codeString },
      ]),
    [theme]
  );

  const editorTheme = useMemo(
    () =>
      EditorView.theme({
        '&': {
          fontSize: '12px',
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          backgroundColor: theme.cardBg,
          color: theme.textMain,
        },
        '.cm-editor': {
          backgroundColor: theme.cardBg,
        },
        '.cm-scroller': {
          lineHeight: '1.5',
          backgroundColor: theme.cardBg,
        },
        '.cm-gutters': {
          backgroundColor: theme.headerBg,
          color: theme.textMuted,
          borderRight: `1px solid ${theme.border}`,
        },
        '.cm-content': {
          padding: '8px 0',
          caretColor: theme.primary,
        },
        '.cm-cursor': {
          borderLeftColor: theme.primary,
        },
        '.cm-activeLine': {
          backgroundColor: theme.codeActiveLineBg,
        },
        '.cm-activeLineGutter': {
          backgroundColor: theme.codeActiveLineBg,
        },
        '.cm-selectionBackground': {
          backgroundColor: theme.codeSelectionBg,
        },
        '&.cm-focused .cm-selectionBackground': {
          backgroundColor: theme.codeSelectionBg,
        },
        '.cm-placeholder': {
          color: theme.textMuted,
        },
      }),
    [theme]
  );

  const extensions = useMemo(
    () => [
      sql({ dialect: cmDialect }),
      syntaxHighlighting(highlightStyle),
      editorTheme,
    ],
    [cmDialect, highlightStyle, editorTheme]
  );

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
        background: theme.cardBg,
      }}
    >
      <CodeMirror
        key={mode}
        value={value}
        height={minHeight}
        extensions={extensions}
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

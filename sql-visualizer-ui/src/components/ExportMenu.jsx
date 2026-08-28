import { useState, useRef, useEffect } from 'react';
import { theme } from '../theme';

export default function ExportMenu({
  disabled,
  onExportPng,
  onExportSvg,
  onExportPdf,
  onExportJson,
  onExportCsv,
  onExportOpenLineage,
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const run = async (label, fn) => {
    setBusy(true);
    try {
      await fn();
      setOpen(false);
    } catch (err) {
      console.error(`${label} export failed`, err);
      alert(err.message || `Failed to export ${label}`);
    } finally {
      setBusy(false);
    }
  };

  const itemStyle = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '8px 12px',
    border: 'none',
    background: 'white',
    fontSize: '12px',
    cursor: disabled || busy ? 'not-allowed' : 'pointer',
    color: theme.textMain,
  };

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: '6px 10px',
          fontSize: '11px',
          fontWeight: '600',
          border: `1px solid ${theme.border}`,
          borderRadius: '6px',
          background: open ? '#eff6ff' : 'white',
          color: theme.textMain,
          cursor: disabled || busy ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
        title="Export graph or lineage data"
      >
        {busy ? 'Exporting…' : 'Export ▾'}
      </button>
      {open && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            minWidth: '200px',
            background: 'white',
            border: `1px solid ${theme.border}`,
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgb(0 0 0 / 0.12)',
            zIndex: 20,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '6px 12px',
              fontSize: '10px',
              fontWeight: '700',
              color: theme.textMuted,
              background: theme.headerBg,
            }}
          >
            Graph image
          </div>
          <button type="button" style={itemStyle} onClick={() => run('PNG', onExportPng)}>
            PNG image
          </button>
          <button type="button" style={itemStyle} onClick={() => run('SVG', onExportSvg)}>
            SVG image
          </button>
          <button type="button" style={itemStyle} onClick={() => run('PDF', onExportPdf)}>
            PDF document
          </button>
          <div
            style={{
              padding: '6px 12px',
              fontSize: '10px',
              fontWeight: '700',
              color: theme.textMuted,
              background: theme.headerBg,
              borderTop: `1px solid ${theme.border}`,
            }}
          >
            Lineage data
          </div>
          <button type="button" style={itemStyle} onClick={() => run('JSON', onExportJson)}>
            JSON (full contract)
          </button>
          <button type="button" style={itemStyle} onClick={() => run('CSV', onExportCsv)}>
            CSV (nodes + edges)
          </button>
          <button
            type="button"
            style={itemStyle}
            onClick={() => run('OpenLineage', onExportOpenLineage)}
          >
            OpenLineage / Marquez JSON
          </button>
        </div>
      )}
    </div>
  );
}

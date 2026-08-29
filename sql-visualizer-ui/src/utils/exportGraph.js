import { getApiBaseUrl } from '../api/apiBase';
import { getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';

const IMAGE_PADDING = 0.15;

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function stamp() {
  const d = new Date();
  return d.toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

export function buildClientExportPayload(lineage, sql, dialect) {
  return {
    exported_at: new Date().toISOString(),
    dialect,
    sql,
    lineage,
  };
}

export function downloadJsonExport(payload, filename = `lineage-${stamp()}.json`) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

export function downloadCsvFromLineage(lineage, filename = `lineage-${stamp()}.csv`) {
  const rows = [
    [
      'record_type',
      'id',
      'source',
      'target',
      'edge_type',
      'node_type',
      'kind',
      'label',
      'qualified_name',
      'columns',
    ],
  ];

  (lineage.nodes || []).forEach((node) => {
    const data = node.data || {};
    rows.push([
      'node',
      node.id,
      '',
      '',
      '',
      node.type || '',
      data.kind || '',
      data.label || '',
      data.qualified_name || '',
      (data.columns || []).join('|'),
    ]);
  });

  (lineage.edges || []).forEach((edge) => {
    rows.push([
      'edge',
      edge.id,
      edge.source,
      edge.target,
      edge.edge_type || '',
      '',
      '',
      '',
      '',
      '',
    ]);
  });

  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell ?? '');
          return `"${text.replace(/"/g, '""')}"`;
        })
        .join(',')
    )
    .join('\n');

  downloadBlob(new Blob([csv], { type: 'text/csv' }), filename);
}

async function captureViewport(rfInstance, format) {
  const { getNodes } = rfInstance;
  const nodes = getNodes().filter((n) => !n.hidden);
  if (!nodes.length) {
    throw new Error('No visible nodes to export');
  }

  const bounds = getNodesBounds(nodes);
  const imageWidth = Math.min(4096, Math.max(800, Math.ceil(bounds.width * 1.25)));
  const imageHeight = Math.min(4096, Math.max(600, Math.ceil(bounds.height * 1.25)));
  const viewport = getViewportForBounds(
    bounds,
    imageWidth,
    imageHeight,
    IMAGE_PADDING,
    2,
    0.02
  );

  const flowEl = document.querySelector('.react-flow');
  if (!flowEl) throw new Error('Graph canvas not found');

  const options = {
    backgroundColor: '#f8fafc',
    width: imageWidth,
    height: imageHeight,
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
    filter: (node) => {
      if (!node?.classList) return true;
      return !node.classList.contains('react-flow__minimap') &&
        !node.classList.contains('react-flow__controls');
    },
  };

  if (format === 'svg') {
    return toSvg(flowEl, options);
  }
  return toPng(flowEl, { ...options, pixelRatio: 2 });
}

export async function downloadGraphPng(rfInstance) {
  const dataUrl = await captureViewport(rfInstance, 'png');
  downloadDataUrl(dataUrl, `lineage-graph-${stamp()}.png`);
}

export async function downloadGraphSvg(rfInstance) {
  const dataUrl = await captureViewport(rfInstance, 'svg');
  downloadDataUrl(dataUrl, `lineage-graph-${stamp()}.svg`);
}

export async function downloadGraphPdf(rfInstance) {
  const dataUrl = await captureViewport(rfInstance, 'png');
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = dataUrl;
  });

  const pxToMm = 0.264583;
  const widthMm = img.width * pxToMm;
  const heightMm = img.height * pxToMm;
  const orientation = widthMm > heightMm ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ orientation, unit: 'mm', format: [widthMm, heightMm] });
  pdf.addImage(dataUrl, 'PNG', 0, 0, widthMm, heightMm);
  pdf.save(`lineage-graph-${stamp()}.pdf`);
}

export async function downloadOpenLineageExport(sql, dialect, lineage) {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/export/openlineage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, dialect, lineage }),
  });
  if (!response.ok) {
    throw new Error(`OpenLineage export failed (${response.status})`);
  }
  const event = await response.json();
  downloadJsonExport(event, `lineage-openlineage-${stamp()}.json`);
}

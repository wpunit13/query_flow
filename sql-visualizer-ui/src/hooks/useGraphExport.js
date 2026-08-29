import { useCallback } from 'react';
import {
  buildClientExportPayload,
  downloadCsvFromLineage,
  downloadGraphPdf,
  downloadGraphPng,
  downloadGraphSvg,
  downloadJsonExport,
  downloadOpenLineageExport,
} from '../utils/exportGraph';

export function useGraphExport({ rfInstance, parse }) {
  const handleExportPng = useCallback(async () => {
    if (!rfInstance) throw new Error('Graph not ready — render a query first');
    await downloadGraphPng(rfInstance);
  }, [rfInstance]);

  const handleExportSvg = useCallback(async () => {
    if (!rfInstance) throw new Error('Graph not ready — render a query first');
    await downloadGraphSvg(rfInstance);
  }, [rfInstance]);

  const handleExportPdf = useCallback(async () => {
    if (!rfInstance) throw new Error('Graph not ready — render a query first');
    await downloadGraphPdf(rfInstance);
  }, [rfInstance]);

  const handleExportJson = useCallback(() => {
    if (!parse.lastParseResult) throw new Error('No lineage data — render a query first');
    const payload = buildClientExportPayload(
      parse.lastParseResult,
      parse.getSqlForAction(),
      parse.dialect
    );
    downloadJsonExport(payload);
  }, [parse]);

  const handleExportCsv = useCallback(() => {
    if (!parse.lastParseResult) throw new Error('No lineage data — render a query first');
    downloadCsvFromLineage(parse.lastParseResult);
  }, [parse]);

  const handleExportOpenLineage = useCallback(async () => {
    const sqlToExport = parse.getSqlForAction();
    if (!sqlToExport?.trim()) throw new Error('No SQL to export');
    if (!parse.lastParseResult) throw new Error('No lineage data — render a query first');
    await downloadOpenLineageExport(sqlToExport, parse.dialect, parse.lastParseResult);
  }, [parse]);

  return {
    handleExportPng,
    handleExportSvg,
    handleExportPdf,
    handleExportJson,
    handleExportCsv,
    handleExportOpenLineage,
  };
}

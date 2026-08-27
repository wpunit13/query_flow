/**
 * Search nodes by label, id, qualified name, columns, and column lineage.
 */
export function computeSearchMatches(nodeList, query) {
  if (!query?.trim() || !nodeList?.length) return [];

  const lower = query.toLowerCase();
  const matches = [];

  nodeList.forEach((n) => {
    const label = n.data?.label?.toLowerCase() || '';
    const id = n.id?.toLowerCase() || '';
    const qualified = n.data?.qualified_name?.toLowerCase() || '';

    const colMatch =
      Array.isArray(n.data?.columns) &&
      n.data.columns.some(
        (col) => typeof col === 'string' && col.toLowerCase().includes(lower)
      );

    const lineageMatch =
      Array.isArray(n.data?.column_lineage) &&
      n.data.column_lineage.some(
        (entry) =>
          (entry?.name && entry.name.toLowerCase().includes(lower)) ||
          (Array.isArray(entry?.sources) &&
            entry.sources.some(
              (src) => typeof src === 'string' && src.toLowerCase().includes(lower)
            ))
      );

    const conditionMatch =
      Array.isArray(n.data?.conditions) &&
      n.data.conditions.some(
        (c) => typeof c === 'string' && c.toLowerCase().includes(lower)
      );

    const isMatch =
      label.includes(lower) ||
      id.includes(lower) ||
      qualified.includes(lower) ||
      colMatch ||
      lineageMatch ||
      conditionMatch;

    if (isMatch) matches.push(n.id);
  });

  return matches;
}

export function getSearchVisibilityIds(matchIds, edges) {
  const visible = new Set(matchIds);
  matchIds.forEach((id) => {
    // upstream
    const upQueue = [id];
    const upSeen = new Set([id]);
    while (upQueue.length) {
      const cur = upQueue.shift();
      edges.forEach((e) => {
        if (e.hidden) return;
        if (e.target === cur && !upSeen.has(e.source)) {
          upSeen.add(e.source);
          visible.add(e.source);
          upQueue.push(e.source);
        }
      });
    }
    // downstream
    const downQueue = [id];
    const downSeen = new Set([id]);
    while (downQueue.length) {
      const cur = downQueue.shift();
      edges.forEach((e) => {
        if (e.hidden) return;
        if (e.source === cur && !downSeen.has(e.target)) {
          downSeen.add(e.target);
          visible.add(e.target);
          downQueue.push(e.target);
        }
      });
    }
  });
  return visible;
}

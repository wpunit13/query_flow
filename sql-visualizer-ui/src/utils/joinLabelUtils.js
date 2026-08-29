/** Parse join operand labels into alias ↔ table mappings for the UI. */

export function parseAliasFromOperandLabel(label) {
  if (!label) return { alias: '—', table: '—' };
  const trimmed = String(label).trim();
  const match = trimmed.match(/^(.+?)\s+\((.+)\)$/);
  if (match) {
    return { alias: match[1].trim(), table: match[2].trim() };
  }
  return { alias: trimmed, table: trimmed };
}

/** Normalize operand label for join node UI (table name + optional SQL alias). */
export function formatOperandDisplay(label) {
  const trimmed = String(label || '').trim();
  if (!trimmed) return { table: '—', alias: null, nested: false, raw: trimmed };

  if (/JOIN:/i.test(trimmed)) {
    const tail = trimmed.split(':').slice(1).join(':').trim();
    return { table: tail, alias: null, nested: true, raw: trimmed };
  }

  const { alias, table } = parseAliasFromOperandLabel(trimmed);
  const showAlias =
    alias &&
    alias !== '—' &&
    alias.toLowerCase() !== table.toLowerCase();

  return {
    table,
    alias: showAlias ? alias : null,
    nested: false,
    raw: trimmed,
  };
}

/** Human label: `stores (s)` — table first, alias in parens when useful. */
export function formatTableAliasPhrase(label) {
  const display = formatOperandDisplay(label);
  if (!display.table || display.table === '—') return '';
  if (display.nested) return '';
  if (display.alias) return `${display.table} (${display.alias})`;
  return display.table;
}

/**
 * One join step as SQL reads it: the table being brought in + ON.
 * Ignores nested left-join blobs (`INNER JOIN: a + b`) — those are graph internals.
 */
export function formatJoinStepLine(op) {
  if (!op || op.opKind === 'union') return '';
  const joinType = op.opType || op.joinType || 'JOIN';
  const rightLabel = op.right?.label || '';
  const broughtIn = formatTableAliasPhrase(rightLabel);
  const on = op.conditions?.[0] ? ` ON ${op.conditions[0]}` : '';
  if (!broughtIn) {
    return `${joinType}${on}`.trim();
  }
  return `${joinType} ${broughtIn}${on}`;
}

/** Join details without repeating the join type (already shown in another column). */
export function formatJoinStepDetail(op) {
  const line = formatJoinStepLine(op);
  if (!line) return '';
  const joinType = op?.opType || op?.joinType || 'JOIN';
  const prefix = `${joinType} `;
  if (line.startsWith(prefix)) return line.slice(prefix.length);
  if (line === joinType) return '';
  return line;
}

/** Flatten nested join operand labels (e.g. "INNER JOIN: p (products) + c (cats)"). */
export function collectAliasEntriesFromOperands(operands = []) {
  const entries = [];
  operands.forEach((op) => {
    const label = op?.label || '';
    if (label.includes(':')) {
      const tail = label.split(':').slice(1).join(':');
      tail.split('+').forEach((part) => {
        entries.push(parseAliasFromOperandLabel(part.trim()));
      });
      return;
    }
    if (label.includes('+')) {
      label.split('+').forEach((part) => {
        entries.push(parseAliasFromOperandLabel(part.trim()));
      });
      return;
    }
    entries.push(parseAliasFromOperandLabel(label));
  });
  return entries;
}

export function buildAliasLegend(operands = []) {
  const seen = new Set();
  const parts = [];
  collectAliasEntriesFromOperands(operands).forEach(({ alias, table }) => {
    const key = alias.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    if (alias.toLowerCase() !== table.toLowerCase()) {
      parts.push(`${alias} → ${table}`);
    } else if (alias && alias !== '—') {
      parts.push(alias);
    }
  });
  return parts.join(' · ');
}

export function aliasesReferencedInCondition(condition, operands = []) {
  if (!condition) return [];
  const entries = collectAliasEntriesFromOperands(operands);
  return entries.filter(({ alias }) => {
    const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`, 'i');
    return pattern.test(condition);
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build alias → table/subquery name map from operands and direct upstream nodes. */
export function buildAliasMap(operands = [], joinId = null, graphNodes = [], graphEdges = []) {
  const map = new Map();
  collectAliasEntriesFromOperands(operands).forEach(({ alias, table }) => {
    if (alias && alias !== '—') map.set(alias, table);
  });

  if (joinId && graphEdges.length && graphNodes.length) {
    graphEdges
      .filter((e) => e.target === joinId && !e.hidden)
      .forEach((e) => {
        const src = graphNodes.find((n) => n.id === e.source);
        const alias = src?.data?.alias;
        const table = src?.data?.label || src?.id;
        if (alias && table) map.set(alias, table);
      });
  }

  return map;
}

/**
 * Rewrite `p.col = c.col` → `products (p).col = product_categories (c).col`
 * so users can read join conditions without memorizing aliases.
 */
export function annotateJoinCondition(condition, operands = [], joinId = null, graphNodes = [], graphEdges = []) {
  if (!condition) return condition;
  const aliasMap = buildAliasMap(operands, joinId, graphNodes, graphEdges);
  if (aliasMap.size === 0) return condition;

  let result = condition;
  [...aliasMap.entries()]
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([alias, table]) => {
      if (alias.toLowerCase() === table.toLowerCase()) return;
      const pattern = new RegExp(`\\b${escapeRegExp(alias)}\\.`, 'g');
      result = result.replace(pattern, `${table} (${alias}).`);
    });

  return result;
}

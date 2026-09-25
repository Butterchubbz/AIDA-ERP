export function parseJsonRecordsFromText(text: string): Array<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON');
  }

  if (Array.isArray(parsed)) return parsed.map(i => i as Record<string, unknown>);

  if (parsed && typeof parsed === 'object') {
    const values = Object.values(parsed as Record<string, unknown>);
    const firstArray = values.find(v => Array.isArray(v)) as Array<unknown> | undefined;
    if (firstArray) return firstArray.map(i => i as Record<string, unknown>);
  }

  throw new Error('JSON did not contain an array of records');
}

export function autoMapHeaders(headers: string[], targetFields: string[]): Record<string, string> {
  const next: Record<string, string> = {};
  const normalize = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const normTarget = targetFields.map(f => normalize(f));
  const synonyms = ['sku', 'id', 'name', 'date', 'oldvalue', 'newvalue', 'webstock', 'productionstock', 'warehousestock', 'reservestock', 'countedstock', 'category', 'subcategory'];

  for (const h of headers) {
  const norm = normalize(h);

    // exact case-insensitive match
    const exactIdx = normTarget.indexOf(norm);
    if (exactIdx >= 0) {
      next[h] = targetFields[exactIdx];
      continue;
    }
    // normalized contains match (ignores spaces/symbols)
    const contains = targetFields.find((_, idx) => {
      const tfNorm = normTarget[idx];
      return norm.includes(tfNorm) || tfNorm.includes(norm);
    });
    if (contains) {
      next[h] = contains;
      continue;
    }

    // synonyms (normalized)
  const syn = targetFields.find((_, idx) => synonyms.includes(normTarget[idx]) && norm.includes(normTarget[idx]));
    if (syn) {
      next[h] = syn;
      continue;
    }

    // fallback: keep header
    next[h] = h;
  }

  return next;
}

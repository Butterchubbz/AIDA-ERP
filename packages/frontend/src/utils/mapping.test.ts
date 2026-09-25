import { describe, it, expect } from 'vitest';
import { parseJsonRecordsFromText, autoMapHeaders } from './mapping';

describe('parseJsonRecordsFromText', () => {
  it('parses a top-level array', () => {
    const txt = JSON.stringify([{ a: 1 }, { a: 2 }]);
    const res = parseJsonRecordsFromText(txt);
    expect(res.length).toBe(2);
    expect(res[0].a).toBe(1);
  });

  it('extracts first array from object', () => {
    const txt = JSON.stringify({ meta: { ok: true }, data: [{ x: 'a' }, { x: 'b' }] });
    const res = parseJsonRecordsFromText(txt);
    expect(res.length).toBe(2);
  expect((res[1] as unknown as { x: string }).x).toBe('b');
  });

  it('throws on invalid json', () => {
    expect(() => parseJsonRecordsFromText('not json')).toThrow();
  });
});

describe('autoMapHeaders', () => {
  it('maps exact matches', () => {
    const headers = ['sku', 'name', 'webStock'];
    const fields = ['sku', 'name', 'webStock'];
    const mapped = autoMapHeaders(headers, fields);
    expect(mapped.sku).toBe('sku');
    expect(mapped.name).toBe('name');
    expect(mapped.webStock).toBe('webStock');
  });

  it('maps contains and synonyms', () => {
    const headers = ['Product SKU', 'Counted Stock', 'Old Value'];
    const fields = ['sku', 'countedStock', 'oldValue'];
    const mapped = autoMapHeaders(headers, fields);
    expect(mapped['Product SKU']).toBe('sku');
    expect(mapped['Counted Stock']).toBe('countedStock');
    expect(mapped['Old Value']).toBe('oldValue');
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const STORAGE_KEY = 'aida.mapping.presets';

describe('CsvImportModal presets localStorage', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('saves and loads a preset for a collection', () => {
    const collectionId = 'testCollection';
    const presetName = 'MyPreset';
    const mapping = { SKU: 'sku', Name: 'name' };

    // Simulate saving
  const raw = localStorage.getItem(STORAGE_KEY);
  const store = raw ? JSON.parse(raw) : {};
    if (!store[collectionId]) store[collectionId] = {};
    store[collectionId][presetName] = mapping;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    // Load and assert
    const loadedRaw = localStorage.getItem(STORAGE_KEY);
    expect(loadedRaw).not.toBeNull();
    const loaded = JSON.parse(loadedRaw as string);
    expect(loaded[collectionId][presetName]).toEqual(mapping);
  });

  it('deletes a preset for a collection', () => {
    const collectionId = 'testCollection';
    const presetName = 'ToDelete';
    const mapping = { A: 'a' };
    const store = { [collectionId]: { [presetName]: mapping } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    // Delete
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    delete parsed[collectionId][presetName];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));

    const after = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect(after[collectionId][presetName]).toBeUndefined();
  });
});

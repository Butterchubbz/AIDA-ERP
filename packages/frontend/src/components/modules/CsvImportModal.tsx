import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { apiClient } from '../../lib/apiClient';
import LoadingSpinner from '../common/LoadingSpinner';
import ProgressBar from '../common/ProgressBar';
import { availableCollections } from '../../lib/collections';
import { listRemotePresets, saveRemotePreset, deleteRemotePreset } from '../../lib/presets';
import type { PresetRecord } from '../../lib/presets';

interface CsvImportModalProps {
  file: File;
  onClose: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const CsvImportModal: React.FC<CsvImportModalProps> = ({ file, onClose, showToast }) => {
  const [parsedData, setParsedData] = useState<Array<{ [key: string]: string }>>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [importMode, setImportMode] = useState<'create' | 'update' | 'upsert'>('create');
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [showMappingPreview, setShowMappingPreview] = useState(false);
  const [topLevelKeys, setTopLevelKeys] = useState<string[]>([]);
  const [selectedTopLevelKey, setSelectedTopLevelKey] = useState<string>('');
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<Record<string, Record<string, Record<string, string>>>>({});
  const [remotePresetIds, setRemotePresetIds] = useState<Record<string, Record<string, string>>>({});
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  useEffect(() => {
    if (!file) return;
    setIsLoading(true);

    const isJson = file.type.includes('application/json') || file.name.toLowerCase().endsWith('.json');

    if (isJson) {
      file
        .text()
        .then(txt => {
          try {
            const parsed = JSON.parse(txt);
            // Accept either an array of records or an object with collections
            let rows: Array<Record<string, unknown>> = [];
            if (Array.isArray(parsed)) {
              rows = parsed as Array<Record<string, unknown>>;
            } else if (parsed && typeof parsed === 'object') {
              // If the JSON is an object with top-level keys, collect any arrays and
              // allow the user to pick which one to import when multiple arrays exist.
              const entries = Object.entries(parsed) as Array<[string, unknown]>;
              const arrays = entries.filter(([, v]) => Array.isArray(v)) as Array<[string, unknown]>;
              if (arrays.length === 0) {
                rows = [];
              } else if (arrays.length === 1) {
                rows = arrays[0][1] as Array<Record<string, unknown>>;
              } else {
                // multiple arrays found: default to the first but remember keys for UI chooser
                setTopLevelKeys(arrays.map(a => a[0]));
                setSelectedTopLevelKey(arrays[0][0]);
                rows = arrays[0][1] as Array<Record<string, unknown>>;
                showToast(
                  `JSON contains multiple top-level arrays (${arrays.map(a => a[0]).join(', ')}). Choose the desired key from the dropdown to switch.`,
                  'info'
                );
              }
            }

            if (!rows || rows.length === 0) {
              showToast('JSON file contains no records to import.', 'warning');
            } else {
              const first = rows[0];
              const fields = Object.keys(first).map(String);
              setHeaders(fields);
              // Normalize values to strings for downstream handling
              const normalized = rows.map(r => {
                const out: Record<string, string> = {};
                for (const k of Object.keys(r)) {
                  const v = (r as Record<string, unknown>)[k];
                  out[k] = v === undefined || v === null ? '' : String(v);
                }
                return out;
              });
              setParsedData(normalized);
              showToast('JSON parsed successfully!', 'success');
            }
          } catch (e: unknown) {
            showToast('Failed to parse JSON: ' + ((e as { message?: string }).message ?? String(e)), 'error');
            console.error('JSON parse error', e);
          }
        })
        .catch(err => {
          showToast('Failed to read JSON file: ' + String(err), 'error');
        })
        .finally(() => setIsLoading(false));
    } else {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results: Papa.ParseResult<Record<string, string>>) => {
          const fields = (results.meta.fields || []) as string[];
          setHeaders(fields);
          setParsedData(results.data as Array<{ [key: string]: string }>);

          if (results.errors && results.errors.length > 0) {
            const first = results.errors[0];
            showToast(`Error parsing CSV: ${first.message}`, 'error');
          } else if ((results.data as Array<Record<string, string>>).length > 0) {
            showToast('CSV parsed successfully!', 'success');
          } else {
            showToast('CSV file is empty or invalid.', 'warning');
          }
          setIsLoading(false);
        },
      });
    }
  }, [file, showToast]);

  // Load presets from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('aida.mapping.presets');
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, Record<string, Record<string, string>>>;
        setPresets(parsed);
      }
    } catch (e) {
      // ignore parse errors
      console.warn('Failed to load mapping presets', e);
    }
  }, []);

  // Load remote presets when authenticated and collection selected
  useEffect(() => {
    let mounted = true;
    const loadRemote = async () => {
      if (!selectedCollection) return;
      try {
        const remote = await listRemotePresets(selectedCollection);
        if (!mounted) return;
        if (remote && remote.length > 0) {
          setPresets(prev => {
            const next = { ...prev };
            if (!next[selectedCollection]) next[selectedCollection] = {};
            const ids: Record<string, string> = {};
            for (const r of remote) {
              const name = r.name;
              next[selectedCollection][name] = r.mapping as Record<string, string>;
              if (r.id) ids[name] = r.id;
            }
            setRemotePresetIds(prevIds => ({ ...prevIds, [selectedCollection]: ids }));
            return next;
          });
        }
      } catch (e) {
        // Non-fatal: notify user so they know remote presets are not available
        console.warn('Failed to load remote presets', e);
        try {
          showToast('Could not load remote presets — continuing with local presets.', 'warning');
        } catch (toastErr) {
          // showToast may be unavailable in some contexts; ignore
        }
      }
    };
    loadRemote();
    return () => {
      mounted = false;
    };
  }, [selectedCollection]);

  // If user selects a different top-level key from JSON, re-run parsing using the original file
  useEffect(() => {
    if (!selectedTopLevelKey || topLevelKeys.length === 0) return;
    // re-read the file and pick the selected key
    file
      .text()
      .then(txt => {
        try {
          const parsed = JSON.parse(txt) as Record<string, unknown>;
          const val = parsed[selectedTopLevelKey];
          if (Array.isArray(val)) {
            const rows = val as Array<Record<string, unknown>>;
            const first = rows[0];
            const fields = Object.keys(first).map(String);
            setHeaders(fields);
            const normalized = rows.map(r => {
              const out: Record<string, string> = {};
              for (const k of Object.keys(r)) {
                const v = (r as Record<string, unknown>)[k];
                out[k] = v === undefined || v === null ? '' : String(v);
              }
              return out;
            });
            setParsedData(normalized);
          }
        } catch (e) {
          // ignore parse failures here
        }
      })
      .catch(() => {});
  }, [selectedTopLevelKey, topLevelKeys, file]);

  const handleImport = async () => {
    if (!selectedCollection) {
      showToast('Please select a target collection.', 'error');
      return;
    }
    if (parsedData.length === 0) {
      showToast('No data to import.', 'error');
      return;
    }

    // Check authentication state — apiClient will redirect on 401 if needed

    setIsLoading(true);
    setImportProgress(0);
    setImportStatus('Starting import...');

    try {
      // Use predefined schema instead of fetching
      const collection = availableCollections.find(col => col.id === selectedCollection);
      if (!collection) {
        throw new Error('Selected collection not found in available collections.');
      }
      const collectionSchema = { schema: collection.schema || [] };

      for (let i = 0; i < parsedData.length; i++) {
        const row = parsedData[i];
          const recordData: Record<string, unknown> = {};
        let recordId: string | undefined;

        for (const csvHeader in row) {
          const dbField = columnMappings[csvHeader] || csvHeader;
          const cellValue = row[csvHeader];
          if (dbField === 'id') {
            recordId = String(cellValue || '');
          } else if (dbField) {
            recordData[dbField] = String(cellValue ?? '');
          }
        }

        // Schema-based validation
        for (const field of collectionSchema.schema) {
          const raw = recordData[field.name];
          if (raw !== undefined && raw !== null && String(raw).length > 0) {
            if (field.type === 'number') {
              const numValue = Number(String(raw));
              (recordData as Record<string, number | string | boolean | Date | null>)[
                field.name
              ] = isNaN(numValue) ? 0 : numValue;
            } else if (field.type === 'bool') {
              const lowered = String(raw).toLowerCase();
              (recordData as Record<string, number | string | boolean | Date | null>)[
                field.name
              ] = ['true', '1', 'on', 'yes'].includes(lowered);
            } else if (field.type === 'date') {
              const date = new Date(String(raw));
              (recordData as Record<string, number | string | boolean | Date | null>)[
                field.name
              ] = isNaN(date.getTime()) ? null : date;
            } else {
              (recordData as Record<string, number | string | boolean | Date | null>)[
                field.name
              ] = String(raw);
            }
          }
          if (field.required && (recordData[field.name] === undefined || recordData[field.name] === '')) {
            throw new Error(`Missing required field '${field.name}' in row ${i + 2}`);
          }
        }

        if (importMode === 'create') {
          await apiClient.post(`/api/${selectedCollection}`, recordData);
        } else if (importMode === 'update') {
          if (!recordId) {
            console.warn(`Skipping row ${i + 2}: No 'id' column found for update mode.`);
            continue;
          }
          await apiClient.patch(`/api/${selectedCollection}/${recordId}`, recordData);
        } else if (importMode === 'upsert') {
          if (recordId) {
            try {
              await apiClient.patch(`/api/${selectedCollection}/${recordId}`, recordData);
            } catch (e: unknown) {
              if ((e as { status?: number }).status === 404) {
                await apiClient.post(`/api/${selectedCollection}`, { id: recordId, ...(recordData as object) });
              } else {
                throw e;
              }
            }
          } else {
            await apiClient.post(`/api/${selectedCollection}`, recordData);
          }
        }
        setImportProgress(Math.round(((i + 1) / parsedData.length) * 100));
      }
      showToast('Import completed successfully!', 'success');
      onClose();
    } catch (error: unknown) {
      showToast(`Import failed: ${(error as { message?: string }).message ?? String(error)}`, 'error');
      console.error('Import error:', error);
    } finally {
      setIsLoading(false);
      setImportStatus('');
      setImportProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-3xl text-slate-100">
        <h2 className="text-2xl font-bold text-cyan-400 mb-4">CSV Data Import Wizard</h2>

        {parsedData.length > 0 && (
          <div className="mb-4">
            {topLevelKeys.length > 1 && (
              <div className="mb-3">
                <label className="block text-slate-300 text-sm mb-1">JSON top-level key</label>
                <select
                  value={selectedTopLevelKey}
                  onChange={e => setSelectedTopLevelKey(e.target.value)}
                  className="px-2 py-1 rounded-md bg-slate-700 border border-slate-600 text-slate-100 text-sm"
                >
                  {topLevelKeys.map(k => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="collection-select" className="block text-slate-300 mb-2">
                  Target Collection:
                </label>
                <select
                  id="collection-select"
                  value={selectedCollection}
                  onChange={e => setSelectedCollection(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-slate-700 border border-slate-600 text-slate-100"
                >
                  <option value="">-- Select Collection --</option>
                  {availableCollections.map(col => (
                    <option key={col.id} value={col.id}>
                      {col.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="import-mode-select" className="block text-slate-300 mb-2">
                  Import Mode:
                </label>
                <select
                  id="import-mode-select"
                  value={importMode}
                  onChange={e => setImportMode(e.target.value as 'create' | 'update' | 'upsert')}
                  className="w-full px-3 py-2 rounded-md bg-slate-700 border border-slate-600 text-slate-100"
                >
                  <option value="create">Create New Records</option>
                  <option value="update">Update Existing Records (requires 'id' column)</option>
                  <option value="upsert">Upsert (Create or Update by 'id')</option>
                </select>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-slate-300 mb-2">
              Column Mapping (CSV Header to DB Field)
            </h3>
            <p className="text-sm text-slate-400 mb-3">
              Map your CSV columns to the corresponding database fields. If a field is not mapped,
              it will be skipped.
            </p>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-300">Mapping Preview</label>
                <input
                  type="checkbox"
                  checked={showMappingPreview}
                  onChange={e => setShowMappingPreview(e.target.checked)}
                  className="accent-cyan-500"
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    // Auto-map heuristics: exact match or common synonyms
                    setColumnMappings(prev => {
                      const next = { ...prev } as Record<string, string>;
                      const target = availableCollections.find(c => c.id === selectedCollection);
                      const targetFields = (target?.schema || []).map(f => f.name);
                      for (const h of headers) {
                        const lower = h.toLowerCase();
                        // exact match to a field
                        const exact = targetFields.find(f => f === h);
                        if (exact) {
                          next[h] = exact;
                          continue;
                        }
                        // try simple synonyms
                        const synonyms = ['sku', 'id', 'name', 'date', 'oldValue', 'newValue'];
                        const found = targetFields.find(f => synonyms.includes(f) && lower.includes(f));
                        if (found) {
                          next[h] = found;
                          continue;
                        }
                        // fallback to keeping header as-is
                        if (!next[h]) next[h] = h;
                      }
                      return next;
                    });
                  }}
                  className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                >
                  Auto-map
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                placeholder="Preset name (e.g. Amazon CSV)"
                className="px-2 py-1 rounded-md bg-slate-700 border border-slate-600 text-slate-100 text-sm"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!selectedCollection) {
                    showToast('Select a collection before saving presets.', 'warning');
                    return;
                  }
                  if (!presetName.trim()) {
                    showToast('Please enter a preset name.', 'warning');
                    return;
                  }
                  const key = selectedCollection;
                  // Save remotely
                  if (true) {
                    try {
                      // If a preset with the same name exists (local or remote), confirm overwrite
                      const name = presetName.trim();
                      const existsLocally = !!presets[key]?.[name];
                      const existsRemotely = !!remotePresetIds[key]?.[name];
                      if (existsLocally || existsRemotely) {
                        const ok = window.confirm(`A preset named "${name}" already exists. Overwrite?`);
                        if (!ok) return;
                      }
                      const res = (await saveRemotePreset(key, name, { ...columnMappings })) as unknown as PresetRecord;
                      // res may include id
                      setPresets(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [name]: { ...columnMappings } } }));
                      setRemotePresetIds(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [name]: res.id || '' } }));
                      setSelectedPreset(name);
                      showToast('Preset saved to server.', 'success');
                    } catch (e) {
                      showToast('Failed to save preset to server: ' + String(e), 'error');
                    }
                  }
                }}
                className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm"
              >
                Save Preset
              </button>
              <select
                value={selectedPreset}
                onChange={e => {
                  const name = e.target.value;
                  setSelectedPreset(name);
                  if (!name) return;
                  const key = selectedCollection;
                  const mapping = presets[key]?.[name];
                  if (mapping) {
                    setColumnMappings(mapping);
                    showToast('Preset loaded.', 'success');
                  } else {
                    showToast('Preset not found for this collection.', 'warning');
                  }
                }}
                className="px-2 py-1 rounded-md bg-slate-700 border border-slate-600 text-slate-100 text-sm"
              >
                <option value="">-- Load Preset --</option>
                {selectedCollection &&
                  Object.keys(presets[selectedCollection] || {}).map(name => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={async () => {
                  if (!selectedCollection || !selectedPreset) {
                    showToast('Select a collection and preset to delete.', 'warning');
                    return;
                  }
                  const key = selectedCollection;
                  // If remote id exists and authenticated, delete remote
                  const remoteId = remotePresetIds[key]?.[selectedPreset];
                  if (remoteId) {
                    try {
                      await deleteRemotePreset(remoteId);
                      setPresets(prev => {
                        const next = { ...prev };
                        delete next[key][selectedPreset];
                        return next;
                      });
                      setRemotePresetIds(prev => {
                        const next = { ...(prev || {}) } as Record<string, Record<string, string>>;
                        if (next[key]) delete next[key][selectedPreset];
                        return next;
                      });
                      setSelectedPreset('');
                      showToast('Preset deleted from server.', 'info');
                    } catch (e) {
                      showToast('Failed to delete preset on server: ' + String(e), 'error');
                    }
                    return;
                  }

                  const next = { ...presets };
                  if (next[key] && next[key][selectedPreset]) {
                    delete next[key][selectedPreset];
                    try {
                      localStorage.setItem('aida.mapping.presets', JSON.stringify(next));
                      setPresets(next);
                      setSelectedPreset('');
                      showToast('Preset deleted.', 'info');
                    } catch (e) {
                      showToast('Failed to delete preset: ' + String(e), 'error');
                    }
                  } else {
                    showToast('Preset not found.', 'warning');
                  }
                }}
                className="px-3 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm"
              >
                Delete Preset
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto border border-slate-700 rounded-md p-2 mb-4">
              {headers.map(header => (
                <div key={header} className="flex items-center mb-2">
                  <span className="w-1/3 font-medium text-slate-200">{header}</span>
                  <span className="mx-2 text-slate-400">-&gt;</span>
                  <input
                    type="text"
                    value={columnMappings[header] || header}
                    onChange={e =>
                      setColumnMappings(prev => ({ ...prev, [header]: e.target.value }))
                    }
                    placeholder="Database Field Name"
                    className="w-2/3 px-2 py-1 rounded-md bg-slate-700 border border-slate-600 text-slate-100 text-sm"
                  />
                </div>
              ))}
            </div>

            {showMappingPreview && parsedData.length > 0 && (
              <div className="mb-4">
                <h4 className="text-md font-semibold text-slate-300 mb-2">Preview (first 5 rows)</h4>
                <div className="overflow-auto bg-slate-900 p-2 rounded-md border border-slate-700">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr>
                        {headers.slice(0, 10).map(h => (
                          <th key={h} className="px-2 py-1 text-left text-slate-300 border-b border-slate-700">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="odd:bg-slate-800">
                          {headers.slice(0, 10).map(h => (
                            <td key={h} className="px-2 py-1 align-top text-slate-200">
                              {row[h]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={isLoading || !selectedCollection}
              className="w-full px-4 py-2 rounded-md bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-50"
            >
              {isLoading ? <LoadingSpinner /> : `Import ${parsedData.length} Records`}
            </button>
            {importStatus && (
              <div className="w-full mt-3">
                <p className="text-blue-300 text-sm mb-1">
                  {importStatus} {importProgress}%
                </p>
                <ProgressBar progress={importProgress} />
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-600 text-white font-semibold hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CsvImportModal;

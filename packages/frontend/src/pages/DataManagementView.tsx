import React, { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { useAuth } from '../context/AuthContext';
import { useInventoryContext } from '../context/InventoryContext';
import { useComponentInventory } from '../hooks/useInventoryModules';
import { useMessageBox } from '../components/common/MessageBox';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CsvImportModal from '../components/modules/CsvImportModal';
import {
  CsvFormatInstructions,
  SalesCsvInstructions,
} from '../components/modules/DataManagementInstructions';
import { availableCollections, COLLECTIONS } from '../lib/collections';
import {
  getLabelDimensions,
  PRINTER_PROFILES,
} from '../lib/printerConfig';
import type { LabelSize, PrinterType } from '../lib/printerConfig';

const LEGACY_LABEL_SIZE_MAP: Record<string, LabelSize> = {
  '2x1': '1x3.5in',
  '2x2': '2.25x1.25in',
  '4x2': '2x4in',
};

const LABEL_SIZE_LABELS: Record<LabelSize, string> = {
  '50x100mm': '50 × 100 mm (2" × 4") — Thermal',
  '62x100mm': '62 × 100 mm (2.4" × 4") — Thermal',
  '54x89mm': '54 × 89 mm (Credit Card) — Thermal',
  '4x6in': '4 × 6 inch (102 × 152 mm) — Shipping',
  '4x4in': '4 × 4 inch (102 × 102 mm) — Square',
  '2x4in': '2 × 4 inch (51 × 102 mm) — Standard',
  '1x3.5in': '1 × 3.5 inch — Address',
  '2.25x1.25in': '2.25 × 1.25 inch — Barcode',
  a4: 'A4 / Letter — Document',
};

type ImportAction = 'created' | 'updated';

type SalesImportRecord = {
  sku: string;
  year: number;
  week: number;
  itemsSold: number;
};

const DataManagementView = () => {
  const { user, pb } = useAuth();
  const { inventory: deviceInventory } = useInventoryContext();
  const { componentInventory } = useComponentInventory();
  const { showToast, showMessageBox } = useMessageBox();
  const [isExporting, setIsExporting] = useState(false);
  const [historyUploadTab, setHistoryUploadTab] = useState('devices');
  const [historyFile, setHistoryFile] = useState<File | null>(null);
  const [isUploadingHistory, setIsUploadingHistory] = useState(false);
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [isUploadingSales, setIsUploadingSales] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [firestoreFile, setFirestoreFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isClearingSales, setIsClearingSales] = useState(false);
  const [isMigratingRma, setIsMigratingRma] = useState(false);
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [csvImportFile, setCsvImportFile] = useState<File | null>(null);
  const [deviceBarcodeEnabled, setDeviceBarcodeEnabled] = useState(() => {
    try {
      return localStorage.getItem('aida_device_barcode_enabled') !== '0';
    } catch {
      return true;
    }
  });
  const [componentBarcodeEnabled, setComponentBarcodeEnabled] = useState(() => {
    try {
      return localStorage.getItem('aida_component_barcode_enabled') !== '0';
    } catch {
      return true;
    }
  });
  const [printerType, setPrinterType] = useState<PrinterType>(() => {
    try {
      const saved = localStorage.getItem('aida_printer_type') as PrinterType | null;
      return saved ?? PRINTER_PROFILES[0].type;
    } catch {
      return PRINTER_PROFILES[0].type;
    }
  });
  const [labelSize, setLabelSize] = useState<LabelSize>(() => {
    try {
      const savedRaw = localStorage.getItem('aida_label_size');
      if (!savedRaw) return '50x100mm';
      return LEGACY_LABEL_SIZE_MAP[savedRaw] ?? (savedRaw as LabelSize);
    } catch {
      return '50x100mm';
    }
  });

  useEffect(() => {
    localStorage.setItem('aida_device_barcode_enabled', deviceBarcodeEnabled ? '1' : '0');
  }, [deviceBarcodeEnabled]);

  useEffect(() => {
    localStorage.setItem('aida_component_barcode_enabled', componentBarcodeEnabled ? '1' : '0');
  }, [componentBarcodeEnabled]);

  useEffect(() => {
    localStorage.setItem('aida_printer_type', printerType);
  }, [printerType]);

  useEffect(() => {
    localStorage.setItem('aida_label_size', labelSize);
  }, [labelSize]);

  const selectedProfile = useMemo(
    () => PRINTER_PROFILES.find(profile => profile.type === printerType) ?? PRINTER_PROFILES[0],
    [printerType]
  );
  const currentDimensions = getLabelDimensions(labelSize);

  const handleExportData = async () => {
    if (!user) {
      showToast('You must be logged in to export data.', 'error');
      return;
    }

    setIsExporting(true);
    showToast('Starting data export...', 'info');

    const exportedData: { [key: string]: unknown[] } = {};

    try {
      for (const collection of availableCollections) {
        const records = await pb.collection(collection.id).getFullList();
        exportedData[collection.id] = records;
      }

      const jsonString = JSON.stringify(exportedData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aida-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Data export completed successfully!', 'success');
    } catch (error: unknown) {
      console.error('Error during data export:', error);
      showToast('An error occurred during the export. Check the console.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCsvImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCsvImportFile(file);
      setShowCsvImportModal(true);
    }
  };

  const parseCsvFile = <T extends Record<string, string>>(file: File): Promise<T[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse<T>(file, {
        header: true,
        skipEmptyLines: true,
        complete: results => resolve(results.data),
        error: error => reject(error),
      });
    });
  };

  const escapeFilterValue = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  // Helper to parse a JSON File into an array of records
  const parseJsonFile = async (file: File): Promise<Array<Record<string, unknown>>> => {
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Invalid JSON file.');
    }

    // If the JSON is an object with arrays, try to find the first array of objects
    if (Array.isArray(parsed)) {
      return (parsed as Array<unknown>).map(item => (item as Record<string, unknown>));
    }

    if (parsed && typeof parsed === 'object') {
      const values = Object.values(parsed as Record<string, unknown>);
      const firstArray = values.find(v => Array.isArray(v)) as Array<unknown> | undefined;
      if (firstArray) return firstArray.map(i => i as Record<string, unknown>);
    }

    throw new Error('JSON did not contain an array of records.');
  };

  const sanitizeRecordForCreate = (input: Record<string, unknown>) => {
    const cleaned: Record<string, unknown> = { ...input };
    delete cleaned.id;
    delete cleaned.created;
    delete cleaned.updated;
    delete cleaned.expand;
    delete cleaned.collection;
    delete cleaned.collectionId;
    delete cleaned.collectionName;
    return cleaned;
  };

  const normalizeSalesRecord = (input: Record<string, unknown>): SalesImportRecord => {
    const sku = String(input.sku ?? '').trim();
    const year = Number(input.year ?? 0);
    const week = Number(input.week ?? 0);
    const itemsSold = Number(input.itemsSold ?? input.netSales ?? 0);

    if (!sku || !Number.isFinite(year) || !Number.isFinite(week) || !Number.isFinite(itemsSold)) {
      throw new Error('Sales record is missing a valid sku, year, week, or itemsSold value.');
    }

    return {
      sku,
      year,
      week,
      itemsSold,
    };
  };

  const upsertSalesRecord = async (input: Record<string, unknown>): Promise<ImportAction> => {
    const payload = normalizeSalesRecord(input);
    const existing = await pb.collection(COLLECTIONS.SALES_DATA).getFullList({
      filter: `sku = "${escapeFilterValue(payload.sku)}" && year = ${payload.year} && week = ${payload.week}`,
      fields: 'id',
    });

    if (existing.length > 0) {
      await pb.collection(COLLECTIONS.SALES_DATA).update(existing[0].id, payload);
      return 'updated';
    }

    await pb.collection(COLLECTIONS.SALES_DATA).create(payload);
    return 'created';
  };

  const upsertInventoryRecordBySku = async (
    collectionId: typeof COLLECTIONS.INVENTORY_DEVICE | typeof COLLECTIONS.INVENTORY_COMPONENT,
    input: Record<string, unknown>
  ): Promise<ImportAction> => {
    const payload = sanitizeRecordForCreate(input);
    const sku = String(payload.sku ?? '').trim();

    if (!sku) {
      await pb.collection(collectionId).create(payload);
      return 'created';
    }

    const existing = await pb.collection(collectionId).getFullList({
      filter: `sku = "${escapeFilterValue(sku)}"`,
      fields: 'id',
    });

    if (existing.length > 0) {
      await pb.collection(collectionId).update(existing[0].id, payload);
      return 'updated';
    }

    await pb.collection(collectionId).create(payload);
    return 'created';
  };

  const importRecord = async (collectionId: string, input: Record<string, unknown>): Promise<ImportAction> => {
    if (collectionId === COLLECTIONS.SALES_DATA) {
      return upsertSalesRecord(input);
    }

    if (collectionId === COLLECTIONS.INVENTORY_DEVICE || collectionId === COLLECTIONS.INVENTORY_COMPONENT) {
      return upsertInventoryRecordBySku(collectionId, input);
    }

    await pb.collection(collectionId).create(sanitizeRecordForCreate(input));
    return 'created';
  };

  const restoreFromBackupObject = async (payload: Record<string, unknown>, source: string) => {
    let totalCreated = 0;
    let totalUpdated = 0;
    for (const collection of availableCollections) {
      const records = payload[collection.id];
      if (!Array.isArray(records)) {
        continue;
      }
      for (const record of records as Array<Record<string, unknown>>) {
        const result = await importRecord(collection.id, record);
        if (result === 'created') {
          totalCreated += 1;
        } else {
          totalUpdated += 1;
        }
      }
    }
    showToast(`Restore completed from ${source}. Created ${totalCreated} records and updated ${totalUpdated}.`, 'success');
  };

  const handleRestoreFile = (event: React.ChangeEvent<HTMLInputElement>, type: 'backup' | 'firestore') => {
    const file = event.target.files?.[0] || null;
    if (type === 'backup') {
      setRestoreFile(file);
    } else {
      setFirestoreFile(file);
    }
  };

  const handleRestoreData = async (type: 'backup' | 'firestore') => {
    const file = type === 'backup' ? restoreFile : firestoreFile;
    if (!file) {
      showToast('Please select a JSON file first.', 'error');
      return;
    }

    const confirmed = await showMessageBox(
      'Confirm Restore',
      `This will import records from ${file.name}. Continue?`,
      true
    );
    if (!confirmed) return;

    setIsRestoring(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        await restoreFromBackupObject(parsed as Record<string, unknown>, type === 'backup' ? 'JSON backup' : 'Firestore JSON');
      } else if (Array.isArray(parsed)) {
        let imported = 0;
        let updated = 0;
        for (const row of parsed as Array<Record<string, unknown>>) {
          const collectionId = String(row.collection || row.collectionId || COLLECTIONS.SALES_DATA);
          const payload = (row.data as Record<string, unknown>) || row;
          const result = await importRecord(collectionId, payload);
          if (result === 'created') {
            imported += 1;
          } else {
            updated += 1;
          }
        }
        showToast(`Imported ${imported} records and updated ${updated} from ${type === 'backup' ? 'JSON backup' : 'Firestore JSON'}.`, 'success');
      } else {
        throw new Error('Unsupported restore file format.');
      }

      if (type === 'backup') {
        setRestoreFile(null);
      } else {
        setFirestoreFile(null);
      }
    } catch (error: unknown) {
      showToast(`Restore failed: ${(error as { message?: string }).message ?? String(error)}`, 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSalesFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSalesFile(e.target.files?.[0] || null);
  };

  const handleSalesDataUpload = async () => {
    if (!salesFile) {
      showToast('Please select a sales data CSV file.', 'error');
      return;
    }
    setIsUploadingSales(true);
    try {
      if (salesFile.name.toLowerCase().endsWith('.json') || salesFile.type === 'application/json') {
        const jsonRecords = await parseJsonFile(salesFile);
        if (!jsonRecords || jsonRecords.length === 0) throw new Error('JSON file contains no records.');
        let created = 0;
        let updated = 0;
        for (const record of jsonRecords) {
          const result = await upsertSalesRecord(record);
          if (result === 'created') {
            created += 1;
          } else {
            updated += 1;
          }
        }
        showToast(`Successfully uploaded sales data. Created ${created} records and updated ${updated}.`, 'success');
        setSalesFile(null);
        const salesInput = document.getElementById('sales-upload-input') as HTMLInputElement;
        if (salesInput) salesInput.value = '';
      } else {
        const salesData = await parseCsvFile<Record<string, string>>(salesFile);
        if (!salesData || salesData.length === 0) {
          throw new Error('Sales data CSV is empty or invalid.');
        }

        let created = 0;
        let updated = 0;
        for (const record of salesData) {
          const result = await upsertSalesRecord(record);
          if (result === 'created') {
            created += 1;
          } else {
            updated += 1;
          }
        }

        showToast(`Successfully uploaded sales data. Created ${created} records and updated ${updated}.`, 'success');
        setSalesFile(null);
        const salesInput = document.getElementById('sales-upload-input') as HTMLInputElement;
        if (salesInput) salesInput.value = '';
      }
    } catch (error: unknown) {
      showToast(`Sales data upload failed: ${(error as { message?: string }).message ?? String(error)}`, 'error');
    } finally {
      setIsUploadingSales(false);
    }
  };

  const handleHistoryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHistoryFile(e.target.files?.[0] || null);
  };

  const processHistoryUpload = async (
    inventoryData: Array<{ sku?: string; id?: string }>,
    _inventoryCollectionName: string,
    historyData: Array<Record<string, unknown>>
  ) => {
    const skuMap = new Map(inventoryData.map(item => [String(item.sku), item.id]));
    const notFoundSkus = new Set<string>();
    let operationsCount = 0;

    for (const record of historyData) {
      const sku = String(record.sku ?? '');
      const date = String(record.date ?? '');
      const field = String(record.field ?? '');
      const oldValueRaw = record.oldValue;
      const newValueRaw = record.newValue;
      const changedByEmail = String(record.changedByEmail ?? '');
      if (!sku || !date || !field || newValueRaw === undefined) {
        console.warn('Skipping invalid history record (missing required fields):', record);
        continue;
      }

      const itemId = skuMap.get(sku);
      if (!itemId) {
        notFoundSkus.add(sku);
        continue;
      }

      const oldValueNum = oldValueRaw !== undefined ? Number(String(oldValueRaw)) : 0;
      const newValueNum = Number(String(newValueRaw));
      const historyEntry = {
        inventoryItemId: itemId,
        timestamp: new Date(date),
        field,
        oldValue: oldValueNum,
        newValue: newValueNum,
        change: newValueNum - oldValueNum,
        changedByEmail: changedByEmail || 'Manual Upload',
        operation: 'Manual History Upload',
      };

      await pb.collection(COLLECTIONS.STOCK_HISTORY).create(historyEntry);
      operationsCount++;
    }

    if (notFoundSkus.size > 0) {
      showToast(
        `SKUs not found: ${Array.from(notFoundSkus).join(', ')}. These records were skipped.`,
        'warning',
        8000
      );
    }

    if (operationsCount > 0) {
      showToast(`Successfully uploaded ${operationsCount} history records.`, 'success');
    } else {
      showToast('No valid history records found to upload.', 'info');
    }
  };

  const handleHistoryUpload = async () => {
    if (!historyFile) {
      showToast('Please select a CSV file for history upload.', 'error');
      return;
    }
    setIsUploadingHistory(true);
    try {
      if (historyFile.name.toLowerCase().endsWith('.json') || historyFile.type === 'application/json') {
        const jsonRecords = await parseJsonFile(historyFile);
        if (!jsonRecords || jsonRecords.length === 0) throw new Error('JSON file contains no records.');
        // Normalize to Record<string, unknown>[]
        const historyData = jsonRecords.map(r => ({ ...r } as Record<string, unknown>));
        if (historyUploadTab === 'devices') {
          await processHistoryUpload(deviceInventory, 'inventoryDevice', historyData);
        } else {
          await processHistoryUpload(componentInventory, 'inventoryComponent', historyData);
        }
        setHistoryFile(null);
        const historyInput = document.getElementById('history-upload-input') as HTMLInputElement;
        if (historyInput) historyInput.value = '';
      } else {
        const historyDataStringRecords = await parseCsvFile<Record<string, string>>(historyFile);
        const historyData = historyDataStringRecords.map(r => Object.fromEntries(
          Object.entries(r).map(([k, v]) => [k, v as unknown])
        )) as Array<Record<string, unknown>>;
        if (!historyData || historyData.length === 0) {
          throw new Error('CSV file is empty or invalid.');
        }

        if (historyUploadTab === 'devices') {
          await processHistoryUpload(deviceInventory, 'inventoryDevice', historyData);
        } else {
          await processHistoryUpload(componentInventory, 'inventoryComponent', historyData);
        }
        setHistoryFile(null);
        const historyInput = document.getElementById('history-upload-input') as HTMLInputElement;
        if (historyInput) historyInput.value = '';
      }
    } catch (error: unknown) {
      showToast(`History upload failed: ${(error as { message?: string }).message ?? String(error)}`, 'error');
    } finally {
      setIsUploadingHistory(false);
    }
  };

  const handleClearAllSalesData = async () => {
    const confirmed = await showMessageBox(
      'Clear Sales Data',
      'Delete all records from salesData? This cannot be undone.',
      true
    );
    if (!confirmed) return;

    setIsClearingSales(true);
    try {
      const records = await pb.collection(COLLECTIONS.SALES_DATA).getFullList();
      for (const record of records) {
        await pb.collection(COLLECTIONS.SALES_DATA).delete(record.id);
      }
      showToast(`Deleted ${records.length} sales records.`, 'success');
    } catch (error: unknown) {
      showToast(`Failed to clear sales data: ${(error as { message?: string }).message ?? String(error)}`, 'error');
    } finally {
      setIsClearingSales(false);
    }
  };

  const handleMigrateRmaNumbers = async () => {
    setIsMigratingRma(true);
    try {
      const records = await pb.collection(COLLECTIONS.RMA_ENTRIES).getFullList();
      const missingTicket = records.filter(record => !record.ticketNumber || String(record.ticketNumber).trim() === '');
      let updated = 0;
      for (let i = 0; i < missingTicket.length; i += 1) {
        const ticketNumber = `RMA-${String(i + 1).padStart(5, '0')}`;
        await pb.collection(COLLECTIONS.RMA_ENTRIES).update(missingTicket[i].id, { ticketNumber });
        updated += 1;
      }
      showToast(`Migration complete. Updated ${updated} RMA entries.`, 'success');
    } catch (error: unknown) {
      showToast(`RMA migration failed: ${(error as { message?: string }).message ?? String(error)}`, 'error');
    } finally {
      setIsMigratingRma(false);
    }
  };

  const rerunSetupWizard = async () => {
    const confirmed = window.confirm(
      'This will clear setup completion and reload the app. Continue?'
    );
    if (!confirmed) return;
    localStorage.removeItem('aida_setup_complete');
    window.location.href = '/';
  };

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-xl text-slate-100">
      <h2 className="text-2xl font-semibold text-cyan-400 mb-6 border-b pb-3 flex items-center gap-2">
        <i className="fas fa-cog" aria-hidden="true"></i>
        AIDA Management
      </h2>
      <div className="space-y-6">
        <section className="border-t border-slate-700 pt-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Data</p>
          <div className="bg-slate-700/40 rounded-lg p-5 border border-slate-600/50 space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-slate-200 mb-2">Export Data</h3>
              <p className="text-sm text-slate-400 mb-3">
                Export all collections to a single JSON backup file.
              </p>
              <button
                onClick={handleExportData}
                disabled={isExporting}
                className="px-6 py-2 rounded-md bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <i className="fas fa-file-export"></i>
                {isExporting ? 'Exporting...' : 'Export All Data'}
              </button>
            </div>

            <div className="border-t border-slate-600/50 pt-4 space-y-3">
              <h3 className="text-lg font-semibold text-slate-200">Restore Data</h3>
              <p className="text-sm text-slate-400">
                Restore from a full JSON backup or from Firestore-style export JSON.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label htmlFor="restore-json" className="block text-sm text-slate-300 mb-1">
                    JSON Backup Import
                  </label>
                  <input
                    id="restore-json"
                    type="file"
                    accept=".json"
                    onChange={e => handleRestoreFile(e, 'backup')}
                    className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-white hover:file:bg-blue-700"
                  />
                  <button
                    onClick={() => handleRestoreData('backup')}
                    disabled={isRestoring || !restoreFile}
                    className="mt-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isRestoring ? 'Restoring...' : 'Restore JSON'}
                  </button>
                </div>
                <div>
                  <label htmlFor="restore-firestore" className="block text-sm text-slate-300 mb-1">
                    Firestore Import JSON
                  </label>
                  <input
                    id="restore-firestore"
                    type="file"
                    accept=".json"
                    onChange={e => handleRestoreFile(e, 'firestore')}
                    className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-white hover:file:bg-indigo-700"
                  />
                  <button
                    onClick={() => handleRestoreData('firestore')}
                    disabled={isRestoring || !firestoreFile}
                    className="mt-2 px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isRestoring ? 'Restoring...' : 'Restore Firestore JSON'}
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-600/50 pt-4">
              <h3 className="text-lg font-semibold text-slate-200 mb-2">Import from CSV</h3>
              <p className="text-sm text-slate-400 mb-3">
                Import records from CSV or JSON into a selected collection.
              </p>
              <label
                htmlFor="csv-import-file"
                className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700"
              >
                <i className="fas fa-upload"></i>
                Select CSV File
              </label>
              <input
                type="file"
                id="csv-import-file"
                accept=".csv,.json"
                onChange={handleCsvImport}
                className="hidden"
              />
              {showCsvImportModal && csvImportFile && (
                <CsvImportModal
                  file={csvImportFile}
                  onClose={() => setShowCsvImportModal(false)}
                  showToast={showToast}
                  pb={pb}
                />
              )}
            </div>

            <div className="border-t border-slate-600/50 pt-4">
              <h3 className="text-lg font-semibold text-slate-200 mb-2">Sales Data Upload</h3>
              <div className="bg-slate-700 p-4 rounded-lg">
                <div className="flex items-center space-x-4">
                  <input
                    id="sales-upload-input"
                    type="file"
                    accept=".csv,.json"
                    onChange={handleSalesFileChange}
                    className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                  />
                  <button
                    onClick={handleSalesDataUpload}
                    disabled={isUploadingSales || !salesFile}
                    className="px-6 py-2 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 flex items-center justify-center w-32"
                  >
                    {isUploadingSales ? <LoadingSpinner /> : 'Upload Sales'}
                  </button>
                </div>
              </div>
              <SalesCsvInstructions />
            </div>

            <div className="border-t border-slate-600/50 pt-4">
              <button
                onClick={handleClearAllSalesData}
                disabled={isClearingSales}
                className="px-6 py-2 rounded-md bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {isClearingSales ? 'Clearing...' : 'Clear All Sales Data'}
              </button>
            </div>

            <div className="border-t border-slate-600/50 pt-4">
              <h3 className="text-lg font-semibold text-slate-200 mb-2">Manual Stock History Upload</h3>
              <div className="bg-slate-700 p-4 rounded-lg">
                <div className="flex border-b border-slate-600 mb-4">
                  <button
                    onClick={() => setHistoryUploadTab('devices')}
                    className={`py-2 px-4 font-medium text-sm w-1/2 transition-colors ${
                      historyUploadTab === 'devices'
                        ? 'border-b-2 border-blue-500 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Devices History
                  </button>
                  <button
                    onClick={() => setHistoryUploadTab('components')}
                    className={`py-2 px-4 font-medium text-sm w-1/2 transition-colors ${
                      historyUploadTab === 'components'
                        ? 'border-b-2 border-blue-500 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Components History
                  </button>
                </div>
                <div className="flex items-center space-x-4">
                  <input
                    id="history-upload-input"
                    type="file"
                    accept=".csv,.json"
                    onChange={handleHistoryFileChange}
                    className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                  />
                  <button
                    onClick={handleHistoryUpload}
                    disabled={isUploadingHistory || !historyFile}
                    className="px-6 py-2 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 flex items-center justify-center w-32"
                  >
                    {isUploadingHistory ? <LoadingSpinner /> : 'Upload History'}
                  </button>
                </div>
              </div>
              <CsvFormatInstructions />
            </div>
          </div>
        </section>

        <section className="border-t border-slate-700 pt-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
            Barcode Settings
          </p>
          <div className="bg-slate-700/40 rounded-lg p-5 border border-slate-600/50 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center justify-between rounded-md border border-slate-600/70 bg-slate-800/60 px-4 py-3">
                <span className="text-sm text-slate-200">Enable Device Barcode Features</span>
                <input
                  type="checkbox"
                  checked={deviceBarcodeEnabled}
                  onChange={e => setDeviceBarcodeEnabled(e.target.checked)}
                  className="h-4 w-4"
                />
              </label>
              <label className="flex items-center justify-between rounded-md border border-slate-600/70 bg-slate-800/60 px-4 py-3">
                <span className="text-sm text-slate-200">Enable Component Barcode Features</span>
                <input
                  type="checkbox"
                  checked={componentBarcodeEnabled}
                  onChange={e => setComponentBarcodeEnabled(e.target.checked)}
                  className="h-4 w-4"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm text-slate-300">Printer Type</span>
                <select
                  value={printerType}
                  onChange={e => {
                    const next = e.target.value as PrinterType;
                    setPrinterType(next);
                    const nextProfile = PRINTER_PROFILES.find(p => p.type === next);
                    const firstSupported =
                      nextProfile?.recommendedLabel ?? nextProfile?.supportedLabelSizes[0] ?? '50x100mm';
                    setLabelSize(firstSupported);
                  }}
                  className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2"
                >
                  {PRINTER_PROFILES.map(profile => (
                    <option key={profile.type} value={profile.type}>
                      {profile.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-slate-300">Label Size</span>
                <select
                  value={labelSize}
                  onChange={e => setLabelSize(e.target.value as LabelSize)}
                  className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2"
                >
                  {selectedProfile.supportedLabelSizes.map(size => (
                    <option key={size} value={size}>
                      {LABEL_SIZE_LABELS[size]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="rounded-md border border-slate-600/60 bg-slate-900/50 p-3 text-sm text-slate-400">
              Configuration Note: Printer and label preferences are stored locally on this browser
              with keys <span className="text-slate-200">aida_printer_type</span> and{' '}
              <span className="text-slate-200">aida_label_size</span>.
            </p>

            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Label Preview</h3>
              <div className="rounded-lg border border-dashed border-slate-500 bg-slate-900/60 p-4">
                <div
                  className="mx-auto flex items-center justify-center rounded border-2 border-cyan-500 bg-slate-800 text-cyan-300 text-xs font-semibold"
                  style={{
                    width: currentDimensions.width,
                    height: currentDimensions.height,
                    maxWidth: '100%',
                  }}
                >
                  {labelSize} ({currentDimensions.width} x {currentDimensions.height}, {currentDimensions.orientation})
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-700 pt-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
            Maintenance
          </p>
          <div className="bg-slate-700/40 rounded-lg p-5 border border-slate-600/50">
            <button
              onClick={handleMigrateRmaNumbers}
              disabled={isMigratingRma}
              className="px-6 py-2 rounded-md bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50"
            >
              {isMigratingRma ? 'Migrating...' : 'Migrate RMA Numbers'}
            </button>
          </div>
        </section>

        <section className="border-t border-slate-700 pt-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
            Re-run Setup Wizard
          </p>
          <div className="bg-red-900/20 rounded-lg p-5 border border-red-600/50">
            <p className="text-sm text-red-100 mb-3">
              Clear setup completion and launch setup flow again on reload.
            </p>
            <button
              onClick={rerunSetupWizard}
              className="px-6 py-2 rounded-md bg-red-600 text-white font-semibold hover:bg-red-700"
            >
              Re-run Setup Wizard
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DataManagementView;

import React, { useState } from 'react';
import Papa from 'papaparse';
import { useAuth } from '../context/AuthContext';
import { useInventoryContext } from '../context/InventoryContext';
import { useComponentInventory } from '../hooks/useComponentInventory';
import { useMessageBox } from '../components/common/MessageBox';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CsvImportModal from '../components/modules/CsvImportModal';
import {
  CsvFormatInstructions,
  SalesCsvInstructions,
} from '../components/modules/DataManagementInstructions';
import { availableCollections } from '../lib/collections';

const DataManagementView = () => {
  const { user, pb } = useAuth();
  const { inventory: deviceInventory } = useInventoryContext();
  const { componentInventory } = useComponentInventory();
  const { showToast } = useMessageBox();
  const [isExporting, setIsExporting] = useState(false);
  const [historyUploadTab, setHistoryUploadTab] = useState('devices');
  const [historyFile, setHistoryFile] = useState<File | null>(null);
  const [isUploadingHistory, setIsUploadingHistory] = useState(false);
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [isUploadingSales, setIsUploadingSales] = useState(false);
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [csvImportFile, setCsvImportFile] = useState<File | null>(null);

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
        for (const record of jsonRecords) {
          await pb.collection('salesData').create(record);
        }
        showToast(`Successfully uploaded ${jsonRecords.length} sales records.`, 'success');
        setSalesFile(null);
        const salesInput = document.getElementById('sales-upload-input') as HTMLInputElement;
        if (salesInput) salesInput.value = '';
      } else {
        // CSV path
        Papa.parse<Record<string, string>>(salesFile, {
          header: true,
          complete: async results => {
            const salesData = results.data as Array<Record<string, string>>;
            if (!salesData || salesData.length === 0) {
              throw new Error('Sales data CSV is empty or invalid.');
            }

            for (const record of salesData) {
              const pbRecord: Record<string, unknown> = {};
              Object.entries(record).forEach(([k, v]) => (pbRecord[k] = v));
              await pb.collection('salesData').create(pbRecord);
            }

            showToast(`Successfully uploaded ${salesData.length} sales records.`, 'success');
            setSalesFile(null);
            const salesInput = document.getElementById('sales-upload-input') as HTMLInputElement;
            if (salesInput) salesInput.value = '';
          },
        });
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

      await pb.collection(`stockHistory`).create(historyEntry);
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
        Papa.parse<Record<string, string>>(historyFile, {
          header: true,
          complete: async results => {
            const historyDataStringRecords = results.data as Array<Record<string, string>>;
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
          },
        });
      }
    } catch (error: unknown) {
      showToast(`History upload failed: ${(error as { message?: string }).message ?? String(error)}`, 'error');
    } finally {
      setIsUploadingHistory(false);
    }
  };

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-xl text-slate-100">
      <h2 className="text-2xl font-semibold text-cyan-400 mb-6 border-b pb-3">
        <i className="fas fa-database text-green-400 mr-2"></i>Data Management
      </h2>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">Export Data</h3>
          <p className="text-sm text-slate-400 mb-3">
            Export all data from all collections to a single JSON backup file.
          </p>
          <button
            onClick={handleExportData}
            disabled={isExporting}
            className="px-6 py-2 rounded-md bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            <i className="fas fa-file-export"></i>{' '}
            {isExporting ? 'Exporting...' : 'Export All Data'}
          </button>
        </div>
        <div className="border-t border-slate-700 pt-6">
          <h3 className="text-lg font-semibold text-slate-300 mb-2">Import from CSV</h3>
          <p className="text-sm text-slate-400 mb-3">
            Import data from a CSV file into a specified collection.
          </p>
          <label
            htmlFor="csv-import-file"
            className={`px-6 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 cursor-pointer`}
          >
            <i className="fas fa-upload"></i> 'Select CSV File'
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

        {/* --- NEW: Sales Data Upload Section --- */}
        <div className="border-t border-slate-700 pt-6">
          <h3 className="text-lg font-semibold text-slate-300 mb-2">Sales Data Upload</h3>
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
                className="px-6 py-2 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 flex items-center justify-center w-32"
              >
                {isUploadingSales ? <LoadingSpinner /> : 'Upload Sales'}
              </button>
            </div>
          </div>
          <SalesCsvInstructions />
        </div>

        {/* --- NEW: Stock History Upload Section --- */}
        <div className="border-t border-slate-700 pt-6">
          <h3 className="text-lg font-semibold text-slate-300 mb-2">Manual Stock History Upload</h3>

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
                className="px-6 py-2 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 flex items-center justify-center w-32"
              >
                {isUploadingHistory ? <LoadingSpinner /> : 'Upload History'}
              </button>
            </div>
          </div>
          <CsvFormatInstructions />
        </div>
      </div>
    </div>
  );
};

export default DataManagementView;

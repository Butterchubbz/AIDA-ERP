// src/views/DataManagementView.js
import React, { useState } from 'react';
import { getDocs, collection, writeBatch, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useInventoryContext } from '../context/InventoryContext'; // Add for history upload
import { useComponentInventory } from '../hooks/useComponentInventory'; // Add for history upload
import { useMessageBox } from '../components/MessageBox';
import { parseCsvFile } from '../utils/csvParser'; // Correct import
import ProgressBar from '../components/ProgressBar'; // Keep for existing functions
import LoadingSpinner from '../components/LoadingSpinner'; // Add for history upload

const DataManagementView = () => {
  const { currentUser, appId } = useAuth();
  const { inventory: vaultInventory } = useInventoryContext(); // Add for history upload
  const { componentInventory } = useComponentInventory(); // Add for history upload
  const { showToast, showMessageBox } = useMessageBox();
  const [isExporting, setIsExporting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  // States for new history upload feature
  const [historyUploadTab, setHistoryUploadTab] = useState('vaults');
  const [historyFile, setHistoryFile] = useState(null);
  const [isUploadingHistory, setIsUploadingHistory] = useState(false);
  // States for new sales data upload feature
  const [salesFile, setSalesFile] = useState(null);
  const [isUploadingSales, setIsUploadingSales] = useState(false);

  const handleExportData = async () => {
    if (!currentUser) {
      showToast('You must be logged in to export data.', 'error');
      return;
    }

    setIsExporting(true);
    showToast('Starting data export...', 'info');

    // This defines the mapping from the JSON file key (what the user expects)
    // to the actual collection name in Firestore. This is necessary because
    // some collection names were updated during the data model migration.
    const collectionMapping = {
      inventory: 'inventory', // For Vaults
      componentInventory: 'componentsInventory',
      refurbishedDevices: 'refurbishedDevices',
      amazonInventory: 'amazonPOs',
      rmaEntries: 'rmaEntries',
      inboundShipments: 'inboundShipments',
    };

    const exportedData = {};

    try {
      for (const jsonName in collectionMapping) {
        const firestoreName = collectionMapping[jsonName];
        // Use the NEW shared path for the export.
        const path = `artifacts/${appId}/${firestoreName}`;
        const collectionRef = collection(db, path);
        const querySnapshot = await getDocs(collectionRef);

        const docs = [];
        querySnapshot.forEach(doc => {
          docs.push({ id: doc.id, ...doc.data() });
        });
        // Use the original name for the key in the exported JSON file.
        exportedData[jsonName] = docs;
      }

      // Create a downloadable file
      const jsonString = JSON.stringify(exportedData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aida-v007-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Data export completed successfully!', 'success');
    } catch (error) {
      console.error('Error during data export:', error);
      showToast('An error occurred during the export. Check the console.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleConvertToCsv = async event => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    setIsProcessing(true);
    showToast('Processing JSON file...', 'info');

    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const data = JSON.parse(e.target.result);
        showToast(`File parsed. Found ${Object.keys(data).length} collections to convert.`, 'info');

        // Helper function to safely format a cell for CSV
        const escapeCsvCell = cell => {
          if (cell === null || cell === undefined) {
            return '';
          }
          // For objects (like timestamps), convert to a JSON string. For others, convert to a plain string.
          const cellString = typeof cell === 'object' ? JSON.stringify(cell) : String(cell);
          // If the string contains a comma, double quote, or newline, it must be wrapped in double quotes.
          if (cellString.includes(',') || cellString.includes('"') || cellString.includes('\n')) {
            // Within a quoted field, any existing double quotes must be doubled.
            return `"${cellString.replace(/"/g, '""')}"`;
          }
          return cellString;
        };

        for (const collectionName in data) {
          const documents = data[collectionName];

          if (!Array.isArray(documents) || documents.length === 0) {
            showToast(`Skipping empty collection: ${collectionName}`, 'info');
            continue;
          }

          // Dynamically generate headers from the keys of the first document
          const headers = Object.keys(documents[0]);

          // Create CSV content by joining headers, then mapping each document to a CSV row
          let csvContent = headers.join(',') + '\n';
          documents.forEach(doc => {
            const row = headers.map(header => escapeCsvCell(doc[header]));
            csvContent += row.join(',') + '\n';
          });

          // Create a Blob and trigger a download for the generated CSV file
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${collectionName}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          showToast(`Successfully created ${collectionName}.csv`, 'success');
        }
      } catch (error) {
        console.error('Error converting to CSV:', error);
        showToast('An error occurred during conversion. Check the console.', 'error');
      } finally {
        setIsProcessing(false);
        event.target.value = null; // Reset file input
      }
    };
    reader.readAsText(file);
  };

  const handleCsvImport = async event => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const confirmed = await showMessageBox(
      'Confirm CSV Import',
      `You are about to import ${files.length} file(s). This will overwrite any documents with matching IDs. This action cannot be undone.`,
      true
    );

    if (!confirmed) {
      event.target.value = null;
      return;
    }

    setIsProcessing(true);
    setImportStatus('Starting import...');
    setImportProgress(0);

    const collectionNameMapping = {
      inventory: 'inventory',
      componentInventory: 'componentsInventory',
      refurbishedDevices: 'refurbishedDevices',
      amazonInventory: 'amazonPOs',
      rmaEntries: 'rmaEntries',
      inboundShipments: 'inboundShipments',
    };

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const baseName = file.name.replace(/\.csv$/, '');
        const collectionName = collectionNameMapping[baseName];

        if (!collectionName) {
          showToast(`Skipping file: Unknown collection for "${file.name}"`, 'warning');
          continue;
        }

        setImportStatus(`Processing ${file.name}...`);
        showToast(`Processing ${file.name}...`, 'info');

        // FIX: Use parseCsvFile to correctly handle the entire file and its structure.
        const documentsData = await parseCsvFile(file);

        if (!documentsData || documentsData.length === 0) {
          showToast(`Skipping empty or invalid file: ${file.name}`, 'warning');
          continue;
        }

        const firstDocHeaders = Object.keys(documentsData[0]);
        if (!firstDocHeaders.includes('id')) {
          showToast(`Skipping file: "${file.name}" must contain an "id" column.`, 'error');
          continue;
        }

        // FIX: Iterate over parsed data, not raw lines.
        const docsToWrite = documentsData
          .map(doc => {
            const { id, ...data } = doc;
            if (!id) return null;

            // Attempt to convert numeric strings and parse JSON for Timestamps
            Object.keys(data).forEach(header => {
              let value = data[header];
              if (value) {
                if (value && !isNaN(value) && value.trim() !== '') {
                  data[header] = Number(value);
                } else {
                  try {
                    const parsed = JSON.parse(value);
                    if (
                      parsed &&
                      typeof parsed === 'object' &&
                      parsed.hasOwnProperty('seconds') &&
                      parsed.hasOwnProperty('nanoseconds')
                    ) {
                      data[header] = new Timestamp(parsed.seconds, parsed.nanoseconds);
                    } else {
                      data[header] = parsed;
                    }
                  } catch (e) {
                    // Keep as string if it's not a number or valid JSON
                  }
                }
              }
            });
            return { id, data };
          })
          .filter(Boolean); // Filter out any null entries from missing IDs

        const BATCH_LIMIT = 499;
        let batch = writeBatch(db);
        const collectionRef = collection(db, `artifacts/${appId}/${collectionName}`);

        for (let k = 0; k < docsToWrite.length; k++) {
          const docToWrite = docsToWrite[k];
          const docRef = doc(collectionRef, docToWrite.id);
          batch.set(docRef, docToWrite.data);

          if ((k + 1) % BATCH_LIMIT === 0 || k === docsToWrite.length - 1) {
            await batch.commit();
            batch = writeBatch(db);
          }
          setImportProgress(Math.round(((k + 1) / docsToWrite.length) * 100));
        }
        showToast(
          `Successfully imported ${docsToWrite.length} documents from "${file.name}".`,
          'success'
        );
      }
      showToast('All files processed!', 'success');
    } catch (error) {
      console.error('Error during CSV import:', error);
      showToast('An error occurred during the import. Check the console.', 'error');
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setImportStatus('');
        setImportProgress(0);
        event.target.value = null;
      }, 1000);
    }
  };

  // --- NEW: Sales Data Upload Functionality ---

  const handleSalesFileChange = e => {
    setSalesFile(e.target.files[0] || null);
  };

  const handleSalesDataUpload = async () => {
    if (!salesFile) {
      showToast('Please select a sales data CSV file.', 'error');
      return;
    }
    setIsUploadingSales(true);
    try {
      const salesData = await parseCsvFile(salesFile);
      if (!salesData || salesData.length === 0) {
        throw new Error('Sales data CSV is empty or invalid.');
      }

      const headers = Object.keys(salesData[0]);
      const requiredHeaders = ['sku', 'netSales', 'year', 'week'];
      if (!requiredHeaders.every(h => headers.includes(h))) {
        throw new Error(`CSV must contain headers: ${requiredHeaders.join(', ')}`);
      }

      const batch = writeBatch(db);
      const salesCollectionRef = collection(db, `artifacts/${appId}/salesData`);
      let operationsCount = 0;

      for (const record of salesData) {
        const { sku } = record;
        const numNetSales = Number(record.netSales);
        const numYear = Number(record.year);
        const numWeek = Number(record.week);

        // Add robust check to ensure all required fields are present and numeric fields are valid numbers.
        if (!sku || isNaN(numNetSales) || isNaN(numYear) || isNaN(numWeek)) {
          console.warn('Skipping invalid or non-numeric sales record:', record);
          continue;
        }

        const salesDocRef = doc(salesCollectionRef);
        batch.set(salesDocRef, {
          sku: sku.trim(),
          netSales: numNetSales,
          year: numYear,
          week: numWeek,
        });
        operationsCount++;
      }

      if (operationsCount > 0) await batch.commit();
      showToast(`Successfully uploaded ${operationsCount} sales records.`, 'success');
      setSalesFile(null);
      document.getElementById('sales-upload-input').value = '';
    } catch (error) {
      showToast(`Sales data upload failed: ${error.message}`, 'error');
    } finally {
      setIsUploadingSales(false);
    }
  };

  // --- NEW: Stock History Upload Functionality ---

  const handleHistoryFileChange = e => {
    setHistoryFile(e.target.files[0] || null);
  };

  const processHistoryUpload = async (inventoryData, inventoryCollectionName, historyData) => {
    const batch = writeBatch(db);
    let operationsCount = 0;
    const notFoundSkus = new Set();

    const skuMap = new Map(inventoryData.map(item => [item.sku, item.id]));

    for (const record of historyData) {
      const { sku, date, field, oldValue, newValue, changedByEmail } = record;
      if (!sku || !date || !field || newValue === undefined) {
        console.warn('Skipping invalid history record (missing required fields):', record);
        continue;
      }

      const itemId = skuMap.get(sku);
      if (!itemId) {
        notFoundSkus.add(sku);
        continue;
      }

      const historyCollectionRef = collection(
        db,
        `artifacts/${appId}/${inventoryCollectionName}/${itemId}/stockHistory`
      );
      const historyDocRef = doc(historyCollectionRef);

      const historyEntry = {
        timestamp: Timestamp.fromDate(new Date(date)),
        field,
        oldValue: oldValue !== undefined ? Number(oldValue) : 0,
        newValue: Number(newValue),
        change: Number(newValue) - (oldValue !== undefined ? Number(oldValue) : 0),
        changedByEmail: changedByEmail || 'Manual Upload',
        operation: 'Manual History Upload',
      };
      batch.set(historyDocRef, historyEntry);
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
      await batch.commit();
      showToast(
        `Successfully uploaded ${operationsCount} history records for ${inventoryCollectionName}.`,
        'success'
      );
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
      const historyData = await parseCsvFile(historyFile);
      if (!historyData || historyData.length === 0) {
        throw new Error('CSV file is empty or invalid.');
      }

      if (historyUploadTab === 'vaults') {
        await processHistoryUpload(vaultInventory, 'inventory', historyData);
      } else {
        await processHistoryUpload(componentInventory, 'components', historyData);
      }
      setHistoryFile(null);
      document.getElementById('history-upload-input').value = '';
    } catch (error) {
      showToast(`History upload failed: ${error.message}`, 'error');
    } finally {
      setIsUploadingHistory(false);
    }
  };

  const CsvFormatInstructions = () => (
    <div className="bg-slate-900/50 p-4 rounded-lg mt-4 text-slate-300 text-sm">
      <h4 className="font-semibold text-slate-200 mb-2">CSV Format Requirements:</h4>
      <p>The CSV file must contain a header row with the following columns:</p>
      <code className="block bg-slate-800 p-2 rounded-md my-2 text-xs text-cyan-300">
        sku,date,field,oldValue,newValue,changedByEmail
      </code>
      <ul className="list-disc list-inside space-y-2 pl-2">
        <li>
          <strong>sku:</strong> The SKU of the item. Must match an existing item in the selected
          inventory.
        </li>
        <li>
          <strong>date:</strong> The date of the history event (e.g., "2024-05-25T10:00:00Z"). Must
          be a valid date format.
        </li>
        <li>
          <strong>field:</strong> The specific stock quantity that was changed. The valid names
          depend on the inventory type you are uploading for:
          <ul className="list-['-_'] list-inside pl-4 mt-1 space-y-1">
            <li>
              For <strong>Vaults</strong>, valid fields are:{' '}
              <code className="text-xs text-cyan-300">wooStock</code>,{' '}
              <code className="text-xs text-cyan-300">productionStock</code>,{' '}
              <code className="text-xs text-cyan-300">warehouseStock</code>,{' '}
              <code className="text-xs text-cyan-300">reserveStock</code>.
            </li>
            <li>
              For <strong>Components</strong>, valid fields are:{' '}
              <code className="text-xs text-cyan-300">wooStock</code>,{' '}
              <code className="text-xs text-cyan-300">countedStock</code>.
            </li>
          </ul>
        </li>
        <li>
          <strong>oldValue:</strong> The stock quantity before the change.
        </li>
        <li>
          <strong>newValue:</strong> The stock quantity after the change.
        </li>
        <li>
          <strong>changedByEmail:</strong> (Optional) The email of the user who made the change.
          Defaults to "Manual Upload".
        </li>
      </ul>
    </div>
  );

  const SalesCsvInstructions = () => (
    <div className="bg-slate-900/50 p-4 rounded-lg mt-4 text-slate-300 text-sm">
      <h4 className="font-semibold text-slate-200 mb-2">Sales Data CSV Format:</h4>
      <p>The CSV file must contain a header row with the following columns:</p>
      <code className="block bg-slate-800 p-2 rounded-md my-2 text-xs text-cyan-300">
        sku,netSales,year,week
      </code>
      <ul className="list-disc list-inside space-y-1 pl-2">
        <li>
          <strong>sku:</strong> The SKU of the item sold.
        </li>
        <li>
          <strong>netSales:</strong> The total number of units sold for that week.
        </li>
        <li>
          <strong>year:</strong> The year of the sales week (e.g., 2024).
        </li>
        <li>
          <strong>week:</strong> The week number of the year (1-52).
        </li>
      </ul>
    </div>
  );

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-xl text-slate-100">
      <h2 className="text-2xl font-semibold text-cyan-400 mb-6 border-b pb-3">
        <i className="fas fa-database text-green-400 mr-2"></i>Data Management
      </h2>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">Export Data (v007)</h3>
          <p className="text-sm text-slate-400 mb-3">
            Export all data from your original user-specific collections to a single JSON backup
            file.
          </p>
          <button
            onClick={handleExportData}
            disabled={isExporting || isProcessing}
            className="px-6 py-2 rounded-md bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            <i className="fas fa-file-export"></i>{' '}
            {isExporting ? 'Exporting...' : 'Export All Data'}
          </button>
        </div>
        <div className="border-t border-slate-700 pt-6">
          <h3 className="text-lg font-semibold text-slate-300 mb-2">Convert JSON to CSV</h3>
          <p className="text-sm text-slate-400 mb-3">
            Select a JSON backup file to convert its contents into separate, downloadable CSV files
            for each data collection.
          </p>
          <label
            htmlFor="import-file"
            className={`px-6 py-2 rounded-md bg-orange-600 text-white font-semibold hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2 cursor-pointer ${
              isProcessing || isExporting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <i className="fas fa-file-csv"></i>{' '}
            {isProcessing ? 'Processing...' : 'Select JSON to Convert'}
          </label>
          <input
            type="file"
            id="import-file"
            accept=".json"
            onChange={handleConvertToCsv}
            disabled={isProcessing || isExporting}
            className="hidden"
          />
        </div>
        <div className="border-t border-slate-700 pt-6">
          <h3 className="text-lg font-semibold text-slate-300 mb-2">Import from CSV</h3>
          <p className="text-sm text-slate-400 mb-3">
            Import data from one or more CSV files. The filename (e.g., `inventory.csv`) determines
            the target collection. Each CSV must have an `id` column.
          </p>
          <label
            htmlFor="csv-import-file"
            className={`px-6 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 cursor-pointer ${
              isProcessing || isExporting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <i className="fas fa-upload"></i>{' '}
            {isProcessing ? 'Processing...' : 'Select CSV File(s)'}
          </label>
          <input
            type="file"
            id="csv-import-file"
            accept=".csv"
            onChange={handleCsvImport}
            disabled={isProcessing || isExporting}
            className="hidden"
            multiple
          />
          {isProcessing && importStatus && (
            <div className="w-full mt-3">
              <p className="text-blue-300 text-sm mb-1">
                {importStatus} {importProgress}%
              </p>
              <ProgressBar progress={importProgress} />
            </div>
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
                accept=".csv"
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
                onClick={() => setHistoryUploadTab('vaults')}
                className={`py-2 px-4 font-medium text-sm w-1/2 transition-colors ${
                  historyUploadTab === 'vaults'
                    ? 'border-b-2 border-blue-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Vaults History
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
                accept=".csv"
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

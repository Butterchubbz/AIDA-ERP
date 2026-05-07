import { useState, useRef } from 'react'
import { apiClient } from '../lib/apiClient'

interface ImportResult {
  recordsImported: number
  errors: Array<{ row: number; message: string }>
}

export function CSVImport() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'reading' | 'uploading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setFileName(file?.name ?? null)
    setStatus('idle')
    setResult(null)
    setErrorMessage(null)
  }

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      setErrorMessage('Please select a CSV file first.')
      return
    }

    setStatus('reading')
    setErrorMessage(null)
    setResult(null)

    let csvText: string
    try {
      csvText = await readFileAsText(file)
    } catch {
      setStatus('error')
      setErrorMessage('Failed to read file. Please try again.')
      return
    }

    setStatus('uploading')
    try {
      const data = await apiClient.post<ImportResult>('/api/data/import', { csv: csvText })
      setResult(data ?? null)
      setStatus('done')
    } catch (err: unknown) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  function handleReset() {
    if (fileInputRef.current) fileInputRef.current.value = ''
    setFileName(null)
    setStatus('idle')
    setResult(null)
    setErrorMessage(null)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Sales Data CSV
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          disabled={status === 'reading' || status === 'uploading'}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100
            disabled:opacity-50"
        />
        {fileName && (
          <p className="mt-1 text-xs text-gray-500">Selected: {fileName}</p>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Required columns: <code>sku</code>, <code>quantity</code>. Optional: <code>saleDate</code>, <code>salePrice</code>.
      </p>

      <div className="flex gap-2">
        <button
          onClick={handleUpload}
          disabled={!fileName || status === 'reading' || status === 'uploading'}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'reading' ? 'Reading…' : status === 'uploading' ? 'Uploading…' : 'Import CSV'}
        </button>

        {status !== 'idle' && (
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
          >
            Reset
          </button>
        )}
      </div>

      {status === 'done' && result && (
        <div className="rounded border border-green-200 bg-green-50 p-3 space-y-2">
          <p className="text-sm font-semibold text-green-800">
            ✓ {result.recordsImported} record{result.recordsImported !== 1 ? 's' : ''} imported
          </p>
          {result.errors.length > 0 && (
            <div>
              <p className="text-xs font-medium text-yellow-700 mb-1">
                {result.errors.length} row{result.errors.length !== 1 ? 's' : ''} skipped:
              </p>
              <ul className="text-xs text-yellow-700 space-y-0.5 list-disc list-inside">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    {e.row > 0 ? `Row ${e.row}: ` : ''}{e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {status === 'error' && errorMessage && (
        <div className="rounded border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}
    </div>
  )
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('FileReader error'))
    reader.readAsText(file, 'utf-8')
  })
}

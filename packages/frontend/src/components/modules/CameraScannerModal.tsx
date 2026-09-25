/**
 * Hybrid barcode scanner modal.
 * Uses native BarcodeDetector API (Chrome/Edge) when available,
 * falls back to react-zxing (ZXing WASM) automatically.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useZxing } from 'react-zxing'

// ---------------------------------------------------------------------------
// BarcodeDetector native type declaration (not yet in standard TS lib)
// ---------------------------------------------------------------------------
interface BarcodeDetectorResult {
  rawValue: string
  format: string
}

interface BarcodeDetectorApi {
  detect(image: HTMLVideoElement): Promise<BarcodeDetectorResult[]>
}

interface BarcodeDetectorConstructor {
  new (options?: { formats: string[] }): BarcodeDetectorApi
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor
  }
}

const NATIVE_FORMATS = [
  'code_128',
  'code_39',
  'ean_13',
  'ean_8',
  'qr_code',
  'upc_a',
  'upc_e',
  'data_matrix',
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface CameraScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScan: (barcode: string) => void
  title?: string
}

// ---------------------------------------------------------------------------
// Native BarcodeDetector path
// ---------------------------------------------------------------------------
function NativeScanner({
  onScan,
  onError,
}: {
  onScan: (value: string) => void
  onError: (msg: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetectorApi | null>(null)
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scannedRef = useRef(false)

  const stopStream = useCallback(() => {
    if (pollingRef.current) clearTimeout(pollingRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        detectorRef.current = new window.BarcodeDetector!({ formats: NATIVE_FORMATS })

        const poll = async () => {
          if (cancelled || scannedRef.current) return
          if (videoRef.current && detectorRef.current) {
            try {
              const results = await detectorRef.current.detect(videoRef.current)
              if (results.length > 0 && results[0].rawValue && !scannedRef.current) {
                scannedRef.current = true
                stopStream()
                onScan(results[0].rawValue)
                return
              }
            } catch {
              // detection frame error — keep polling
            }
          }
          pollingRef.current = setTimeout(poll, 300)
        }

        pollingRef.current = setTimeout(poll, 300)
      } catch (err: unknown) {
        if (!cancelled) {
          console.error('Camera error:', err)
          onError(err instanceof Error ? err.message : 'Camera access denied')
        }
      }
    }

    start()

    return () => {
      cancelled = true
      stopStream()
    }
  }, [onScan, onError, stopStream])

  return <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
}

// ---------------------------------------------------------------------------
// ZXing fallback path
// ---------------------------------------------------------------------------
function ZxingScanner({
  onScan,
  onError,
}: {
  onScan: (value: string) => void
  onError: (msg: string) => void
}) {
  const scannedRef = useRef(false)

  const { ref } = useZxing({
    onDecodeResult(result) {
      if (!scannedRef.current) {
        scannedRef.current = true
        onScan(result.getText())
      }
    },
    onDecodeError() {
      // per-frame decode failures are normal — ignore
    },
    onError(err) {
      onError(err instanceof Error ? err.message : 'Camera error')
    },
  })

  return (
    <video
      ref={ref}
      className="h-full w-full object-cover"
      playsInline
      muted
    />
  )
}

// ---------------------------------------------------------------------------
// Modal shell
// ---------------------------------------------------------------------------
export default function CameraScannerModal({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Barcode',
}: CameraScannerModalProps) {
  const hasNative = typeof window !== 'undefined' && Boolean(window.BarcodeDetector)
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanned, setScanned] = useState(false)

  // Reset state whenever modal re-opens
  useEffect(() => {
    if (isOpen) {
      setCameraError(null)
      setScanned(false)
    }
  }, [isOpen])

  const handleScan = useCallback(
    (barcode: string) => {
      setScanned(true)
      onScan(barcode)
      onClose()
    },
    [onScan, onClose]
  )

  const handleError = useCallback((msg: string) => {
    setCameraError(msg)
  }, [])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase ${
                hasNative
                  ? 'bg-emerald-900/50 text-emerald-300'
                  : 'bg-blue-900/50 text-blue-300'
              }`}
            >
              {hasNative ? 'Native API Mode' : 'Fallback Engine Mode'}
            </span>
            <button
              onClick={onClose}
              className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-100"
              aria-label="Close scanner"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Camera viewport */}
        <div className="relative aspect-square bg-black">
          {!isLocalhost && (
            <div className="text-amber-400 text-xs text-center mb-2 px-4 py-2">
              Warning: Camera requires localhost. Open via http://localhost:8090
            </div>
          )}
          {cameraError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-red-300">Camera error: {cameraError}</p>
              <p className="text-xs text-slate-400">
                Make sure camera permissions are granted in browser settings.
              </p>
            </div>
          ) : scanned ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-emerald-300">✓ Scanned</p>
            </div>
          ) : (
            <>
              {/* Live camera feed */}
              {hasNative ? (
                <NativeScanner onScan={handleScan} onError={handleError} />
              ) : (
                <ZxingScanner onScan={handleScan} onError={handleError} />
              )}

              {/* Targeting crosshair overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                  className="h-48 w-48 rounded-lg"
                  style={{
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                    border: '2px solid rgba(34,211,238,0.7)',
                  }}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer hint */}
        {!cameraError && !scanned && (
          <p className="px-4 py-2 text-center text-xs text-slate-400">
            Point camera at a barcode — detection is automatic
          </p>
        )}
        {cameraError && (
          <div className="px-4 py-2 text-center text-sm text-red-400">Camera error: {cameraError}</div>
        )}
      </div>
    </div>
  )
}

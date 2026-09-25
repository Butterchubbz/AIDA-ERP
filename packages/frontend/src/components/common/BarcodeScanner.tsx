import { useCallback, useEffect, useRef, useState } from 'react'

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  title?: string
  className?: string
}

const SUPPORTED_BARCODE_FORMATS = [
  'code_128',
  'code_39',
  'ean_13',
  'ean_8',
  'qr_code',
  'upc_a',
  'upc_e',
  'data_matrix',
]

function playScanBeep(): void {
  if (typeof window === 'undefined') return

  const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtor) return

  try {
    const audioContext = new AudioCtor()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.type = 'square'
    oscillator.frequency.value = 1800

    gainNode.gain.setValueAtTime(0.001, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.02)
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12)

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.12)
    void audioContext.close().catch(() => undefined)
  } catch {
    // Audio playback is optional and should never block scanning.
  }
}

export default function BarcodeScanner({
  onScan,
  title = 'Scan / Enter SKU or Serial',
  className = '',
}: BarcodeScannerProps) {
  const manualInputRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorIntervalRef = useRef<number | null>(null)
  const [manualValue, setManualValue] = useState('')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [isCameraRunning, setIsCameraRunning] = useState(false)

  const hasSecureCameraAccess =
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    Boolean(navigator.mediaDevices?.getUserMedia)

  const stopCamera = useCallback(() => {
    if (detectorIntervalRef.current) {
      window.clearInterval(detectorIntervalRef.current)
      detectorIntervalRef.current = null
    }

    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setIsCameraRunning(false)
  }, [])

  const triggerScan = useCallback(
    (barcode: string) => {
      const cleaned = barcode.trim()
      if (!cleaned) return

      playScanBeep()
      onScan(cleaned)
      setManualValue('')
      stopCamera()
    },
    [onScan, stopCamera]
  )

  const handleManualSubmit = useCallback(() => {
    triggerScan(manualValue)
  }, [manualValue, triggerScan])

  const detectBarcodeFromVideo = useCallback(async () => {
    if (!videoRef.current || typeof window === 'undefined') return

    const BarcodeDetectorCtor = (window as typeof window & { BarcodeDetector?: new (options?: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector

    if (!BarcodeDetectorCtor) return

    try {
      const detector = new BarcodeDetectorCtor({ formats: SUPPORTED_BARCODE_FORMATS })
      const results = await detector.detect(videoRef.current)
      const firstResult = results.find(item => item?.rawValue && item.rawValue.trim().length > 0)

      if (firstResult) {
        triggerScan(firstResult.rawValue)
      }
    } catch {
      // Detection failures are expected as frames move; we keep the camera live.
    }
  }, [triggerScan])

  const startCamera = useCallback(async () => {
    if (!hasSecureCameraAccess) {
      setCameraError('Camera scanner requires a secure context. Please access the app via http://localhost:3001 instead of the IP address.')
      return
    }

    setCameraError(null)

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = devices.filter(device => device.kind === 'videoinput')
      setCameraDevices(videoInputs)

      const preferredVideo = videoInputs.find(device => device.deviceId === selectedCameraId) ?? videoInputs[0]
      const stream = await navigator.mediaDevices.getUserMedia({
        video: preferredVideo
          ? { deviceId: { exact: preferredVideo.deviceId } }
          : { facingMode: 'environment' },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }

      setIsCameraRunning(true)
      setSelectedCameraId(preferredVideo?.deviceId ?? selectedCameraId)

      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        detectorIntervalRef.current = window.setInterval(() => {
          void detectBarcodeFromVideo()
        }, 350)
      }
    } catch (error: unknown) {
      console.error('Barcode scanner camera error:', error)

      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setCameraError('Camera permission was denied. Please allow access to the camera and try again.')
      } else {
        setCameraError('Unable to start the camera. Please check your browser permissions or use the manual scanner field.')
      }

      stopCamera()
    }
  }, [detectBarcodeFromVideo, hasSecureCameraAccess, selectedCameraId, stopCamera])

  useEffect(() => {
    if (manualInputRef.current) {
      manualInputRef.current.focus()
    }
  }, [])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  const handleDeviceChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextCameraId = event.target.value
      setSelectedCameraId(nextCameraId)
      if (isCameraRunning) {
        stopCamera()
        void startCamera()
      }
    },
    [isCameraRunning, startCamera, stopCamera]
  )

  if (!hasSecureCameraAccess) {
    return (
      <div className={`rounded-xl border border-amber-500/40 bg-slate-950/80 p-4 shadow-lg ${className}`}>
        <div className="mb-3 flex items-center gap-2 text-amber-400">
          <span className="text-lg">⚠</span>
          <span className="text-sm font-semibold uppercase tracking-wide">Camera access unavailable</span>
        </div>

        <p className="mb-4 text-sm text-amber-200">
          Camera scanner requires a secure context. Please access the app via http://localhost:3001 instead of the IP address.
        </p>

        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-300">
          Scan / Enter SKU or Serial
        </label>
        <input
          ref={manualInputRef}
          value={manualValue}
          onChange={event => setManualValue(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleManualSubmit()
            }
          }}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          placeholder="Scan or type barcode then press Enter"
          autoFocus
        />
      </div>
    )
  }

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-950/80 p-3 shadow-xl ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (isCameraRunning) {
                stopCamera()
              } else {
                void startCamera()
              }
            }}
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20"
          >
            {isCameraRunning ? 'Stop Camera' : 'Start Camera'}
          </button>
        </div>
      </div>

      {cameraError && (
        <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {cameraError}
        </div>
      )}

      <div className="relative overflow-hidden rounded-lg border border-slate-700 bg-black">
        <video
          ref={videoRef}
          className="h-56 w-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {!isCameraRunning && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/70 text-xs font-medium uppercase tracking-[0.18em] text-slate-300">
            Camera offline
          </div>
        )}

        {isCameraRunning && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-32 w-40 rounded-lg border-2 border-cyan-400/80 bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]" />
          </div>
        )}
      </div>

      {cameraDevices.length > 0 && (
        <div className="mt-3">
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
            Camera
          </label>
          <select
            value={selectedCameraId}
            onChange={handleDeviceChange}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          >
            {cameraDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-4">
        <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.14em] text-slate-300">
          Scan / Enter SKU or Serial
        </label>
        <input
          ref={manualInputRef}
          value={manualValue}
          onChange={event => setManualValue(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleManualSubmit()
            }
          }}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          placeholder="Scan or type barcode then press Enter"
          autoFocus
        />
      </div>
    </div>
  )
}

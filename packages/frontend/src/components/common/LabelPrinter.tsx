import { useCallback } from 'react'

export interface LabelPrintData {
  sku: string
  name?: string
  description?: string
  location?: string
  workspace?: string
  serialNumber?: string
}

interface LabelPrinterProps {
  labelData: LabelPrintData
  labelSize?: string
  buttonLabel?: string
  className?: string
}

const DEFAULT_LABEL_SIZE = '50x100mm'

function buildBarcodeSvg(value: string): string {
  const safeValue = (value || '000000').replace(/\s+/g, '').slice(0, 48) || '000000'

  const stripeSegments: string[] = []
  for (let index = 0; index < safeValue.length * 8; index += 1) {
    const charCode = safeValue.charCodeAt(index % safeValue.length)
    const width = ((charCode + index * 13) % 5) + 1
    const isBar = (index + charCode) % 3 !== 0
    stripeSegments.push(
      `<rect x="${index * 2}" y="0" width="${width}" height="38" fill="${isBar ? '#111827' : '#ffffff'}" />`
    )
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="44" viewBox="0 0 ${safeValue.length * 16} 44" preserveAspectRatio="xMidYMid meet">
      <rect width="100%" height="100%" fill="#ffffff" />
      ${stripeSegments.join('')}
      <text x="50%" y="33" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#111827" letter-spacing="1">${safeValue}</text>
    </svg>
  `
}

function createPrintDocument({
  labelData,
  labelSize,
}: {
  labelData: LabelPrintData
  labelSize: string
}): string {
  const size = labelSize || DEFAULT_LABEL_SIZE
  const barcodeSvg = buildBarcodeSvg(labelData.serialNumber || labelData.sku)
  const displayName = labelData.name || labelData.description || 'AIDA Item'
  const locationText = labelData.location || 'Unassigned location'
  const workspaceText = labelData.workspace || 'Default workspace'

  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Label Print</title>
        <style>
          @media print {
            @page {
              size: 50mm 100mm;
              margin: 0;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
            }
            body {
              width: 50mm;
              height: 100mm;
              margin: 0;
              padding: 4mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              font-family: Arial, Helvetica, sans-serif;
              color: #111827;
              background: #ffffff;
            }
            .label {
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              gap: 3mm;
            }
            .sku {
              font-size: 12pt;
              font-weight: 700;
              line-height: 1.2;
              word-break: break-word;
            }
            .meta {
              font-size: 8pt;
              line-height: 1.4;
            }
            .barcode-wrap {
              border: 1px solid #111827;
              padding: 2mm 1mm;
              background: #ffffff;
            }
            .barcode-wrap svg {
              display: block;
              width: 100%;
              height: 44px;
            }
          }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="meta">${size}</div>
          <div class="barcode-wrap">${barcodeSvg}</div>
          <div class="sku">${(labelData.sku || 'N/A').replace(/&/g, '&amp;')}</div>
          <div class="meta"><strong>Name:</strong> ${displayName.replace(/&/g, '&amp;')}</div>
          <div class="meta"><strong>Location:</strong> ${locationText.replace(/&/g, '&amp;')}</div>
          <div class="meta"><strong>Workspace:</strong> ${workspaceText.replace(/&/g, '&amp;')}</div>
          ${labelData.serialNumber ? `<div class="meta"><strong>Serial:</strong> ${labelData.serialNumber.replace(/&/g, '&amp;')}</div>` : ''}
        </div>
      </body>
    </html>`
}

export default function LabelPrinter({
  labelData,
  labelSize = DEFAULT_LABEL_SIZE,
  buttonLabel = 'Print Label',
  className = '',
}: LabelPrinterProps) {
  const printLabel = useCallback(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return

    const iframe = document.createElement('iframe')
    iframe.setAttribute('title', 'AIDA label print frame')
    iframe.style.position = 'fixed'
    iframe.style.width = '0px'
    iframe.style.height = '0px'
    iframe.style.border = '0'
    iframe.style.opacity = '0'
    iframe.style.pointerEvents = 'none'
    iframe.style.left = '-9999px'
    iframe.style.top = '-9999px'

    document.body.appendChild(iframe)

    const iframeDoc = iframe.contentWindow?.document
    if (!iframeDoc) {
      document.body.removeChild(iframe)
      return
    }

    iframeDoc.open()
    iframeDoc.write(createPrintDocument({ labelData, labelSize }))
    iframeDoc.close()

    const printAttempt = () => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } finally {
        window.setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe)
          }
        }, 500)
      }
    }

    window.setTimeout(printAttempt, 200)
  }, [labelData, labelSize])

  return (
    <button
      type="button"
      onClick={printLabel}
      className={`rounded border border-cyan-600/50 bg-cyan-600/10 px-2.5 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-600/20 ${className}`}
    >
      {buttonLabel}
    </button>
  )
}

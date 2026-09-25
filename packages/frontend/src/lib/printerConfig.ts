/** Supported printer driver families for barcode and label output. */
export type PrinterType = 'zebra' | 'dymo' | 'brother' | 'generic';
/** Supported label sizes exposed in the management UI. */
export type LabelSize =
  | '50x100mm'
  | '62x100mm'
  | '54x89mm'
  | '4x6in'
  | '4x4in'
  | '2x4in'
  | '1x3.5in'
  | '2.25x1.25in'
  | 'a4';

/** Describes a printable device profile and its supported media sizes. */
export interface PrinterProfile {
  type: PrinterType;
  label: string;
  recommendedLabel: LabelSize;
  supportedLabelSizes: LabelSize[];
}

/** Built-in printer profiles available to the settings UI. */
export const PRINTER_PROFILES: PrinterProfile[] = [
  {
    type: 'zebra',
    label: 'Zebra (ZPL)',
    recommendedLabel: '50x100mm',
    supportedLabelSizes: ['50x100mm', '62x100mm', '4x6in', '4x4in', '2x4in', '1x3.5in', '2.25x1.25in'],
  },
  {
    type: 'dymo',
    label: 'DYMO LabelWriter',
    recommendedLabel: '54x89mm',
    supportedLabelSizes: ['54x89mm', '1x3.5in', '2.25x1.25in', '2x4in'],
  },
  {
    type: 'brother',
    label: 'Brother QL',
    recommendedLabel: '62x100mm',
    supportedLabelSizes: ['62x100mm', '2x4in', '4x6in', '1x3.5in'],
  },
  {
    type: 'generic',
    label: 'Generic Browser Print',
    recommendedLabel: 'a4',
    supportedLabelSizes: ['50x100mm', '62x100mm', '54x89mm', '4x6in', '4x4in', '2x4in', '1x3.5in', '2.25x1.25in', 'a4'],
  },
];

/** Returns printable dimensions for a configured label size. */
export function getLabelDimensions(labelSize: LabelSize): {
  width: string;
  height: string;
  orientation: 'landscape' | 'portrait' | 'square';
} {
  switch (labelSize) {
    case '50x100mm':
      return { width: '100mm', height: '50mm', orientation: 'landscape' };
    case '62x100mm':
      return { width: '100mm', height: '62mm', orientation: 'landscape' };
    case '54x89mm':
      return { width: '89mm', height: '54mm', orientation: 'landscape' };
    case '4x6in':
      return { width: '6in', height: '4in', orientation: 'landscape' };
    case '4x4in':
      return { width: '4in', height: '4in', orientation: 'square' };
    case '2x4in':
      return { width: '4in', height: '2in', orientation: 'landscape' };
    case '1x3.5in':
      return { width: '3.5in', height: '1in', orientation: 'landscape' };
    case '2.25x1.25in':
      return { width: '2.25in', height: '1.25in', orientation: 'landscape' };
    case 'a4':
      return { width: '210mm', height: '297mm', orientation: 'portrait' };
    default:
      return { width: '100mm', height: '50mm', orientation: 'landscape' };
  }
}

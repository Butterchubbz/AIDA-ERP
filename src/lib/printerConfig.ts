/** Supported printer driver families for barcode and label output. */
export type PrinterType = 'zebra' | 'dymo' | 'brother' | 'generic';
/** Supported label sizes exposed in the management UI. */
export type LabelSize = '2x1' | '2x2' | '4x2';

/** Describes a printable device profile and its supported media sizes. */
export interface PrinterProfile {
  type: PrinterType;
  label: string;
  supportedLabelSizes: LabelSize[];
}

/** Built-in printer profiles available to the settings UI. */
export const PRINTER_PROFILES: PrinterProfile[] = [
  { type: 'zebra', label: 'Zebra (ZPL)', supportedLabelSizes: ['2x1', '2x2', '4x2'] },
  { type: 'dymo', label: 'DYMO LabelWriter', supportedLabelSizes: ['2x1', '2x2'] },
  { type: 'brother', label: 'Brother QL', supportedLabelSizes: ['2x1', '2x2', '4x2'] },
  { type: 'generic', label: 'Generic Browser Print', supportedLabelSizes: ['2x1', '2x2', '4x2'] },
];

/** Returns printable dimensions for a configured label size. */
export function getLabelDimensions(labelSize: LabelSize): { width: number; height: number; unit: 'in' } {
  switch (labelSize) {
    case '2x1':
      return { width: 2, height: 1, unit: 'in' };
    case '2x2':
      return { width: 2, height: 2, unit: 'in' };
    case '4x2':
      return { width: 4, height: 2, unit: 'in' };
    default:
      return { width: 2, height: 1, unit: 'in' };
  }
}

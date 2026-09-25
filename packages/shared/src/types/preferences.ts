export type LabelUnit = 'mm' | 'inch'

export interface PrinterSettings {
  defaultLabelSize: string
  unit: LabelUnit
  width: number
  height: number
  showSku: boolean
  showName: boolean
  showLocation: boolean
  showWorkspace: boolean
}

export interface ScannerSettings {
  preferredCameraId?: string
  autoStart: boolean
  beepOnSuccess: boolean
}

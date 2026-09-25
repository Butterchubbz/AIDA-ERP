export interface HistoryRecord {
  id: string;
  inventoryItemId: string;
  field: string;
  oldValue: number;
  newValue: number;
  change: number;
  operation: string;
  changedByEmail?: string;
  timestamp?: string;
  created?: string;
}

export interface HistoryEntry {
  date: string;
  value: number;
}

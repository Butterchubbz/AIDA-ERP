export interface HistoryRecord {
  id: string;
  timestamp: string; // ISO string or human-readable date
  field: string;
  oldValue: string | number | null;
  newValue: string | number | null;
  change: number; // numeric delta
  changedByEmail?: string;
}

export interface HistoryEntry {
  date: string;
  value: number;
}

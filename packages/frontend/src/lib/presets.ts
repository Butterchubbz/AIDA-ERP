import { apiClient } from './apiClient';

export interface PresetRecord {
  id?: string;
  userId: string;
  collectionId: string;
  name: string;
  mapping: Record<string, string>;
}

export async function listRemotePresets(collectionId: string): Promise<PresetRecord[]> {
  return apiClient.get<PresetRecord[]>(`/api/presets/${encodeURIComponent(collectionId)}`);
}

export async function saveRemotePreset(collectionId: string, name: string, mapping: Record<string, string>): Promise<PresetRecord> {
  return apiClient.post<PresetRecord>(`/api/presets/${encodeURIComponent(collectionId)}`, { name, mapping });
}

export async function deleteRemotePreset(recordId: string): Promise<void> {
  await apiClient.delete(`/api/presets/record/${encodeURIComponent(recordId)}`);
}
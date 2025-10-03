import { pb } from './pocketbase';

export interface PresetRecord {
  id?: string;
  userId: string;
  collectionId: string;
  name: string;
  mapping: Record<string, string>;
}

const COLLECTION_NAME = 'mappingPresets';

export async function listRemotePresets(collectionId: string) {
  if (!pb.authStore.isValid) return [] as PresetRecord[];
  // Query presets for this user and collection
  const userId = pb.authStore.model?.id;
  const items = await pb.collection(COLLECTION_NAME).getFullList({ filter: `userId = "${userId}" && collectionId = "${collectionId}"` });
  return items as unknown as PresetRecord[];
}

export async function saveRemotePreset(collectionId: string, name: string, mapping: Record<string, string>) {
  if (!pb.authStore.isValid) throw new Error('Not authenticated');
  const userId = pb.authStore.model?.id as string;
  const existing = await pb.collection(COLLECTION_NAME).getFirstListItem(`userId = "${userId}" && collectionId = "${collectionId}" && name = "${name}"`).catch(() => null);
  if (existing) {
    return pb.collection(COLLECTION_NAME).update(existing.id, { mapping });
  }
  return pb.collection(COLLECTION_NAME).create({ userId, collectionId, name, mapping });
}

export async function deleteRemotePreset(recordId: string) {
  if (!pb.authStore.isValid) throw new Error('Not authenticated');
  return pb.collection(COLLECTION_NAME).delete(recordId);
}

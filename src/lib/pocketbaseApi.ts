import type { RecordListOptions } from 'pocketbase'
import { COLLECTIONS } from './collections'
import { pb } from './pocketbase'

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS]

export async function listRecords<T>(
  collection: CollectionName,
  options?: RecordListOptions
): Promise<T[]> {
  const records = await pb.collection(collection).getFullList(options)
  return records as unknown as T[]
}

export async function getRecord<T>(
  collection: CollectionName,
  id: string
): Promise<T> {
  const record = await pb.collection(collection).getOne(id)
  return record as unknown as T
}

export async function createRecord<T>(
  collection: CollectionName,
  data: FormData | object
): Promise<T> {
  const record = await pb.collection(collection).create(data)
  return record as unknown as T
}

export async function updateRecord<T>(
  collection: CollectionName,
  id: string,
  data: FormData | object
): Promise<T> {
  const record = await pb.collection(collection).update(id, data)
  return record as unknown as T
}

export async function deleteRecord(collection: CollectionName, id: string): Promise<void> {
  await pb.collection(collection).delete(id)
}

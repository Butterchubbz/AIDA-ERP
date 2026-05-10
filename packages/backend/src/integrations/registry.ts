import type PocketBase from 'pocketbase'

export interface CredentialField {
  key: string
  label: string
  type: 'text' | 'url' | 'password'
  required?: boolean
  placeholder?: string
  helpText?: string
}

export interface SyncResult {
  recordsImported: number
  errors: string[]
  unknownSkuCount: number
}

export interface IntegrationAdapter {
  id: string
  name: string
  description: string
  credentialFields: CredentialField[]
  sync(credentials: Record<string, string>, pb: PocketBase): Promise<SyncResult>
}

import { WooCommerceAdapter } from './woocommerce.js'

const REGISTRY: Record<string, IntegrationAdapter> = {
  woocommerce: WooCommerceAdapter,
}

export function getAdapter(type: string): IntegrationAdapter | undefined {
  return REGISTRY[type]
}

export function listAdapters(): Omit<IntegrationAdapter, 'sync'>[] {
  return Object.values(REGISTRY).map(({ id, name, description, credentialFields }) => ({
    id,
    name,
    description,
    credentialFields,
  }))
}

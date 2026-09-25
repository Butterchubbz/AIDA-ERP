export type WorkspaceType = 'device' | 'component' | 'accessory' | 'refurb_device' | 'refurb_component'

export interface InventoryWorkspace {
  id: string
  name: string
  type: WorkspaceType
  description?: string
  created: string
  updated: string
}

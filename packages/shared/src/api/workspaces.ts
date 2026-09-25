import type { InventoryWorkspace, WorkspaceType } from '../types/workspace.js'

export type GetWorkspacesResponse = InventoryWorkspace[]

export interface CreateWorkspaceRequest {
  name: string
  type: WorkspaceType
  description?: string
}

export interface UpdateWorkspaceRequest {
  name?: string
  type?: WorkspaceType
  description?: string
}

export interface WorkspaceDetailResponse {
  item: InventoryWorkspace
}

export interface DeleteWorkspaceResponse {
  ok: boolean
  deletedId: string
}

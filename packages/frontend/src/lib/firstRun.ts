import { apiClient } from './apiClient'

export const SETUP_STORAGE_KEY = 'aida_setup_complete'
export const FIRST_RUN_TIMEOUT_MS = 2000

export type FirstRunStatus = 'checking' | 'first-run' | 'ready'

export function hasSetupCompleted(): boolean {
  try {
    return localStorage.getItem(SETUP_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

export async function detectFirstRun(): Promise<boolean> {
  if (hasSetupCompleted()) {
    return false
  }

  try {
    const res = await apiClient.get<{ user: null | object }>('/api/auth/session')
    // If session returns a user, we're not first-run
    return res.user === null
  } catch {
    return false
  }
}
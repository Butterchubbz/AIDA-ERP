import { apiClient, isApiError } from './apiClient'

export const FIRST_RUN_TIMEOUT_MS = 2000

export type FirstRunStatus = 'checking' | 'first-run' | 'ready'

export function hasSetupCompleted(): boolean {
  return false
}

export async function detectFirstRun(): Promise<boolean> {
  try {
    const res = await apiClient.get<{ setupComplete: boolean }>('/api/setup/check-health')
    return !res.setupComplete
  } catch (error: unknown) {
    if (isApiError(error)) {
      console.warn(`[FirstRun] setup health check failed with ${error.status}: ${error.message}`)
    } else {
      console.warn('[FirstRun] setup health check failed:', error)
    }

    return false
  }
}
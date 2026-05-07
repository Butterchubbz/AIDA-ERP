import { viteEnv } from './env'

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

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), FIRST_RUN_TIMEOUT_MS)

  try {
    const baseUrl = String(viteEnv.VITE_PB_URL || 'http://127.0.0.1:8090').replace(/\/$/, '')
    const response = await fetch(
      `${baseUrl}/api/collections/users/records?page=1&perPage=1`,
      {
        method: 'GET',
        signal: controller.signal,
      }
    )

    if (!response.ok) {
      return false
    }

    const payload = (await response.json()) as { totalItems?: number }
    return Number(payload.totalItems ?? 0) === 0
  } catch {
    return false
  } finally {
    window.clearTimeout(timeoutId)
  }
}
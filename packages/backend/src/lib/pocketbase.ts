import PocketBase from 'pocketbase'

/**
 * PocketBase singleton configured with admin auth.
 * Uses superuser credentials (PB v0.30) to bypass user auth limitations.
 * All database operations are performed as admin.
 */

const pb = new PocketBase(process.env.PB_URL || 'http://127.0.0.1:8090')

// Disable auto-cancellation — the SDK cancels concurrent requests to the same
// collection by default (a UI debounce feature). On the backend, every request
// is independent and must complete, so this must be off.
pb.autoCancellation(false)

/**
 * Authenticate as superuser using stored credentials.
 * Retries up to maxAttempts times with linear backoff to handle PocketBase
 * starting slightly after the backend process (common in the launcher).
 */
export async function authenticatePocketBase(maxAttempts = 10, retryDelayMs = 1000): Promise<void> {
  const email = process.env.PB_ADMIN_EMAIL
  const password = process.env.PB_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error(
      'PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD environment variables must be set'
    )
  }

  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pb.collection('_superusers').authWithPassword(email, password)
      console.log(`[PocketBase] Authenticated as superuser: ${email}`)
      return
    } catch (err: unknown) {
      lastErr = err
      const isConnRefused =
        err instanceof Error && err.message.includes('ECONNREFUSED')
      if (isConnRefused && attempt < maxAttempts) {
        console.log(`[PocketBase] Not ready yet, retrying (${attempt}/${maxAttempts})...`)
        await new Promise(resolve => setTimeout(resolve, retryDelayMs))
      } else {
        break
      }
    }
  }

  console.error('[PocketBase] Authentication failed:', lastErr)
  throw lastErr
}

/**
 * Verify that the PocketBase connection is authenticated.
 */
export function isPbAuthenticated(): boolean {
  return pb.authStore.isValid
}

export default pb

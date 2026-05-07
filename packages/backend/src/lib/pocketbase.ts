import PocketBase from 'pocketbase'

/**
 * PocketBase singleton configured with admin auth.
 * Uses superuser credentials (PB v0.30) to bypass user auth limitations.
 * All database operations are performed as admin.
 */

const pb = new PocketBase(process.env.PB_URL || 'http://127.0.0.1:8090')

/**
 * Authenticate as superuser using stored credentials.
 * Called once on backend startup.
 */
export async function authenticatePocketBase(): Promise<void> {
  const email = process.env.PB_ADMIN_EMAIL
  const password = process.env.PB_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error(
      'PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD environment variables must be set'
    )
  }

  try {
    // PocketBase v0.30 uses collection('_superusers') for admin auth
    await pb.collection('_superusers').authWithPassword(email, password)
    console.log(`[PocketBase] Authenticated as superuser: ${email}`)
  } catch (err) {
    console.error('[PocketBase] Authentication failed:', err)
    throw err
  }
}

/**
 * Verify that the PocketBase connection is authenticated.
 */
export function isPbAuthenticated(): boolean {
  return pb.authStore.isValid
}

export default pb

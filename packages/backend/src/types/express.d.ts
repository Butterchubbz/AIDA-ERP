import type { User } from '@aida/shared'

declare global {
  namespace Express {
    interface Request {
      /**
       * User authenticated via JWT in aida_session cookie.
       * Set by authMiddleware; undefined if not authenticated.
       */
      user?: User

      /**
       * CSRF token from request body/query (verified by csrfMiddleware).
       * Present if CSRF validation passed.
       */
      csrfToken?: string
    }
  }
}

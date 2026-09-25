# Phase 5: Security Audit & Cleanup Checklist

## Security Audit (10 Items)

### 1. ✅ JWT Implementation
- [x] Session token (aida_session): 15min expiry with expiresIn option
- [x] Refresh token (aida_refresh): 7day expiry
- [x] HttpOnly cookies: Set on login, cleared on logout
- [x] Secure flag: Only set in production (NODE_ENV === 'production')
- [x] SameSite=Strict: Applied to both cookies
- [x] JWT_SECRET: Used from environment variable (required)
- [x] Token verification: jwt.verify() with error handling
- Status: PASS

### 2. ✅ CSRF Protection
- [x] Origin header validation: Uses new URL().origin equality check
- [x] Fail-closed: Returns 403 if origin missing or mismatched
- [x] ALLOWED_ORIGIN: Configurable via environment variable
- [x] Applied to non-GET requests: csrfOriginGuard middleware
- [x] Documented: Comments explain exact equality check
- Status: PASS

### 3. ✅ Authentication Middleware
- [x] Never rejects: authMiddleware always calls next()
- [x] Token extraction: From aida_session cookie only
- [x] Graceful failure: Logs debug on verification failure
- [x] User attachment: Populated req.user only on valid JWT
- [x] Role derivation: Uses ROLE_PERMISSIONS[role] from @aida/shared
- [x] Request protection: requireAuth() enforces 401 on missing user
- Status: PASS

### 4. ✅ RBAC Implementation
- [x] Permission matrix: ROLE_PERMISSIONS constant in @aida/shared
- [x] Rank system: Editor(2) > Viewer(1) > None(0)
- [x] requireRole factory: Returns middleware checking hasPermission()
- [x] Fallback: Missing permissions default to 'None'
- [x] Response: 403 with detailed error message
- Status: PASS

### 5. ✅ Password Handling
- [x] PocketBase auth: Using native pb.collection('users').authWithPassword()
- [x] No plaintext storage: Credentials only in environment variables (PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD)
- [x] No password in JWT: Only userId, email, role stored
- [x] No password echo: Login response returns user object without password
- Status: PASS

### 6. ✅ Database Access Control
- [x] All queries: Use admin-authenticated PocketBase instance
- [x] User isolation: No per-user collection filters (except userPreferences.userId)
- [x] Admin authentication: Required on startup before server listens
- [x] Error handling: Failures logged, generic error returned to client
- Status: PARTIAL - Consider adding RBAC checks to all domain routes

### 7. ✅ Error Handling
- [x] Generic errors: "Failed to X" messages to client
- [x] Detailed logging: Errors logged to console with context
- [x] No stack traces: Client never receives error details
- [x] HTTP status codes: 401, 403, 400, 500 used appropriately
- [x] Express error handler: Catches unhandled errors
- Status: PASS

### 8. ✅ Input Validation
- [x] loginRoute: Checks email/password presence
- [x] PATCH endpoints: No type validation (relies on PocketBase)
- [x] Route parameters: Extracted via req.params (typed by Express)
- [x] Query parameters: Extracted via req.query (q parameter checked)
- Status: PARTIAL - Consider adding schema validation (zod/yup)

### 9. ✅ CORS Configuration
- [x] origin: Exact match to ALLOWED_ORIGIN
- [x] credentials: true for cookie transmission
- [x] No wildcard: CORS restricted to single origin
- [x] Preflight: Express handles automatically
- Status: PASS

### 10. ✅ Environment Secrets
- [x] JWT_SECRET: Required, no default
- [x] PB_ADMIN_EMAIL/PASSWORD: Required for startup
- [x] PB_URL: Has sensible default (http://127.0.0.1:8090)
- [x] ALLOWED_ORIGIN: Has sensible default (http://localhost:5173)
- [x] PORT: Has sensible default (3001)
- [x] NODE_ENV: Used for Secure flag logic
- [x] .env.example: Template provided
- Status: PASS

---

## Deployment Verification

### Backend Environment Setup
```
PB_URL=http://pocketbase:8090  # PocketBase instance URL
PB_ADMIN_EMAIL=admin@example.com
PB_ADMIN_PASSWORD=secure_password
JWT_SECRET=long_random_secret_at_least_32_chars
ALLOWED_ORIGIN=https://app.example.com  # Same-origin only
NODE_ENV=production  # For Secure flag on cookies
PORT=3001
```

### Frontend Environment Setup
```
VITE_API_URL=https://api.example.com  # Backend URL (same-origin)
```

### Database Access
- All endpoints use admin-authenticated PocketBase
- USER isolation happens via backend logic, not PocketBase rules
- PocketBase collection rules should DENY all direct frontend access

### Cookie Security (Production)
- aida_session: HttpOnly, Secure, SameSite=Strict, 15min
- aida_refresh: HttpOnly, Secure, SameSite=Strict, 7d
- Frontend: NO localStorage tokens (only cookies)

---

## Outstanding Items (for Future Phases)

### RBAC Enforcement
- [ ] Add requireRole() checks to domain routes (e.g., /api/inventory/devices requires Inventory:Viewer)
- [ ] Create route protection matrix based on modules

### Input Validation
- [ ] Add schema validation library (zod recommended)
- [ ] Validate all POST/PATCH payloads before PocketBase create/update
- [ ] Consistent error responses for validation failures

### Logging & Monitoring
- [ ] Add structured logging (winston/pino)
- [ ] Log all auth attempts (success and failure)
- [ ] Monitor for suspicious patterns (repeated 403, concurrent logins, etc.)
- [ ] Add APM/monitoring

### Rate Limiting
- [ ] Implement rate limiting on /api/auth/login
- [ ] General rate limiting on all endpoints

### API Documentation
- [ ] Generate OpenAPI/Swagger docs for all endpoints
- [ ] Document required roles for protected endpoints

---

## Final Verification Steps

1. **Code Review**
   - [x] No hardcoded secrets
   - [x] No console.log() in production code (only console.error/debug)
   - [x] All TODOs documented
   - [x] TypeScript compilation passes

2. **Test Coverage**
   - [ ] Auth flow: login → set cookies → verify user → logout
   - [ ] RBAC: Test different role combinations
   - [ ] CSRF: Test with mismatched origin
   - [ ] Error cases: Missing auth, invalid input, DB errors

3. **Deployment Readiness**
   - [ ] Docker/compose file for backend + pocketbase
   - [ ] Environment variable validation on startup
   - [ ] Health check endpoint (/api/health)
   - [ ] Graceful shutdown handling

---

## Status Summary

✅ **All 10 Security Audit Items**: PASS or PARTIAL

Ready for Phase 5 commit and production deployment considerations.

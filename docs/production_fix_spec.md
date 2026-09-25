# Production Fix Specification

## Problem

The browser receives HTML with MIME type text/html when requesting JavaScript or CSS assets
from the Express backend. This is caused by the static asset middleware being registered
after the CSRF and auth security guards, and after all API routes. Requests for
/assets/*.js fall through the entire middleware stack, hit the SPA fallback, and get
index.html served with the wrong MIME type.

Additionally, the csrfOriginGuard and authMiddleware currently run against every incoming
request, including asset requests, which adds unnecessary overhead and risks future
regression.

The launcher currently opens the browser to PocketBase on port 8090. The application
is now served by Express on port 3001, so the browser target must change.

## 1. Middleware Pipeline

The required order in packages/backend/src/index.ts is:

### Stage 1: Body and cookie parsing

These must come first so all downstream middleware can read request data.

1. express.json()
2. express.urlencoded({ extended: true })
3. cookieParser()

### Stage 2: CORS

Must run before any response is sent, including static file responses.

4. cors({ origin: ALLOWED_ORIGINS, credentials: true })

### Stage 3: Static file serving

Must run before security guards and before any SPA fallback.
Placing static middleware here ensures asset requests are served immediately
and never interact with CSRF checks, auth token verification, or API routes.

5. express.static(publicDir, { fallthrough: true })

### Stage 4: API security guards

Only apply to requests that have not been handled by static middleware.
Both guards must check req.path and skip immediately if the path does not
start with /api.

6. csrfOriginGuard
7. authMiddleware

### Stage 5: API routes

All /api/* routes follow the security guards.

8. /api/health
9. /api/setup/*
10. /api/auth/*
11. All requireAuth routes

### Stage 6: SPA fallback

Only reached by non-API, non-asset requests. Returns index.html.
Never returns index.html for requests with a file extension.
Returns 404 for extension-based asset paths that do not resolve to a static file.

12. SPA fallback GET *

### Stage 7: Error handler

13. express error handler

## 2. Security Guard Optimization

### csrfOriginGuard path check

Add at the top of the csrfOriginGuard function body, before all other logic:

```ts
if (!req.path.startsWith('/api')) {
  next()
  return
}
```

Rationale: non-API requests are either static assets or SPA navigations.
Neither requires CSRF validation. CSRF protection applies only to
state-changing API operations.

### authMiddleware path check

Add at the top of the authMiddleware function body, before cookie parsing:

```ts
if (!req.path.startsWith('/api')) {
  next()
  return
}
```

Rationale: asset requests do not carry session cookies and do not need
JWT verification. The auth middleware is a no-op for these requests anyway,
but skipping explicitly prevents any future code path from inadvertently
touching req.user for asset requests.

### Why both guards still appear in the global middleware chain

Moving them to route-level middleware on every /api route would require
duplicating them on every registration call and would risk missed coverage
on new routes. Keeping them global with an /api prefix fast-path is the
correct balance of safety and performance.

## 3. Dual-Service Launcher

### Required behavior for AIDA_LAUNCHER.ps1

1. Start PocketBase on 8090 if not already listening.
2. Start the Express backend via npm run start:backend targeting port 3001 if not already listening.
3. Wait for both ports to become active using the existing Wait-ForPort utility.
4. Open the default browser to http://localhost:3001 (Express, not PocketBase).

### Current bug

The launcher's final line opens $pbUrl (http://localhost:8090), which is the PocketBase
admin panel. The frontend app is served by Express. The browser should open to $backendUrl
(http://localhost:3001).

### Corrected launcher terminal lines

The existing Start-Process at the end of the file should use $backendUrl instead of $pbUrl.
The accompanying Write-Host should reflect port 3001.

## 4. Acceptance Criteria

1. GET /assets/<hash>.js returns Content-Type: application/javascript and status 200.
2. GET /assets/<hash>.css returns Content-Type: text/css and status 200.
3. GET /some/spa/route returns index.html with status 200.
4. GET /assets/nonexistent.js returns status 404, not index.html.
5. POST /api/auth/login from a disallowed origin returns 403.
6. GET /api/auth/session without a cookie returns 401 from requireAuth-protected downstream.
7. AIDA_LAUNCHER.ps1 opens the browser to http://localhost:3001.

---
## Ownership and Rights
Made by Patrick Walton with AI.
Copyright (c) 2026 Patrick Walton. All rights reserved.
This project is privately owned by Patrick Walton and is not company-owned unless explicitly stated in a signed written agreement.

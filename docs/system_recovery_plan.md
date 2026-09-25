# System Recovery Plan

## Source Documents

- docs/production_fix_spec.md
- docs/setup_fix_spec.md
- docs/deployment_fix.md
- docs/deploy_plan.md

## Current State

1. express.static is registered after all API routes and security guards — causing assets to fall through to the SPA fallback.
2. csrfOriginGuard and authMiddleware run on every request including static asset paths.
3. AIDA_LAUNCHER.ps1 opens the browser to http://localhost:8090 (PocketBase) instead of http://localhost:3001 (Express).

## Work Split

### Claude Sonnet (The Senior)

Update packages/backend/src/index.ts, middleware/csrf.ts, and middleware/auth.ts.

Tasks:

1. In index.ts, move express.static(publicDir) to immediately after the CORS middleware, before csrfOriginGuard and authMiddleware.
2. In csrf.ts, add a req.path.startsWith('/api') fast-path at the top of csrfOriginGuard that calls next() and returns for non-API paths.
3. In auth.ts, add a req.path.startsWith('/api') fast-path at the top of authMiddleware that calls next() and returns for non-API paths.
4. Keep all requireAuth usages on routes unchanged.

Expected outcome:

1. Asset requests reach express.static before any security logic.
2. CSRF guard and auth token decoding are bypassed for asset and SPA navigation requests.
3. All API routes remain protected identically to before.

### Claude Haiku (The Junior)

Update AIDA_LAUNCHER.ps1.

Tasks:

1. Change the final Start-Process call from $pbUrl to $backendUrl.
2. Change the accompanying Write-Host message from PocketBase URL to backend URL.

Expected outcome:

1. Launcher opens the browser to http://localhost:3001 after both services are ready.
2. Both Wait-ForPort checks remain in place for ports 8090 and 3001.

### GPT-4.1 (The Intern)

Execute the frontend build and verify backend public output.

Tasks:

1. Run npm run build from the repository root.
2. Confirm packages/backend/public/index.html exists.
3. Confirm packages/backend/public/assets contains at least one .js file and at least one .css file.

Expected outcome:

1. Build succeeds with no errors.
2. Backend public directory contains dated hashed assets.

### GPT-5 (MIME Audit)

Verify MIME type headers for built assets served by Express.

Audit steps:

1. Identify one .js file in packages/backend/public/assets.
2. Request it via HTTP from the running backend and check the Content-Type header.
3. Request one .css file and check Content-Type.
4. Request a deep SPA route and confirm it returns index.html.
5. Request a nonexistent .js asset and confirm 404, not HTML.

Expected outcome:

1. .js assets return Content-Type application/javascript.
2. .css assets return Content-Type text/css.
3. SPA routes return index.html with 200.
4. Missing asset paths return 404.

## Execution Sequence

1. Senior: reorder middleware stack in index.ts, add path guards to csrf.ts and auth.ts.
2. Junior: fix launcher browser target.
3. Intern: run build and verify output.
4. GPT-5: run MIME audit against running backend.
5. Run tsc --noEmit in packages/backend to confirm no type regressions.

## Completion Checklist

- [ ] packages/backend/public/assets contains hashed .js and .css files
- [ ] GET /assets/*.js returns Content-Type application/javascript
- [ ] GET /assets/*.css returns Content-Type text/css
- [ ] GET /nonexistent/spa/route returns index.html
- [ ] GET /assets/nonexistent.js returns 404
- [ ] AIDA_LAUNCHER.ps1 opens browser to localhost:3001
- [ ] tsc --noEmit passes in packages/backend
- [ ] Devices remain alphabetically sorted by SKU

---
## Ownership and Rights
Made by Patrick Walton with AI.
Copyright (c) 2026 Patrick Walton. All rights reserved.
This project is privately owned by Patrick Walton and is not company-owned unless explicitly stated in a signed written agreement.

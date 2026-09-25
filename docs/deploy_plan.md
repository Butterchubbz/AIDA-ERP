# Final Deployment Fix Plan

## Inputs Reviewed

1. docs/deployment_fix.md
2. docs/setup_fix_spec.md
3. Current backend routing in packages/backend/src/index.ts
4. Current frontend build config in packages/frontend/vite.config.ts

## Current State Summary

1. Frontend currently builds to packages/frontend/pb_public.
2. Backend currently does not serve static frontend assets.
3. Root npm run build currently only triggers frontend build and does not validate backend-facing artifact placement.
4. SKU sorting already exists in backend devices route and frontend device inventory hook, but needs a final surface audit confirmation.

## Work Split

### Claude Sonnet (The Senior)

Fix static file middleware and SPA fallback in packages/backend/src/index.ts.

Tasks:

1. Add a resolved publicDir pointing to packages/backend/public.
2. Mount express.static(publicDir) before SPA fallback logic.
3. Add a GET-only SPA fallback that serves index.html for non-API routes without file extensions.
4. Ensure /api routes remain API responses and never fall through to index.html.
5. Ensure missing asset URLs return 404 instead of HTML.

Expected outcome:

1. Backend serves built JS/CSS/images with correct MIME types.
2. Browser no longer receives text/html for asset requests.
3. SPA deep links still work.

### Claude Haiku (The Junior)

Align frontend build output and base path in packages/frontend/vite.config.ts.

Tasks:

1. Set base to '/'.
2. Set build.outDir to '../backend/public'.
3. Keep emptyOutDir true so stale assets are removed on each build.
4. Preserve existing chunk-splitting behavior.

Expected outcome:

1. Built index.html references /assets/... paths compatible with backend static root.
2. Build artifacts land in backend public directory with no manual copy step.

### GPT-4.1 (The Intern)

Apply and verify alphabetical SKU sort in inventory views as requested.

Tasks:

1. Confirm backend device list route comparator remains case-insensitive SKU A-Z with tie-breakers.
2. Confirm frontend inventory hooks preserve sorted order after fetch, create, and update operations.
3. If any inventory view bypasses the sorted hooks, patch that view-level list handling.

Expected outcome:

1. Inventory displays deterministic SKU ordering across screens.
2. Sorting behavior remains stable after CRUD operations.

### GPT-5 (Audit)

Audit root build pipeline to ensure npm run build produces backend-served static output.

Audit targets:

1. package.json at repo root
2. packages/frontend/package.json
3. packages/backend/public output after build

Audit questions:

1. Does root npm run build reliably generate backend public assets?
2. Is there any stale script path still targeting packages/frontend/pb_public?
3. After build, can backend serve index.html and assets without extra copy commands?

Expected outcome:

1. Pass/fail statement for build pipeline integrity.
2. Script patch proposal only if root build does not guarantee backend-ready artifacts.

## Execution Sequence

1. Senior updates backend static middleware and SPA fallback.
2. Junior updates Vite base and outDir.
3. Intern verifies and patches any remaining unsorted inventory surfaces.
4. GPT-5 audits root build script and end-to-end asset output.
5. Run final validation commands.

## Validation Checklist

1. npm run build at repo root completes successfully.
2. packages/backend/public/index.html exists after build.
3. packages/backend/public/assets contains hashed js and css files.
4. GET /assets/<built-js-file> returns JavaScript MIME, not HTML.
5. GET /assets/<built-css-file> returns text/css MIME, not HTML.
6. GET /nonexistent/deep/link returns index.html.
7. GET /assets/nonexistent.js returns 404.
8. Inventory UI remains alphabetically sorted by SKU.

## Stop Condition

Plan only. Wait for user go-ahead before implementation.

---
## Ownership and Rights
Made by Patrick Walton with AI.
Copyright (c) 2026 Patrick Walton. All rights reserved.
This project is privately owned by Patrick Walton and is not company-owned unless explicitly stated in a signed written agreement.

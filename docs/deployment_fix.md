# Deployment Fix Specification

## Goal

Resolve MIME-type errors caused by the browser receiving HTML for JavaScript and CSS asset URLs when the app is accessed through the PocketBase-facing flow.

## Problem Statement

When static asset requests are routed to an HTML fallback instead of real files, the browser reports errors like:

- Refused to execute script because its MIME type is text/html
- Refused to apply stylesheet because MIME type is text/html

This happens when build output location, Vite asset paths, and Express static middleware are not aligned.

## 1. Build Output Mapping

### Required mapping

The frontend build artifacts must be served by the backend process from a single canonical directory.

Approved target options:

1. Preferred: packages/backend/public
2. Alternate: shared repository-level pb_public served by backend from an absolute path

### Decision for this repo

Use packages/backend/public as canonical static output.

Reasoning:

1. Backend becomes source of truth for static serving and API routing.
2. Eliminates cross-process confusion between frontend dev server output and production-like serving.
3. Simplifies SPA fallback and MIME handling because one process owns asset and HTML responses.

### Build contract

1. Frontend build writes index.html plus hashed assets into packages/backend/public.
2. Root npm run build must invoke frontend build with this output target.
3. No runtime should depend on legacy root pb_public for production serving once cutover is complete.

## 2. Vite Base Path

### Required behavior

Vite must emit absolute root-referenced asset URLs that match backend static mount at /.

### Configuration contract

In packages/frontend/vite.config.ts:

1. base must be '/'
2. build.outDir must be '../backend/public'
3. build.emptyOutDir remains true

### Why this prevents MIME errors

With base '/', built HTML references assets like /assets/app-<hash>.js. Express static resolves these as files from the public directory. Requests do not fall through to an HTML fallback unless the route is non-asset SPA navigation.

## 3. Express Static Middleware

### Required middleware order

In packages/backend/src/index.ts, static middleware must run in this order:

1. express.static(publicDir) mounted before SPA fallback
2. API routes under /api
3. SPA fallback for non-API, non-asset GET requests only
4. Error handler last

### Static serving contract

1. Serve packages/backend/public via express.static
2. Do not override Content-Type for known extensions; let Express set MIME by extension
3. If asset file does not exist, return 404 for asset paths instead of index.html

### SPA fallback contract

Fallback to index.html only when all are true:

1. method is GET
2. path does not start with /api
3. path does not look like a static file request (contains extension such as .js, .css, .map, .png, .svg, .ico)

This prevents JS/CSS requests from receiving HTML.

## 4. Root Build and Serve Pipeline

### Pipeline target state

1. npm run build at repo root builds shared package then frontend package
2. Frontend artifacts are emitted directly into packages/backend/public
3. Backend start serves API and static assets from one process

### Minimal acceptance checks

1. Requesting /assets/*.js returns status 200 and Content-Type of javascript
2. Requesting /assets/*.css returns status 200 and Content-Type of text/css
3. Requesting /some/spa/route returns index.html
4. Requesting /assets/does-not-exist.js returns 404 (not index.html)

## 5. Non-goals

1. No CDN path rewrite in this phase
2. No reverse-proxy re-architecture in this phase
3. No frontend router mode changes in this phase

---
## Ownership and Rights
Made by Patrick Walton with AI.
Copyright (c) 2026 Patrick Walton. All rights reserved.
This project is privately owned by Patrick Walton and is not company-owned unless explicitly stated in a signed written agreement.

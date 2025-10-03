# AIDA — React + TypeScript + Vite

This repository contains AIDA: a React + TypeScript application built with Vite. The README below focuses on running and testing the app locally, preparing a production build, and the PocketBase backend used by the app. The instructions are written with GitLab CI in mind but work equally well locally or in GitHub Actions.

<<<<<<< Updated upstream
PLEASE NOTE: I am not a programmer, I am a hardware engineer with a logistics background. This was made entirely using AI. If any programmer want to update this with human code, please feel free to do so. There is a story of how this came to be, which I can gladly share.

=======
>>>>>>> Stashed changes
## Table of contents
- Getting started (prereqs)
- Local development (Vite dev server)
- PocketBase (local dev and seeding)
- Production build & serving (dist)
- Smoke tests (Playwright)
- CI / GitLab notes
- Troubleshooting & tips

## Getting started (prerequisites)
- Node.js 18+ (LTS recommended)
- npm (or yarn/pnpm) available in PATH
- Git client
- Optional: Playwright dependencies (browsers) — see Running tests

Clone and install

```powershell
git clone --branch feature/simplified-launch-scripts https://gitlab.com/<your-group-or-username>/AIDA.git
cd AIDA
npm install
```

## Local development (Vite)

Start the dev server with hot reload:

```powershell
npm run dev
```

The app will be available at http://localhost:5173 by default (check console output for port). Vite supports HMR so edits in `src/` reload instantly.

## PocketBase (local backend used by the app)

This project expects a PocketBase instance for authentication and data storage during development. You can run PocketBase locally or in CI.

Run PocketBase locally (recommended for dev):

1. Download the PocketBase binary for your platform from https://pocketbase.io/ and put it in a known folder (or use the Docker image).
2. Start PocketBase in the project folder (or any folder) and point it at a `pb_data` folder for storage:

```powershell
# run from repo root (creates ./pb_data)
.\pocketbase.exe serve --dir ./pb_data
# or with Docker
docker run --rm -p 8090:8090 -v ${PWD}/pb_data:/pb_data pocketbase/pocketbase serve --dir /pb_data
```

3. By default PocketBase listens on `http://127.0.0.1:8090`. The frontend expects that endpoint in development. If you run PocketBase on another host/port, adjust the `lib/pocketbase.ts` or environment variables accordingly.

### Seeding PocketBase

We provide example seed logic used in CI workflows. For local use you can seed using the PocketBase admin UI (`/admin`) or the PocketBase JS SDK.

A quick local seed approach:

```powershell
# install dependencies if the seed script uses pocketbase client
npm install
node scripts/seed-pocketbase.mjs
```

(If `scripts/seed-pocketbase.mjs` does not exist in your repo, create a small script that uses the PocketBase JS client to create required collections and test users.)

## Production build & serving (dist)

Build the app with Vite:

```powershell
npm run build
```

This produces a `dist` folder. To serve `dist` during tests or for a simple static host, use the included static server script `scripts/serve-dist.mjs`:

```powershell
# install dependencies if you haven't
npm install

# run the static server (serves on http://127.0.0.1:5174 by default)
node ./scripts/serve-dist.mjs
```

The static server exposes a health endpoint at `/health` which returns a quick 200 JSON payload. This is useful for smoke tests or orchestrators to know when the app is ready.

## Smoke tests (Playwright)

Playwright is used for smoke/e2e verification. Smoke tests live in `test/smoke/` and we include a reproducer `scripts/playwright-open.mjs` for quick manual checks.

Install Playwright browsers (one-time):

```powershell
npx playwright install
```

Run the smoke tests locally with traces enabled (recommended when debugging):

```powershell
npx playwright test test/smoke --project=chromium --trace=on
```

Notes and test hardening in this repo:
- Tests pre-seed `localStorage` before navigation so the app can bypass auth in CI/dev.
- Tests wait for the server `/health` and an in-page readiness flag `window.__AIDA_APP_READY` before proceeding. This helps avoid flaky redirects to `/login`.

## CI / GitLab notes

If you host this repo on GitLab, add the following pieces to your pipeline:

- A job to run PocketBase (docker image) and wait for it to be healthy on port 8090.
- A job to build the frontend (`npm ci && npm run build`) and run `node ./scripts/serve-dist.mjs` as a background service for Playwright tests.
- Run Playwright smoke tests with `--trace=on` on failure or for full debugging. Store `test-results/` as artifacts so you can inspect traces.

Example GitLab CI job sketch (high-level):

```yaml
# .gitlab-ci.yml snippet
stages:
  - test

smoke_tests:
  stage: test
  image: node:20
  services:
    - name: docker:dind
  script:
    - npm ci
    - npx playwright install --with-deps
    - npm run build
    - node ./scripts/serve-dist.mjs &
    - # run PocketBase in background via Docker or a separate job
    - npx playwright test test/smoke --project=chromium --trace=on
  artifacts:
    when: always
    paths:
      - test-results/
```

## Troubleshooting & tips

- If Playwright sees a redirect to `/login`, ensure PocketBase is running and seeded with the expected users and that the test bypass (`localStorage['aida.test.bypass']='1'`) is applied before the SPA boot.
- Use `scripts/playwright-open.mjs` to reproduce the app load and capture console logs and page HTML quickly.
- For faster CI runs, install Playwright browsers with `npx playwright install --with-deps` on Linux images or `npx playwright install` on Windows/macOS.

## Contributing

- Follow the repository ESLint and TypeScript configuration in `eslint.config.js` and `tsconfig.*.json`.
- Add unit tests for new logic and keep Playwright smoke tests focused and small — they run against the built `dist` served by the included static server.

---

If you'd like, I can also:
- Add a `docs/` page with CI-ready `.gitlab-ci.yml` flow and a PocketBase seeder script example.
- Create a short `RELEASE.md` checklist for beta launch (tagging, changelog, CI smoke verification).

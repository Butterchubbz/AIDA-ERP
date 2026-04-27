# AIDA ERP

AIDA ERP is a React + TypeScript application built with Vite and backed by PocketBase.

## Requirements

- Node.js 18+
- npm
- PocketBase

## Local Setup

1. Install dependencies:

```powershell
npm install
```

2. Start PocketBase in the repository root so local data is stored in `pb_data/`:

```powershell
.\pocketbase.exe serve --dir .\pb_data
```

3. Start the frontend:

```powershell
npm run dev
```

The Vite app runs on the local development port shown in the terminal. PocketBase defaults to `http://127.0.0.1:8090`.

## Environment

Copy values from `.env.example` into a local environment file if needed.

Important variables:

- `VITE_LOCAL_OWNER_PASSWORD`
- `VITE_DEBUG`
- `VITE_SENTRY_DSN`

## Available Scripts

- `npm run dev` - start the Vite development server
- `npm run build` - run TypeScript project builds and create a production bundle
- `npm run preview` - preview the production build locally
- `npm run lint` - run ESLint
- `npm run test` - run Vitest
- `npm run smoke:test` - run the Playwright smoke suite
- `npm run format` - format supported source files with Prettier

## Data and Backups

- PocketBase runtime data is stored in `pb_data/`
- Public PocketBase assets are stored in `pb_public/`
- Import/export and maintenance tasks are available in the app under AIDA Management

## Testing

Type-check before pushing:

```powershell
npx tsc --noEmit
```

Build verification:

```powershell
npm run build
```

Smoke tests:

```powershell
npm run smoke:test
```

## Project Notes

- Main application source lives in `src/`
- Legacy and reference material is kept elsewhere in the workspace and is not the active frontend
- Release and utility scripts live in `scripts/`

## Related Docs

- `AIDA_SETUP_GUIDE.md`
- `POCKETBASE_SETUP_GUIDE.md`
- `scripts/README.md`

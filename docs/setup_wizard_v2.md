# Setup Wizard v2 Specification

Status: Draft for implementation
Owner: UX Architecture
Target: First-run setup for the Three-Package Monorepo

## Why This Wizard Exists

The new monorepo has multiple packages working together behind the scenes. New users should not have to learn npm workspaces, environment files, or PocketBase internals just to get started.

This wizard provides one guided path that:
- confirms the app can talk to PocketBase,
- creates a secure encryption key automatically,
- scaffolds required collections if missing,
- and blocks normal app usage until setup is complete.

## Experience Goals

- Keep language friendly and plain.
- Show one clear next step at a time.
- Avoid technical terms unless needed.
- Never ask users to run terminal commands.
- Make progress and success visible.

## Guided Setup Flow

The setup uses a 5-step progress flow with simple status lights.

## Step 1: Welcome

Purpose: Explain what will happen in one minute.

Screen copy:
- Title: "Let's set up AIDA"
- Message: "We will check your connection, secure your data, and prepare your workspace."
- Primary button: "Start Setup"

Behavior:
- No form fields.
- Moves directly to Step 2.

## Step 2: System Health Check

Purpose: Confirm backend and PocketBase connectivity.

Status indicators:
- Backend API: gray -> yellow -> green or red
- PocketBase: gray -> yellow -> green or red

Source:
- Wizard calls `GET /api/setup/check-health`.

Success state:
- Both lights turn green.
- "Continue" button is enabled.

Failure state:
- Show one plain-language message:
  - "We could not reach PocketBase. Please make sure it is running, then try again."
- Show "Try Again" button.
- Keep user on this step.

## Step 3: Generate Encryption Key

Purpose: Automatically create the encryption key without OpenSSL commands.

Primary action:
- Button: "Generate Security Key"

Behavior:
- Use Web Crypto API to generate a 32-byte random key.
- Convert to a 64-character hex string.
- Send key to backend setup API for safe local save.
- Backend writes the value to local environment targets used by this app:
  - `packages/backend/.env` as `VITE_ENCRYPTION_KEY=...`
  - `packages/frontend/.env.local` as `VITE_ENCRYPTION_KEY=...`
- If key already exists in both files, show:
  - "A security key is already configured."
  - Secondary button: "Regenerate Key"

User messaging:
- "Your key is generated and saved locally on this machine."
- "Keep your .env files private and never commit them."

Failure handling:
- If save fails, show:
  - "We generated a key, but could not save it yet. Please try again."
- Never display stack traces.

## Step 4: Collection Scaffolding

Purpose: Ensure required PocketBase collections exist.

Required collections:
- `userPreferences`
- `integrations`

Behavior:
- Wizard calls `POST /api/setup/init-collections`.
- Backend checks each required collection.
- If missing, backend creates collection with expected schema and sensible defaults.
- If present, backend leaves it unchanged.

User-facing progress:
- Show row per collection with status light:
  - "Checking userPreferences"
  - "Checking integrations"
- On create action, status text changes to:
  - "Creating..."
  - then "Ready"

Completion message:
- "Database setup is complete."

## Step 5: Finish

Purpose: Confirm setup completion and unlock the app.

Screen copy:
- Title: "Setup Complete"
- Message: "AIDA is ready. You can now continue to the dashboard."
- Button: "Go to AIDA"

Behavior:
- Persist `setupComplete=true` in backend-controlled first-run state.
- Redirect to app home.

## First-Run Guardrail

Until setup is complete, users cannot bypass the wizard.

Rules:
- App checks first-run status on load.
- If encryption key is missing or scaffolding is incomplete, force redirect to setup route.
- Block dashboard and feature routes until setup is complete.
- Provide a friendly message if blocked:
  - "A quick setup is required before using AIDA."

## API Contract Summary

## `GET /api/setup/check-health`

Returns:
- backend: `ok | fail`
- pocketbase: `ok | fail`
- optional user-safe message on failure

## `POST /api/setup/init-collections`

Returns:
- `userPreferences`: `exists | created | failed`
- `integrations`: `exists | created | failed`
- `complete`: boolean

## Content Tone Guide

Use these content rules in the UI:
- Prefer "We are setting this up for you" over "Run this command".
- Prefer "Try Again" over "Retry operation".
- Prefer "Ready" over "Initialized successfully".

## Accessibility and UX Notes

- Do not rely on color alone for status; pair lights with text labels.
- Keep keyboard navigation complete for all controls.
- Announce status updates for screen readers.
- Keep loading states explicit so users know work is in progress.

## Acceptance Criteria

- A new user can complete setup without opening a terminal.
- Encryption key is generated and saved locally from the wizard flow.
- Missing `userPreferences` and `integrations` collections are auto-created.
- The app cannot be used in an unencrypted first-run state.
- All setup errors are shown in plain, helpful language.

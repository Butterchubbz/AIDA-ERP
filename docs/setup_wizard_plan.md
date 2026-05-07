# Setup Wizard v2 Implementation Plan

Status: Ready for build
Depends on: docs/setup_wizard_v2.md

## Goal

Implement a friendly first-run setup wizard for the Three-Package Monorepo that hides workspace complexity, automates encryption key setup, and scaffolds required PocketBase collections.

## Team Distribution

## GPT-4.1 (The Intern): UI Components

Scope:
- Build the multi-step setup shell with progress bar.
- Build status indicator lights used in health and collection steps.
- Build step layouts for Welcome, Health Check, Generate Key, Collection Scaffolding, and Finish.

Deliverables:
- `SetupWizard` page with 5 steps and step navigation state.
- Reusable `SetupProgressBar` component.
- Reusable `StatusIndicator` component with states: `idle | running | success | error`.
- Friendly text states and loading placeholders from the specification.

Definition of done:
- Progress bar updates correctly by step index.
- Status indicators show both icon and text label.
- UI is responsive and keyboard accessible.

## Claude Haiku (The Junior): Frontend Logic

Scope:
- Implement setup orchestration logic in the wizard container.
- Implement "Generate Security Key" behavior with Web Crypto API.
- Implement temporary local config handling for in-session setup state.

Deliverables:
- Health check call to `GET /api/setup/check-health`.
- Key generation utility using `crypto.getRandomValues` for 32 bytes and hex encoding.
- Client call to persist key via setup backend endpoint.
- Collection init call to `POST /api/setup/init-collections`.
- First-run route guard wiring (frontend side) that routes to setup when incomplete.

Definition of done:
- "Generate Security Key" is one-click and shows clear success/failure.
- Flow advances only when each step succeeds.
- Errors are shown in plain language with retry actions.

## Claude Sonnet (The Senior): Backend Integration

Scope:
- Add setup endpoints and PocketBase integration routines.
- Implement safe local environment write logic for encryption key persistence.
- Implement collection existence checks and creation for PocketBase v0.30.0.

Deliverables:
- `GET /api/setup/check-health`
  - Returns backend and PocketBase status.
- `POST /api/setup/init-collections`
  - Ensures `userPreferences` and `integrations` collections exist.
  - Creates missing collections with expected schema.
- Setup service utilities for:
  - key persistence to `packages/backend/.env` and `packages/frontend/.env.local`
  - idempotent collection creation
  - first-run completion status read/write

Definition of done:
- Endpoints are idempotent and safe to re-run.
- Responses match setup wizard needs (simple statuses, no internal leakage).
- PocketBase v0.30.0 behavior verified.

## Mandatory Security Review: GPT-5

Reviewer: GPT-5
Focus: First-run bypass prevention and encryption enforcement.

Review checklist:
- Confirm app cannot reach protected routes before setup completes.
- Confirm missing key or failed key save always re-routes to setup.
- Confirm no unencrypted fallback path exists.
- Confirm setup completion state cannot be spoofed from client-only state.
- Confirm setup endpoints fail closed on errors.

Exit gate:
- Build does not merge until GPT-5 review signs off first-run logic.

## Sequence and Milestones

1. Finalize spec alignment with product owner.
2. Intern builds UI shell and reusable status components.
3. Junior wires frontend step logic and key generation.
4. Senior delivers backend endpoints and PocketBase scaffolding.
5. Integrate full flow and run first-run happy path + failure path tests.
6. GPT-5 performs first-run security review and signs off.
7. Prepare release notes and rollout.

## Test Plan

Functional checks:
- Health step reports both backend and PocketBase status.
- Generate key step creates and persists a 64-char hex key.
- Collection step creates missing `userPreferences` and `integrations`.
- Re-running setup does not duplicate collections or corrupt env files.

Negative checks:
- PocketBase offline shows friendly retry message.
- Env write failure blocks completion and explains next action.
- Users cannot access dashboard if setup is incomplete.

Security checks:
- No plaintext keys logged to browser console or backend logs.
- Setup completion is validated server-side, not only in local state.

## Risks and Mitigations

Risk: File write permissions block local env save.
Mitigation: Show clear error and retry; add preflight permission check.

Risk: Partial setup leaves inconsistent state.
Mitigation: Keep each step idempotent and re-runnable.

Risk: PocketBase schema drift.
Mitigation: Validate collection definitions before create/update.

## Output of This Phase

- Specification completed in docs/setup_wizard_v2.md.
- Implementation plan completed in docs/setup_wizard_plan.md.
- Awaiting go-ahead before starting code implementation.

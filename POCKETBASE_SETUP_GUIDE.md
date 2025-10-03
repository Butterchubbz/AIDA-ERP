# PocketBase Setup for AIDA (quick)

This guide shows the manual steps to prepare PocketBase for local AIDA development.

Prerequisites:

- Downloaded `pocketbase` and able to run it locally.
- Admin username/password (created when you first open the Admin UI).

1. Download and run PocketBase (PowerShell example)

```powershell
cd C:\path\to\pocketbase
.\pocketbase.exe serve
```

Open the Admin UI at `http://127.0.0.1:8090/_/` and create an admin account when prompted.

2. Create the collections AIDA needs (Manual)

- In the Admin UI go to **Collections** and create each collection required (e.g., `refurbishedDevices`, `devices`, `inventory`, `users`).
- Add fields and API rules manually as required by your workflow (for local development you can set List/View/Create/Update/Delete to **Auth** or as needed).

3. Add a user to the `users` collection

- Create a regular user to log into the AIDA frontend.

4. Start the frontend

```powershell
cd AIDA
npm install
npm run dev
```

Open the frontend (usually `http://localhost:5173/`) and log in with the user you created.

If you later decide you want automation, consider a server-side/CI script that uses admin credentials to create collections and seed data; that approach is safer than shipping admin automation in the client or repository.

Importing seed data (optional)

- In the Admin UI go to **Settings → Data** and use the import tool to import the provided `pocketbase/seed.json` file. This will create empty collections with the fields defined in the seed file.

Mapping presets collection (recommended)

For mapping presets (CSV import presets), create a collection named `mappingPresets` with these fields:

- `userId` (text) — the owner's user id
- `collectionId` (text) — the target collection id (e.g., `inventoryDevice`)
- `name` (text) — preset name
- `mapping` (json) — the mapping object (header -> field name)

You can create the collection manually in the Admin UI, or run the provided seed helper if you have an admin token:

```powershell
# Set the admin token in your environment and run the seed script
$env:PBC_ADMIN_TOKEN = 'your_admin_token_here';
node ./scripts/seed-presets.mjs
```

Note: programmatic creation requires admin privileges (PBC_ADMIN_TOKEN) and will only run when provided.

Run PocketBase with Docker Compose (optional)

Create a `docker-compose.yml` file and run:

```yaml
version: '3.8'
services:
	pocketbase:
		image: ghcr.io/pocketbase/pocketbase:latest
		ports:
			- "8090:8090"
		volumes:
			- ./pb_data:/pb_data
		command: serve --http=0.0.0.0:8090

# After starting, open http://localhost:8090/_/ to access the admin UI
```

Notes

- The `pocketbase/seed.json` is a minimal example showing collection names and fields; you will probably want to enhance the schema to match your app's needs (indexes, rules, relations).
- Do not store admin credentials or DSNs in the repository. Use environment variables for sensitive values.

Backups

We include a simple backup helper that zips the PocketBase database file and the storage folder. Example:

```powershell
node ./scripts/pb-backup.mjs --db ./pb_data/pocketbase.db --storage ./pb_data/storage --out ./backups
```

Or with environment variables:

```powershell
$env:PB_DB_PATH = 'C:\pb_data\pocketbase.db';
$env:PB_STORAGE_PATH = 'C:\pb_data\storage';
node ./scripts/pb-backup.mjs
```

Store backups off-host (S3, cloud storage) for production safety and add a retention policy.

Workflows (GitHub Actions)

We include two workflows to help operate PocketBase from CI:

- `pocketbase-backup.yml` — scheduled and dispatchable backup workflow. It expects a self-hosted runner labeled `pocketbase` that has access to the file system where the PocketBase DB and storage live. Configure the following repository secrets on the Actions settings page:
	- `PB_DB_PATH` — absolute path to your PocketBase sqlite DB file (used in the workflow as an env var)
	- `PB_STORAGE_PATH` — absolute path to your PocketBase `storage` directory

	The workflow runs the `scripts/pb-backup.mjs` script and uploads the generated zip as a workflow artifact. This is a convenient way to centralize backups — but for production you should push backups off-host (S3) and maintain retention.

- `pocketbase-seed.yml` — a manual `workflow_dispatch` job that runs `scripts/seed-presets.mjs` using an admin token stored in the repository secrets. Configure these secrets:
	- `PBC_ADMIN_TOKEN` — a PocketBase admin token with permission to create collections
	- `PBC_URL` — base URL of your PocketBase instance (optional if the seed script reads it from env)

Usage notes:

- The backup workflow requires a self-hosted runner which has direct filesystem access to the PocketBase DB and storage. If you run PocketBase in a container or separate host, either run the backups on that host or expose an export path.
- The seed workflow is safe to run manually when setting up a new instance; it requires the `PBC_ADMIN_TOKEN` secret to be set in the repository settings. After running seed, verify collection rules in the Admin UI and restrict access so users can only modify their own presets.

S3 Backup workflow

We also provide `pocketbase-backup-s3.yml` which runs the same backup script and uploads generated backups to an S3 bucket. Configure these repository secrets before enabling the workflow:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `PB_S3_BUCKET` — the S3 bucket name (e.g., `mycompany-pb-backups`)
- `PB_DB_PATH` and `PB_STORAGE_PATH` — as with the plain backup workflow

Retention configuration

The S3 backup workflow supports automatic deletion of old backups. Set the secret `PB_S3_RETENTION_DAYS` to the number of days to keep backups (default 30). The workflow will delete objects older than this value after uploading new backups.

The workflow expects a self-hosted runner labeled `pocketbase` which has network access to AWS and filesystem access to the PocketBase DB/storage paths. Backups are uploaded under a prefix with the GitHub run id for easy grouping.

Sentry release (source maps)

If you enable Sentry for error monitoring you should upload source maps for readable stack traces. We provide a `sentry-release.yml` workflow that runs on pushes to `main` and will upload source maps if the following secrets are set in the repository settings:

- `SENTRY_AUTH_TOKEN` — a Sentry auth token with `project:releases` scope
- `SENTRY_ORG` — your Sentry organization slug
- `SENTRY_PROJECT` — the Sentry project slug
- `VITE_SENTRY_DSN` — DSN for the client (also used at runtime)

The workflow builds the app, creates a release using the git SHA, uploads the source maps from `./dist`, and finalizes the release.

Notes:
- The source map upload assumes assets are served under `~/assets` — adjust the `--url-prefix` flag in the workflow if your hosting differs.
- Keep `SENTRY_AUTH_TOKEN` secret and restrict who can modify workflows/secrets.


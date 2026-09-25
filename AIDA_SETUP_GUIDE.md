````markdown
# AIDA — Simple Setup Guide (Easy for Everyone)

This guide shows the absolute simplest steps to get AIDA running on your computer. Follow each step slowly. If something is confusing, stop and ask.

# AIDA — Simple Setup Guide

This minimal guide helps you run AIDA locally.

Prerequisites

- Node.js + npm installed
- PocketBase executable if you want to run the backend locally (optional)

1. Start PocketBase (PowerShell example)

```powershell
cd C:\path\to\pocketbase
.\pocketbase.exe serve
```

2. Clone and install the frontend

```powershell
git clone <repository_url> AIDA
cd AIDA
npm install
```

3. Start the frontend

```powershell
npm run dev
```

4. Create a user in PocketBase

- Open PocketBase Admin UI at `http://127.0.0.1:8090/_/` and add a user in the `users` collection.

5. Log in to AIDA

- Open the frontend (usually `http://localhost:5173/`) and log in with the user you created.

If you need help creating collections or configuring API rules, see `POCKETBASE_SETUP_GUIDE.md`.
Step 4 — Start the AIDA frontend
````

---

## Docker: the simplest first run

If you are running AIDA via Docker (see `README-DOCKER.md` for the full guide), the documented first run is:

1. Clone the repository.
2. Run `docker compose up -d --build`.
3. Open `http://localhost:3001` in your browser.
4. The setup wizard asks for everything it needs — including, on a fresh install, creating the PocketBase superuser account directly in the browser if you did not already set `PB_ADMIN_EMAIL`/`PB_ADMIN_PASSWORD` in your `.env` file.

You never need to touch the PocketBase container directly. The superuser-creation step in the wizard is only available while the PocketBase data volume is truly fresh (no superusers and no application users yet) — it disappears permanently once a superuser exists, whether that superuser was created via the wizard or via `.env` credentials.

---
## Ownership and Rights
Made by Patrick Walton with AI.
Copyright (c) 2026 Patrick Walton. All rights reserved.
This project is privately owned by Patrick Walton and is not company-owned unless explicitly stated in a signed written agreement.

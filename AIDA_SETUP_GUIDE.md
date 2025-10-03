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

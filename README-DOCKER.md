# 🐳 AIDA-ERP — Docker Deployment Guide
This guide provides a production-ready, zero-overhead Docker Compose deployment path for **AIDA-ERP**. 

By running AIDA inside Docker, you eliminate the need to manually install Node.js, PocketBase, compile packages, or manage separate database processes. PocketBase's high-performance SQLite engine and the Express server compile and run in absolute isolation.

---

## 📋 System Requirements
Before starting, ensure you have the following installed on your machine:

### 🪟 For Windows Users:
1. **Docker Desktop**: Download and install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/).
2. During installation, select the recommended **WSL 2 backend** option.
3. Open Docker Desktop and verify that the engine is active (green indicator in the bottom-left corner).

### 🐧 For Linux Users:
1. **Docker Engine & Compose**: Install Docker using your system package manager (e.g., `sudo apt install docker.io docker-compose-v2`).
2. Ensure your user is added to the docker group so you don't need `sudo` for every command:
   ```bash
   sudo usermod -aG docker $USER
   ```

---

## ⚙️ Step 1: Prepare Your Environment (`.env`)
Docker Compose automatically loads configuration from a `.env` file located in the same directory. Create a file named `.env` in your root folder and copy the template below:

```env
# ==============================================================================
# AIDA-ERP SYSTEM SETTINGS
# ==============================================================================
PORT=3001
NODE_ENV=production
ALLOWED_ORIGIN=http://localhost:3001

# ==============================================================================
# SECURITY CREDENTIALS (MANDATORY STARTUP VALIDATION)
# ==============================================================================
# 1. JWT_SECRET: Sign user sessions. Must be a secure 32+ character string.
#    You can generate one by running in a terminal: openssl rand -base64 32
JWT_SECRET=super_secret_base64_signing_key_at_least_32_characters

# 2. AIDA_ENCRYPTION_KEY: Encrypts integration API keys (WooCommerce, SP-API)
#    Must be EXACTLY 64 hexadecimal characters (representing 32 bytes).
#    You can generate one by running in a terminal: openssl rand -hex 32
AIDA_ENCRYPTION_KEY=a1b2c3d4e5f607182930415263748596a1b2c3d4e5f607182930415263748596

# ==============================================================================
# POCKETBASE ADMINISTRATIVE ACCOUNT (SUPERUSER)
# ==============================================================================
# Used by the backend system to establish the initial secure database link.
PB_ADMIN_EMAIL=admin@yourcompany.com
PB_ADMIN_PASSWORD=Select_A_Very_Strong_Database_Password_123!
```

---

## 🚀 Step 2: Boot Up the Services
With your `.env` file configured, starting the entire AIDA-ERP stack requires only one command:

### 🪟 Windows (Powershell / Command Prompt):
Navigate to your repository directory and run:
```powershell
docker compose up -d --build
```

### 🐧 Linux / macOS:
```bash
docker compose up -d --build
```

### 🔍 What Happens in the Background:
1. Docker builds a multi-stage **Alpine Node.js image** for AIDA, installing dependencies, compiling the TypeScript models, and building the Vite React frontend.
2. It compiles a highly optimized **PocketBase 0.30.0 service** mapped to a persistent volume named `pb_data`.
3. The system executes health checks to ensure PocketBase is responsive on port `8090` before starting the Express application on port `3001`.

To monitor active logs, run:
```bash
docker compose logs -f
```

---

## 🧙‍♂️ Step 3: Run the Guided Setup Wizard
Once the containers report `healthy`, AIDA is fully operational.

1. Open your default browser and navigate to: **`http://localhost:3001`**
2. Since this is a fresh install, AIDA will automatically detect an unconfigured system state and launch the **Setup Wizard v2**.
3. **Step 1 (Welcome)**: Click **Start Setup**.
4. **Step 2 (System Health Check)**: The wizard will probe both the Express backend and PocketBase databases, turning both status lights green. Click **Continue**.
5. **Step 3 (Encryption Key)**: Because you already defined `AIDA_ENCRYPTION_KEY` in your `.env` file during Step 1, the wizard will detect it and report: *"A security key is already configured."* Click **Continue**.
6. **Step 4 (Database Scaffolding)**: The backend will automatically scaffold all **11 required database collections** (including dynamic workspaces, RMA returns, and logistics history logs). Watch the checklist indicators turn green, then click **Continue**.
7. **Step 5 (Workspace Mode)**: Choose **Solo Mode** or **Team Mode** (multi-user role-based access controls) based on your company's operational hierarchy.
8. **Step 6 (Finish)**: Click **Go to AIDA** to be redirected to the secure login screen. Use the email and password you defined in your `.env` file to log in!

---

## 💾 Managing Your Data
* **Database Backups**: All database records, schemas, and configurations are stored inside the Docker-managed volume `pb_data`. They will persist if you rebuild, stop, or recreate containers.
* **Database Admin Panel**: You can access PocketBase's native visual administration interface directly at **`http://localhost:8090/_/`** to perform manual data exports, schema inspection, or database backups.

---

## 🔒 Production Security Hardening
Before exposing AIDA-ERP to a wider local network or a custom domain:
1. **Isolate Database Access**: Edit the `docker-compose.yml` file and remove or comment out the `ports:` block on the `pocketbase` service. This completely blocks external network scans from finding the PocketBase database, confining database access strictly to the containerized Express application.
2. **Reverse Proxy (SSL)**: Place AIDA behind a reverse proxy (like Nginx, Caddy, or Traefik) to handle HTTPS certificates (SSL/TLS). Always access AIDA via `https://` in production to protect session cookie transmission.

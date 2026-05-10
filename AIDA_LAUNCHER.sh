#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PB_EXEC="$SCRIPT_DIR/pocketbase"
PB_PORT=8090
BACKEND_PORT=3001
BACKEND_URL="http://localhost:$BACKEND_PORT"

pb_pid=""
backend_pid=""

cleanup() {
    echo ""
    echo "Stopping AIDA services..."
    if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" 2>/dev/null; then
        kill "$backend_pid" 2>/dev/null || true
    fi
    if [[ -n "$pb_pid" ]] && kill -0 "$pb_pid" 2>/dev/null; then
        kill "$pb_pid" 2>/dev/null || true
    fi
    wait 2>/dev/null || true
    echo "Done."
}
trap cleanup INT TERM EXIT

is_port_listening() {
    local port="$1"
    if command -v lsof >/dev/null 2>&1; then
        lsof -i TCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 && return 0
    fi
    if command -v ss >/dev/null 2>&1; then
        ss -ltn | grep -q ":$port " && return 0
    fi
    if command -v netstat >/dev/null 2>&1; then
        netstat -an 2>/dev/null | grep -q "[\.:]$port .*LISTEN" && return 0
    fi
    return 1
}

wait_for_port() {
    local port="$1"
    local timeout="${2:-30}"
    local elapsed=0
    until is_port_listening "$port"; do
        sleep 1
        elapsed=$((elapsed + 1))
        if [[ $elapsed -ge $timeout ]]; then
            return 1
        fi
    done
    return 0
}

echo "================================================="
echo "  AIDA ERP Launcher"
echo "================================================="
echo ""

if [[ ! -f "$PB_EXEC" ]]; then
    echo "ERROR: ./pocketbase not found in the project root."
    exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
    echo "ERROR: npm not found on PATH. Install Node.js first."
    exit 1
fi
[[ ! -x "$PB_EXEC" ]] && chmod +x "$PB_EXEC"

# ── PocketBase ──────────────────────────────────────────────────────────────────
if is_port_listening "$PB_PORT"; then
    echo "PocketBase is already running."
else
    echo "Starting PocketBase..."
    "$PB_EXEC" serve --dir ./pb_data --publicDir ./pb_public &
    pb_pid=$!
fi

# ── Backend ─────────────────────────────────────────────────────────────────────
if is_port_listening "$BACKEND_PORT"; then
    echo "Backend API is already running."
else
    echo "Starting Backend API..."
    npm run start:backend &
    backend_pid=$!
fi

# ── Wait for ready ───────────────────────────────────────────────────────────────
echo "Waiting for services..."
if ! wait_for_port "$PB_PORT" 20; then
    echo "ERROR: PocketBase did not start on port $PB_PORT."
    exit 1
fi
if ! wait_for_port "$BACKEND_PORT" 30; then
    echo "ERROR: Backend API did not start on port $BACKEND_PORT."
    exit 1
fi

echo ""
echo "AIDA is ready at $BACKEND_URL"

if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$BACKEND_URL" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
    open "$BACKEND_URL" &
else
    echo "Open $BACKEND_URL in your browser."
fi

echo "Press Ctrl+C to stop all services."
echo ""

# Keep running until signal
wait

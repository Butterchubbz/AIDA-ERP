#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PB_EXEC="$SCRIPT_DIR/pocketbase"
PB_DATA_DIR="$SCRIPT_DIR/pb_data"
PB_PUBLIC_DIR="$SCRIPT_DIR/pb_public"
PB_URL="http://localhost:8090"
PB_PORT="8090"

is_port_listening() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -i TCP:"$PB_PORT" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -ltn | grep -q ":$PB_PORT "
    return $?
  fi

  if command -v netstat >/dev/null 2>&1; then
    netstat -an 2>/dev/null | grep -q "[\.:]$PB_PORT .*LISTEN"
    return $?
  fi

  return 1
}

echo "================================================="
echo "  AIDA - PocketBase Launcher"
echo "================================================="
echo
echo "Checking PocketBase binary..."

if [ ! -f "$PB_EXEC" ]; then
  echo "ERROR: ./pocketbase was not found in the project root."
  exit 1
fi

if is_port_listening; then
  echo "PocketBase is already running on $PB_URL"
  echo "Opening PocketBase in your default browser..."
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$PB_URL" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open "$PB_URL" >/dev/null 2>&1 &
  else
    echo "No supported browser opener found. Open $PB_URL manually."
  fi
  exit 0
fi

if [ ! -x "$PB_EXEC" ]; then
  echo "PocketBase is not executable. Applying chmod +x..."
  chmod +x "$PB_EXEC"
fi

echo "Opening PocketBase in your default browser..."
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$PB_URL" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
  open "$PB_URL" >/dev/null 2>&1 &
else
  echo "No supported browser opener found. Open $PB_URL manually."
fi

echo "Starting PocketBase..."
cd "$SCRIPT_DIR" || exit 1
./pocketbase serve --dir ./pb_data --publicDir ./pb_public
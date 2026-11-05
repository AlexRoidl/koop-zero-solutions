#!/usr/bin/env bash
# Set up a local virtualenv and run the Signal pack builder.
# Usage:
#   ./run.sh --dry-run --out out      # just build the .webp files (no credentials)
#   ./run.sh                          # build AND upload (reads creds from .env, see below)
#
# Credentials: create a .env file next to this script (copy .env.example) with
#   SIGNAL_USER=...
#   SIGNAL_PASSWORD=...
# and run.sh loads it automatically — nothing secret on the command line.
# (Env vars you set in the shell still take precedence over .env.)
set -euo pipefail
cd "$(dirname "$0")"

# Load credentials from a local .env file if present.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

PY="${PYTHON:-python3}"
if [ ! -d .venv ]; then
  echo "Creating virtualenv (.venv) ..."
  "$PY" -m venv .venv
fi
# shellcheck disable=SC1091
. .venv/bin/activate

pip -q install --upgrade pip >/dev/null
# Install deps, then force a modern httpx/httpcore. signalstickers-client pins an
# old httpx that won't build on Python 3.13+/3.14; the newer one is API-compatible,
# so --no-warn-conflicts silences pip's (harmless) version-pin complaint.
pip install -q --no-warn-conflicts "signalstickers-client==3.3.0" "Pillow>=10"
pip install -q --no-warn-conflicts --upgrade "httpx>=0.28" "httpcore>=1.0.9"

exec python make_signal_pack.py "$@"

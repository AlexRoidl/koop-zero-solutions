#!/usr/bin/env bash
# Set up a local virtualenv and run the Signal pack builder.
# Usage:
#   ./run.sh --dry-run --out out                 # just build the .webp files
#   SIGNAL_USER=xxx SIGNAL_PASSWORD=yyy ./run.sh  # build AND upload to Signal
set -euo pipefail
cd "$(dirname "$0")"

PY="${PYTHON:-python3}"
if [ ! -d .venv ]; then
  echo "Creating virtualenv (.venv) ..."
  "$PY" -m venv .venv
fi
# shellcheck disable=SC1091
. .venv/bin/activate

pip -q install --upgrade pip >/dev/null
# Install deps, then force a modern httpx/httpcore. signalstickers-client pins an
# old httpx that won't build on Python 3.13+/3.14; the newer one is API-compatible.
pip -q install "signalstickers-client==3.3.0" "Pillow>=10"
pip -q install --upgrade "httpx>=0.28" "httpcore>=1.0.9"

exec python make_signal_pack.py "$@"

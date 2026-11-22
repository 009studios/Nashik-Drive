#!/bin/zsh
set -e
cd -- "$(dirname -- "$0")" || exit 1
PORT=8000
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port 8000 is currently used by another game server. Stop it with Control+C first."
  echo "Press Enter to close this window."; read; exit 1
fi
printf '\nNASHIK FULL CITY BUILDER v2.0.2\n'
printf 'Your College Road world.json will not be overwritten.\n'
printf 'Map source: OpenStreetMap roads and building footprints.\n'
printf 'Secure downloads: macOS system curl certificates.\n'
printf 'Download can resume after any error. Each tile shows progress and network errors.\n\n'
python3 scripts/build_nashik_city.py --download
printf '\nCity ready! Opening the game. Keep this Terminal open.\n'
python3 -m http.server "$PORT" &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null' EXIT INT TERM
sleep 1
open "http://localhost:$PORT/"
wait "$SERVER"

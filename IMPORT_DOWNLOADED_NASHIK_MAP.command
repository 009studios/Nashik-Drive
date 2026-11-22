#!/bin/zsh
set -e
cd -- "$(dirname -- "$0")" || exit 1
printf '\nNASHIK LOCAL MAP IMPORTER v2.0.3\n'
printf 'Select the OSM XML gzip file downloaded from BBBike.\n'
printf 'This imports directly from your file and does NOT contact Overpass.\n'
printf 'Your College Road world.json will not be overwritten.\n\n'
if [ "$#" -gt 0 ]; then
  SOURCE="$1"
else
  SOURCE=$(osascript -e 'POSIX path of (choose file with prompt "Select the downloaded Nashik OSM XML .gz file")') || exit 0
fi
if [ ! -f "$SOURCE" ]; then
  echo "File not found: $SOURCE"; read '?Press Enter to close...' ; exit 1
fi
python3 -u scripts/build_nashik_city.py --input "$SOURCE"
printf '\nImport completed.\n'
PORT=8000
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo 'Existing server running on port 8000. Opening that browser tab.'
  echo 'Note: restart the old server in the NEW project folder if you changed projects.'
  open "http://localhost:$PORT/"
  echo 'Press Enter to exit.'; read
  exit 0
fi
python3 -m http.server "$PORT" &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null' EXIT INT TERM
sleep 1
open "http://localhost:$PORT/"
wait "$SERVER"

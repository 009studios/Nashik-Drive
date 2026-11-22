#!/bin/zsh
# Open the game, reusing the already-built full-city file from another Nashik version.
cd -- "$(dirname -- "$0")" || exit 1
PORT=8000
printf '\nNASHIK FIRST DRIVE v2.2 — LIVE LOCATION\n\n'
if [[ ! -f city-world.json ]]; then
  printf 'The full-city map is on your Mac, but not yet in this new game folder.\n'
  printf 'Please select city-world.json from your previous Nashik-Drive-main folder.\n'
  if command -v osascript >/dev/null 2>&1; then
    FILE=$(osascript -e 'POSIX path of (choose file with prompt "Select the existing city-world.json from your previous Nashik game folder")' 2>/dev/null)
    if [[ -n "$FILE" && -f "$FILE" ]]; then
      if python3 - "$FILE" <<'PY'
import json,sys
try:
    with open(sys.argv[1],encoding='utf-8') as f: w=json.load(f)
    assert w.get('cityMode') and isinstance(w.get('blocks'),list)
    assert isinstance(w.get('roadNetwork',{}).get('roads'),list) and len(w['roadNetwork']['roads'])>0
except Exception as e:
    print('Selected JSON is not a valid full-city map:',e)
    sys.exit(1)
PY
      then
        cp "$FILE" ./city-world.json
        echo 'Full-city data copied successfully. Your original file was not changed.'
      fi
    fi
  fi
fi
if [[ ! -f city-world.json ]]; then
  printf '\nNo full-city map selected. The College Road test world will be available.\n'
  printf 'To open the entire city, copy your original city-world.json into this folder.\n'
else
  printf 'City-world.json found. The complete Nashik map will load.\n'
fi
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  printf '\nPort %s is already used by an earlier server.\n' "$PORT"
  printf 'Stop the old Nashik Terminal using Control+C, then open this launcher again.\n'
  printf 'Press Enter to close this window.\n'; read; exit 1
fi
printf '\nLaunching http://localhost:%s/\n' "$PORT"
python3 -m http.server "$PORT" &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null' EXIT INT TERM
sleep 1
open "http://localhost:$PORT/"
wait "$SERVER"

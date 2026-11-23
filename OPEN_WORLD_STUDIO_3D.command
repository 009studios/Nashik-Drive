#!/bin/zsh
# Owner-only 3D editing workspace: not included in Vercel production build.
cd -- "$(dirname -- "$0")" || exit 1
PORT=8000
printf '\nNASHIK WORLD STUDIO 3D v3.0 — OWNER WORKSPACE\n\n'
if [[ ! -f city-world.json ]]; then
  echo 'Your full city-world.json is not in this folder yet.'
  echo 'Choose the Nashik city-world.json from your previous game installation.'
  if command -v osascript >/dev/null 2>&1; then
    FILE=$(osascript -e 'POSIX path of (choose file with prompt "Choose your Nashik city-world.json file")' 2>/dev/null)
    if [[ -n "$FILE" && -f "$FILE" ]]; then
      if python3 - "$FILE" <<'PY'
import json,sys
try:
 with open(sys.argv[1],encoding='utf-8') as f: data=json.load(f)
 assert data.get('cityMode') and isinstance(data.get('blocks'),list)
 assert len(data.get('roadNetwork',{}).get('roads',[]))>0
 print(f"City map verified: {len(data['roadNetwork']['roads']):,} roads, {len(data['blocks']):,} buildings")
except Exception as e:
 print('The selected file is not a valid Nashik full-city map:',e)
 sys.exit(1)
PY
      then
        cp "$FILE" ./city-world.json
        echo 'Map copied. Your original file has not been changed.'
      fi
    fi
  fi
fi
if [[ ! -f city-world.json ]]; then
  echo 'You can still open World Studio using the College Road test map.'
  echo 'To use the complete Nashik map, upload city-world.json using the editor file picker.'
fi
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is in use. Stop the previous server using Control+C."
  echo 'Press Enter to exit.'; read; exit 1
fi
printf '\n3D editor: http://localhost:%s/world-studio-3d.html\nGame:      http://localhost:%s/\n' "$PORT" "$PORT"
python3 -m http.server "$PORT" --bind 127.0.0.1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null' EXIT INT TERM
sleep 1
open "http://localhost:$PORT/world-studio-3d.html"
wait "$SERVER"

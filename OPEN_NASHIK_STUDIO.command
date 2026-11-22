#!/bin/zsh
# Nashik First Drive / Mac quick launcher.
cd -- "$(dirname -- "$0")" || exit 1
PORT=8000
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is already in use, likely by an older Nashik server."
  echo "Stop the other Terminal server with Control+C, then double-click this file again."
  echo "This protects you from accidentally viewing an older game version."
  echo 'Press Enter to close this window.'
  read
  exit 1
fi
print 'Starting Nashik World Studio v2.0…'
print "Editor: http://localhost:$PORT/studio.html"
print "Game:   http://localhost:$PORT/"
print 'Keep this Terminal window open. Control+C stops the game server.'
python3 -m http.server "$PORT" &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null' EXIT INT TERM
sleep 1
open "http://localhost:$PORT/studio.html"
wait "$SERVER"

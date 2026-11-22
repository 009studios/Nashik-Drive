# Nashik First Drive v2.1 — City Explorer

## What is new

- In-game full-city map: click **MAP** or press **M**.
- Drag the map to pan, use the zoom buttons or mouse wheel to zoom.
- Click a road to select a destination. The destination snaps to the nearest mapped road.
- Click **TELEPORT TO ROAD** to drive from that location; teleport only affects your current game session and does not change the saved map.
- Search for street names present in the imported OpenStreetMap road data.
- Quick area shortcuts: College Road, Panchavati, Satpur and Nashik Road (only in full-city mode). These approximate locality coordinates snap to a nearby mapped road; the exact destinations are not official POI entrances.
- **MY CAR** recentres the full map on your vehicle; **FIT** returns to whole-city view.
- The top-right minimap still shows only roads/buildings near the player.

## First-time use on Mac

1. Extract this ZIP to a new folder.
2. Double-click `PLAY_NASHIK_CITY.command` (right-click → Open if required by macOS).
3. If prompted, select `city-world.json` from the older Nashik project where you downloaded all 36 map sections. This copies your data; it does not alter the original.
4. Your browser opens automatically. Click **START DRIVING**, then **MAP** to use the City Explorer.
5. Use **MAP** or **M** to close it. You can also use the **CLOSE** button.

Important: The ZIP includes the existing College Road test world, but not your 15,102-road / 48,423-building full-city file, because that file was generated locally on your Mac and was not uploaded to this conversation. The launcher guides you through reusing that local file without redownloading it.

## Troubleshooting

- If the game says **285 mapped roads**, you are seeing the included College Road data. Place `city-world.json` beside `index.html` inside the project folder and refresh the game.
- If the game says **Full Nashik**, the city map is loaded.
- If port 8000 is busy, stop the previous Terminal with Control+C before relaunching.
- `?college=1` still opens the separate College Road prototype.
- Street search finds only names in the imported roads; unnamed roads remain selectable by clicking.
- District shortcuts select the nearest mapped road within a limited distance and report when none exists.
- Generated buildings and widths are approximate OSM-derived blockouts; this tool is not live traffic navigation.

## Publishing

Run `npm run build` in the project folder, after putting `city-world.json` next to `index.html`. Publish the generated `dist/` folder. Keep the OpenStreetMap attribution.

## Verification

Static JavaScript syntax checks, build and Node road-search / coordinate tests passed. Full WebGL visual testing in an interactive browser was blocked by the testing environment, so please confirm the new map and teleport behavior in Chrome on your Mac.

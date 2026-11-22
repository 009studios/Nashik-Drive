# Nashik First Drive v2.0.1 — macOS SSL certificate fix

This update fixes the city builder's `SSL: CERTIFICATE_VERIFY_FAILED` problem on macOS by downloading Overpass tiles through the system `curl` command rather than Python's potentially unconfigured CA store. HTTPS certificate verification remains **enabled**. No additional Python packages are required.

**How to run:** Extract ZIP, open `Nashik-Drive-main`, double-click `BUILD_FULL_NASHIK_CITY.command`, or run `zsh BUILD_FULL_NASHIK_CITY.command` in Terminal from inside the folder. Existing `world.json` is preserved, and completed downloaded tile files in `.city-cache` can be copied over from the earlier v2.0 folder to resume progress.

If downloads still fail, report the full first `curl error ...` line. This patch only addresses macOS certificate trust, not server overload, rate limits or incomplete public map data.

---

# Nashik First Drive v1.5 — Nearby minimap

**Minimap change:** The top-right game minimap is now a 260-metre player-centered viewport. Streets and nearby buildings scroll beneath the center marker as you drive, and the triangular marker shows heading. The entire map is displayed **only** when the player presses `MAP` or `M`. This is a player-following 2D map, not a separate rendered camera.

The original v1.4 road/building world (285 roads, 561 buildings) is preserved. This release does **not** claim to contain the whole city of Nashik yet. It prepares the small HUD map for larger city datasets using a spatial index.

## Run

1. Extract the ZIP and open `Nashik-Drive-main`.
2. Double-click `OPEN_NASHIK_STUDIO.command` on Mac, or run `python3 -m http.server 8000` from that folder.
3. Game: `http://localhost:8000/`. Editor: `http://localhost:8000/studio.html`.
4. Select **START DRIVING**, then drive with W/A/S/D and watch the nearby map. Select **MAP** for the complete map.

**Important:** If Studio restores an old local draft, first export that draft as a backup and click `Load included map` to use the bundled world. If using another localhost server, stop it first so you don't view an older version.

## Notes

- Map extent is 260m across; the scale bar is 50m. All distances are based on the current `mapScale` value in `world.json`.
- A small spatial grid indexes roads and building footprints to avoid drawing the full city every minimap frame.
- Full-map image/position marker and OSM attribution remain unchanged.
- The nearest roads come from the same editable `world.json` as the 3D game.
- Minimap is north-up; the player arrow rotates to show heading.

---

# Nashik First Drive v1.4 — Seamless Roads + Street Match

This update preserves the bundled 285 road paths and 561 building polygons from the owner's Nov 22, 2026 world export. It is a **blockout quality improvement**, not a 1:1 recreation of College Road.

### What's new

- **Seamless intersections:** A build-time authoring script (`scripts/generate-road-surface.py`) uses Shapely to unite road strips before triangulating them. This removes coplanar overlap/triangular flicker at intersections. Two generated binary layers (`road-surface.bin`, `road-shoulder.bin`) are shipped. They are only used if the road network has the exact geometry/width signature baked into the assets.
- **Editor-friendly fallback:** If you modify road geometry or widths in World Studio and preview, the old baked mesh is intentionally not loaded. Instead, continuous round-join road geometry is drawn into a higher-resolution terrain texture. After publishing a modified `world.json`, regenerate the seamless road assets before production build.
- **Street Match:** A new **Street Match** button in World Studio lets you upload your own reference photo, click a location on the map, set the viewing angle and preview the game from that position alongside the image. This **does not** alter permanent spawn or city geometry. Images stay locally in browser storage; the project does not bundle copyrighted Street View pictures.
- **Facade variations:** Imported residential blocks near a major mapped road get a provisional *visual mixed-use storefront* treatment, with stronger windows/awnings and balconies on selected buildings. These are illustrative, not actual street-verified architecture.
- **Additional props:** Traffic signal, raised planted median and pedestrian crossing, placed through the existing Props tool. These are not automatically placed at real GPS locations.

### Local preview on Mac

**Easiest:** Double-click `OPEN_NASHIK_STUDIO.command` from the extracted folder. If macOS warns about an unidentified developer, right-click → Open. Keep the Terminal window open; Control+C stops it. The launcher refuses to run when an older server occupies port 8000.

Alternatively, in Terminal:

```sh
cd "/path/to/Nashik-Drive-main"
python3 -m http.server 8000
```

Open `http://localhost:8000/studio.html` and use **Street Match**. The bundled `world.json` already contains all current mapped buildings and roads. Old drafts on the same localhost port can override the bundled world. To switch safely, click **Load included map** (downloads a backup first), or choose **Import JSON** and select the new `world.json`.

To publish your edited road widths or coordinates using the seamless 3D mesh (optional Python authoring dependency):

```sh
python3 -m pip install shapely
python3 scripts/generate-road-surface.py
npm run build
```

The public `dist/` contains the game only—not Studio. Real road widths, road dividers, sign positions, building styles and true height still require local verification. The OSM map data remains subject to its attribution and licensing conditions; reference photos are not included.

---

# Nashik First Drive v1.3 — Road + Building Refinement

This ZIP contains the actual **exported College Road world** supplied by the owner on Nov 22, 2026 (285 OSM-derived roads and 561 OSM-derived building footprints). It is already bundled as `world.json`; no separate GeoJSON import is needed to preview this world.

### Improvements over v1.2

- **Smoother road ribbons**: modified miter joins along curves, rounded end caps only at road ends, and a restrained shoulder edge. The old road mesh drew a disk at *every* intermediate vertex, which created obvious lumpy corners. Source street centerlines and widths are unchanged.
- **Polygon building facades**: automatic windows and optional balconies now work on irregular OSM footprint buildings rather than only rectangle blocks. Only camera-facing nearby facade edges are drawn for browser performance.
- **Focus city** button in World Studio: zooms into the actual road and building extent instead of leaving large blank map margins. The existing fit button still shows the complete 1,175 × 1,280 map frame.
- **Preservation**: original exported GPS-derived centerlines, all 561 building polygons, 285 road definitions, manually chosen spawn, and local-edit metadata remain unmodified.

### Quick start on Mac

1. Unzip this archive and open Terminal. Type `cd ` then drag the *Nashik-Drive-main* folder from Finder onto the **same Terminal line**; press Enter. Alternatively, quote the full path.
2. Run `python3 -m http.server 8000`.
3. Open `http://localhost:8000/` to play the included world, or `http://localhost:8000/studio.html` to edit.
4. Your old v1.2 Studio local draft might be automatically restored if you use the same browser and port. To load the **bundled v1.3** map instead, use **Import JSON** in Studio and select `world.json` from this extracted folder. Export your old draft first if it contains unsaved modifications.
5. After editing, click **Export world.json** and replace the ZIP's `world.json` with the exported one before publishing. `npm run build` makes the public game in `dist/`; the local editor is intentionally excluded.

### Accuracy limits

OpenStreetMap road data provides approximate road centerlines. Road widths and most building heights still require local validation. This update improves **visual geometry only**; it does not add physical road boundaries, traffic AI, properly surveyed carriageway edges, real signage or verified building styles. Auto-generated windows/rooftop objects are fictional visual detail, not claims about real architecture. Full WebGL rendering must be visually checked on target devices.

---

# Nashik First Drive v1.2 — Auto City Builder

**New:** Import accurate OpenStreetMap building footprints into the same geographic coordinate frame as your existing roads. Editable 3D building blocks are generated automatically. The road geometry and gameplay from v1.1 are preserved.

## Quick setup on Mac

1. Extract this ZIP and open its `Nashik-Drive-main` folder.
2. Type `cd ` in Terminal **without pressing Enter**, drag that folder into Terminal and press Enter. macOS automatically escapes spaces. Alternatively use `cd "$HOME/Downloads/Nashik-Drive-main 7"` if that is your actual extracted folder name.
3. Run `python3 -m http.server 8000`.
4. Open http://localhost:8000/studio.html.
5. **Keep your existing work:** If your roads are stored in a downloaded `world.json`, click **Import JSON** in Studio and select it. If the editor is already showing your imported roads from the local draft, no extra import is necessary. Do **not** overwrite your saved road world with the sample `world.json` in this ZIP.

## Auto City: import roads + buildings

1. Open https://overpass-turbo.eu/ and navigate to the same small College Road / BYK College zone used for the roads. Zoom to roughly 0.5–1 km across.
2. Paste the query below and click **Run → Export → GeoJSON**:

```overpass
[out:json][timeout:90];
(
  way["highway"~"^(primary|secondary|tertiary|residential|unclassified|service|living_street|primary_link|secondary_link|tertiary_link)$"]({{bbox}});
  way["building"]({{bbox}});
);
out geom;
```

3. In Studio, select **Auto City Builder**, then upload your `.geojson` file.
4. With your existing road world open, choose **Add buildings to my imported roads**. Buildings will be positioned using the current road import's geographic center and scale, *not* by stretching a screenshot.
5. Choose **New world from roads + buildings** only if you want to replace the whole map and the uploaded file contains **both** roads and buildings.
6. Review the green building outlines. If too many are missing, verify geographic area, turn off **Skip footprints intersecting roads**, or check whether OpenStreetMap actually has buildings mapped in your area.
7. Click **Generate editable city**. A `world-backup-before-auto-city.json` backup is downloaded automatically before any modification.
8. Use **Preview game** to inspect the new 3D blocks, then **Export world.json** to publish. Replace `world.json` in your actual project/repository. Local draft edits do not automatically deploy to Vercel.

### Notes & limits

- **Accuracy:** Building footprints come from user-exported OSM data, but some mapped building shapes, building levels and heights may be absent, outdated or incorrect. Missing heights default to 3 floors, editable afterward.
- Inner courtyards/holes, complex roofs and multiple structural parts are simplified. Long or very small geometries and buildings outside the selected world are skipped.
- The safety filter intentionally skips footprints intersecting road widths. OSM roads are **centerlines** and many widths are estimated, so you can disable that filter after reviewing the preview.
- Keep road and building geometry from the **same geographic area**. Legacy screenshot-based roads cannot align precisely with OSM footprints.
- The world is limited to **1,175 × 1,280 map pixels**, **0.15–4 metres per pixel**, and a configurable limit (default 1,400) on imported buildings to keep the browser game usable.
- No live API, Google Maps scraping, automatic inference from satellite photos, missions, AI pedestrians or traffic routing is included.
- Attribution: **© OpenStreetMap contributors**. Follow the ODbL licensing obligations for derived OpenStreetMap databases; see https://www.openstreetmap.org/copyright.
- The owner editor is local-only, not access-controlled. Public deployment uses `npm run build` and includes only `dist/`, not `studio.html`.

---

# Nashik First Drive v1.0 — GeoJSON Road Builder + World Studio

This is a **browser-based 3D free-roaming game** with an **owner-only LOCAL world editor**. The 180 original buildings, 13 props, and screenshot-based streets remain in the original `world.json` unless you explicitly replace them.

## NEW: Import accurately located roads instead of tracing a screenshot

**You don't have to hand-draw roads anymore.** OpenStreetMap (OSM) GeoJSON supplies latitude/longitude road centerlines. The importer projects those coordinates into a consistent 2D metric coordinate system with one scale for both axes. The game paints imported roads onto its ground texture **and generates actual flat road meshes above the terrain**, retaining editable vector paths in `world.json`.

### 1. Get a real road map (Overpass Turbo)

1. Open https://overpass-turbo.eu/ and zoom to **BYK College / College Road in Nashik**. Start with a neighborhood-sized area, not all of Nashik.
2. Delete the existing Overpass query and paste:

```overpass
[out:json][timeout:60];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|service|living_street|pedestrian|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"]({{bbox}});
);
out geom;
```

3. Click **Run**, then **Export → GeoJSON**. Save the exported `.geojson` file. Some service roads and crossings may need manual inspection; only mapped ways are imported.
4. In Terminal, navigate to the extracted project directory and run:

```bash
python3 -m http.server 8000
```

5. Open **http://localhost:8000/studio.html**, click **Import Real Roads**, choose the GeoJSON file and review the preview.
6. Select **New accurate road-first world** (recommended). This keeps the real road proportions and replaces your old screenshot-based ground, buildings, props and manual strokes. The editor automatically downloads a `world-backup-before-roads.json` safety backup before replacing the old layout. You can also Undo the import.
7. Alternatively, select **Align with existing old map**. This uses the old map scale. Adjust X/Y offset and rotation to compare locations. **This mode is approximate, not survey-calibrated**; an arbitrary screenshot generally won't align with geographical coordinates unless it has known anchor points and scale.
8. Click **Apply Roads to World**. Select any imported road in the editor to edit its name, category, **width (metres)** and traffic-direction metadata. Drag a road to shift its vector path. The **Spawn** tool places the player on a road. Use **Preview game** to see the actual 3D game.
9. Click **Export world.json**. Replace the project's `world.json` with the exported copy, then push to the original GitHub repository and redeploy on Vercel. Only the public game is deployed; the editor is NOT deployed.

**Important:** `world.json` from the importer is the one file needed for both game and editor to display the imported roads. The in-game minimap is regenerated from the new road texture. `world.json` already shipped in this ZIP is the **unchanged original starting world** so your previous work is safe.

### What this solves

- North-oriented relative road positions and distances from real geographic coordinates rather than guessed pixels.
- Road widths can be adjusted in metres; missing width tags use approximate defaults by road class.
- Road intersection **visuals** merge smoothly, and shared mapped vertices generate junction-marker metadata for future navigation.
- Editor and playable game use exactly the same vector paths and pixel-to-metre scale.
- Existing hand-drawn road strokes and `Image → 3D Map` remain available as additional tools.

### Limitations to understand before expanding

- OSM provides mostly road **centerlines**. Widths, split carriageways, footpaths, road geometry, and some junctions may be incomplete. Do not describe output as survey accurate; manual review is still needed.
- Junctions are detected from shared mapped vertices (with a small snapping threshold), but this release **does not implement traffic AI, turn restrictions, collisions at road edges, or full routing/turn graphs**. Imported roads are flat rendered WebGL geometry and stored editable vector data; there is no terrain-following grade separation, traffic navigation or turn restriction system yet.
- This importer takes **GeoJSON files**. It does not fetch Google Maps, trace a photo with AI, import GPS automatically from screenshots, or infer building footprints.
- Recommended neighborhood size: up to roughly 3 km across (depending on map aspect ratio). Large areas may exceed the current supported metres-per-pixel range of 0.15–4.
- If the imported roads are a new neighborhood, the original building blocks won't align; add/import new buildings later. Auto importing OSM building footprints is not part of this release.
- Do not use Google Maps imagery or extracted 3D data without the necessary licensing rights. OSM is under the ODbL; include attribution to **© OpenStreetMap contributors** (https://www.openstreetmap.org/copyright) in a publicly distributed product, and review ODbL obligations when using/deriving from the data.
- The editor is local-only and **not password-protected**. Do not publish the entire project root as an unprotected web folder.

## Existing tools retained

- `studio.html` / `studio.js`: select and edit buildings, polygon footprints, storeys, roofs, props, spawn, road paint, local autosave, undo/redo and export.
- `Image → 3D Map`: upload a color-coded screenshot and detect *approximate building footprints*, not geo-verified roads.
- `index.html` / `game.js`: browser-based WebGL free driving, walking and mobile controls.
- `world.json`: source of published building, road, map-image and prop data.

## Publishing

```bash
npm run build
```

Vercel uses `vercel.json` to deploy `dist/`. Owner editing pages and GeoJSON importer scripts are **excluded** from the public build, while `geo-roads.js` (shared road renderer) is included. If Vercel settings override the project build/output settings, ensure build command is `npm run build` and output directory is `dist`.

For local publication preview:

```bash
npm run build
cd dist
python3 -m http.server 8001
```

## Quick Mac navigation tip

Enter `cd ` (with a trailing space) into Terminal and then **drag the extracted `Nashik-Drive-main` folder from Finder directly into Terminal**. Press Enter. The shell will escape spaces correctly; do not manually add extra quotation marks.


## v1.1: Blank ground / outdated minimap troubleshooting

If World Studio shows the imported road layout but the driving game is empty:

1. Always press **Preview game** in Studio (the URL must end in `index.html?preview=1`). A plain `index.html` loads published `world.json`, not unpublished edits.
2. In the game, the new **world-status** strip displays how many roads and buildings actually loaded. If it says **Original map** or **no imported road data**, the game did not load your GeoJSON draft. Return to Studio, import the GeoJSON, then Preview again.
3. A new road-first import **intentionally clears old building blocks** because those blocks correspond to the previous screenshot map. Roads will now appear as flat, solid WebGL road geometry; no buildings appear until you import/place new footprints.
4. For normal `index.html` or published Vercel play, export the new **world.json** in Studio, replace the existing file and redeploy.
5. If the road status says N mapped roads but the ground still looks blank, open the browser Developer Tools Console to check WebGL errors; try an incognito window to avoid stale service worker resources.

The minimap is regenerated from the loaded road network instead of the legacy `map_preview.png` whenever imported roads are present.


## v2.0 — Full Nashik City Builder

**The full city is not pre-bundled:** it must be downloaded from OpenStreetMap.
The current `world.json` always remains the College Road blockout.

1. Stop existing servers (`Control+C`).
2. Double-click `BUILD_FULL_NASHIK_CITY.command` on macOS (or run it in Terminal).
3. The downloader saves raw response tiles to `.city-cache/` and can resume by rerunning.
4. It creates `city-world.json`, which the driving game prefers automatically.
5. The map is an approximately 20 × 26 km urban study bounding box at a stable 23.5 m/pixel.
6. `MAP`/`M` displays the full overview; the HUD minimap stays locked on nearby streets.
7. `index.html?college=1` always loads the older College Road world.
8. World Studio `studio.html` continues editing College Road; whole-city data is kept separate to avoid overwriting local detail. A future edition will support editing selected city districts.

If API services are unavailable, use `python3 scripts/build_nashik_city.py --input <your-file.geojson>` to create the same city file from a downloaded OSM GeoJSON/Overpass JSON containing roads and buildings. The Python importer is dependency-free.

The city bounding box is not a legally authoritative Nashik municipal boundary. It does not recreate all terrain, real facades, signs, or rivers yet. Building elevations and road widths may be estimated. Observe ODbL and credit OpenStreetMap contributors.

Production deployment: after city generation, run `node scripts/build-public.mjs` (Node installed) and publish the generated `dist/` directory, which includes `city-world.json` when present.


## v2.0 Minimap alignment correction

- Minimap shows only the nearest 160 m (180 m for the full city), not the whole city.
- The small bright centre dot marks the exact WebGL car/character position; the smaller triangle shows heading.
- Road widths in the HUD and 3D game both use the same OSM width in metres.
- Coordinate conversion is tested with identical world/map inputs.
- This fixes the HUD's previous oversized marker (18px across a 3px-wide road). It does not claim to fix incomplete or erroneous OSM street data.

### 2026 Overpass usage caveat

The one-click city fetcher sends small requests and caches each successful chunk. Public Overpass servers can rate-limit or reject requests; on a 429/503 the script backs off before retrying, and rerunning it resumes from cached chunks. For heavier future use, prefer a downloaded regional extract instead of repeatedly querying public Overpass instances. The game does NOT ship with a fake city map.

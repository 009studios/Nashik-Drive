# Nashik World Studio 3D — first foundation release (v3.0)

This updates the existing Nashik First Drive v2.2 project; it is **not** a new game engine or a photorealistic reconstruction.

## Quick start (macOS)

1. Unzip the project and open `Nashik-Drive-main`.
2. Double-click `OPEN_WORLD_STUDIO_3D.command` (right-click > Open if needed).
3. The full Nashik `city-world.json` supplied for this project is already included. The launcher will only ask for a file if the JSON is missing. You can also choose a different dataset using **Import city-world.json**.
4. Use the city overview or search for a road. Drag to orbit the 3D street scene, Shift+drag to pan, Alt+drag a selected prop to move it, scroll to zoom.
5. Click a building or road to select it. Change dimensions, floors, kind or road width in the inspector. Add trees, dividers and props using the left toolbar.
6. Click **Test drive this street** to preview in the same local game. For a portable copy of your work, click **Export edits**. The result is `world-overrides.json`.
7. Put `world-overrides.json` next to `city-world.json` in the game project, then deploy with your normal Vercel/GitHub workflow. The game automatically applies those safe edits to its own in-memory world. Running `npm run build` copies the override file into `dist/` if present.

The editor is intentionally **excluded from the public production build**. It has no server-side user authentication: do not publish the raw development folder containing `world-studio-3d.html` to a public site. The provided build command outputs only game files.

## Why separate edits?

The original OpenStreetMap-derived `city-world.json` (road coordinates and building footprints) is never overwritten. The `world-overrides.json` file stores only changes. It includes identifying metadata (scale, counts and reference center) so it cannot be accidentally applied to another city's map or a differently imported Nashik map.

## Performance

World Studio creates spatial lookup indexes once when loading the map and renders buildings/roads only around the editor focus, instead of drawing tens of thousands of objects each frame. Large-city performance still requires testing on your actual Mac. The 3D preview is a lightweight perspective renderer, not the exact WebGL game renderer; always use **Test drive** to validate the final result.

## Implemented vs future work

**Now:** bundled full Nashik map, full city source import and detection, overview map location selection, road-name search, perspective street camera, local object selection, building height/floor/width edits, road width edits, street-prop placement/editing, Alt+drag move for props, delete, duplicate prop, undo/redo, local draft, portable JSON edits, game preview.

**Not yet:** moving road centerline vertices, vertex-level polygon reshaping, axis gizmos for moving/scaling buildings (currently use property inputs), persistent cloud account, live multiplayer, full 3D tile streaming in the driving game, physically accurate traffic/collisions. Those remain next development stages.

## Source data

Map and buildings originate from OpenStreetMap where imported; retain visible attribution in the game: © OpenStreetMap contributors (ODbL). Imported heights, lanes and building names are not guaranteed accurate.

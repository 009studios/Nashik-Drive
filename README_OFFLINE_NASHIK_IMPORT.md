# Nashik First Drive v2.0.3 — Import downloaded city map locally

The previous Overpass-based builder may fail midway because public servers are saturated. This version adds a file-based offline import. Original `world.json` is left untouched; the generated city is `city-world.json`.

1. Visit https://extract.bbbike.org/ and navigate to Nashik, Maharashtra, India.
2. Create the extraction rectangle. For the current game frame use bounding corners approximately **west 73.67°, south 19.91° / east 73.915°, north 20.09°**. This is the project's rectangular urban study area, not an official city boundary.
3. Choose **OSM XML gzip** (not Garmin, PNG, PBF or MBTiles). Name the extract Nashik-Game and provide an email address for its download link.
4. When the extract is available, download it. If it arrives inside a `.zip`, extract it and select the underlying `.osm.gz` file.
5. Double-click `IMPORT_DOWNLOADED_NASHIK_MAP.command` in the project folder. In the macOS picker, select the downloaded `.osm.gz` file.
6. The builder creates `city-world.json` with the roads and buildings mapped in the selected area, then opens the game. If port 8000 is occupied, stop the old server and open this version from the new folder.

Alternate for Terminal users (drag the folder after typing `cd ` and press Enter):

```sh
python3 -u scripts/build_nashik_city.py --input "$HOME/Downloads/Nashik-Game.osm.gz"
python3 -m http.server 8000
```

`--input` now supports `.osm`, `.osm.gz`, `.osm.xz`, and GeoJSON/Overpass JSON (`.json`, `.geojson`, optional `.gz` or `.xz`). It does not natively parse `.pbf`, `.zip`, `.gpkg` or `.mbtiles`. BBBike OSM XML is the easiest supported download format.

**Limitations:** This importer handles OSM roads and simple closed building ways, not multipolygon relations or every landmark. Several building floors/road widths are estimates. The output covers the project bounding rectangle and may contain many buildings. Performance of city-wide driving must be verified on target Mac/mobile devices. Do not attempt to place all detailed assets at once. Map attribution must remain `© OpenStreetMap contributors` and OpenStreetMap ODbL terms apply. Data provided via BBBike, not Google Maps/Street View.

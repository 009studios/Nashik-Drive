# Nashik First Drive v2.2 — Live location on the minimap

The bottom label in the top-right minimap no longer shows a fixed `NEARBY · 180 M` caption.

- The minimap **still follows the car** and shows only nearby roads.
- It now displays the current OSM-mapped **street name** when the car is on a named road.
- If the closest road has no mapped name, it shows **Near <mapped named road>** only when a named road is within 65 m. Otherwise it displays approximate latitude/longitude when geo-referencing is available, or **Unnamed street** as a fallback.
- The location updates while driving or after teleporting. The full city map is still accessible by pressing M or clicking MAP.
- This is the **in-game car location** from imported map data, **not the user's physical GPS location**. Map names and positions reflect available OSM data and may be approximate.

## To load your existing full-city map

Your `city-world.json` is saved on your own Mac. It is **not** bundled in this ZIP. You can either:

1. Follow the existing `PLAY_NASHIK_CITY.command` prompt and choose your old `city-world.json`; or
2. Copy `city-world.json` from the previous project into the new extracted `Nashik-Drive-main` folder.

Then launch `PLAY_NASHIK_CITY.command` or open the game through a local server.

Your original College Road world remains included and unchanged. No re-download is required.

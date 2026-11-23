# Nashik First Drive — Creta-inspired SUV update (v3.1)

This package includes the complete Nashik city dataset from v3.0 and replaces the original teal block car with an **original lightweight, stylized SUV mesh**. The photos supplied by the project owner guided the shape, proportions and visual details. It is *not* an exact manufacturer CAD model or a downloaded Sketchfab model.

## Run on Mac

1. Unzip the archive.
2. In Terminal type `cd ` and **drag the `Nashik-Drive-main` folder onto the same command line**. Press Return.
3. Run `python3 -m http.server 8000`.
4. Open `http://localhost:8000/`, press **START DRIVING**.
5. Open `http://localhost:8000/creta-preview.html` to inspect and rotate the car by itself.

For Vercel: deploy this entire updated project to the existing Vercel project (do not deploy the model alone). The provided build script automatically includes `creta-car.js` and the showroom page in `dist`. `city-world.json` and other data are preserved. Run `npm test && npm run build` locally if Node.js is installed.

## Model files

- `creta-car.js`: The **in-game car asset** and its triangles/materials; the main renderer draws this model directly in WebGL 2. No third-party 3D loader, Sketchfab download, or network fetch is required.
- `creta-inspired-suv.glb`: Separate re-usable 3D asset for Blender or a future engine (material colors only).
- `creta-preview.html`: Car-only rotatable preview. Drag to rotate and scroll to zoom.

### Features

- Sculpted SUV body with a contemporary Creta-inspired silhouette
- Tinted windows, split window design, contrasting roof and rails
- Large dark grille with patterned detailing and sculpted front fascia
- Slim front LED signature and connected rear lamp motif
- Wheels with tire/rim geometry and wheel-arch cladding
- Mirrors, handles, door seams, chrome elements, rear badge and plates

### Limitations

This is a low-poly *interpretation*, not a photo-accurate Creta. The game still uses its older simplified handling, vehicle collisions and camera system, which are the next independent engineering tasks. The vehicle wheels are static geometry for now. Shader lighting can look different on individual devices.

The browser WebGL gameplay rendering could not be visually tested in this headless execution environment; the asset geometry, load order, syntax, project tests, and production build were checked.

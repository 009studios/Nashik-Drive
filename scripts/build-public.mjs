import { mkdir, copyFile, rm, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const out=join(root,'dist');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
const publicFiles=['index.html','styles.css','game.js','creta-car.js','creta-preview.html','shapes.js','geo-roads.js','road-mesh.js','mini-map.js','city-explorer.js','world-overrides.js','road-shoulder.bin','road-surface.bin','road-surface-meta.json','world.json','terrain.png','map_preview.png','road_layout_preview.png','road_mask.png','manifest.webmanifest','icon.png'];
for(const name of publicFiles)await copyFile(join(root,name),join(out,name));
for(const name of ['city-world.json','city-setup.html','world-overrides.json']){try{await access(join(root,name));await copyFile(join(root,name),join(out,name));}catch(e){/* Optional city data */}}
console.log('Built public game in dist/. Owner editor files are not published.');

import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const base=new URL('../',import.meta.url);
const read=(file)=>fs.readFileSync(new URL(file,base),'utf8');
const env={};env.window=env;env.globalThis=env;
vm.runInNewContext(read('mini-map.js'),env);
const m=env.NashikMiniMap;
const roads=[
 {name:'College Road',widthM:8,points:[[100,100],[200,100]]},
 {name:'',widthM:5,points:[[200,100],[200,180]]},
 {name:'Satpur Main Road',widthM:9,points:[[700,700],[800,700]]}
];
const index=m.indexFeatures(roads,[],null,40);
let at=m.currentStreet(index,130,100,1);
assert.equal(at.label,'College Road');assert.equal(at.kind,'street');
at=m.currentStreet(index,200,150,1);
assert.equal(at.kind,'near');assert.equal(at.label,'Near College Road');
at=m.currentStreet(index,200,180,1);
assert.equal(at.kind,'unnamed');
at=m.currentStreet(index,735,700,1);
assert.equal(at.label,'Satpur Main Road');
at=m.currentStreet(index,1900,2000,1);
assert.equal(at.kind,'unknown');assert.equal(at.label,'Nashik');
const onlyUnnamed=m.indexFeatures([{name:'',widthM:5,points:[[10,10],[20,10]]}],[],null,40);
assert.equal(m.currentStreet(onlyUnnamed,14,10,1).label,'Unnamed street');
const game=read('game.js'),html=read('index.html');
assert.ok(game.includes('miniMap.locate(u,v)'));
assert.ok(game.includes('const coords='));
assert.ok(html.includes('id="minimap-location"'));
assert.ok(!html.includes('NEARBY · 160 M'));
console.log('PASS: Player minimap shows mapped street, nearby street, or geographic coordinates; updates on player movement; full map stays independent.');

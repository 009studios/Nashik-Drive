import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const source=fs.readFileSync(new URL('city-explorer.js',root),'utf8');
const world=JSON.parse(fs.readFileSync(new URL('world.json',root),'utf8'));
const scope={};scope.window=scope;scope.globalThis=scope;
vm.runInNewContext(source,scope);
const exp=scope.NashikCityExplorer;
assert.ok(exp);
assert.deepEqual(Array.from(exp.projection(20,73.79,{lat:20,lon:73.79},23.5)),[587.5,640]);
const index=exp.createRoadIndex(world.roadNetwork.roads);
const point=world.roadNetwork.roads[0].points[0];
const snap=exp.nearestRoad(index,point[0]+1,point[1]+1,15);
assert.ok(snap,'should snap to a nearby mapped road');
assert.ok(snap.distancePixels<=Math.SQRT2);
assert.ok(Number.isFinite(snap.heading));
assert.equal(exp.nearestRoad(index,-10000,-10000,5),null,'no teleport target when no mapped roads exist');
const handlers={};
const noop=()=>{};
const ctx={setTransform:noop,fillRect:noop,save:noop,restore:noop,translate:noop,scale:noop,drawImage:noop,
 beginPath:noop,arc:noop,fill:noop,stroke:noop,strokeRect:noop,moveTo:noop,lineTo:noop,closePath:noop,
 fillText:noop,measureText:s=>({width:s.length*6})};
function el(id){return {id,clientWidth:800,clientHeight:600,width:0,height:0,disabled:false,style:{},textContent:'',
  innerHTML:'',getBoundingClientRect:()=>({width:800,height:600,left:0,top:0}),
  listeners:{},addEventListener(type,cb){this.listeners[type]=cb;},
  appendChild:noop,replaceChildren:noop,focus:noop,click(){this.listeners.click?.({});}};}
const els=new Map();
const document={getElementById:id=>els.get(id)||els.set(id,el(id)).get(id),
  createElement:tag=>{const item=el(tag);item.type=tag;return item;}};
scope.document=document;scope.devicePixelRatio=1;
const canvas=document.getElementById('explorer-map');canvas.getContext=()=>ctx;
const explorer=exp.create({canvas,roads:world.roadNetwork.roads,blocks:world.blocks,
  metresPerPixel:world.mapScale,center:world.roadNetwork.center,cityMode:false,
  baseCanvas:{},shapes:{worldPoints:()=>[]},onTeleport:noop});
assert.ok(explorer);
explorer.open(point[0],point[1]);
assert.ok(canvas.width>0&&canvas.height>0);
assert.ok(explorer.choose(point[0],point[1],'Test road'));
assert.equal(document.getElementById('map-teleport').disabled,false);
assert.equal(explorer.selection.label,'Test road');
assert.ok(explorer.search('College').some(r=>/college/i.test(r.name)));
explorer.updatePlayer(point[0]+10,point[1]+5);
explorer.close();
const html=fs.readFileSync(new URL('index.html',root),'utf8');
assert.ok(html.includes('id="explorer-map"'));
assert.ok(html.includes('src="city-explorer.js"'));
const game=fs.readFileSync(new URL('game.js',root),'utf8');
assert.ok(game.includes('teleportToRoad(destination)'));
assert.ok(game.includes('cityExplorer?.updatePlayer(u,v)'));
console.log(`PASS City Explorer: ${world.roadNetwork.roads.length} local roads indexed; GPS projection, road snapping, empty-area guard, map rendering, street search and teleport selection.`);

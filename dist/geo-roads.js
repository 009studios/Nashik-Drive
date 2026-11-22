/* GeoJSON road projector and shared road renderer. No network requests or third-party keys. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.NashikGeoRoads=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const DEG=Math.PI/180, EARTH=6371008.8;
 const ALLOWED=new Set(['motorway','trunk','primary','secondary','tertiary','unclassified','residential','service','living_street','motorway_link','trunk_link','primary_link','secondary_link','tertiary_link','pedestrian']);
 const WIDTH={motorway:16,trunk:13,primary:12,secondary:9,tertiary:8,unclassified:6,residential:6,service:3.5,living_street:4,motorway_link:7,trunk_link:6,primary_link:5,secondary_link:4.5,tertiary_link:4,pedestrian:3};
 function roadWidth(p){const n=parseFloat(String(p.width||'').replace(',','.'));if(Number.isFinite(n)&&n>=2&&n<=35)return n;const lanes=Number(p.lanes);if(Number.isInteger(lanes)&&lanes>=1&&lanes<=12)return Math.min(30,lanes*3.1+(lanes>1?1:0));return WIDTH[p.highway]||6;}
 function geometryLines(geom){if(!geom)return[];if(geom.type==='LineString')return[geom.coordinates];if(geom.type==='MultiLineString')return geom.coordinates;if(geom.type==='Polygon')return geom.coordinates.slice(0,1);return[];}
 function isPoint(p){return Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;}
 function parseGeoJSON(raw){if(!raw||typeof raw!=='object')throw new Error('Upload a GeoJSON FeatureCollection or LineString.');
   const feats=raw.type==='FeatureCollection'?raw.features:raw.type==='Feature'?[raw]:geometryLines(raw).length?[{type:'Feature',geometry:raw,properties:{highway:'residential'}}]:[];
   if(!Array.isArray(feats)||feats.length>15000)throw new Error('The GeoJSON has too many features. Export a smaller area.');
   const roads=[],all=[];for(const [i,f] of feats.entries()){const p=f.properties||{};const hw=typeof p.highway==='string'?p.highway:'residential';if(!ALLOWED.has(hw))continue;
     const parts=geometryLines(f.geometry);for(const [j,part] of parts.entries()){
       if(!Array.isArray(part)||part.length<2||part.length>15000||!part.every(isPoint))continue;
       const cleaned=part.filter((v,k)=>k===0||v[0]!==part[k-1][0]||v[1]!==part[k-1][1]);if(cleaned.length<2)continue;
       all.push(...cleaned);roads.push({id:String(f.id||p['@id']||p.osm_id||i)+'-'+j,name:typeof p.name==='string'?p.name.slice(0,110):'',highway:hw,widthM:roadWidth(p),oneway:['yes','true','1','-1'].includes(String(p.oneway)),grade:String(p.layer||0)+(p.bridge&&p.bridge!=='no'?'-bridge':'')+(p.tunnel&&p.tunnel!=='no'?'-tunnel':''),coords:cleaned});
       if(roads.length>6000||all.length>130000)throw new Error('Too many road coordinates. Choose a smaller area in Overpass Turbo.');
     }
   }
   if(!roads.length)throw new Error('No drivable LineString roads found. Export highways as GeoJSON.');
   let minLon=Infinity,maxLon=-Infinity,minLat=Infinity,maxLat=-Infinity;for(const [lon,lat] of all){minLon=Math.min(minLon,lon);maxLon=Math.max(maxLon,lon);minLat=Math.min(minLat,lat);maxLat=Math.max(maxLat,lat);}
   const lat0=(maxLat+minLat)/2,lon0=(maxLon+minLon)/2,cos=Math.cos(lat0*DEG);
   const toMeters=([lon,lat])=>[(lon-lon0)*DEG*EARTH*cos,-(lat-lat0)*DEG*EARTH];
   const projected=roads.map(r=>({...r,coords:r.coords.map(toMeters)}));
   const width=(maxLon-minLon)*DEG*EARTH*cos,height=(maxLat-minLat)*DEG*EARTH;
   if(width<3||height<3)throw new Error('The selection is too narrow. Export a normal neighborhood-sized area.');
   if(width>18000||height>18000)throw new Error('Area too large for this browser game. Choose a neighborhood first (up to about 3 km across).');
   return {roads:projected,boundsMeters:{width,height},center:{lat:lat0,lon:lon0},sourceFeatures:feats.length};
 }
 function project(parsed,opts={}){const W=opts.width||1175,H=opts.height||1280,pad=opts.padding??72;
   const autoScale=Math.max(parsed.boundsMeters.width/(W-2*pad),parsed.boundsMeters.height/(H-2*pad),.15);
   const metresPerPixel=opts.metresPerPixel||autoScale;
   if(metresPerPixel<.15||metresPerPixel>4)throw new Error('Selection does not fit the supported map scale (0.15–4 m/pixel). Zoom into a smaller area.');
   const theta=(Number(opts.rotation)||0)*DEG,co=Math.cos(theta),si=Math.sin(theta),dx=Number(opts.offsetX)||0,dy=Number(opts.offsetY)||0;
   const roads=parsed.roads.map(r=>{const points=r.coords.map(([x,y])=>[
     +((W/2+dx+(x*co-y*si)/metresPerPixel)).toFixed(2),+((H/2+dy+(x*si+y*co)/metresPerPixel)).toFixed(2)
   ]);return {id:r.id,name:r.name,highway:r.highway,widthM:r.widthM,oneway:r.oneway,grade:r.grade,points};});
   const network={version:1,source:'OpenStreetMap GeoJSON',coordinateSystem:'game-pixels',metresPerPixel,center:parsed.center,roads,junctions:findJunctions(roads,metresPerPixel)};
   return network;
 }
 function findJunctions(roads,k){const nodes=new Map(),cell=.4/Math.max(.15,k);
  for(const r of roads){for(let i=0;i<r.points.length;i++){
    const [x,y]=r.points[i],key=`${Math.round(x/cell)}:${Math.round(y/cell)}:${r.grade||'0'}`;
    if(!nodes.has(key))nodes.set(key,{x,y,roadIds:new Set(),degrees:0});const n=nodes.get(key);n.roadIds.add(r.id);n.degrees+=(i===0||i===r.points.length-1)?1:2;
  }}
  return [...nodes.values()].filter(v=>v.roadIds.size>=2||v.degrees>=3).slice(0,10000).map(v=>[+v.x.toFixed(2),+v.y.toFixed(2),v.roadIds.size]);
 }
 function draw(ctx,network,options={}){if(!network||!Array.isArray(network.roads))return;
   const k=options.metresPerPixel||network.metresPerPixel||.65;
   const roads=network.roads;
   ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
   for(const outer of [true,false]){
     for(const r of roads){if(!r.points||r.points.length<2)continue;
       ctx.beginPath();for(let i=0;i<r.points.length;i++){const p=r.points[i];if(i===0)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);}
       ctx.lineWidth=Math.max(1,r.widthM/k)+(outer?Math.min(3,1.5/k):0);
       ctx.strokeStyle=outer?'#aaa79c':options.highlight?'#36656b':'#303840';ctx.stroke();
     }
   }
   ctx.restore();
 }
 function distanceToRoad(x,y,r){let best=Infinity;for(let i=1;i<(r.points?.length||0);i++){
   const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
   best=Math.min(best,Math.hypot(x-(a[0]+t*dx),y-(a[1]+t*dy)));
 }return best;}
 function nearestRoad(x,y,network,onlyWithin=Infinity){let best=null,bestD=onlyWithin;
   for(let i=0;i<(network?.roads?.length||0);i++){const r=network.roads[i],d=distanceToRoad(x,y,r);if(d<bestD){bestD=d;best={index:i,road:r,distance:d};}}
   return best;
 }
 return {parseGeoJSON,project,draw,nearestRoad,distanceToRoad,roadWidth,findJunctions};
});

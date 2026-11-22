/* Auto City Builder — georeferenced OSM building footprints to Nashik world blocks.
 * Pure parser/projector: the same geographic origin and scale as the road importer.
 * Does not contact a mapping service and does not infer unmapped buildings.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.NashikGeoBuildings=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const DEG=Math.PI/180, EARTH=6371008.8,W=1175,H=1280;
const limited=(v,min,max,d)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):d;
function validCoord(p){return Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;}
function isBuilding(p){return p&&((p.building&&p.building!=='no'&&p.building!=='false')||(p['building:part']&&p['building:part']!=='no'));}
function parse(raw){const feats=raw?.type==='FeatureCollection'?raw.features:raw?.type==='Feature'?[raw]:null;
 if(!Array.isArray(feats)||feats.length>20000)throw new Error('Choose a GeoJSON FeatureCollection from a smaller map area.');
 let roads=[],footprints=[],rejected=0;
 for(const [i,f] of feats.entries()){
  const p=f?.properties||{};if(typeof p.highway==='string'&&p.highway)roads.push(f);
  if(!isBuilding(p))continue;
  const geom=f.geometry||{},polys=geom.type==='Polygon'?[geom.coordinates]:geom.type==='MultiPolygon'?geom.coordinates:[];
  if(!polys.length){rejected++;continue;}
  for(let j=0;j<polys.length;j++){
   const rawRing=polys[j]?.[0];if(!Array.isArray(rawRing)||rawRing.length<4||rawRing.length>500||!rawRing.every(validCoord)){rejected++;continue;}
   let ring=rawRing.slice();if(ring.length>3&&ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1])ring.pop();
   if(ring.length<3){rejected++;continue;}
   const osmId=String(f.id??p['@id']??p.osm_id??`feature-${i}`)+`-${j}`;
   footprints.push({osmId,ring,properties:p});
   if(footprints.length>6000)throw new Error('Over 6,000 building outlines. Export a smaller neighborhood.');
  }
 }
 return {footprints,roadsGeoJSON:{type:'FeatureCollection',features:roads},rejected,featureCount:feats.length};
}
function metresToPixels(lon,lat,network){const center=network?.center;
 if(!center||!Number.isFinite(center.lat)||!Number.isFinite(center.lon))throw new Error('The road world has no geographic center. Re-import roads using GeoJSON first.');
 const k=network.metresPerPixel;if(!Number.isFinite(k)||k<.15||k>4)throw new Error('Invalid world map scale. Re-import roads.');
 const x=(lon-center.lon)*DEG*EARTH*Math.cos(center.lat*DEG),y=-(lat-center.lat)*DEG*EARTH;
 const t=network.geoTransform||{},theta=(Number(t.rotation)||0)*DEG,co=Math.cos(theta),si=Math.sin(theta);
 return [W/2+(Number(t.offsetX)||0)+(x*co-y*si)/k,H/2+(Number(t.offsetY)||0)+(x*si+y*co)/k];
}
function simplify(poly,epsilon){ // Retain corners, remove almost identical points and near-collinear runs.
 let result=[];for(const p of poly){if(!result.length||Math.hypot(p[0]-result.at(-1)[0],p[1]-result.at(-1)[1])>epsilon)result.push(p);}
 if(result.length>3&&Math.hypot(result[0][0]-result.at(-1)[0],result[0][1]-result.at(-1)[1])<epsilon)result.pop();
 for(let pass=0;pass<3&&result.length>3;pass++){
  let next=[];for(let i=0;i<result.length;i++){
   const a=result[(i+result.length-1)%result.length],b=result[i],c=result[(i+1)%result.length];
   const den=Math.hypot(c[0]-a[0],c[1]-a[1])||1;
   const distance=Math.abs((c[0]-a[0])*(a[1]-b[1])-(a[0]-b[0])*(c[1]-a[1]))/den;
   if(distance>=epsilon||result.length-next.length<=3)next.push(b);
  }if(next.length<3||next.length===result.length)break;result=next;
 }return result;
}
function area(points){let n=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];n+=a[0]*b[1]-b[0]*a[1];}return n/2;}
function segmentDistance(p,a,b){const vx=b[0]-a[0],vy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*vx+(p[1]-a[1])*vy)/(vx*vx+vy*vy||1)));return Math.hypot(p[0]-a[0]-t*vx,p[1]-a[1]-t*vy);}
function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function intersects(a,b,c,d){const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);return x*y<0&&z*w<0;}
function indexRoads(network){const cell=40,buckets=new Map(),roads=network?.roads||[],scale=network?.metresPerPixel||.65;
 for(const r of roads){const radius=Math.max(1,(Number(r.widthM)||6)/2/scale+.65/scale);
  for(let i=1;i<r.points.length;i++){
   const a=r.points[i-1],b=r.points[i];const s={a,b,radius};
   const x0=Math.floor((Math.min(a[0],b[0])-radius)/cell),x1=Math.floor((Math.max(a[0],b[0])+radius)/cell),y0=Math.floor((Math.min(a[1],b[1])-radius)/cell),y1=Math.floor((Math.max(a[1],b[1])+radius)/cell);
   if((x1-x0+1)*(y1-y0+1)>500)continue;
   for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){let key=x+','+y;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(s);}
  }
 }
 return {buckets,cell};
}
function overlapsRoad(poly,index){const lowX=Math.min(...poly.map(p=>p[0])),highX=Math.max(...poly.map(p=>p[0])),lowY=Math.min(...poly.map(p=>p[1])),highY=Math.max(...poly.map(p=>p[1]));const seen=new Set();
 for(let x=Math.floor(lowX/index.cell);x<=Math.floor(highX/index.cell);x++)for(let y=Math.floor(lowY/index.cell);y<=Math.floor(highY/index.cell);y++){
  for(const s of index.buckets.get(x+','+y)||[]){if(seen.has(s))continue;seen.add(s);
   if(poly.some(p=>segmentDistance(p,s.a,s.b)<s.radius)||inside(s.a,poly)||inside(s.b,poly))return true;
   for(let k=0;k<poly.length;k++)if(intersects(s.a,s.b,poly[k],poly[(k+1)%poly.length]))return true;
  }
 }return false;
}
function numberMetres(s){if(s==null)return null;const text=String(s).toLowerCase().trim();const m=text.match(/^(\d+(?:\.\d+)?)\s*(m|metres?|meters?|ft|feet|')?$/);if(!m)return null;const n=Number(m[1])*(m[2]==='ft'||m[2]==='feet'||m[2]==="'"?.3048:1);return Number.isFinite(n)?n:null;}
function buildingHeight(p,defaultFloors){const level=Number(p['building:levels']);const explicit=numberMetres(p.height);let floors=Number.isFinite(level)&&level>=1&&level<=60?Math.ceil(level):defaultFloors;
 if(explicit&&!(Number.isFinite(level)&&level>=1))floors=Math.max(1,Math.round(explicit/3.1));
 floors=limited(floors,1,20,defaultFloors);
 const height=limited(explicit||floors*3.1,2.3,85,floors*3.1);
 return {floors,meters:height,floorHeight:height/floors};
}
function kind(p){const val=String(p.building||'').toLowerCase();if(['commercial','retail','supermarket','shop','kiosk'].includes(val))return 'commercial';if(['office','government','civic'].includes(val))return 'office';return 'residential';}
function project(parsed,network,opts={}){if(!network?.center||!network?.metresPerPixel)throw new Error('Import roads first or choose "New roads + buildings".');
 const maxBuildings=limited(opts.maxBuildings,10,2200,1400),floorDefault=limited(opts.floors,1,15,3),avoid=opts.avoidRoads!==false,filter=avoid?indexRoads(network):null;
 let outside=0,small=0,roads=0,invalid=0,limit=0;
 const blocks=[],osmIds=new Set();
 for(const fp of parsed.footprints){
  const poly0=fp.ring.map(([lon,lat])=>metresToPixels(lon,lat,network));
  const poly=simplify(poly0,Math.min(1.1,.65/network.metresPerPixel));
  if(poly.length<3||poly.length>80){invalid++;continue;}
  const xx=poly.map(p=>p[0]),yy=poly.map(p=>p[1]),minX=Math.min(...xx),maxX=Math.max(...xx),minY=Math.min(...yy),maxY=Math.max(...yy),w=maxX-minX,d=maxY-minY;
  if(minX<0||minY<0||maxX>W||maxY>H){outside++;continue;}
  if(w*network.metresPerPixel<2||d*network.metresPerPixel<2||Math.abs(area(poly))*network.metresPerPixel**2<7){small++;continue;}
  if(avoid&&overlapsRoad(poly,filter)){roads++;continue;}
  if(osmIds.has(fp.osmId))continue;osmIds.add(fp.osmId);
  const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2,normalized=poly.map(([x,y])=>[+( (x-centerX)/w ).toFixed(6),+((y-centerY)/d).toFixed(6)]);
  const {floors,meters,floorHeight}=buildingHeight(fp.properties,floorDefault),type=kind(fp.properties);
  const color=type==='commercial'?2:type==='office'?1:Math.floor(blocks.length*7%5);
  blocks.push([+centerX.toFixed(3),+centerY.toFixed(3),+w.toFixed(3),+d.toFixed(3),+meters.toFixed(2),color,0,floors,type,+floorHeight.toFixed(3),'custom',normalized,{windows:true,roof:'tank',osmId:fp.osmId}]);
  if(blocks.length>=maxBuildings){limit=parsed.footprints.length-blocks.length;break;}
 }
 return {blocks,statistics:{total:parsed.footprints.length,created:blocks.length,outside,small,roadOverlap:roads,invalid,limit},mapScale:network.metresPerPixel};
}
return {parse,project,metresToPixels,buildingHeight,overlapsRoads:overlapsRoad};
});

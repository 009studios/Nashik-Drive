/* Nashik World Studio: an offline, browser-native perspective 3D editor.
   It views only nearby objects from the imported city; source files stay read-only. */
(()=>{'use strict';
const $=id=>document.getElementById(id), O=window.NashikWorldOverrides;
const W=1175,H=1280,TAU=Math.PI*2;
let world=null,baseName='',patch=null,roads=[],blocks=[],assets=[],grid=null,focus=[587.5,640],selection=null,selectedOverview=null;
let azimuth=.65,elevation=.68,distance=240,viewWidth=1,viewHeight=1,drawPick=[],dirty=true,drag=null,skipPick=false;
let history=[],future=[],sourceName='';
const canvas=$('scene'),ctx=canvas.getContext('2d',{alpha:false});
const map=$('overview-canvas'),mctx=map.getContext('2d');
function status(msg){$('message').textContent=msg;}
function finite(v){return Number.isFinite(v)}
function num(v,def=0){const n=Number(v);return finite(n)?n:def}
function setSave(msg){$('save-state').textContent=msg}
function download(name,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000)}
function sigKey(){const s=O.signature(world);return 'nashik-studio-3d:'+JSON.stringify(s)}
function savePatch(){if(!world)return;patch.savedAt=new Date().toISOString();try{localStorage.setItem(sigKey(),JSON.stringify(patch));setSave('Draft saved locally');}catch(e){setSave('Export your changes — browser storage unavailable');}dirty=true;drawOverviewIfVisible();}
function edit(action){if(!world)return;history.push(O.clone(patch));if(history.length>35)history.shift();future.length=0;action();savePatch();updateInspector();}
function undo(){if(!history.length)return;future.push(O.clone(patch));patch=history.pop();savePatch();updateInspector();}
function redo(){if(!future.length)return;history.push(O.clone(patch));patch=future.pop();savePatch();updateInspector();}
function blockAt(i){const b=blocks[i];return b&&O.patchBlock(b,patch.buildings[O.blockId(b,i)]);}
function roadAt(i){const r=roads[i];return r&&O.patchRoad(r,patch.roads[String(r.id)]);}
function combinedAssets(){const deleted=new Set(patch.assetsDeleted);return assets.filter(a=>!deleted.has(a.id)).concat(patch.assetsAdded.filter(a=>!deleted.has(a.id)));}
function keyCell(x,y){return x+','+y}
function makeIndex(){const scale=num(world.mapScale,.65),cell=Math.max(5,Math.ceil(240/scale));const B=new Map(),R=new Map();
 function add(map,idx,x0,y0,x1,y1){let xA=Math.floor(x0/cell),xB=Math.floor(x1/cell),yA=Math.floor(y0/cell),yB=Math.floor(y1/cell);
  if((xB-xA+1)*(yB-yA+1)>600)return;
  for(let x=xA;x<=xB;x++)for(let y=yA;y<=yB;y++){const key=keyCell(x,y);if(!map.has(key))map.set(key,[]);map.get(key).push(idx);}}
 for(let i=0;i<blocks.length;i++){const b=blocks[i],pad=Math.max(b[2],b[3]);add(B,i,b[0]-pad,b[1]-pad,b[0]+pad,b[1]+pad);}
 for(let i=0;i<roads.length;i++){const p=roads[i]?.points;if(!Array.isArray(p)||p.length<2)continue;let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const [x,y] of p){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}add(R,i,x0-1,y0-1,x1+1,y1+1);}
 return {B,R,cell};}
function query(map,u,v,r){if(!grid)return[];const cell=grid.cell,ret=new Set();for(let x=Math.floor((u-r)/cell);x<=Math.floor((u+r)/cell);x++)for(let y=Math.floor((v-r)/cell);y<=Math.floor((v+r)/cell);y++)for(const i of map.get(keyCell(x,y))||[])ret.add(i);return [...ret];}
function importWorld(data,source){
 if(!data||!Array.isArray(data.blocks)||!Array.isArray(data.assets)||!Array.isArray(data.roadNetwork?.roads)||!finite(num(data.mapScale,NaN)))throw Error('Invalid city-world.json: roads, buildings, assets and mapScale are required.');
 if(data.blocks.length>150000||data.roadNetwork.roads.length>100000)throw Error('This map exceeds the safe limits for the browser editor.');
 world=data;sourceName=source;baseName=data.cityMode?'Full Nashik City':'College Road';
 blocks=world.blocks;roads=world.roadNetwork.roads;assets=world.assets;
 patch=O.empty(world);try{const draft=localStorage.getItem(sigKey());if(draft)patch=O.validate(JSON.parse(draft),world);}catch(e){console.warn('Saved local draft was skipped:',e);}
 history=[];future=[];selection=null;grid=makeIndex();
 const s=world.mapEdits?.spawn;focus=Array.isArray(s)&&s.length>=2?[num(s[0],W/2),num(s[1],H/2)]:[W/2,H/2];
 distance=220;azimuth=.60;elevation=.67;
 $('source-status').textContent=`${source}: ${roads.length.toLocaleString('en-IN')} roads · ${blocks.length.toLocaleString('en-IN')} buildings`;
 $('city-stat').textContent=`${roads.length.toLocaleString('en-IN')} roads`;
 $('scene-heading').textContent=baseName+' · Street Editor';$('place-label').textContent='STARTING LOCATION';
 setSave('Map loaded · edits local');status('Select a building or street in 3D to edit it.');updateInspector();refreshSearch();dirty=true;
}
async function loadPublishedOverrides(){
 if(!world)return;
 // A saved local draft always wins over the last published file.
 try{
  if(localStorage.getItem(sigKey()))return;
  const r=await fetch('world-overrides.json',{cache:'no-store'});
  if(!r.ok)return;
  const fromDisk=O.validate(await r.json(),world);
  patch=fromDisk;setSave('Published edits loaded');dirty=true;
 }catch(e){console.warn('Published edits were not loaded:',e);}
}
async function start(){try{
 let response=await fetch('city-world.json',{cache:'no-store'}).catch(()=>null);
 if(response?.ok){const data=await response.json();if(data.cityMode){importWorld(data,'city-world.json');await loadPublishedOverrides();return;}}
 response=await fetch('world.json',{cache:'no-store'});if(!response.ok)throw Error('world.json not found');importWorld(await response.json(),'world.json');await loadPublishedOverrides();
 status('Full city map not included. Use Import city-world.json in the left panel to open your Nashik city.');
}catch(e){setSave('Map not loaded');$('source-status').textContent=e.message;status('Choose your existing city-world.json to begin.');}}
function inFocus(b,u,v,rPx){return Math.abs(b[0]-u)<rPx+b[2]&&Math.abs(b[1]-v)<rPx+b[3]}
function getFootprint(b){const [u,v,w,d,, ,rot=0, , , ,shape='rect',points=[]]=b;let q;
 if(shape==='custom'&&Array.isArray(points)&&points.length>2)q=points;
 else if(shape==='L')q=[[-.5,-.5],[.5,-.5],[.5,-.16],[-.1,-.16],[-.1,.5],[-.5,.5]];
 else q=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
 const rad=rot*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);
 return q.map(([a,b])=>[u+(a*w*c+b*d*s),v+(-a*w*s+b*d*c)]);
}
function mToPx(m){return m/(world?.mapScale||1)}
function to3d(u,v,height=0){const scale=world.mapScale;return [(u-focus[0])*scale,height,(v-focus[1])*scale];}
function project(X,Y,Z){const sa=Math.sin(azimuth),ca=Math.cos(azimuth),se=Math.sin(elevation),ce=Math.cos(elevation);
 const screenX=X*ca-Z*sa,screenY=-X*sa*se+Y*ce-Z*ca*se;
 const depth=distance-(X*sa*ce+Y*se+Z*ca*ce),factor=Math.min(3,Math.max(.05,((Math.min(viewWidth,viewHeight)*1.15)/Math.max(14,depth))));
 return {x:viewWidth*.5+screenX*factor,y:viewHeight*.59-screenY*factor,depth,factor};}
function projUV(u,v,h=0){return project(...to3d(u,v,h));}
function unprojectGround(px,py){
 // Perspective mouse ray / ground plane intersection for direct prop placement.
 const focal=Math.min(viewWidth,viewHeight)*1.15, nx=(px-viewWidth*.5)/focal,ny=(viewHeight*.59-py)/focal;
 const sa=Math.sin(azimuth),ca=Math.cos(azimuth),se=Math.sin(elevation),ce=Math.cos(elevation);
 const denominator=-se+ny*ce;if(Math.abs(denominator)<.06)return null;
 const B=ny*distance/denominator,A=nx*(distance-ce*B);
 const X=A*ca+B*sa,Z=-A*sa+B*ca;
 if(!finite(X)||!finite(Z)||Math.abs(X)>20000||Math.abs(Z)>20000)return null;
 return [focus[0]+X/world.mapScale,focus[1]+Z/world.mapScale];
}
function fillPoly(points,color,stroke=null,lw=1){if(!points.length)return;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}}
function distPointSeg(px,py,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((px-a.x)*dx+(py-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(px-a.x-dx*t,py-a.y-dy*t);}
function shade(kind){return ({residential:['#89998f','#bbc8b9','#8faaa2'],commercial:['#79989a','#b8c9c6','#739297'],office:['#819aa5','#bdced3','#6d8b92'],industrial:['#858f91','#a6adae','#788588'],mixed:['#9d988c','#c7c8b8','#839b94']})[kind]||['#98a499','#c0c9bf','#8da9a0'];}
function buildingFaces(b,i){const poly=getFootprint(b),h=Math.max(1,b[4]),colors=shade(b[8]),selected=selection?.type==='building'&&selection.index===i;
 const bottom=poly.map(([u,v])=>projUV(u,v,.1));const top=poly.map(([u,v])=>projUV(u,v,h));
 let groups=[];for(let j=0;j<poly.length;j++){const k=(j+1)%poly.length;const pts=[bottom[j],bottom[k],top[k],top[j]];
  groups.push({depth:pts.reduce((s,p)=>s+p.depth,0)/4,pts,color:colors[j%2?0:2],type:'building',index:i,selected,face:true,windows:b[12]?.windows!==false,floors:Math.min(12,Math.max(1,b[7]||3))});}
 groups.push({depth:top.reduce((s,p)=>s+p.depth,0)/top.length,pts:top,color:colors[1],type:'building',index:i,selected});return groups;}
function render(){requestAnimationFrame(render);if(!dirty||!world)return;dirty=false;const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
 viewWidth=Math.max(100,rect.width);viewHeight=Math.max(100,rect.height);
 if(canvas.width!==Math.round(viewWidth*dpr)||canvas.height!==Math.round(viewHeight*dpr)){canvas.width=Math.round(viewWidth*dpr);canvas.height=Math.round(viewHeight*dpr);}
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#acc0b9';ctx.fillRect(0,0,viewWidth,viewHeight);
 ctx.fillStyle='#c1cdbf';const corners=[[-550,-550],[550,-550],[550,550],[-550,550]].map(([a,b])=>project(a,0,b));fillPoly(corners,'#bdc6b7');
 // A local grid gives real-world scale without re-rendering the entire city.
 const range=Math.min(750,distance*1.6),s=world.mapScale;for(let x=-range;x<=range;x+=50){const a=project(x,.012,-range),b=project(x,.012,range);ctx.strokeStyle='#ffffff26';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
 for(let z=-range;z<=range;z+=50){const a=project(-range,.012,z),b=project(range,.012,z);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
 const pxRange=mToPx(range),nearRoads=query(grid.R,focus[0],focus[1],pxRange),nearBuildings=query(grid.B,focus[0],focus[1],pxRange);
 drawPick=[];
 // Roads: use actual imported paths, width scaled in metres.
 let roadsShown=0;
 for(const i of nearRoads){const r=roadAt(i);if(!r||!Array.isArray(r.points))continue;const selected=selection?.type==='road'&&selection.index===i;
  const width=Math.max(2,Math.min(35,num(r.widthM,6)));for(let j=0;j<r.points.length-1;j++){
   const A=r.points[j],B=r.points[j+1];if(Math.hypot(((A[0]+B[0])/2-focus[0])*s,((A[1]+B[1])/2-focus[1])*s)>range+120)continue;
   const dx=B[0]-A[0],dy=B[1]-A[1],l=Math.hypot(dx,dy);if(l<.0001)continue;
   const wx=dy/l*width/(2*s),wy=-dx/l*width/(2*s);
   const pts=[[A[0]+wx,A[1]+wy],[A[0]-wx,A[1]-wy],[B[0]-wx,B[1]-wy],[B[0]+wx,B[1]+wy]].map(p=>projUV(p[0],p[1],.035));
   fillPoly(pts,selected?'#4b9c88':'#4d575d');drawPick.push({type:'road',index:i,pts,depth:pts[0].depth});roadsShown++;
  }}
 const faces=[];let buildingsShown=0;
 for(const i of nearBuildings){const b=blockAt(i);if(!b||!inFocus(b,focus[0],focus[1],pxRange))continue;
  faces.push(...buildingFaces(b,i));buildingsShown++;}
 const localProps=combinedAssets().filter(a=>Math.hypot(a.x-focus[0],a.y-focus[1])*s<range);
 for(const a of localProps){let footprint=[[a.x-a.w/2,a.y-a.d/2],[a.x+a.w/2,a.y-a.d/2],[a.x+a.w/2,a.y+a.d/2],[a.x-a.w/2,a.y+a.d/2]],h=Math.max(.1,a.h);
  const bot=footprint.map(p=>projUV(...p,.1)),top=footprint.map(p=>projUV(...p,h));const selected=selection?.type==='asset'&&selection.id===a.id;
  for(let k=0;k<4;k++)faces.push({pts:[bot[k],bot[(k+1)%4],top[(k+1)%4],top[k]],depth:(bot[k].depth+top[k].depth)/2,color:selected?'#2ba47c':'#536f57',type:'asset',id:a.id,selected});
  faces.push({pts:top,depth:top[0].depth,color:selected?'#61edbe':'#8bb396',type:'asset',id:a.id,selected});}
 faces.sort((a,b)=>b.depth-a.depth);
 for(const f of faces){fillPoly(f.pts,f.color,f.selected?'#74ffce':'#2b414326',f.selected?2.7:.5);
  // Lightweight projected facade details for nearby imported polygon buildings.
  if(f.face&&f.windows&&f.floors&&f.pts.length===4&&f.depth>30&&f.depth<850){
   const p=f.pts, floors=Math.min(f.floors,10),cols=3;
   if(Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)>22){
    for(let row=0;row<floors;row++)for(let col=0;col<cols;col++){
      const ta=(col+.30)/cols,tb=(col+.70)/cols,ya=(row+.36)/floors,yb=(row+.72)/floors;
      const pt=(t,y)=>({x:p[0].x*(1-t)*(1-y)+p[1].x*t*(1-y)+p[2].x*t*y+p[3].x*(1-t)*y,
                         y:p[0].y*(1-t)*(1-y)+p[1].y*t*(1-y)+p[2].y*t*y+p[3].y*(1-t)*y});
      fillPoly([pt(ta,ya),pt(tb,ya),pt(tb,yb),pt(ta,yb)],'#354c55');
    }
   }
  }
  drawPick.push(f);
 }
 // Selected building height guide.
 if(selection?.type==='building'){const b=blockAt(selection.index);if(b){const at=projUV(b[0],b[1],b[4]+3);ctx.textAlign='center';ctx.font='bold 12px Arial';ctx.fillStyle='#0d3f32';ctx.fillText(`${(b[4]).toFixed(1)} m / ${b[7]||3} floors`,at.x,at.y);}}
 $('scene-count').textContent=`${nearRoads.length} nearby roads · ${buildingsShown} building blocks`;
 $('position').textContent=`MAP ${focus[0].toFixed(1)} / ${focus[1].toFixed(1)} · SCALE ${s} m/px`;
}
function hitPoly(px,py,pts){let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a.y>py)!==(b.y>py) && px<(b.x-a.x)*(py-a.y)/(b.y-a.y||.0001)+a.x)inside=!inside;}return inside;}
function pickAt(x,y){for(let i=drawPick.length-1;i>=0;i--){const f=drawPick[i];if(hitPoly(x,y,f.pts))return f;}return null;}
function displaySelection(){const o=selection; if(!o){$('selection-label').hidden=true;return;}let name='';if(o.type==='building')name='Building '+O.blockId(blocks[o.index],o.index);else if(o.type==='road')name=roads[o.index].name||roads[o.index].highway||'Road';else name=o.id;
 $('selection-label').textContent=`SELECTED · ${name}`;$('selection-label').hidden=false;}
function choose(type,index,id){selection=type?{type,index,id}:null;updateInspector();displaySelection();dirty=true;}
function inputField(label,name,value,step='1',type='number'){return `<label>${label}<input data-prop="${name}" type="${type}" step="${step}" value="${String(value??'')}"/></label>`}
function typeSelect(label,name,value,choices){return `<label>${label}<select data-prop="${name}">${choices.map(v=>`<option value="${v}" ${v===value?'selected':''}>${v}</option>`).join('')}</select></label>`}
function updateInspector(){const form=$('props');form.innerHTML='';$('duplicate').disabled=true;$('remove').disabled=true;const s=selection;if(!s){$('object-title').textContent='Select an object';$('object-description').textContent='Click a building, road or street prop in the 3D view. Drag to orbit, Shift+drag to pan.';return;}
 let content='',title='',subtitle='';const scale=world.mapScale;
 if(s.type==='building'){
  const b=blockAt(s.index);if(!b){choose(null);return;}
  title='Building';subtitle=`${O.blockId(blocks[s.index],s.index)} · imported footprint preserved`;
  content='<div class="props-row">'+inputField('Map X','x',b[0],'.01')+inputField('Map Y','y',b[1],'.01')+'</div>'+
   '<div class="props-row">'+inputField('Width (m)','widthM',(b[2]*scale).toFixed(1),'.1')+inputField('Depth (m)','depthM',(b[3]*scale).toFixed(1),'.1')+'</div>'+
   '<div class="props-row">'+inputField('Height (m)','h',b[4],'.1')+inputField('Floors','floors',b[7]||3)+'</div>'+inputField('Rotation (deg)','rot',b[6]||0,'1')+
   typeSelect('Building type','kind',b[8]||'mixed',['residential','mixed','commercial','office','industrial'])+
   `<label>Windows <input data-prop="windows" type="checkbox" ${b[12]?.windows!==false?'checked':''}/></label>`+
   typeSelect('Roof','roof',b[12]?.roof||'flat',['flat','parapet','tank'])+
   '<p class="note">Edits preserve the original footprint geometry. Height, floors and width can be changed here.</p>';
 }else if(s.type==='road'){
  const r=roadAt(s.index);if(!r){choose(null);return;}
  title=r.name||'Unnamed Road';subtitle=`${r.highway||'road'} · ${r.points?.length||0} mapped points`;
  content=inputField('Carriageway width (metres)','widthM',r.widthM||6,'.1')+'<p class="note">This changes the road surface width. Moving road centerline control points is planned for the next editor release.</p>';
 }else if(s.type==='asset'){
  const a=combinedAssets().find(x=>x.id===s.id);if(!a){choose(null);return;}
  title=a.type.replaceAll('-',' ');subtitle='New editable street prop';$('duplicate').disabled=false;
  content='<div class="props-row">'+inputField('Map X','x',a.x,'.01')+inputField('Map Y','y',a.y,'.01')+'</div>'+
    '<div class="props-row">'+inputField('Width (m)','widthM',(a.w*scale).toFixed(1),'.1')+inputField('Depth (m)','depthM',(a.d*scale).toFixed(1),'.1')+'</div>'+
    inputField('Height (m)','h',a.h,'.1')+inputField('Rotation (deg)','rot',a.rot||0);
 }
 $('object-title').textContent=title;$('object-description').textContent=subtitle;$('remove').disabled=false;form.innerHTML=content;
 form.querySelectorAll('[data-prop]').forEach(el=>el.addEventListener('change',()=>propertyChanged(s,el)));
}
function propertyChanged(s,el){const k=el.dataset.prop,v=el.type==='checkbox'?el.checked:el.tagName==='SELECT'?el.value:el.valueAsNumber;
 if(el.type==='number'&&!finite(v))return status('Enter a valid number.');
 edit(()=>{if(s.type==='building'){
   const id=O.blockId(blocks[s.index],s.index),change=patch.buildings[id]||{};
   const key=k==='widthM'?'w':k==='depthM'?'d':k;
   if(k==='windows'||k==='roof'){change.facade={...(change.facade||{}),[k]:v};}
   else change[key]=(k==='widthM'||k==='depthM')?v/world.mapScale:v;
   patch.buildings[id]=change;
  }else if(s.type==='road'){patch.roads[String(roads[s.index].id)]={...(patch.roads[String(roads[s.index].id)]||{}),[k]:v};}
  else {const a=patch.assetsAdded.find(a=>a.id===s.id);if(!a)return;const key=k==='widthM'?'w':k==='depthM'?'d':k;a[key]=(k==='widthM'||k==='depthM')?v/world.mapScale:v;}
 });status('Object updated · export when ready.');}
let unique=0;
function addProp(type){if(!world)return status('Load a city map first.');
 const scale=world.mapScale,shape=({tree:[3,3,5],lamp:[1,1,7], 'traffic-signal':[.8,.8,4], median:[8,1.5,.65],planter:[1,1,1.2],billboard:[5,1,6],sign:[1.4,.3,3],bench:[2,.7,1]})[type]||[2,2,2];
 const id='studio:'+Date.now().toString(36)+'_'+(++unique).toString(36);const prop={id,type,x:Number(focus[0].toFixed(3)),y:Number(focus[1].toFixed(3)),w:shape[0]/scale,d:shape[1]/scale,h:shape[2],rot:0};
 edit(()=>patch.assetsAdded.push(prop));choose('asset',null,id);status(`Added ${type}; edit its size and position in Properties.`);
}
function refreshSearch(){const q=$('search').value.trim().toLowerCase(),results=$('search-results');results.replaceChildren();if(!world){return;}
 if(q.length<2){const p=document.createElement('div');p.className='muted';p.textContent='Type at least 2 letters to find a mapped street.';results.append(p);return;}
 let matched=0;const seen=new Set();for(let i=0;i<roads.length&&matched<14;i++){
   const name=String(roads[i].name||'').trim();if(!name||!name.toLowerCase().includes(q))continue;
   const key=name.toLowerCase();if(seen.has(key))continue;seen.add(key);matched++;
   const button=document.createElement('button');button.textContent=name;button.onclick=()=>{const p=roads[i].points[Math.floor(roads[i].points.length/2)];goTo(p[0],p[1],name);choose('road',i);};results.append(button);
 }
 if(!matched)results.textContent='No matching named streets in this map.';
}
function goTo(u,v,label='Selected neighborhood'){focus=[u,v];distance=190;selection=null;$('place-label').textContent=label.toUpperCase().slice(0,48);updateInspector();displaySelection();dirty=true;status(`Editing ${label}. The 3D view loads nearby city objects only.`);}
function drawOverviewIfVisible(){if(!$('map-modal').hidden)drawOverview();}
function drawOverview(){if(!world)return;const r=map.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);if(map.width!==Math.round(r.width*dpr)||map.height!==Math.round(r.height*dpr)){map.width=Math.round(r.width*dpr);map.height=Math.round(r.height*dpr);}mctx.setTransform(dpr,0,0,dpr,0,0);
 const cw=r.width,ch=r.height,pad=24,zoom=Math.min((cw-pad*2)/W,(ch-pad*2)/H),ox=(cw-W*zoom)/2,oy=(ch-H*zoom)/2;
 map._view={ox,oy,zoom};mctx.fillStyle='#b8c6b8';mctx.fillRect(0,0,cw,ch);mctx.save();mctx.translate(ox,oy);mctx.scale(zoom,zoom);
 mctx.lineCap='round';mctx.lineJoin='round';mctx.strokeStyle='#58636a';
 for(const r of roads){const pts=r.points;if(!pts?.length)continue;mctx.beginPath();pts.forEach(([x,y],i)=>i?mctx.lineTo(x,y):mctx.moveTo(x,y));mctx.lineWidth=Math.min(4,Math.max(.6,num(r.widthM,6)/world.mapScale));mctx.stroke();}
 const dot=(x,y,fill,rad=7)=>{mctx.beginPath();mctx.arc(x,y,rad/zoom,0,TAU);mctx.fillStyle=fill;mctx.fill();mctx.lineWidth=2/zoom;mctx.strokeStyle='white';mctx.stroke();};
 dot(focus[0],focus[1],'#19ad7a',5);if(selectedOverview)dot(selectedOverview[0],selectedOverview[1],'#dc9655',5);
 mctx.restore();}
function pointToSegment(p,A,B){const dx=B[0]-A[0],dy=B[1]-A[1],t=Math.max(0,Math.min(1,((p[0]-A[0])*dx+(p[1]-A[1])*dy)/(dx*dx+dy*dy||1)));return [A[0]+t*dx,A[1]+t*dy];}
function nearRoadAt(u,v,limit=Infinity){let best=null,dist=limit;const all=query(grid.R,u,v,mToPx(180));for(const i of all){const points=roads[i].points||[];for(let j=1;j<points.length;j++){const p=pointToSegment([u,v],points[j-1],points[j]);const d=Math.hypot(u-p[0],v-p[1]);if(d<dist){dist=d;best={index:i,pt:p};}}}return best;}
function openOverview(){if(!world)return;$('map-modal').hidden=false;requestAnimationFrame(drawOverview)}
function closeOverview(){$('map-modal').hidden=true}
map.addEventListener('click',e=>{const r=map.getBoundingClientRect(),v=map._view;if(!v)return;let x=(e.clientX-r.left-v.ox)/v.zoom,y=(e.clientY-r.top-v.oy)/v.zoom;
 x=Math.max(0,Math.min(W,x));y=Math.max(0,Math.min(H,y));const road=nearRoadAt(x,y);selectedOverview=road?.pt||[x,y];drawOverview();});
$('overview-focus').onclick=()=>{if(!selectedOverview)return status('Choose a point on the city map.');const [x,y]=selectedOverview;goTo(x,y,'Selected map area');closeOverview();};
$('overview').onclick=openOverview;$('toggle-plan').onclick=openOverview;$('close-overview').onclick=closeOverview;
canvas.addEventListener('pointerdown',e=>{
 const r=canvas.getBoundingClientRect();
 const a=selection?.type==='asset'?patch.assetsAdded.find(p=>p.id===selection.id):null;
 const moveProp=!!(e.altKey&&a);
 drag={x:e.clientX-r.left,y:e.clientY-r.top,az:azimuth,el:elevation,focus:[...focus],moved:false,pan:e.shiftKey,
   mode:moveProp?'move-asset':'camera',id:a?.id,origin:a?[a.x,a.y]:null};
 canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{if(!drag||!world)return;const r=canvas.getBoundingClientRect(),dx=e.clientX-r.left-drag.x,dy=e.clientY-r.top-drag.y;
 if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;
 if(drag.mode==='move-asset'){
   const a=patch.assetsAdded.find(p=>p.id===drag.id),ground=unprojectGround(e.clientX-r.left,e.clientY-r.top);
   if(a&&ground){a.x=Number(ground[0].toFixed(3));a.y=Number(ground[1].toFixed(3));}
 }else if(drag.pan){const metersPerScreenPixel=distance/(Math.min(viewWidth,viewHeight)*.9);const ca=Math.cos(azimuth),sa=Math.sin(azimuth);
   focus=[drag.focus[0]+(-dx*ca-dy*sa)*metersPerScreenPixel/world.mapScale,drag.focus[1]+(dx*sa-dy*ca)*metersPerScreenPixel/world.mapScale];
 }else{azimuth=drag.az-dx*.006;elevation=Math.max(.19,Math.min(1.47,drag.el+dy*.005));}dirty=true;});
canvas.addEventListener('pointerup',e=>{if(!drag)return;
 const moved=drag.moved,movedProp=drag.mode==='move-asset',origin=drag.origin,id=drag.id;drag=null;
 if(movedProp&&moved){const a=patch.assetsAdded.find(p=>p.id===id);if(a&&origin){
   const nx=a.x,ny=a.y;a.x=origin[0];a.y=origin[1];edit(()=>{a.x=nx;a.y=ny;});status('Prop moved directly in 3D. Export edits when ready.');
 }return;}
 if(!moved){const r=canvas.getBoundingClientRect(),p=pickAt(e.clientX-r.left,e.clientY-r.top);if(p)choose(p.type,p.index,p.id);else choose(null);}});
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(40,Math.min(1450,distance*Math.exp(e.deltaY*.001)));dirty=true;},{passive:false});
$('cam-left').onclick=()=>{azimuth-=.21;dirty=true};$('cam-right').onclick=()=>{azimuth+=.21;dirty=true};$('zoom-plus').onclick=()=>{distance=Math.max(40,distance*.78);dirty=true};$('zoom-minus').onclick=()=>{distance=Math.min(1450,distance*1.28);dirty=true};$('reset-camera').onclick=()=>{azimuth=.65;elevation=.68;distance=240;dirty=true};
$('file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{setSave('Reading Nashik map…');const t=await file.text();const w=JSON.parse(t);importWorld(w,file.name);await loadPublishedOverrides();if(!w.cityMode)status('This file contains a neighborhood map, not the complete Nashik city.');else status('Full Nashik loaded. Choose a street and edit in 3D.');}catch(err){setSave('Import failed');status(err.message);}e.target.value='';};
$('search').addEventListener('input',refreshSearch);document.querySelectorAll('[data-add]').forEach(btn=>btn.onclick=()=>addProp(btn.dataset.add));
$('export').onclick=()=>{if(!world)return status('Load a map first.');patch.savedAt=new Date().toISOString();download('world-overrides.json',patch);setSave('Edit file exported');status('Put world-overrides.json beside city-world.json in your Vercel project, then redeploy.');};
$('undo').onclick=undo;$('redo').onclick=redo;
$('remove').onclick=()=>{if(!selection)return;const s=selection;if(!confirm(`Delete selected ${s.type} from the edited world? The original imported map stays safe.`))return;
 edit(()=>{if(s.type==='building'){const k=O.blockId(blocks[s.index],s.index);patch.buildings[k]={...(patch.buildings[k]||{}),deleted:true};}
 else if(s.type==='road')patch.roads[String(roads[s.index].id)]={...(patch.roads[String(roads[s.index].id)]||{}),deleted:true};
 else {patch.assetsDeleted.push(s.id);patch.assetsAdded=patch.assetsAdded.filter(a=>a.id!==s.id);}});choose(null);};
$('duplicate').onclick=()=>{if(selection?.type!=='asset')return;const src=combinedAssets().find(a=>a.id===selection.id);if(!src)return;const dup={...src,id:'studio:'+Date.now().toString(36)+'_'+(++unique).toString(36),x:src.x+2/world.mapScale,y:src.y+2/world.mapScale};edit(()=>patch.assetsAdded.push(dup));choose('asset',null,dup.id);};
$('drive').onclick=()=>{if(!world)return status('Load a world first.');try{localStorage.setItem('nashik-studio-preview-overrides',JSON.stringify(patch));}catch(e){status('Local preview cannot save; export edits instead.');return;}
 const params=new URLSearchParams({preview:'1',street:'1',sx:focus[0].toFixed(3),sy:focus[1].toFixed(3),heading:'180'});window.open('index.html?'+params,'_blank','noopener');};
addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;if((e.metaKey||e.ctrlKey)&&e.code==='KeyZ'){e.preventDefault();e.shiftKey?redo():undo();}if(e.code==='Escape')closeOverview();});
addEventListener('resize',()=>{dirty=true;drawOverviewIfVisible()});
render();start();
})();

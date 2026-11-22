/* Owner-only LOCAL editor. Not included in the production build; see README.md. */
(()=>{'use strict';
const W=1175,H=1280,S=window.NashikShapes,G=window.NashikGeoRoads,$=id=>document.getElementById(id),canvas=$('editor-map'),ctx=canvas.getContext('2d');
const storeKey='nashik-world-studio-v08'; // Preserve existing local drafts across versions
const tools={match:'PICK STREET CAMERA',select:'SELECT',building:'PLACE BUILDING',polygon:'DRAW CUSTOM FOOTPRINT',asset:'PLACE STREET PROP',road:'PAINT ROAD',cover:'COVER ROAD',spawn:'MOVE SPAWN'};
const assetTypes=['tree','palm','bush','park','pond','parking','wall','fence','billboard','bench','lamp','forecourt','canopy','dispenser','pylon','shop','bollard','bus-stop','speedbump','sign','planter','traffic-signal','median','crosswalk'];
const defaults={tree:[8,8,7],palm:[9,9,9],bush:[5,4,2],park:[28,24,.2],pond:[18,16,.2],parking:[22,14,.2],wall:[18,2,2.2],fence:[18,2,1.3],billboard:[8,2,5],bench:[4,2,1.2],lamp:[2,2,7],forecourt:[38,25,.2],canopy:[30,16,6],dispenser:[2,4,1.7],pylon:[4,3,7],shop:[8,5,3.4],bollard:[1,1,1], 'bus-stop':[9,4,3.2],speedbump:[10,2,.15],sign:[3,1,3],planter:[3,3,1.2],'traffic-signal':[1,1,5.5],median:[8,1.3,.4],crosswalk:[3.5,1.6,.1]};
const pal=['#c9bca8','#a8b2bf','#c2a699','#97b3ab','#bcbab0'];
let world={version:5,blocks:[],assets:[],roadNetwork:null,mapEdits:{version:3,spawn:[787,544,180],roadStrokes:[]}},selected=null,tool='select',toolShape='rect',assetType='tree',roadWidth=12;
let show={buildings:true,assets:true,roads:true,grid:false},image=new Image(),loaded=false;
let zoom=1,baseScale=1,ox=0,oy=0,dpr=1,drag=null,shiftDown=false,spaceDown=false,drawing=[],pointerAt=null;
let history=[],future=[],messageTimeout,streetMatchPicking=false;
function copy(x){return JSON.parse(JSON.stringify(x));}
function pack(){return JSON.stringify(world);}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function status(msg){$('message').textContent=msg;clearTimeout(messageTimeout);messageTimeout=setTimeout(()=>$('message').textContent='Changes are stored locally. Export world.json to publish.',3800);}
function saveDraft(){try{localStorage.setItem(storeKey,pack());$('save-status').textContent='● Local draft saved';}catch(e){$('save-status').textContent='Storage unavailable — export now';status('Browser storage unavailable. Export world.json to save.');}}
function commit(){if(world.roadNetwork?.roads?.length){world.roadNetwork.junctions=G.findJunctions(world.roadNetwork.roads,world.mapScale||.65);}const json=pack();if(json!==history[history.length-1]){history.push(json);if(history.length>75)history.shift();future=[];saveDraft();updateCounts();}updateHistory();}
function updateHistory(){$('undo').disabled=history.length<2;$('redo').disabled=!future.length;}
function snapshot(json){world=JSON.parse(json);selected=null;drawing=[];syncMapImage();saveDraft();updateCounts();updateInspector();render();}
function undo(){if(history.length<2)return;future.push(history.pop());snapshot(history[history.length-1]);updateHistory();}
function redo(){if(!future.length)return;let j=future.pop();history.push(j);snapshot(j);updateHistory();}
function sanitize(raw){if(!raw||typeof raw!=='object')throw new Error('Not a world data object');
 const src=Array.isArray(raw)?{blocks:raw,assets:[],mapEdits:{}}:raw;
 if(!Array.isArray(src.blocks)||!Array.isArray(src.assets))throw new Error('Expected blocks and assets arrays');
 if(src.blocks.length>30000||src.assets.length>30000)throw new Error('File is too large for this editor');
 const mapImage=src.mapImage;if(mapImage!=null&&(typeof mapImage!=='string'||mapImage.length>4500000||!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(mapImage)))throw new Error('Map image must be a supported embedded PNG/JPEG/WebP below 4.5 MB');
 const net=src.roadNetwork;let roadNetwork=null;if(net&&typeof net==='object'&&Array.isArray(net.roads)){if(net.roads.length>6000)throw new Error('Too many vector roads');let npts=0;const roads=net.roads.map((r,i)=>{if(!Array.isArray(r.points)||r.points.length<2)throw new Error('Invalid road path');npts+=r.points.length;if(npts>130000)throw new Error('Too many road points');return {id:String(r.id||i),name:String(r.name||'').slice(0,110),highway:String(r.highway||'residential'),widthM:Math.min(35,Math.max(2,Number(r.widthM)||6)),oneway:!!r.oneway,grade:String(r.grade||'0'),points:r.points.map(q=>{if(!Array.isArray(q)||!Number.isFinite(q[0])||!Number.isFinite(q[1]))throw new Error('Invalid road coordinate');return [+q[0],+q[1]];})};});roadNetwork={version:1,source:String(net.source||'GeoJSON'),coordinateSystem:'game-pixels',metresPerPixel:(Number.isFinite(net.metresPerPixel)&&net.metresPerPixel>=.15&&net.metresPerPixel<=4)?net.metresPerPixel:.65,center:net.center||null,geoTransform:{rotation:Number(net.geoTransform?.rotation)||0,offsetX:Number(net.geoTransform?.offsetX)||0,offsetY:Number(net.geoTransform?.offsetY)||0},roads,junctions:Array.isArray(net.junctions)?net.junctions.slice(0,10000):[]};}
 return {version:5,roadNetwork,blocks:src.blocks.map(b=>{if(!Array.isArray(b)||b.length<6)throw new Error('Invalid building');return b;}),assets:src.assets.map(a=>{if(!a||typeof a!=='object')throw new Error('Invalid prop');return a;}),mapEdits:{version:3,spawn:Array.isArray(src.mapEdits?.spawn)?src.mapEdits.spawn:[787,544,180],roadStrokes:Array.isArray(src.mapEdits?.roadStrokes)?src.mapEdits.roadStrokes:[]},...(mapImage?{mapImage}:{}),mapScale:(Number.isFinite(src.mapScale)&&src.mapScale>=.15&&src.mapScale<=4)?src.mapScale:.65};
}
function syncMapImage(){let src=world.mapImage||'map_preview.png';if(image.src!==new URL(src,location.href).href){image.src=src;}}
async function load(){let data;const draft=localStorage.getItem(storeKey);
 if(draft){try{data=sanitize(JSON.parse(draft));status('Restored your previous local draft.');}catch(e){console.warn('Invalid draft',e);}}
 if(!data){const r=await fetch('world.json',{cache:'no-store'});if(r.ok)data=sanitize(await r.json());else{
 const rs=await Promise.all(['blocks.json','assets.json','map_edits.json'].map(f=>fetch(f).then(r=>r.json())));data=sanitize({blocks:rs[0],assets:rs[1],mapEdits:rs[2]});}}
 world=data;syncMapImage();history=[pack()];future=[];updateCounts();updateHistory();updateInspector();saveDraft();loaded=true;fit();}
function current(){if(!selected)return null;return selected.type==='building'?world.blocks[selected.index]:selected.type==='road'?world.roadNetwork?.roads[selected.index]:world.assets[selected.index];}
function updateCounts(){$('building-count').textContent=world.blocks.length;$('asset-count').textContent=world.assets.length;if($('road-count'))$('road-count').textContent=world.roadNetwork?.roads?.length||0;if(world.roadNetwork?.roads?.length){document.querySelector('.map-brief h1').textContent='Real road network';document.querySelector('.map-brief p').textContent='OSM road centerlines · estimated widths · editable in metres';}else{document.querySelector('.map-brief h1').textContent='College Road world';document.querySelector('.map-brief p').textContent='Map-aligned working reference — not survey-accurate GPS data';}}
function setTool(t){tool=t;drawing=[];drag=null;document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));$('active-tool-name').textContent=tools[t];$('draw-hint').classList.toggle('hidden',t!=='polygon');canvas.style.cursor=t==='select'?'default':t==='polygon'?'crosshair':'cell';updateInspector();render();}
function scale(){return baseScale*zoom;}
function mapToScreen(x,y){let s=scale();return [ox+x*s,oy+y*s];}
function screenToMap(x,y){let s=scale();return [(x-ox)/s,(y-oy)/s];}
function eventPoint(e){const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];}
function safeNumber(n,d=0){n=Number(n);return Number.isFinite(n)?n:d;}
function keepMap(){const s=scale();const maxX=canvas.clientWidth*.7,maxY=canvas.clientHeight*.7;ox=Math.min(maxX,Math.max(canvas.clientWidth-W*s-maxX,ox));oy=Math.min(maxY,Math.max(canvas.clientHeight-H*s-maxY,oy));}
function fit(){baseScale=Math.min((canvas.clientWidth-36)/W,(canvas.clientHeight-36)/H);if(!Number.isFinite(baseScale)||baseScale<=0)baseScale=.4;zoom=1;ox=(canvas.clientWidth-W*baseScale)/2;oy=(canvas.clientHeight-H*baseScale)/2;render();}
function focusCity(){
 const coords=[];
 for(const r of world.roadNetwork?.roads||[])for(const p of r.points||[]){if(Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]))coords.push(p);}
 for(const b of world.blocks){if(Array.isArray(b)&&b.length>=4)coords.push([b[0]-b[2]/2,b[1]-b[3]/2],[b[0]+b[2]/2,b[1]+b[3]/2]);}
 if(coords.length<2){fit();return;}
 const xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const pad=35,spanX=Math.max(20,maxX-minX),spanY=Math.max(20,maxY-minY);
 const desired=Math.min((canvas.clientWidth-2*pad)/spanX,(canvas.clientHeight-2*pad)/spanY);
 baseScale=Math.min((canvas.clientWidth-36)/W,(canvas.clientHeight-36)/H);if(baseScale<=0)baseScale=.4;
 zoom=Math.max(.35,Math.min(9,desired/baseScale));
 ox=canvas.clientWidth/2-(minX+maxX)/2*scale();oy=canvas.clientHeight/2-(minY+maxY)/2*scale();
 render();
}
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));if(!baseScale)fit();else render();}
function zoomAt(factor,sx=canvas.clientWidth/2,sy=canvas.clientHeight/2){let [x,y]=screenToMap(sx,sy);zoom=Math.max(.35,Math.min(9,zoom*factor));ox=sx-x*scale();oy=sy-y*scale();keepMap();render();}
function path(points){if(!points||!points.length)return;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();}
function drawRoundMark(x,y,size=4,c='#8bf7c5'){ctx.beginPath();ctx.arc(x,y,size/scale(),0,Math.PI*2);ctx.fillStyle=c;ctx.fill();}
function drawRoads(){if(!show.roads)return;if(world.roadNetwork?.roads?.length)G.draw(ctx,world.roadNetwork,{metresPerPixel:world.mapScale});
 if(selected?.type==='road'){const road=current();if(road?.points?.length){ctx.beginPath();road.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.lineWidth=Math.max(2,road.widthM/(world.mapScale||.65)+3/scale());ctx.strokeStyle='#9ef6be';ctx.stroke();}}
for(let i=0;i<world.mapEdits.roadStrokes.length;i++){let stroke=world.mapEdits.roadStrokes[i];if(!stroke.points?.length)continue;ctx.beginPath();stroke.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(stroke.points.length===1)ctx.lineTo(stroke.points[0][0]+.01,stroke.points[0][1]+.01);ctx.strokeStyle=stroke.mode==='cover'?'#aaab99':'#2b333b';ctx.lineWidth=Math.max(2,stroke.width||12);ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}}
function drawGrid(){if(!show.grid)return;ctx.strokeStyle='#ffffff24';ctx.lineWidth=1/scale();ctx.beginPath();for(let x=0;x<=W;x+=50){ctx.moveTo(x,0);ctx.lineTo(x,H)}for(let y=0;y<=H;y+=50){ctx.moveTo(0,y);ctx.lineTo(W,y)}ctx.stroke();}
function render(){if(!canvas.width||!canvas.height)return;
 const s=scale();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight);ctx.fillStyle='#17252a';ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);
 ctx.setTransform(dpr*s,0,0,dpr*s,dpr*ox,dpr*oy);if(image.complete&&image.naturalWidth)ctx.drawImage(image,0,0,W,H);
 drawRoads();drawGrid();
 if(show.buildings)world.blocks.forEach((b,i)=>{let pts=S.worldPoints(b);path(pts);let active=selected?.type==='building'&&selected.index===i;ctx.fillStyle=active?'#8cf2c766':`${pal[Math.abs(b[5]||0)%5]}6e`;ctx.fill();ctx.lineWidth=(active?2.5:1.2)/s;ctx.strokeStyle=active?'#9effd2':'#28444dd5';ctx.stroke();if(active){pts.forEach(([x,y])=>drawRoundMark(x,y,4));let [bx,by]=[b[0],b[1]];drawRoundMark(bx,by,3,'#ffffff');}});
 if(show.assets)world.assets.forEach((a,i)=>{let x=safeNumber(a.x),y=safeNumber(a.y),w=Math.max(1,safeNumber(a.w,8)),d=Math.max(1,safeNumber(a.d,8));const p=S.worldPoints({x,y,w,d,rot:a.rot||0,shape:a.shape||'rect'});path(p);let active=selected?.type==='asset'&&selected.index===i;ctx.fillStyle=active?'#ffcb7c99':'#8fd1ff76';ctx.fill();ctx.lineWidth=(active?2.4:1.3)/s;ctx.strokeStyle=active?'#ffdb9f':'#3289b0';ctx.stroke();if(active)p.forEach(([x,y])=>drawRoundMark(x,y,3,'#ffdf9f'));});
 const spawn=world.mapEdits.spawn||[787,544,180];ctx.beginPath();ctx.arc(spawn[0],spawn[1],7/s,0,Math.PI*2);ctx.fillStyle='#60ffad';ctx.fill();ctx.lineWidth=2/s;ctx.strokeStyle='#ffffff';ctx.stroke();ctx.beginPath();ctx.moveTo(spawn[0],spawn[1]);let a=spawn[2]*Math.PI/180;ctx.lineTo(spawn[0]+Math.sin(a)*19/s,spawn[1]+Math.cos(a)*19/s);ctx.stroke();
 if(drawing.length){ctx.strokeStyle='#b4ffc4';ctx.lineWidth=2/s;ctx.setLineDash([6/s,4/s]);ctx.beginPath();drawing.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(pointerAt)ctx.lineTo(pointerAt[0],pointerAt[1]);ctx.stroke();ctx.setLineDash([]);drawing.forEach(([x,y])=>drawRoundMark(x,y,4,'#a9f6c9'));}
 ctx.setTransform(dpr,0,0,dpr,0,0);$('zoom-text').textContent=Math.round(zoom*100)+'%';}
function hit(x,y){if(show.assets){for(let i=world.assets.length-1;i>=0;i--){const a=world.assets[i];if(S.pointInside(x,y,S.worldPoints({x:a.x,y:a.y,w:Math.max(1,a.w),d:Math.max(1,a.d),rot:a.rot||0,shape:a.shape||'rect'})))return {type:'asset',index:i};}}
 if(show.buildings){for(let i=world.blocks.length-1;i>=0;i--){if(S.pointInside(x,y,S.worldPoints(world.blocks[i])))return {type:'building',index:i};}}
 if(show.roads&&world.roadNetwork){const found=G.nearestRoad(x,y,world.roadNetwork,24/scale());if(found&&found.distance<=found.road.widthM/(2*(world.mapScale||.65))+6/scale())return {type:'road',index:found.index};}return null;}
function vertexNear(x,y){if(selected?.type!=='building')return -1;let b=current();if(b[10]!=='custom')return -1;const pts=S.worldPoints(b);let threshold=11/scale();return pts.findIndex(p=>Math.hypot(p[0]-x,p[1]-y)<threshold);}
function updateInspector(){const title=$('inspector-title'),sub=$('inspector-subtitle'),host=$('inspector-content');const b=current();$('duplicate').disabled=!selected;$('delete').disabled=!selected;
 if(!b){if(tool==='match'){title.textContent='Street Match camera';sub.textContent='Click once on the map to choose the viewpoint.';host.innerHTML='<p class="muted-note">This only sets the comparison camera. It does not move your published spawn or modify roads.</p>';return;}if(tool==='building'){title.textContent='Place building';sub.textContent='Click the map to place a building.';host.innerHTML=`<div class="section-heading">NEW BUILDING</div><label class="field"><span>Footprint shape</span><select id="new-shape">${shapeOptions(toolShape)}</select></label><p class="muted-note">Place a building by clicking an empty space. Drag it into position, then adjust floors, footprint and facade here.</p>`;$('new-shape').onchange=e=>toolShape=e.target.value;return;}
 if(tool==='asset'){title.textContent='Place props';sub.textContent='Click the map to place this prop.';host.innerHTML=`<label class="field"><span>Prop type</span><select id="new-asset">${assetOptions(assetType)}</select></label><p class="muted-note">Use props for trees, fences, street lights, shop signs, parking, and road details.</p>`;$('new-asset').onchange=e=>assetType=e.target.value;return;}
 if(tool==='road'||tool==='cover'){title.textContent=tool==='road'?'Paint road':'Cover existing road';sub.textContent='Drag on the map to create a brush stroke.';host.innerHTML=`<label class="field"><span>Brush width (map pixels)</span><input id="brush" type="range" min="2" max="45" step="1" value="${roadWidth}"><small id="brush-value">${roadWidth} px</small></label><button class="action" id="clear-roads">Clear ALL manual road strokes</button><p class="muted-note">Road marks are non-destructive overlays on the source terrain. Use Cover to hide an incorrect road stroke.</p>`;$('brush').oninput=e=>{roadWidth=+e.target.value;$('brush-value').textContent=roadWidth+' px'};$('clear-roads').onclick=()=>{if(confirm('Remove all manual road edits? You can undo this.')){world.mapEdits.roadStrokes=[];commit();render();}};return;}
 if(tool==='spawn'){title.textContent='Vehicle spawn';sub.textContent='Click map to set the car starting point.';host.innerHTML=`<label class="field"><span>Spawn heading (degrees)</span><input id="spawn-angle" type="number" step="5" value="${world.mapEdits.spawn[2]||0}"></label><div class="muted-note">Green marker shows where players start. Heading controls which way the vehicle faces.</div>`;$('spawn-angle').onchange=e=>{world.mapEdits.spawn[2]=safeNumber(e.target.value);commit();render();};return;}
 title.textContent=tool==='polygon'?'Draw footprint':'Nothing selected';sub.textContent=tool==='polygon'?'Click vertices, then press Enter to create a custom building.':'Select an object or use a placement tool.';host.innerHTML='<div class="welcome"><div class="welcome-icon">▥</div><h3>Build your city</h3><p>Everything is saved locally until you export and publish your world data.</p></div>';return;}
 if(selected.type==='road'){
   title.textContent='Road #'+(selected.index+1);sub.textContent='Road from geographical data · geometry stays editable';
   host.innerHTML=`<div class="section-heading">ROAD GEOMETRY</div><label class="field"><span>Street name</span><input type="text" id="road-name" maxlength="110" value="${escapeHtml(b.name)}"></label><label class="field"><span>Road class</span><select id="road-kind">${['motorway','trunk','primary','secondary','tertiary','unclassified','residential','service','living_street','pedestrian'].map(t=>`<option value="${t}" ${b.highway===t?'selected':''}>${t.replace('_',' ')}</option>`).join('')}</select></label><label class="field"><span>Actual road width (metres)</span><input type="number" id="road-width-metres" min="2" max="35" step="0.5" value="${b.widthM}"></label><label class="field"><span>Traffic direction</span><select id="road-oneway"><option value="two" ${!b.oneway?'selected':''}>Two-way</option><option value="one" ${b.oneway?'selected':''}>One-way</option></select></label><p class="muted-note">${b.points.length} mapped points. Drag to shift this road in the editor. Road widths are estimates, not surveyed road edges. Road source: ${escapeHtml(world.roadNetwork?.source||'GeoJSON')}.</p>`;
   $('road-name').onchange=e=>{b.name=e.target.value.trim().slice(0,110);commit();updateInspector();};
   $('road-width-metres').oninput=e=>{b.widthM=Math.min(35,Math.max(2,Number(e.target.value)||6));render();};$('road-width-metres').onchange=()=>commit();
   $('road-kind').onchange=e=>{b.highway=e.target.value;commit();};$('road-oneway').onchange=e=>{b.oneway=e.target.value==='one';commit();};return;
 }
 const isB=selected.type==='building';title.textContent=isB?`Building #${selected.index+1}`:`${b.type||'Prop'} #${selected.index+1}`;sub.textContent=isB?'Adjust footprint, floor count, facade and rooftop':'Adjust prop location, dimensions and appearance';
 if(isB){const facade=b[12]&&typeof b[12]==='object'?b[12]:{};host.innerHTML=`<div class="section-heading">BUILDING GEOMETRY</div><div class="form-grid">${num('X',0,b[0],.5)}${num('Y',1,b[1],.5)}${num('Width',2,b[2],.5,2)}${num('Depth',3,b[3],.5,2)}${num('Floors',7,b[7]||Math.round(b[4]/3.2),1,1)}${num('Floor height (m)',9,b[9]||3.2,.1,2)}${num('Angle (°)',6,b[6]||0,5)}${num('Total height (m)',4,b[4],.1,1)}</div>
 <label class="field"><span>Footprint shape</span><select data-index="10">${shapeOptions(b[10]||'rect')}</select></label>
 <div class="section-heading">APPEARANCE</div><label class="field"><span>Building category</span><select data-index="8">${['residential','commercial','office','heritage','industrial'].map(v=>`<option ${v===(b[8]||'residential')?'selected':''} value="${v}">${v[0].toUpperCase()+v.slice(1)}</option>`).join('')}</select></label><label class="field"><span>Material palette</span><select data-index="5">${['Sandstone','Cool grey','Brick','Sage','Concrete'].map((t,i)=>`<option ${i===(b[5]||0)?'selected':''} value="${i}">${t}</option>`).join('')}</select></label>
 <label class="field"><span>Facade windows</span><select data-facade="windows"><option value="yes" ${facade.windows===false?'':'selected'}>Visible</option><option value="no" ${facade.windows===false?'selected':''}>Hidden</option></select></label>
 <label class="field"><span>Balconies</span><select data-facade="balconies"><option value="no" ${facade.balconies?'':'selected'}>None</option><option value="yes" ${facade.balconies?'selected':''}>Add balconies</option></select></label>
 <label class="field"><span>Roof details</span><select data-facade="roof">${['tank','flat','parapet'].map(v=>`<option value="${v}" ${(facade.roof||'tank')===v?'selected':''}>${v[0].toUpperCase()+v.slice(1)}</option>`).join('')}</select></label>
 <div class="inline-buttons"><button id="scale-tall">+ 1 floor</button><button id="scale-short">− 1 floor</button><button id="edit-polygon">Draw replacement outline</button></div><p class="muted-note">Widths and depths are in map pixels (1 px = ${world.mapScale.toFixed(3)} m in the game). Floor heights are in metres. Custom polygons can be reshaped by dragging their corners.</p>`;
 }else{host.innerHTML=`<div class="section-heading">STREET PROP</div><label class="field"><span>Prop type</span><select data-field="type">${assetOptions(b.type)}</select></label><div class="form-grid">${['x','y','w','d','h','rot'].map((p,i)=>`<label class="field"><span>${['X','Y','Width','Depth','Height (m)','Angle (°)'][i]}</span><input type="number" data-field="${p}" value="${Number(b[p]||0).toFixed(2)}" step="${i===5?'5':'.5'}"></label>`).join('')}</div><label class="field"><span>Color palette</span><select data-field="color">${[0,1,2,3,4].map(i=>`<option value="${i}" ${i===(b.color||0)?'selected':''}>Palette ${i+1}</option>`).join('')}</select></label><p class="muted-note">Props are rendered by the game as lightweight geometry. Rotate and resize to match the streets.</p>`;}
 host.querySelectorAll('[data-index]').forEach(el=>{el.addEventListener('input',()=>{let i=+el.dataset.index,value=i===8||i===10?el.value:Number(el.value);b[i]=value;if(i===7||i===9){b[7]=Math.max(1,Math.round(Number(b[7])||1));b[9]=Math.max(1.8,Number(b[9])||3.1);b[4]=+(b[7]*b[9]).toFixed(2);}if(i===4){b[4]=Math.max(2,Number(b[4]));}render();});el.addEventListener('change',()=>{commit();updateInspector();});});
 host.querySelectorAll('[data-facade]').forEach(el=>{el.onchange=()=>{if(!b[12]||typeof b[12]!=='object')b[12]={};b[12][el.dataset.facade]=el.dataset.facade==='roof'?el.value:el.value==='yes';commit();render();};});
 host.querySelectorAll('[data-field]').forEach(el=>{el.oninput=()=>{b[el.dataset.field]=el.dataset.field==='type'?el.value:safeNumber(el.value);render();};el.onchange=()=>{if(el.dataset.field==='type'){let [w,d,h]=defaults[b.type]||[6,5,3];b.w=w;b.d=d;b.h=h;}commit();updateInspector();};});
 if(isB){$('scale-tall').onclick=()=>changeFloors(1);$('scale-short').onclick=()=>changeFloors(-1);$('edit-polygon').onclick=()=>{setTool('polygon');status('Draw a new footprint; press Enter to replace selected building outline.');};}}
function num(label,index,value,step,min){return `<label class="field"><span>${label}</span><input type="number" data-index="${index}" value="${Number(value||0).toFixed(index===7?0:2)}" step="${step}" ${min===undefined?'':`min="${min}"`}></label>`;}
function shapeOptions(value){return ['rect','square','l','u','t','hex','triangle','oval','circle','custom'].map(s=>`<option value="${s}" ${s===value?'selected':''}>${({rect:'Rectangle',square:'Square',l:'L-shaped',u:'U-shaped',t:'T-shaped',hex:'Hexagon',triangle:'Triangle',oval:'Oval',circle:'Circle',custom:'Custom polygon'})[s]}</option>`).join('');}
function assetOptions(value){return assetTypes.map(t=>`<option value="${t}" ${t===value?'selected':''}>${t[0].toUpperCase()+t.slice(1).replaceAll('-',' ')}</option>`).join('');}
function changeFloors(delta){let b=current();if(!b||selected.type!=='building')return;b[7]=Math.max(1,Math.round(b[7]+delta));b[4]=+(b[7]*(b[9]||3.2)).toFixed(2);commit();updateInspector();render();}
function createBuilding(x,y,shape=toolShape){let floors=3,floorHeight=3.2;let b=[+x.toFixed(2),+y.toFixed(2),20,17,floors*floorHeight,0,0,floors,'residential',floorHeight,shape==='custom'?'rect':shape,[],{windows:true,balconies:false,roof:'tank'}];world.blocks.push(b);selected={type:'building',index:world.blocks.length-1};commit();setTool('select');updateInspector();render();}
function createAsset(x,y){let [w,d,h]=defaults[assetType]||[5,5,3];world.assets.push({id:`prop-${Date.now()}-${world.assets.length}`,type:assetType,x:+x.toFixed(2),y:+y.toFixed(2),w,d,h,rot:0,color:0,shape:'rect'});selected={type:'asset',index:world.assets.length-1};commit();setTool('select');updateInspector();render();}
function finishPolygon(){if(drawing.length<3){status('Add at least three corners.');return;}const xs=drawing.map(v=>v[0]),ys=drawing.map(v=>v[1]);let minx=Math.min(...xs),miny=Math.min(...ys),maxx=Math.max(...xs),maxy=Math.max(...ys),w=maxx-minx,d=maxy-miny;if(w<3||d<3){status('Footprint is too small.');return;}const x=(maxx+minx)/2,y=(maxy+miny)/2;const points=drawing.map(([px,py])=>[+((px-x)/w).toFixed(5),+((py-y)/d).toFixed(5)]);
 if(S.triangleIndices(points).length!==(points.length-2)*3){status('Polygon overlaps itself or cannot be triangulated. Draw a simple outline.');return;}
 let b;if(selected?.type==='building'){b=current();b[0]=x;b[1]=y;b[2]=w;b[3]=d;b[10]='custom';b[11]=points;}else{b=[x,y,w,d,9.6,0,0,3,'residential',3.2,'custom',points,{windows:true,roof:'flat'}];world.blocks.push(b);selected={type:'building',index:world.blocks.length-1};}
 drawing=[];pointerAt=null;commit();setTool('select');updateInspector();render();}
function objectCenter(sel){const o=current();return sel.type==='building'?[o[0],o[1]]:sel.type==='road'?[o.points[0][0],o.points[0][1]]:[o.x,o.y];}
function pointerDown(e){if(!loaded)return;const [sx,sy]=eventPoint(e),[x,y]=screenToMap(sx,sy);pointerAt=[x,y];if(e.button===1||spaceDown){drag={kind:'pan',sx,sy,ox,oy};canvas.setPointerCapture(e.pointerId);e.preventDefault();return;}if(e.button!==0)return;
 if(streetMatchPicking){streetMatchPicking=false;setTool('select');
   window.dispatchEvent(new CustomEvent('street-match:picked',{detail:{x:+x.toFixed(2),y:+y.toFixed(2)}}));return;}
 if(tool==='polygon'){if(x>=0&&x<=W&&y>=0&&y<=H){drawing.push([+x.toFixed(2),+y.toFixed(2)]);render();}return;}
 if(tool==='building'){createBuilding(x,y);return;}if(tool==='asset'){createAsset(x,y);return;}if(tool==='spawn'){world.mapEdits.spawn[0]=+x.toFixed(2);world.mapEdits.spawn[1]=+y.toFixed(2);commit();render();return;}
 if(tool==='road'||tool==='cover'){let st={mode:tool==='road'?'road':'cover',width:roadWidth,points:[[+x.toFixed(2),+y.toFixed(2)]]};world.mapEdits.roadStrokes.push(st);drag={kind:'road',stroke:st};canvas.setPointerCapture(e.pointerId);render();return;}
 let hitVertex=vertexNear(x,y);if(hitVertex>=0){drag={kind:'vertex',at:hitVertex};canvas.setPointerCapture(e.pointerId);return;}
 let choice=hit(x,y);if(choice){selected=choice;let [cx,cy]=objectCenter(choice);drag={kind:'move',dx:x-cx,dy:y-cy};canvas.setPointerCapture(e.pointerId);}else{selected=null;drag=null;}updateInspector();render();}
function pointerMove(e){if(!loaded)return;const [sx,sy]=eventPoint(e),[x,y]=screenToMap(sx,sy);pointerAt=[x,y];$('cursor-position').textContent=`X ${Math.round(x)} / Y ${Math.round(y)}`;
 if(!drag){if(tool==='polygon')render();return;}
 if(drag.kind==='pan'){ox=drag.ox+(sx-drag.sx);oy=drag.oy+(sy-drag.sy);keepMap();}
 if(drag.kind==='road'){let st=drag.stroke,p=st.points[st.points.length-1];if(Math.hypot(x-p[0],y-p[1])>Math.max(1,roadWidth*.18))st.points.push([+x.toFixed(2),+y.toFixed(2)]);}
 if(drag.kind==='move'&&selected){let o=current(),nx=Math.max(0,Math.min(W,x-drag.dx)),ny=Math.max(0,Math.min(H,y-drag.dy));if(selected.type==='building'){o[0]=+nx.toFixed(2);o[1]=+ny.toFixed(2);}else if(selected.type==='road'){const dx=nx-o.points[0][0],dy=ny-o.points[0][1];o.points=o.points.map(([px,py])=>[+(px+dx).toFixed(2),+(py+dy).toFixed(2)]);}else{o.x=+nx.toFixed(2);o.y=+ny.toFixed(2);}}
 if(drag.kind==='vertex'&&selected?.type==='building'){let b=current(),angle=(b[6]||0)*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle),dx=x-b[0],dy=y-b[1];let lx=co*dx-si*dy,ly=si*dx+co*dy;b[11][drag.at]=[+(lx/b[2]).toFixed(5),+(ly/b[3]).toFixed(5)];}
 render();}
function pointerUp(e){if(!drag)return;const kind=drag.kind;drag=null;if(kind!=='pan'){commit();updateInspector();}try{canvas.releasePointerCapture(e.pointerId);}catch(e){}render();}
function deleteSelected(){if(!selected)return;if(selected.type==='building')world.blocks.splice(selected.index,1);else if(selected.type==='road')world.roadNetwork.roads.splice(selected.index,1);else world.assets.splice(selected.index,1);selected=null;commit();updateInspector();render();}
function duplicateSelected(){if(!selected)return;const item=copy(current());if(selected.type==='building'){item[0]+=12;item[1]+=12;world.blocks.push(item);selected.index=world.blocks.length-1;}else if(selected.type==='road'){item.id+='-copy-'+Date.now();item.points=item.points.map(([x,y])=>[x+12,y+12]);world.roadNetwork.roads.push(item);selected.index=world.roadNetwork.roads.length-1;}else{item.x+=12;item.y+=12;item.id='prop-'+Date.now();world.assets.push(item);selected.index=world.assets.length-1;}commit();updateInspector();render();}
function exportJSON(){world.mapEdits.updatedAt=new Date().toISOString();const blob=new Blob([JSON.stringify(world,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='world.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);commit();status('Exported world.json — replace your repository file with this to publish.');}
function preview(){saveDraft();window.open('index.html?preview=1','_blank','noopener');}
function importJSON(file){file.text().then(t=>{let data=sanitize(JSON.parse(t));if(!confirm('Replace the current map with this imported world? Your previous work can still be undone.'))return;world=data;selected=null;drawing=[];syncMapImage();commit();updateInspector();render();status('Imported '+file.name+' successfully.');}).catch(e=>status('Import failed: '+e.message));}
canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);
canvas.addEventListener('dblclick',e=>{if(tool==='polygon'){finishPolygon();return;}const [sx,sy]=eventPoint(e),[x,y]=screenToMap(sx,sy);selected=hit(x,y);setTool('select');updateInspector();});
canvas.addEventListener('wheel',e=>{e.preventDefault();const [sx,sy]=eventPoint(e);zoomAt(e.deltaY<0?1.16:1/1.16,sx,sy);},{passive:false});
window.addEventListener('keydown',e=>{if(e.target.closest('input, select, textarea'))return;let cmd=e.metaKey||e.ctrlKey;if(cmd&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();return;}if(cmd&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}if(e.code==='Space'){e.preventDefault();spaceDown=true;return;}if(e.key==='Enter'&&tool==='polygon'){e.preventDefault();finishPolygon();return;}if(e.key==='Escape'){drawing=[];drag=null;setTool('select');return;}if((e.key==='Delete'||e.key==='Backspace')&&selected){e.preventDefault();deleteSelected();return;}if(cmd&&e.key.toLowerCase()==='s'){e.preventDefault();exportJSON();return;}
 const shortcuts={v:'select',b:'building',p:'polygon',a:'asset',r:'road',c:'cover',s:'spawn'};if(shortcuts[e.key.toLowerCase()])setTool(shortcuts[e.key.toLowerCase()]);});
window.addEventListener('keyup',e=>{if(e.code==='Space')spaceDown=false;});window.addEventListener('blur',()=>spaceDown=false);
$('zoom-in').onclick=()=>zoomAt(1.25);$('zoom-out').onclick=()=>zoomAt(1/1.25);$('fit').onclick=fit;$('focus-city').onclick=focusCity;
$('undo').onclick=undo;$('redo').onclick=redo;$('duplicate').onclick=duplicateSelected;$('delete').onclick=deleteSelected;$('preview').onclick=preview;$('export').onclick=exportJSON;
$('load-bundled').onclick=async()=>{
 if(!confirm('Load the included v1.4 world? Your current local edits will be downloaded as a backup first.'))return;
 const blob=new Blob([JSON.stringify(world,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='world-backup-before-reload.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
 try{const r=await fetch('world.json',{cache:'no-store'});if(!r.ok)throw new Error('Included world.json missing');
  const data=sanitize(await r.json());world=data;selected=null;drawing=[];syncMapImage();commit();updateCounts();updateInspector();focusCity();status('Loaded included v1.4 world. A backup of your prior draft was downloaded.');}
 catch(e){status('Could not load included map: '+e.message);}
};
$('import').onclick=()=>$('import-input').click();$('import-input').onchange=e=>{if(e.target.files?.[0])importJSON(e.target.files[0]);e.target.value='';};
document.querySelectorAll('[data-tool]').forEach(el=>el.onclick=()=>setTool(el.dataset.tool));
for(const [id,key] of [['toggle-buildings','buildings'],['toggle-assets','assets'],['toggle-roads','roads'],['toggle-grid','grid']]){$(id).onclick=()=>{show[key]=!show[key];$(id).classList.toggle('active',show[key]);render();};}
// Auto City uses the exact map coordinate frame of the already-imported road network.
window.addEventListener('street-match:request-position',()=>{
 window.dispatchEvent(new CustomEvent('street-match:position',{detail:{spawn:[...world.mapEdits.spawn],scale:world.mapScale||.65}}));
});
window.addEventListener('street-match:pick-start',()=>{
 streetMatchPicking=true;setTool('match');status('Click your camera position on the map. No world geometry will change.');
});
window.addEventListener('geo-city:request-world',()=>{
  window.dispatchEvent(new CustomEvent('geo-city:world',{detail:{roadNetwork:world.roadNetwork?copy(world.roadNetwork):null,spawn:copy(world.mapEdits.spawn)}}));
});
window.addEventListener('geo-city:apply',e=>{
 const {blocks,network,mode,replaceBuildings}=e.detail||{};
 if(!Array.isArray(blocks)||blocks.length<1||blocks.length>2200||!network?.roads?.length){status('Auto City import rejected: invalid dataset.');return;}
 const backup=new Blob([JSON.stringify(world,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(backup),a=document.createElement('a');
 a.href=url;a.download='world-backup-before-auto-city.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
 if(mode==='new'){
   world.roadNetwork=copy(network);world.mapScale=network.metresPerPixel;
   world.assets=[];world.mapEdits.roadStrokes=[];
   const background=document.createElement('canvas');background.width=W;background.height=H;
   const context=background.getContext('2d');context.fillStyle='#a6b4a4';context.fillRect(0,0,W,H);
   world.mapImage=background.toDataURL('image/jpeg',.8);
   const near=G.nearestRoad(W/2,H/2,network);
   if(near){const r=near.road,i=Math.max(0,Math.min(r.points.length-2,Math.floor((r.points.length-1)/2))),u=r.points[i],v=r.points[i+1];
     world.mapEdits.spawn=[+( (u[0]+v[0])/2 ).toFixed(2),+( (u[1]+v[1])/2 ).toFixed(2),+( (Math.atan2(v[0]-u[0],v[1]-u[1])*180/Math.PI+360)%360 ).toFixed(1)];}
 }
 if(mode==='new'||replaceBuildings)world.blocks=copy(blocks);
 else{
  const known=new Set(world.blocks.map(b=>b[12]?.osmId).filter(Boolean));
  for(const b of blocks){if(!known.has(b[12]?.osmId)){world.blocks.push(copy(b));known.add(b[12]?.osmId);}}
 }
 selected=null;drawing=[];syncMapImage();commit();updateInspector();fit();
 status(`Auto City generated ${blocks.length} mapped building footprints. Roads preserved or regenerated to match geographic coordinates. Preview game, then export world.json.`);
});
window.addEventListener('image-map:apply',e=>{
 const {blocks,mapImage,mode,spawn,mapScale}=e.detail||{};if(!Array.isArray(blocks)||!blocks.length||blocks.length>1500||typeof mapImage!=='string')return;
 if(mode==='replace'){world.blocks=copy(blocks);world.assets=[];world.mapEdits.roadStrokes=[];world.roadNetwork=null;
   // A new map has no reliable correspondence with the previous player's spawn.
   world.mapEdits.spawn=Array.isArray(spawn)?spawn:[Math.round(W/2),Math.round(H/2),180];
 }else{world.blocks.push(...copy(blocks));}
 world.mapImage=mapImage;if(Number.isFinite(mapScale)&&mapScale>=.15&&mapScale<=4)world.mapScale=mapScale;selected=null;drawing=[];syncMapImage();commit();updateInspector();render();
 status(`Imported ${blocks.length} editable building blocks. Move the spawn marker onto a road, then Preview game.`);
});
window.addEventListener('geo-roads:request-open',()=>{
 if(!loaded){status('Editor is still loading. Try importing again.');return;}
 window.dispatchEvent(new CustomEvent('geo-roads:open',{detail:{mapImage:world.mapImage||'map_preview.png',mapScale:world.mapScale}}));
});
window.addEventListener('geo-roads:apply',e=>{
 const {roadNetwork:net,mode,mapImage}=e.detail||{};
 if(!net?.roads?.length||net.roads.length>6000||!Number.isFinite(net.metresPerPixel))return;
 if(mode==='replace'){
  // Automatic safety backup of old world, before any destructive import.
  const backup=new Blob([JSON.stringify(world,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(backup),a=document.createElement('a');a.href=url;a.download='world-backup-before-roads.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  world.blocks=[];world.assets=[];world.mapEdits.roadStrokes=[];world.mapScale=net.metresPerPixel;
  if(mapImage)world.mapImage=mapImage;
  const near=G.nearestRoad(W/2,H/2,net);
  if(near){
    const r=near.road,i=Math.min(r.points.length-2,Math.max(0,Math.floor((r.points.length-1)/2)));
    const a=r.points[i],b=r.points[i+1],heading=(Math.atan2(b[0]-a[0],b[1]-a[1])*180/Math.PI+360)%360;
    world.mapEdits.spawn=[+((a[0]+b[0])/2).toFixed(2),+((a[1]+b[1])/2).toFixed(2),+heading.toFixed(1)];
  }
 }
 world.roadNetwork=copy(net);selected=null;drawing=[];syncMapImage();commit();updateInspector();fit();
 status('Imported '+net.roads.length+' geographical road paths. Inspect widths, Preview game, then export world.json.');
});
image.onload=render;new ResizeObserver(resize).observe(canvas);
load().catch(e=>{status('Could not open world: '+e.message);$('save-status').textContent='Load failed';console.error(e);});
})();

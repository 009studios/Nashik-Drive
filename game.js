/* NASHIK: FIRST DRIVE — MOBILE / OWNER STUDIO 2.0
   Road surfaces were traced from the user-supplied College Road map screenshot.
   This is screenshot-coordinate accurate, NOT verified survey/GPS geometry.
   It contains no Google basemap, imagery, tiles or logos.
   The building blocks in the focused BYK sector are approximate massing from user references.
   Free-roam only: no mission logic and no payment code.
*/
(() => {
  'use strict';
  const $=id=>document.getElementById(id), cv=$('gl');
  const gl=cv.getContext('webgl2',{alpha:false,depth:true,antialias:true,powerPreference:'high-performance'});
  if(!gl){$('error').textContent='WebGL 2 is required. Try Chrome with hardware acceleration enabled.';$('error').hidden=false;return;}
  const W=1175,H=1280,S=window.NashikShapes;
  let K=.65; // metres per image pixel; overridden by world.mapScale for imports
  let mapEdits={spawn:[787,544,180],roadStrokes:[]};
  const wx=u=>(u-W/2)*K, wz=v=>(v-H/2)*K;
  const uvx=x=>x/K+W/2, uvy=z=>z/K+H/2;
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n)), lerp=(a,b,t)=>a+(b-a)*t;
  const rad=Math.PI/180;
  function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),m=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*m,-1,0,0,2*far*near*m,0]);}
  function lookAt(eye,target){const a=eye[0]-target[0],b=eye[1]-target[1],c=eye[2]-target[2];let l=Math.hypot(a,b,c)||1;const z=[a/l,b/l,c/l];let x=[z[2],0,-z[0]];l=Math.hypot(...x)||1;x=x.map(n=>n/l);const y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-(x[0]*eye[0]+x[1]*eye[1]+x[2]*eye[2]),-(y[0]*eye[0]+y[1]*eye[1]+y[2]*eye[2]),-(z[0]*eye[0]+z[1]*eye[1]+z[2]*eye[2]),1]);}
  function mul(a,b){const r=new Float32Array(16);for(let c=0;c<4;c++)for(let k=0;k<4;k++)r[c*4+k]=a[k]*b[c*4]+a[4+k]*b[c*4+1]+a[8+k]*b[c*4+2]+a[12+k]*b[c*4+3];return r;}
  function transform(x,y,z,sx,sy,sz,angle=0){const c=Math.cos(angle),s=Math.sin(angle);return new Float32Array([c*sx,0,-s*sx,0,0,sy,0,0,s*sz,0,c*sz,0,x,y,z,1]);}
  function shader(type,code){const sh=gl.createShader(type);gl.shaderSource(sh,code);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh;}
  const vs=`#version 300 es
   precision highp float;layout(location=0)in vec3 pos;layout(location=1)in vec3 norm;
   uniform mat4 model;uniform mat4 viewProj;out vec3 vNormal;out vec3 vWorld;
   void main(){vec4 p=model*vec4(pos,1.);vWorld=p.xyz;vNormal=mat3(model)*norm;gl_Position=viewProj*p;}`;
  const fs=`#version 300 es
   precision highp float;in vec3 vNormal;in vec3 vWorld;uniform vec3 color;uniform vec3 cameraPos;
   uniform float isGround;uniform sampler2D groundTex;uniform vec2 groundSize;out vec4 pixel;
   void main(){vec3 col=color; if(isGround>.5){vec2 uv=vec2(vWorld.x/groundSize.x+.5,.5-vWorld.z/groundSize.y);col=texture(groundTex,uv).rgb;}
    else{vec3 N=normalize(vNormal);float f=max(dot(N,normalize(vec3(.45,.94,.38))),0.);col*=.62+.38*f;}
    float dist=distance(vWorld,cameraPos);float haze=smoothstep(90.,280.,dist)*.34;
    col=mix(col,vec3(.65,.77,.78),haze);pixel=vec4(col,1.);}`;
  const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));gl.useProgram(p);
  const U={model:gl.getUniformLocation(p,'model'),viewProj:gl.getUniformLocation(p,'viewProj'),color:gl.getUniformLocation(p,'color'),cameraPos:gl.getUniformLocation(p,'cameraPos'),isGround:gl.getUniformLocation(p,'isGround'),groundTex:gl.getUniformLocation(p,'groundTex'),groundSize:gl.getUniformLocation(p,'groundSize')};
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);
  const verts=[],inds=[];
  const sides=[[[0,0,1],[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]],[[0,0,-1],[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]],[[1,0,0],[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]]],[[-1,0,0],[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]]],[[0,1,0],[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]],[[0,-1,0],[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]]];
  for(const [n,corners] of sides){const start=verts.length/6;corners.forEach(v=>verts.push(...v,...n));inds.push(start,start+1,start+2,start,start+2,start+3);}
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);const ix=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ix);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(inds),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);gl.bindVertexArray(vao);
  function cube(x,y,z,sx,sy,sz,col,yaw=0){gl.uniformMatrix4fv(U.model,false,transform(x,y,z,sx,sy,sz,yaw));gl.uniform3fv(U.color,col);gl.drawElements(gl.TRIANGLES,inds.length,gl.UNSIGNED_SHORT,0);}
  const colors=[[.79,.74,.66],[.66,.7,.75],[.76,.65,.59],[.59,.70,.67],[.74,.73,.69]], roof=[.49,.53,.56],dark=[.15,.20,.23],carBody=[.13,.70,.59],glass=[.45,.68,.72],wheel=[.09,.13,.16],headlight=[.94,.89,.71];
  let blocks=[],assets=[],loaded=false,groundTexture=null,roadMesh=null,shoulderMesh=null,streetMode=false,miniMap=null,cityExplorer=null;
  let mapGeoCenter=null; // Geographic reference of the currently loaded map (if available).
  let cityMode=false, cityRoads=[],cityRoadGrid=null,cityBlockGrid=null,lastRoadTile='',cityMetres=160;
  // Grid indices keep collision, road meshes and facades local even for a whole city.
  const CELL=260;
  function makeGrid(features, boundsFn){
    const cells=new Map();
    features.forEach((o,i)=>{
      const [x0,z0,x1,z1]=boundsFn(o);
      if(![x0,z0,x1,z1].every(Number.isFinite))return;
      let xa=Math.floor(x0/CELL),xb=Math.floor(x1/CELL),za=Math.floor(z0/CELL),zb=Math.floor(z1/CELL);
      if((xb-xa+1)*(zb-za+1)>1200)return;
      for(let x=xa;x<=xb;x++)for(let z=za;z<=zb;z++){
        const k=x+','+z;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(i);
      }
    });return cells;
  }
  function nearFromGrid(grid,items,x,z,r=210){
    if(!grid)return items;
    const found=new Set(),out=[];
    const xa=Math.floor((x-r)/CELL),xb=Math.floor((x+r)/CELL),za=Math.floor((z-r)/CELL),zb=Math.floor((z+r)/CELL);
    for(let a=xa;a<=xb;a++)for(let b=za;b<=zb;b++)for(const i of grid.get(a+','+b)||[]){if(!found.has(i)){found.add(i);out.push(items[i]);}}
    return out;
  }
  function updateCityRoadMesh(x,z){
    if(!cityMode||!cityRoadGrid)return;
    const tile=Math.floor(x/180)+','+Math.floor(z/180);
    if(tile===lastRoadTile)return;
    lastRoadTile=tile;
    const roads=nearFromGrid(cityRoadGrid,cityRoads,x,z,580);
    const network={roads};
    const fresh=uploadRoadGeometry(network,{elevation:.070});
    const edge=uploadRoadGeometry(network,{elevation:.048,extraWidth:1.6});
    for(const old of [roadMesh,shoulderMesh])if(old){gl.deleteVertexArray(old.vao);if(old.buffer)gl.deleteBuffer(old.buffer);}
    roadMesh=fresh;shoulderMesh=edge;
  }
  const polyMeshCache=new Map();
  function meshFor(shape,points){
    const key=shape+JSON.stringify(points||[]);if(polyMeshCache.has(key))return polyMeshCache.get(key);
    const poly=S.footprint(shape,points),tri=S.triangleIndices(poly);
    if(tri.length<3)return null;
    const vert=[],faces=[];
    const push=(pos,nor)=>{vert.push(...pos,...nor);return vert.length/6-1;};
    for(const idx of tri){const q=poly[idx];let v=push([q[0],.5,q[1]],[0,1,0]);faces.push(v);}
    for(const idx of tri){const q=poly[idx];let v=push([q[0],-.5,q[1]],[0,-1,0]);faces.push(v);}
    for(let i=0;i<poly.length;i++){let a=poly[i],b=poly[(i+1)%poly.length];const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1,n=S.area(poly)>0?[dz/len,0,-dx/len]:[-dz/len,0,dx/len];
      const start=vert.length/6;push([a[0],-.5,a[1]],n);push([b[0],-.5,b[1]],n);push([b[0],.5,b[1]],n);push([a[0],.5,a[1]],n);
      faces.push(start,start+1,start+2,start,start+2,start+3);
    }
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);
    const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vert),gl.STATIC_DRAW);
    const eb=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,eb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(faces),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
    gl.bindVertexArray(null);const mesh={vao,count:faces.length};polyMeshCache.set(key,mesh);return mesh;
  }
  function polygonBuilding(x,y,z,w,h,d,col,rot,mesh){if(!mesh)return;gl.disable(gl.CULL_FACE);gl.bindVertexArray(mesh.vao);gl.uniformMatrix4fv(U.model,false,transform(x,y,z,w,h,d,rot));gl.uniform3fv(U.color,col);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);gl.bindVertexArray(vao);gl.enable(gl.CULL_FACE);}
  function buildingSolid(b,y,h,col,extra=0){if(b.shape==='rect'||b.shape==='square')cube(b.x,y,b.z,b.w+extra,h,b.d+extra,col,b.yaw);
    else polygonBuilding(b.x,y,b.z,b.w+extra,h,b.d+extra,col,b.yaw,b.mesh);}

  const IDENTITY=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  function uploadRoadGeometry(network, options={}){
    if(!network?.roads?.length||!window.NashikRoadMesh)return null;
    const geometry=window.NashikRoadMesh.build(network,K,W,H,options);
    if(!geometry.vertices.length)return null;
    const roadVAO=gl.createVertexArray();gl.bindVertexArray(roadVAO);
    const roadBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,roadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,geometry.vertices,gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
    gl.bindVertexArray(vao);
    return {vao:roadVAO,buffer:roadBuffer,count:geometry.vertices.length/6,segments:geometry.segments,paths:geometry.paths};
  }
  // Pre-unioned geometry removes z-fighting and overlap at junctions. It is built
  // from the exact shipped OSM road network. Unpublished edits fall back to the
  // clean map-texture road surfaces until the owner regenerates the mesh.
  function roadSignature(roads){
    let n=0,sum=0;for(let i=0;i<roads.length;i++){
      const r=roads[i];sum+=(i+1)*Math.round((Number(r.widthM)||6)*100);
      for(const a of r.points){sum+=Math.round(a[0]*100)*31+Math.round(a[1]*100)*17;n++;}
    }return `${roads.length}:${n}:${sum}`;
  }
  function uploadBinaryRoad(buffer){
    if(!buffer?.byteLength||buffer.byteLength%24!==0)return null;
    const array=new Float32Array(buffer),roadVAO=gl.createVertexArray();gl.bindVertexArray(roadVAO);
    const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,array,gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
    gl.bindVertexArray(vao);return {vao:roadVAO,count:array.length/6};
  }
  async function getSeamlessRoadSurfaces(data){
    try{
      if(!data.roadNetwork?.roads?.length)return null;
      const r=await fetch('road-surface-meta.json');if(!r.ok)return null;
      const meta=await r.json();if(meta.signature!==roadSignature(data.roadNetwork.roads)||Math.abs(meta.scale-K)>.00001)return null;
      const [asphalt,shoulder]=await Promise.all(['road-surface.bin','road-shoulder.bin'].map(async f=>{
        const response=await fetch(f);if(!response.ok)throw Error('Road surface missing');return response.arrayBuffer();
      }));return {asphalt,shoulder};
    }catch(e){console.warn('Road atlas unavailable; using texture fallback:',e);return null;}
  }
  function showMapStatus(data){
    const pill=$('world-status');if(!pill)return;
    const n=data.roadNetwork?.roads?.length||0;
    const preview=new URLSearchParams(location.search).get('preview')==='1';
    pill.textContent=n?`${cityMode?'Full Nashik · ':''}${n} mapped roads · ${blocks.length} buildings${preview?' · Studio preview':''}`:
      `Original map · ${blocks.length} buildings${preview?' · no imported road data':''}`;
    pill.classList.toggle('has-roads',n>0);
    const lbl=$('minimap-location');if(lbl)lbl.textContent='LOCATING...';
    const header=$('map-heading');if(header)header.textContent=n?'IMPORTED NASHIK ROAD WORLD':'COLLEGE ROAD / BLOCKOUT';
    const explainer=$('map-explainer');if(explainer)explainer.textContent=n?'Road paths imported from OpenStreetMap; widths are approximate.':'Screenshot-based original map. Import GeoJSON in World Studio to create real roads.';
  }
  const img=new Image();
  // The published world is a single versioned file. The local owner studio can preview
  // unpublished drafts only while serving the project from localhost.
  const isLocal=/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const previewMode=isLocal&&new URLSearchParams(location.search).get('preview')==='1';
  async function getWorld(){
    if(!previewMode && !new URLSearchParams(location.search).has('college')){
      try{const city=await fetch('city-world.json',{cache:'no-store'});
        if(city.ok){const data=await city.json();if(data.cityMode && data.roadNetwork?.roads?.length)return data;}
      }catch(e){console.warn('Full city is not installed yet; using College Road world.',e);}
    }
    if(previewMode){try{const draft=localStorage.getItem('nashik-world-studio-v08');if(draft)return JSON.parse(draft);}catch(e){console.warn('Draft not available:',e);}}
    const r=await fetch('world.json?v='+Date.now());
    if(r.ok)return r.json();
    const [b,a,m]=await Promise.all(['blocks.json','assets.json','map_edits.json'].map(f=>fetch(f).then(r=>{if(!r.ok)throw new Error(f+' missing');return r.json();})));
    return {blocks:b,assets:a,mapEdits:m};
  }
  const worldPromise=getWorld();
  const imagePromise=worldPromise.then(data=>new Promise((resolve,reject)=>{
    img.onload=resolve;img.onerror=()=>reject(new Error('map image missing or invalid'));
    const candidate=data.mapImage;
    img.src=(typeof candidate==='string'&&candidate.length<4500000&&/^data:image\/(png|jpeg|webp);base64,/.test(candidate))?candidate:'terrain.png';
  }));
  Promise.all([worldPromise,imagePromise]).then(async ([data])=>{
    if(!Array.isArray(data.blocks)||!Array.isArray(data.assets))throw new Error('Invalid world.json');
    cityMode=!!data.cityMode;
    const geoCenter=data.roadNetwork?.center;
    mapGeoCenter=geoCenter&&Number.isFinite(geoCenter.lat)&&Number.isFinite(geoCenter.lon)?geoCenter:null;
    K=(Number.isFinite(data.mapScale)&&data.mapScale>=.15&&data.mapScale<32)?data.mapScale:.65;
    cityMetres=cityMode?180:160;
    const seamless=cityMode?null:await getSeamlessRoadSurfaces(data);
    blocks=data.blocks.map(([u,v,w,d,h,c,angle=0,floors,kind='mixed',floorHeight,shape='rect',points=[],facade={}])=>({
      x:wx(u),z:wz(v),w:Math.max(1,w*K),d:Math.max(1,d*K),h:Math.max(2,h),c,yaw:angle*rad,
      floors:Math.max(1,Math.round(floors||h/3.2)),kind,floorHeight:floorHeight||3.2,shape,points,
      facade:facade&&typeof facade==='object'?facade:{},mesh:cityMode?null:((shape==='rect'||shape==='square')?null:meshFor(shape,points))
    }));
    // OSM imports often tag every building as residential because their actual
    // use is unknown. Infer a *visual* mixed-use frontage only beside main roads;
    // editable category remains untouched and is never claimed as verified.
    const major=(cityMode?[]:(data.roadNetwork?.roads||[])).filter(r=>['primary','secondary','tertiary'].includes(r.highway)).map(r=>({
      ...r,minX:Math.min(...r.points.map(q=>wx(q[0]))),maxX:Math.max(...r.points.map(q=>wx(q[0]))),
      minZ:Math.min(...r.points.map(q=>wz(q[1]))),maxZ:Math.max(...r.points.map(q=>wz(q[1])))
    }));
    for(const b of blocks){
      const near=major.some(r=>{
        if(b.x<r.minX-b.w*.6-12||b.x>r.maxX+b.w*.6+12||b.z<r.minZ-b.d*.6-12||b.z>r.maxZ+b.d*.6+12)return false;
        const bbox=Math.hypot(b.w,b.d)*.34;
        return window.NashikGeoRoads.distanceToRoad(uvx(b.x),uvy(b.z),r)*K < bbox+10;
      });
      b.visualKind=b.kind==='residential'&&near?'mixed':b.kind;
    }
    if(cityMode){
      cityBlockGrid=makeGrid(blocks,b=>[b.x-b.w/2-8,b.z-b.d/2-8,b.x+b.w/2+8,b.z+b.d/2+8]);
      cityRoads=data.roadNetwork?.roads||[];
      cityRoadGrid=makeGrid(cityRoads,r=>{
        let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;
        for(const [u,v] of r.points){const x=wx(u),z=wz(v);x0=Math.min(x0,x);z0=Math.min(z0,z);x1=Math.max(x1,x);z1=Math.max(z1,z);}
        return [x0-15,z0-15,x1+15,z1+15];
      });
    }
    assets=data.assets;
    const edits=data.mapEdits||{};if(edits&&typeof edits==='object')mapEdits={...mapEdits,...edits};
    const paint=document.createElement('canvas');const quality=matchMedia('(pointer: coarse)').matches?1.5:2;
    paint.width=Math.round(W*quality);paint.height=Math.round(H*quality);const ctx=paint.getContext('2d');ctx.scale(quality,quality);
    if(cityMode){ctx.fillStyle='#a9b7a9';ctx.fillRect(0,0,W,H);}
    else ctx.drawImage(img,0,0,W,H);
    if(data.roadNetwork?.roads?.length){
      window.NashikGeoRoads.draw(ctx,data.roadNetwork,{metresPerPixel:K});
      // Draw building footprints on the regenerated minimap using the same map frame.
      // Physical 3D buildings still come from the editable world.blocks array.
      if(data.blocks?.length){
        ctx.save();ctx.fillStyle='#768c7c';ctx.strokeStyle='#536c61';ctx.lineWidth=.7;
        for(const block of data.blocks){const outline=S.worldPoints(block);if(outline.length<3)continue;
          ctx.beginPath();outline.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();ctx.stroke();}
        ctx.restore();
      }
      if(seamless){
        shoulderMesh=uploadBinaryRoad(seamless.shoulder);
        roadMesh=uploadBinaryRoad(seamless.asphalt);
      }else{
        // No mismatched prebuilt geometry when the owner edits a road.
        // The continuous, round-join road texture still shows accurate paths.
        shoulderMesh=null;roadMesh=null;
      }
    }
    for(const stroke of (mapEdits.roadStrokes||[])){
      if(!Array.isArray(stroke.points)||stroke.points.length<1)continue;
      ctx.strokeStyle=stroke.mode==='cover'?'#aaab99':'#2b333b';
      ctx.lineWidth=Math.max(2,Number(stroke.width)||12);ctx.lineJoin='round';ctx.lineCap='round';
      ctx.beginPath();stroke.points.forEach(([u,v],i)=>i?ctx.lineTo(u,v):ctx.moveTo(u,v));
      if(stroke.points.length===1){const [u,v]=stroke.points[0];ctx.lineTo(u+.01,v+.01);}ctx.stroke();
    }
    // Street map uses local OSM geometry, never an external tile server.
    if(data.roadNetwork?.roads?.length && !document.querySelector('.osm-credit')){
      const credit=document.createElement('a');credit.className='osm-credit';credit.href='https://www.openstreetmap.org/copyright';
      credit.target='_blank';credit.rel='noopener noreferrer';credit.textContent='© OpenStreetMap contributors';document.body.appendChild(credit);
    }
    // The mini HUD has its own metre-scaled follow camera. The full map is separate.
    miniMap=window.NashikMiniMap?.create($('minimap-canvas'),{roads:data.roadNetwork?.roads||[],blocks:data.blocks,shapes:S,metresPerPixel:K,visibleMetres:cityMetres,baseImage:img,mapWidth:W,mapHeight:H});
    cityExplorer=window.NashikCityExplorer?.create({
      canvas:$('explorer-map'),roads:data.roadNetwork?.roads||[],blocks:data.blocks,
      shapes:S,baseCanvas:paint,metresPerPixel:K,center:data.roadNetwork?.center,cityMode,
      onTeleport:destination=>teleportToRoad(destination)
    });
    groundTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,groundTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,paint);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.generateMipmap(gl.TEXTURE_2D);
    let [u,v,a]=mapEdits.spawn||[787,544,180];
    const query=new URLSearchParams(location.search);
    if(previewMode&&query.get('street')==='1'){
      const su=Number(query.get('sx')),sv=Number(query.get('sy')),sa=Number(query.get('heading'));
      if(Number.isFinite(su)&&Number.isFinite(sv)&&su>=0&&su<=W&&sv>=0&&sv<=H){u=su;v=sv;}
      if(Number.isFinite(sa))a=((sa%360)+360)%360;
      streetMode=true;
      try{const ref=localStorage.getItem('nashik-street-match-ref');if(ref?.startsWith('data:image/')){
        const panel=$('street-reference');if(panel){$('street-reference-image').src=ref;panel.hidden=false;}
      }}catch(e){console.warn('Street Match image not available',e);}
    }
    car.x=wx(u);car.z=wz(v);car.yaw=a*rad;
    person.x=car.x+3.4;person.z=car.z+1.5;camera.x=car.x-Math.sin(car.yaw)*12;camera.z=car.z-Math.cos(car.yaw)*12;
    showMapStatus(data);
    if(cityMode){
      $('location-text').textContent='NASHIK · FULL CITY';
      document.title='Nashik First Drive — Full City';
      const pill=document.querySelector('.map-brief');
      // City data is loaded independently of the College Road editor.
    }
    loaded=true;
  }).catch(e=>{$('error').textContent='Could not load game files: '+e.message;$('error').hidden=false;});
  const SPAWN={x:wx(787),z:wz(544),yaw:Math.PI};
  const car={x:SPAWN.x,z:SPAWN.z,yaw:SPAWN.yaw,v:0,driving:true};
  const person={x:car.x+3.4,z:car.z+1.5,yaw:Math.PI};
  let camera={x:car.x,y:8,z:car.z+16},camMode=0,paused=false,playing=false,last=0,clock=0;
  const keys={forward:false,backward:false,left:false,right:false};const keyMap={KeyW:'forward',ArrowUp:'forward',KeyS:'backward',ArrowDown:'backward',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
  const names=['Close chase','Wide chase','High view'];
  function hitBuilding(x,z,pad){for(const b of nearFromGrid(cityBlockGrid,blocks,x,z,45)){
    // Collision with rotated rectangular masses, not only axis-aligned bounding boxes.
    if(Math.abs(x-b.x)>Math.max(b.w,b.d)+pad||Math.abs(z-b.z)>Math.max(b.w,b.d)+pad)continue;
    const co=Math.cos(b.yaw),si=Math.sin(b.yaw),dx=x-b.x,dz=z-b.z;
    const localX=co*dx-si*dz,localZ=si*dx+co*dz;
    if(b.shape==='rect'||b.shape==='square'){if(Math.abs(localX)<b.w*.5+pad&&Math.abs(localZ)<b.d*.5+pad)return true;}else{
      const poly=S.footprint(b.shape,b.points).map(([a,c])=>[a*b.w,c*b.d]);
      if(S.pointInside(localX,localZ,poly))return true;
      for(let k=0;k<poly.length;k++){
        const A=poly[k],B=poly[(k+1)%poly.length],vx=B[0]-A[0],vz=B[1]-A[1];
        const t=clamp(((localX-A[0])*vx+(localZ-A[1])*vz)/(vx*vx+vz*vz||1),0,1);
        if(Math.hypot(localX-A[0]-vx*t,localZ-A[1]-vz*t)<pad)return true;
      }
    }
  }return false;}
  function insideBounds(x,z){return Math.abs(x)<W*K*.5-5 && Math.abs(z)<H*K*.5-5;}
  function canMove(x,z,pad){return insideBounds(x,z)&&!hitBuilding(x,z,pad);}
  // Every street object comes from editable assets.json. No hardcoded petrol pump.
  const colorMat=[[.20,.44,.74],[.16,.52,.43],[.69,.46,.34],[.66,.60,.50],[.54,.63,.71]];
  function localPart(cx,cz,rot,lx,lz,h,sx,sy,sz,col){
    const co=Math.cos(rot),si=Math.sin(rot);
    cube(cx+co*lx+si*lz,h,cz-si*lx+co*lz,sx,sy,sz,col,rot);
  }
  function drawAsset(a){
    const x=wx(a.x),z=wz(a.y),r=(a.rot||0)*rad,w=Math.max(.2,a.w*K),d=Math.max(.2,a.d*K),h=Math.max(.2,a.h);
    const mat=colorMat[a.color]||colorMat[0];
    if(a.type==='forecourt'){
      cube(x,.07,z,w,.14,d,[.65,.67,.63],r);
      cube(x,.151,z,Math.max(.1,w-.4),.014,Math.max(.1,d-.4),[.75,.74,.67],r);
    }else if(a.type==='canopy'){
      localPart(x,z,r,0,0,h,w,.40,d,[.18,.39,.70]);
      localPart(x,z,r,0,0,h-.28,w,.16,d,[.96,.77,.22]);
      for(const dx of [-w*.39,w*.39])for(const dz of [-d*.35,d*.35])
        localPart(x,z,r,dx,dz,(h-.55)/2,.38,h-.65,.38,[.82,.84,.82]);
    }else if(a.type==='dispenser'){
      cube(x,h/2,z,Math.max(1,w),h,Math.max(.6,d),[.20,.34,.51],r);
      cube(x,h*.70,z,Math.max(.9,w+.1),h*.20,Math.max(.7,d+.15),[.90,.92,.93],r);
      cube(x,h*.48,z,Math.max(.3,w+.14),h*.10,Math.max(.5,d+.12),[.86,.70,.28],r);
    }else if(a.type==='pylon'){
      cube(x,h/2,z,w*.44,h,d*.6,[.83,.85,.84],r);
      cube(x,h*.78,z,w,h*.32,d,[.18,.40,.69],r);
      cube(x,h*.79,z,w+.04,h*.10,d+.06,[.94,.75,.24],r);
    }else if(a.type==='tree'){
      const trunk=h*.55, canopy=Math.max(.8,w);
      cube(x,trunk/2,z,Math.max(.22,canopy*.095),trunk,Math.max(.22,canopy*.095),[.39,.30,.20]);
      const foliage=a.color===1?[.20,.39,.30]:a.color===2?[.31,.49,.29]:[.23,.45,.32];
      const cy=trunk+(h-trunk)*.45;
      cube(x,cy,z,canopy*.62,h-trunk,canopy*.65,foliage);
      cube(x+canopy*.23,cy-.20,z,canopy*.57,(h-trunk)*.74,canopy*.53,foliage);
      cube(x-canopy*.23,cy-.28,z+canopy*.18,canopy*.53,(h-trunk)*.76,canopy*.47,foliage);
    }else if(a.type==='palm'){
      cube(x,h*.45,z,.25,h*.9,.25,[.48,.36,.24]);
      for(let i=0;i<6;i++){const ang=i*Math.PI/3;
        cube(x+Math.cos(ang)*w*.28,h*.93,z+Math.sin(ang)*w*.28,w*.7,.17,.46,[.23,.50,.30],ang);
      }
    }else if(a.type==='bush'){
      cube(x,.25,z,w*.65,.50,d*.65,[.18,.41,.24],r);cube(x,h*.55,z,w,h*.8,d,[.26,.51,.30],r);
    }else if(a.type==='park'){
      polygonBuilding(x,.045,z,w,.09,d,[.28,.47,.28],r,meshFor(a.shape||'rect',[]));
    }else if(a.type==='pond'){
      polygonBuilding(x,.045,z,w,.09,d,[.18,.52,.69],r,meshFor(a.shape||'circle',[]));
    }else if(a.type==='parking'){
      polygonBuilding(x,.045,z,w,.09,d,[.30,.35,.36],r,meshFor(a.shape||'rect',[]));
      for(let i=-2;i<=2;i++)localPart(x,z,r,i*w/6,0,.10,.08,.03,d*.82,[.83,.84,.79]);
    }else if(a.type==='wall'||a.type==='fence'){
      if(a.type==='wall')cube(x,h*.5,z,w,h,Math.min(d,1.7),[.66,.69,.65],r);
      else{cube(x,h*.78,z,w,.13,.15,[.43,.49,.47],r);cube(x,h*.35,z,w,.13,.15,[.43,.49,.47],r);
        for(let j=-2;j<=2;j++)localPart(x,z,r,j*w*.22,0,h*.5,.15,h,.15,[.47,.52,.50]);}
    }else if(a.type==='billboard'){
      cube(x,h*.50,z,.20,h,.20,[.42,.44,.46],r);cube(x,h*.87,z,w,h*.23,d,[.20,.35,.44],r);
    }else if(a.type==='bench'){
      cube(x,.57,z,w,.18,d,[.43,.31,.24],r);cube(x,1.05,z-d*.38,w,.9,.13,[.43,.31,.24],r);
    }else if(a.type==='lamp'){
      cube(x,h*.5,z,.22,h,.22,[.48,.53,.54]);
      cube(x+.65,h,z,1.6,.18,.3,[.41,.47,.50]);
      cube(x+1.15,h-.15,z,.8,.12,.4,[.95,.88,.65]);
    }else if(a.type==='shop'){
      cube(x,h*.48,z,w,h*.96,d,[.69,.68,.63],r);
      localPart(x,z,r,0,d*.50+.07,h*.38,w*.83,h*.55,.14,[.23,.36,.40]);
      localPart(x,z,r,0,d*.52+.09,h*.80,w*.94,h*.22,.18,[.25,.52,.47]);
    }else if(a.type==='bollard'){
      cube(x,h*.5,z,Math.min(.6,w),h,Math.min(.6,d),[.39,.45,.47],r);
      cube(x,h*.83,z,Math.min(.66,w+.1),Math.min(.12,h*.16),Math.min(.66,d+.1),[.90,.78,.34],r);
    }else if(a.type==='bus-stop'){
      cube(x,h*.99,z,w,.15,d,[.22,.37,.46],r);
      for(const dx of [-w*.43,w*.43])localPart(x,z,r,dx,0,h*.49,.16,h*.96,.16,[.70,.73,.73]);
      localPart(x,z,r,0,-d*.43,h*.52,w*.9,h*.72,.12,[.32,.51,.56]);
      localPart(x,z,r,0,0,.54,w*.74,.16,d*.37,[.45,.41,.35]);
    }else if(a.type==='traffic-signal'){
      cube(x,h*.5,z,.20,h,.20,[.38,.43,.46],r);
      localPart(x,z,r,0,0,h*.80,.55,1.55,.34,[.12,.17,.19]);
      for(let i=0;i<3;i++)localPart(x,z,r,0,-.20,h*(.99-i*.18),.29,.28,.08,i===0?[.86,.20,.17]:i===1?[.91,.70,.24]:[.26,.62,.37]);
    }else if(a.type==='median'){
      cube(x,.19,z,w,.38,d,[.61,.62,.57],r);
      cube(x,.40,z,Math.max(.2,w-.3),.08,Math.max(.2,d-.3),[.32,.47,.32],r);
      for(let j=-1;j<=1;j++)localPart(x,z,r,j*w*.23,0,.66,Math.min(1.3,w*.13),.46,Math.min(.8,d*.60),[.27,.45,.27]);
    }else if(a.type==='crosswalk'){
      const count=Math.min(12,Math.max(3,Math.floor(w/.7)));
      for(let j=0;j<count;j++)localPart(x,z,r,-w*.5+(j+.5)*w/count,0,.108,w/count*.58,.025,d,[.89,.90,.82]);
    }else if(a.type==='speedbump'){
      cube(x,.08,z,w,.16,d,[.86,.72,.25],r);
    }else if(a.type==='sign'){
      cube(x,h*.43,z,.20,h*.86,.2,[.50,.56,.57],r);
      localPart(x,z,r,0,0,h*.87,w,h*.25,Math.max(.15,d),[.22,.47,.67]);
    }else if(a.type==='planter'){
      cube(x,h*.24,z,w*.68,h*.48,d*.68,[.59,.58,.48],r);
      cube(x,h*.68,z,w*.80,h*.55,d*.80,[.22,.48,.27],r);
    }
  }
  // Render lightweight facade panels on ANY OSM footprint, including polygons.
  // Older versions skipped every imported polygon, leaving all 561 blocks blank.
  function drawBuildingDetails(b,dist){
    const facade=b.facade||{};
    const mobile=matchMedia('(pointer: coarse)').matches;
    if(dist>(mobile?80:130)||facade.windows===false)return;
    const floors=Math.min(b.floors,12),fh=b.h/Math.max(1,b.floors);
    const isShop=['commercial','office','mixed'].includes(b.visualKind);
    const col=isShop?[.20,.34,.39]:[.25,.39,.46];
    const frameCol=[.80,.78,.70],railCol=[.34,.37,.36];
    const poly=S.footprint(b.shape,b.points).map(([x,z])=>[x*b.w,z*b.d]);
    const signed=S.area(poly),co=Math.cos(b.yaw),si=Math.sin(b.yaw);
    // Each facade faces outward and is considered only when seen by the camera.
    let faces=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],z=poly[(i+1)%poly.length],dx=z[0]-a[0],dz=z[1]-a[1],len=Math.hypot(dx,dz);
      if(len<2.2)continue;
      const tx=dx/len,tz=dz/len,side=signed>=0?1:-1,nx=side*tz,nz=-side*tx;
      const cx=(a[0]+z[0])*.5,cz=(a[1]+z[1])*.5;
      const x=b.x+co*cx+si*cz,zz=b.z-si*cx+co*cz;
      const ox=co*nx+si*nz,oz=-si*nx+co*nz;
      const facing=ox*(camera.x-x)+oz*(camera.z-zz);
      if(facing<.4)continue;
      faces.push({a,tx,tz,len,nx,nz,angle:b.yaw+Math.atan2(-tz,tx),facing});
    }
    faces.sort((a,b)=>(b.facing*b.len)-(a.facing*a.len));
    for(const edge of faces.slice(0,mobile?2:3)){
      const frontCount=Math.min(mobile?3:5,Math.max(1,Math.floor(edge.len/3.5)));
      const step=edge.len/frontCount;
      const glassWidth=Math.min(1.25,step*.60);
      for(let level=0;level<floors;level++){
        const shop=level===0&&isShop;
        const height=Math.min(fh*.60,shop?2.1:1.4);
        const yy=level*fh+fh*.52;
        if(yy+height/2>b.h-.08)continue;
        for(let j=0;j<frontCount;j++){
          const along=(j+.5)*step;
          const lx=edge.a[0]+edge.tx*along+edge.nx*.07;
          const lz=edge.a[1]+edge.tz*along+edge.nz*.07;
          const gx=b.x+co*lx+si*lz,gz=b.z-si*lx+co*lz;
          cube(gx,yy,gz,shop?Math.min(step*.80,2.7):glassWidth,height,.12,col,edge.angle);
          if(dist<90){
            // Lighter trim creates visible window depth at ordinary road distance.
            cube(gx,yy+height*.50,gz,shop?Math.min(step*.83,2.75):glassWidth+.09,.095,.16,[.72,.74,.70],edge.angle);
            if(shop){
              const awning=[.20,.47,.43],sign=[.74,.71,.60];
              cube(gx,level*fh+fh*.89,gz,Math.min(step*.84,2.85),.30,.28,awning,edge.angle);
              cube(gx,level*fh+fh*.89+.01,gz,Math.min(step*.42,1.4),.055,.31,sign,edge.angle);
            }else if(level===0){
              cube(gx,Math.max(.35,fh*.18),gz,Math.min(step*.65,1.8),.66,.12,[.42,.44,.40],edge.angle);
            }
          }
          // Balcony slabs are reserved for residential upper floors.
          if((facade.balconies||(b.visualKind==='residential'&&b.c%3===0))&&level>0&&j%2===0&&dist<60){
            const blx=lx+edge.nx*.40,blz=lz+edge.nz*.40;
            const bx=b.x+co*blx+si*blz,bz=b.z-si*blx+co*blz;
            cube(bx,level*fh+.20,bz,Math.min(step*.85,2.2),.13,.82,frameCol,edge.angle);
            cube(bx,level*fh+.61,bz,Math.min(step*.85,2.2),.70,.07,railCol,edge.angle);
          }
        }
      }
    }
    if(b.h>6&&dist<(mobile?42:67)){
      const roofType=facade.roof||'tank';
      if(roofType==='tank'){
        // Use a small centered roof object to avoid spanning an irregular outline.
        cube(b.x,b.h+.68,b.z,1.35,1.35,1.35,[.38,.43,.46]);
        cube(b.x,b.h+1.41,b.z,1.48,.13,1.48,[.27,.31,.33]);
      }else if(roofType==='parapet'&&(b.shape==='rect'||b.shape==='square')){
        for(const side of [-1,1]){
          localPart(b.x,b.z,b.yaw,0,side*b.d*.48,b.h+.33,b.w,.66,.20,frameCol);
          localPart(b.x,b.z,b.yaw,side*b.w*.48,0,b.h+.33,.20,.66,b.d,frameCol);
        }
      }
    }
  }
  function drawCar(){const x=car.x,z=car.z,a=car.yaw;const s=Math.sin(a),c=Math.cos(a);
    const part=(side,forward,height,sw,sh,sd,color)=>{const X=x+c*side+s*forward,Z=z-s*side+c*forward;cube(X,height,Z,sw,sh,sd,color,a);};
    part(0,0,.85,2.15,1.2,4.6,carBody);part(0,-.30,1.41,1.80,.44,2.75,carBody);part(0,.58,1.47,1.78,.24,.13,glass);
    for(const side of [-1,1])for(const f of [-1.42,1.40])part(side*1.12,f,.44,.36,.79,.73,wheel);
    for(const side of [-.73,.73]){part(side,2.33,.85,.48,.23,.1,headlight);part(side,-2.34,.85,.45,.24,.10,[.82,.15,.13]);}
  }
  function drawPerson(){const x=person.x,z=person.z;cube(x,.82,z,.63,1.08,.45,[.23,.40,.50],person.yaw);cube(x,1.55,z,.42,.42,.43,[.72,.52,.42],person.yaw);for(const d of [-.22,.22])cube(x+d,.32,z,.18,.6,.22,[.22,.25,.30]);}
  function enterExit(){if(!playing||paused)return;if(car.driving){if(Math.abs(car.v)>2)return;car.driving=false;const dx=Math.cos(car.yaw)*3.1,dz=-Math.sin(car.yaw)*3.1;person.x=car.x+dx;person.z=car.z+dz;person.yaw=car.yaw;}
    else if(Math.hypot(person.x-car.x,person.z-car.z)<5){car.driving=true;}
    $('speed-panel').classList.toggle('hidden',!car.driving);$('drive-status').textContent=car.driving?'DRIVING':'WALKING';}
  function teleportToRoad(destination){
    if(!loaded||!playing||!Number.isFinite(destination.u)||!Number.isFinite(destination.v))return;
    const nextX=wx(destination.u),nextZ=wz(destination.v);
    if(!insideBounds(nextX,nextZ))return;
    car.x=nextX;car.z=nextZ;car.yaw=(Number(destination.heading)||0)*rad;car.v=0;car.driving=true;
    person.x=car.x+3.4;person.z=car.z+1.5;person.yaw=car.yaw;
    camera.x=car.x-Math.sin(car.yaw)*12;camera.y=6.2;camera.z=car.z-Math.cos(car.yaw)*12;
    lastRoadTile='';// rebuild nearby road meshes in the next render frame
    $('speed-panel').classList.remove('hidden');$('drive-status').textContent='DRIVING';
    lastPlaceTime=0; // Refresh the street label immediately after teleporting.
    toggleMap(false);updateMaps();
  }
  function viewMode(){camMode=(camMode+1)%3;$('view-btn').title='Camera: '+names[camMode];}
  function toggleMap(force){
    if(!playing||!loaded)return;
    const dialog=$('map-overlay');const open=typeof force==='boolean'?force:dialog.classList.contains('hidden');
    dialog.classList.toggle('hidden',!open);$('map-btn').setAttribute('aria-pressed',open?'true':'false');
    if(open){
      for(const key in keys)keys[key]=false;
      const x=car.driving?car.x:person.x,z=car.driving?car.z:person.z;
      cityExplorer?.open(uvx(x),uvy(z));
      $('map-search')?.focus({preventScroll:true});
    }else{cityExplorer?.close();$('map-btn')?.focus({preventScroll:true});}
    if(open)updateMaps();
  }
  function togglePause(){paused=!paused;$('pause-btn').textContent=paused?'▶':'Ⅱ';$('pause-btn').setAttribute('aria-label',paused?'Resume':'Pause');$('state').textContent=paused?'PAUSED':'FREE ROAM';}
  async function fullScreen(){try{if(document.fullscreenElement){await document.exitFullscreen?.();return;}await document.documentElement.requestFullscreen?.();if(matchMedia('(pointer: coarse)').matches && screen.orientation?.lock)await screen.orientation.lock('landscape').catch(()=>{});}catch(e){/* unsupported browser: continue in viewport */}}
  function update(dt){if(!playing||paused||!loaded||!$('map-overlay').classList.contains('hidden'))return;
    const f=+keys.forward-+keys.backward,turn=+keys.right-+keys.left;
    if(car.driving){
      const target=f>0?20:f<0?-8:0;
      car.v+=(target-car.v)*Math.min(1,dt*(f?1.5:2.3));if(Math.abs(car.v)<.025)car.v=0;
      if(Math.abs(car.v)>.10)car.yaw+=turn*(car.v>0?1:-1)*1.14*dt*(.38+.62*Math.min(Math.abs(car.v)/15,1));
      const nx=car.x+Math.sin(car.yaw)*car.v*dt,nz=car.z+Math.cos(car.yaw)*car.v*dt;
      if(canMove(nx,nz,1.55)){car.x=nx;car.z=nz;}else car.v=0;
    }else{
      if(turn)person.yaw+=turn*2.4*dt;
      if(f){const nx=person.x+Math.sin(person.yaw)*f*4.2*dt,nz=person.z+Math.cos(person.yaw)*f*4.2*dt;
        if(canMove(nx,nz,.38)){person.x=nx;person.z=nz;}}
    }
    $('speed').textContent=Math.floor(Math.abs(car.v)*3.6).toString().padStart(3,'0');
    const x=car.driving?car.x:person.x,z=car.driving?car.z:person.z,a=car.driving?car.yaw:person.yaw;
    const back=camMode===0?12:camMode===1?23:4;const high=camMode===0?6.2:camMode===1?11:69;
    const tx=x-Math.sin(a)*back,tz=z-Math.cos(a)*back;
    camera.x=lerp(camera.x,tx,Math.min(1,dt*5.2));camera.y=lerp(camera.y,high,Math.min(1,dt*4.7));camera.z=lerp(camera.z,tz,Math.min(1,dt*5.2));
    clock+=dt;if(clock>.035){updateMaps();clock=0;}
  }
  let lastPlaceTime=0,lastPlaceLabel='';
  function updateMaps(){const x=car.driving?car.x:person.x,z=car.driving?car.z:person.z;
    const u=uvx(x),v=uvy(z),heading=car.driving?car.yaw:person.yaw;
    // City Explorer and the HUD minimap share the same map-pixel frame.
    cityExplorer?.updatePlayer(u,v);
    // Pass the exact WebGL player position to the map instead of separate rounded map pixels.
    miniMap?.drawWorld(x,z,W,H);
    // Only update the location name a few times per second. The map itself
    // follows the player every frame; the text changes only when it needs to.
    const placeLabel=$('minimap-location');
    if(placeLabel&&miniMap){
      const now=performance.now();
      if(now-lastPlaceTime>350){
        lastPlaceTime=now;
        const found=miniMap.locate(u,v);
        // Convert the exact in-game location back to approximate WGS84 coordinates
        // when the imported dataset has a valid geographic reference.
        const center=mapGeoCenter;
        const lat=center?center.lat-(v-H/2)*K/111195:null;
        const lon=center?center.lon+(u-W/2)*K/(111195*Math.cos(center.lat*Math.PI/180)):null;
        const coords=Number.isFinite(lat)&&Number.isFinite(lon)?`${lat.toFixed(5)}°N, ${lon.toFixed(5)}°E`:'';
        const label=(found.kind==='unknown'||found.kind==='unnamed')&&coords?coords:found.label;
        if(label!==lastPlaceLabel){placeLabel.textContent=label;lastPlaceLabel=label;}
        placeLabel.title=coords?`${found.label} · ${coords}`:found.label;
        $('location-text').textContent=`CURRENT POSITION · ${found.label}${coords?' · '+coords:''}`;
      }
    }
    const marker=$('minimap-dot');marker.style.transform=`translate(-50%, -50%) rotate(${(180-heading/rad)%360}deg)`;
    // Rotating with CSS 'rotate' separately could rotate the 50%-centering offset too.
    // A single translate-then-rotate transform keeps the marker pinned to the exact centre.
    // Coordinates are shown with the current road name above when available.
  }
  let pixelRatio=1;
  function resize(){pixelRatio=Math.min(devicePixelRatio||1,(matchMedia('(pointer: coarse)').matches?1.05:1.55));cv.width=Math.floor(innerWidth*pixelRatio);cv.height=Math.floor(innerHeight*pixelRatio);gl.viewport(0,0,cv.width,cv.height);}
  window.addEventListener('resize',resize);resize();
  function render(){gl.clearColor(.58,.76,.83,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!loaded)return;
    const a=car.driving?car.yaw:person.yaw,x=car.driving?car.x:person.x,z=car.driving?car.z:person.z;
    const target=[x+Math.sin(a)*(camMode===2?0:10),1.3,z+Math.cos(a)*(camMode===2?0:10)];
    const vp=mul(perspective((camMode===2?47:70)*rad,cv.width/cv.height,.1,1500),lookAt([camera.x,camera.y,camera.z],target));
    gl.useProgram(p);gl.uniformMatrix4fv(U.viewProj,false,vp);gl.uniform3f(U.cameraPos,camera.x,camera.y,camera.z);gl.bindVertexArray(vao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,groundTexture);gl.uniform1i(U.groundTex,0);gl.uniform2f(U.groundSize,W*K,H*K);
    gl.uniform1f(U.isGround,1);cube(0,-.12,0,W*K,.20,H*K,[1,1,1]);gl.uniform1f(U.isGround,0);
    if(cityMode)updateCityRoadMesh(x,z);
    // Real geometry, not just paint on a ground texture. This remains visible
    // even if browser texture filtering blurs the thin roads.
    // Slightly wider shoulder layer visually separates asphalt from terrain.
    // Different elevations prevent the coplanar flicker seen at road joins.
    if(shoulderMesh?.count){
      gl.disable(gl.CULL_FACE);gl.bindVertexArray(shoulderMesh.vao);
      gl.uniformMatrix4fv(U.model,false,IDENTITY);
      gl.uniform3fv(U.color,[.51,.53,.50]);
      gl.drawArrays(gl.TRIANGLES,0,shoulderMesh.count);
      gl.bindVertexArray(vao);gl.enable(gl.CULL_FACE);
    }
    if(roadMesh?.count){
      gl.disable(gl.CULL_FACE);gl.bindVertexArray(roadMesh.vao);
      gl.uniformMatrix4fv(U.model,false,IDENTITY);
      gl.uniform3fv(U.color,[.19,.23,.26]);
      gl.drawArrays(gl.TRIANGLES,0,roadMesh.count);
      gl.bindVertexArray(vao);gl.enable(gl.CULL_FACE);
    }
    for(const b of nearFromGrid(cityBlockGrid,blocks,x,z,185)){
      if(Math.abs(b.x-x)>175||Math.abs(b.z-z)>175)continue;
      if(cityMode && b.shape!=='rect' && b.shape!=='square' && !b.mesh)b.mesh=meshFor(b.shape,b.points);
      const c=colors[b.c]||colors[0];buildingSolid(b,b.h*.5,b.h,c);
      if(b.h>13)buildingSolid(b,b.h+.10,.18,roof,.18);
      drawBuildingDetails(b,Math.hypot(b.x-x,b.z-z));
      // Light floor-slab bands make floor count readable without high-poly models.
      if(Math.hypot(b.x-x,b.z-z)<85 && b.floors>1){
        const step=b.h/b.floors;
        for(let level=1;level<b.floors&&level<14;level++){
          buildingSolid(b,level*step,.105,[.46,.48,.46],.065);
        }
      }
    }
    for(const a of assets){if(Math.hypot(wx(a.x)-x,wz(a.y)-z)<160)drawAsset(a);}
    drawCar();if(!car.driving)drawPerson();
  }
  function loop(t){const dt=Math.min(.042,(t-last)/1000||.016);last=t;update(dt);render();requestAnimationFrame(loop);}requestAnimationFrame(loop);
  function start(){playing=true;$('start-screen').classList.add('hidden');$('hud').classList.remove('hidden');updateMaps();}
  $('start-btn').addEventListener('click',start);
  $('street-hide')?.addEventListener('click',()=>$('street-reference').hidden=true);
  $('street-opacity')?.addEventListener('input',e=>{
    $('street-reference-image').style.opacity=String(Number(e.target.value)/100);
  });
  $('fullscreen-btn').addEventListener('click',fullScreen);$('view-btn').addEventListener('click',viewMode);
  $('pause-btn').addEventListener('click',togglePause);$('map-btn').addEventListener('click',()=>toggleMap());
  $('close-map').addEventListener('click',()=>toggleMap(false));$('interact-btn').addEventListener('click',enterExit);
  window.addEventListener('keydown',e=>{
    const mapOpen=!$('map-overlay').classList.contains('hidden');
    const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName||'');
    if(mapOpen||typing){
      if(e.code==='Escape')toggleMap(false);
      else if(e.code==='KeyM'&&!typing)toggleMap(false);
      return;
    }
    if(keyMap[e.code]){keys[keyMap[e.code]]=true;e.preventDefault();}
    if(e.repeat)return;
    if(e.code==='KeyE')enterExit();if(e.code==='KeyM')toggleMap();if(e.code==='KeyV')viewMode();if(e.code==='KeyF')fullScreen();if(e.code==='Escape'){if(!$('map-overlay').classList.contains('hidden'))toggleMap(false);else if(playing)togglePause();}
  });
  window.addEventListener('keyup',e=>{if(keyMap[e.code]){keys[keyMap[e.code]]=false;e.preventDefault();}});
  window.addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){for(const k in keys)keys[k]=false;}});
  const rotateNotice=$('rotate-hint');
  const hintUpdate=()=>{if(rotateNotice)rotateNotice.hidden=!(matchMedia('(pointer: coarse)').matches&&innerHeight>innerWidth*1.15);};
  window.addEventListener('resize',hintUpdate);hintUpdate();
  $('hint-dismiss')?.addEventListener('click',()=>rotateNotice.hidden=true);

  for(const btn of document.querySelectorAll('[data-key]')){
    const key=btn.dataset.key;
    function down(e){e.preventDefault();keys[key]=true;btn.classList.add('active');btn.setPointerCapture?.(e.pointerId);}
    function up(e){e.preventDefault();keys[key]=false;btn.classList.remove('active');}
    btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('lostpointercapture',up);
  }
})();

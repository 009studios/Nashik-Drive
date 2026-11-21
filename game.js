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
  const W=1175,H=1280,K=.65,S=window.NashikShapes;
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
   uniform float isGround;uniform sampler2D groundTex;out vec4 pixel;
   void main(){vec3 col=color; if(isGround>.5){vec2 uv=vec2((vWorld.x/${(W*K).toFixed(3)})+.5,.5-(vWorld.z/${(H*K).toFixed(3)}));col=texture(groundTex,uv).rgb;}
    else{vec3 N=normalize(vNormal);float f=max(dot(N,normalize(vec3(.45,.94,.38))),0.);col*=.62+.38*f;}
    float dist=distance(vWorld,cameraPos);float haze=smoothstep(90.,280.,dist)*.34;
    col=mix(col,vec3(.65,.77,.78),haze);pixel=vec4(col,1.);}`;
  const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));gl.useProgram(p);
  const U={model:gl.getUniformLocation(p,'model'),viewProj:gl.getUniformLocation(p,'viewProj'),color:gl.getUniformLocation(p,'color'),cameraPos:gl.getUniformLocation(p,'cameraPos'),isGround:gl.getUniformLocation(p,'isGround'),groundTex:gl.getUniformLocation(p,'groundTex')};
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);
  const verts=[],inds=[];
  const sides=[[[0,0,1],[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]],[[0,0,-1],[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]],[[1,0,0],[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]]],[[-1,0,0],[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]]],[[0,1,0],[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]],[[0,-1,0],[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]]];
  for(const [n,corners] of sides){const start=verts.length/6;corners.forEach(v=>verts.push(...v,...n));inds.push(start,start+1,start+2,start,start+2,start+3);}
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);const ix=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ix);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(inds),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);gl.bindVertexArray(vao);
  function cube(x,y,z,sx,sy,sz,col,yaw=0){gl.uniformMatrix4fv(U.model,false,transform(x,y,z,sx,sy,sz,yaw));gl.uniform3fv(U.color,col);gl.drawElements(gl.TRIANGLES,inds.length,gl.UNSIGNED_SHORT,0);}
  const colors=[[.79,.74,.66],[.66,.7,.75],[.76,.65,.59],[.59,.70,.67],[.74,.73,.69]], roof=[.49,.53,.56],dark=[.15,.20,.23],carBody=[.13,.70,.59],glass=[.45,.68,.72],wheel=[.09,.13,.16],headlight=[.94,.89,.71];
  let blocks=[],assets=[],loaded=false,groundTexture=null;
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

  const img=new Image();
  const mapPromise=fetch('map_edits.json?v='+Date.now()).then(r=>r.ok?r.json():{}).catch(()=>({}));
  const blocksPromise=fetch('blocks.json?v='+Date.now()).then(r=>r.ok?r.json():Promise.reject(new Error('Building data missing'))).then(data=>{
    blocks=data.map(([u,v,w,d,h,c,angle=0,floors,kind='mixed',floorHeight,shape='rect',points=[]])=>({x:wx(u),z:wz(v),w:w*K,d:d*K,h,c,yaw:angle*rad,floors:Math.max(1,Math.round(floors||h/3.2)),kind,floorHeight:floorHeight||3.2,shape,points,mesh:(shape==='rect'||shape==='square')?null:meshFor(shape,points)}));
  });
  const assetsPromise=fetch('assets.json?v='+Date.now()).then(r=>r.ok?r.json():[]).then(data=>{assets=Array.isArray(data)?data:[]});
  const imagePromise=new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('terrain.png missing'));img.src='terrain.png';});
  Promise.all([mapPromise,blocksPromise,assetsPromise,imagePromise]).then(([edits])=>{
    if(edits&&typeof edits==='object')mapEdits={...mapEdits,...edits};
    const paint=document.createElement('canvas');paint.width=W;paint.height=H;const ctx=paint.getContext('2d');
    ctx.drawImage(img,0,0,W,H);
    for(const stroke of (mapEdits.roadStrokes||[])){
      if(!Array.isArray(stroke.points)||stroke.points.length<1)continue;
      ctx.strokeStyle=stroke.mode==='cover'?'#aaaB99':'#2b333b';
      ctx.lineWidth=Math.max(2,Number(stroke.width)||12);ctx.lineJoin='round';ctx.lineCap='round';
      ctx.beginPath();stroke.points.forEach(([u,v],i)=>i?ctx.lineTo(u,v):ctx.moveTo(u,v));
      if(stroke.points.length===1){const [u,v]=stroke.points[0];ctx.lineTo(u+.01,v+.01);}ctx.stroke();
    }
    groundTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,groundTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,paint);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.generateMipmap(gl.TEXTURE_2D);
    const [u,v,a]=mapEdits.spawn||[787,544,180];car.x=wx(u);car.z=wz(v);car.yaw=a*rad;
    person.x=car.x+3.4;person.z=car.z+1.5;camera.x=car.x;camera.z=car.z+16;
    loaded=true;
  }).catch(e=>{$('error').textContent='Could not load game files: '+e.message;$('error').hidden=false;});
  const SPAWN={x:wx(787),z:wz(544),yaw:Math.PI};
  const car={x:SPAWN.x,z:SPAWN.z,yaw:SPAWN.yaw,v:0,driving:true};
  const person={x:car.x+3.4,z:car.z+1.5,yaw:Math.PI};
  let camera={x:car.x,y:8,z:car.z+16},camMode=0,paused=false,playing=false,last=0,clock=0;
  const keys={forward:false,backward:false,left:false,right:false};const keyMap={KeyW:'forward',ArrowUp:'forward',KeyS:'backward',ArrowDown:'backward',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
  const names=['Close chase','Wide chase','High view'];
  function hitBuilding(x,z,pad){for(const b of blocks){
    // Collision with rotated rectangular masses, not only axis-aligned bounding boxes.
    if(Math.abs(x-b.x)>Math.max(b.w,b.d)+pad||Math.abs(z-b.z)>Math.max(b.w,b.d)+pad)continue;
    const co=Math.cos(b.yaw),si=Math.sin(b.yaw),dx=x-b.x,dz=z-b.z;
    const localX=co*dx-si*dz,localZ=si*dx+co*dz;
    if(b.shape==='rect'||b.shape==='square'){if(Math.abs(localX)<b.w*.5+pad&&Math.abs(localZ)<b.d*.5+pad)return true;}else if(S.pointInside(localX/b.w,localZ/b.d,S.footprint(b.shape,b.points)))return true;
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
  function viewMode(){camMode=(camMode+1)%3;$('view-btn').title='Camera: '+names[camMode];}
  function toggleMap(force){const dialog=$('map-overlay');const open=typeof force==='boolean'?force:dialog.classList.contains('hidden');dialog.classList.toggle('hidden',!open);$('map-btn').setAttribute('aria-pressed',open?'true':'false');if(open)updateMaps();}
  function togglePause(){paused=!paused;$('pause-btn').textContent=paused?'▶':'Ⅱ';$('pause-btn').setAttribute('aria-label',paused?'Resume':'Pause');$('state').textContent=paused?'PAUSED':'FREE ROAM';}
  async function fullScreen(){try{if(document.fullscreenElement){await document.exitFullscreen?.();return;}await document.documentElement.requestFullscreen?.();if(matchMedia('(pointer: coarse)').matches && screen.orientation?.lock)await screen.orientation.lock('landscape').catch(()=>{});}catch(e){/* unsupported browser: continue in viewport */}}
  function update(dt){if(!playing||paused||!loaded)return;
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
    clock+=dt;if(clock>.09){updateMaps();clock=0;}
  }
  function updateMaps(){const x=car.driving?car.x:person.x,z=car.driving?car.z:person.z;
    const u=clamp(uvx(x),0,W),v=clamp(uvy(z),0,H);
    const m=$('map-position');m.style.left=(u/W*100)+'%';m.style.top=(v/H*100)+'%';
    const miniMarker=$('minimap-dot');miniMarker.style.left=(u/W*100)+'%';miniMarker.style.top=(v/H*100)+'%';
    $('location-text').textContent=`MAP POSITION ${Math.round(u)} / ${Math.round(v)}`;
  }
  let pixelRatio=1;
  function resize(){pixelRatio=Math.min(devicePixelRatio||1,(matchMedia('(pointer: coarse)').matches?1.05:1.55));cv.width=Math.floor(innerWidth*pixelRatio);cv.height=Math.floor(innerHeight*pixelRatio);gl.viewport(0,0,cv.width,cv.height);}
  window.addEventListener('resize',resize);resize();
  function render(){gl.clearColor(.58,.76,.83,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!loaded)return;
    const a=car.driving?car.yaw:person.yaw,x=car.driving?car.x:person.x,z=car.driving?car.z:person.z;
    const target=[x+Math.sin(a)*(camMode===2?0:10),1.3,z+Math.cos(a)*(camMode===2?0:10)];
    const vp=mul(perspective((camMode===2?47:70)*rad,cv.width/cv.height,.1,1500),lookAt([camera.x,camera.y,camera.z],target));
    gl.useProgram(p);gl.uniformMatrix4fv(U.viewProj,false,vp);gl.uniform3f(U.cameraPos,camera.x,camera.y,camera.z);gl.bindVertexArray(vao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,groundTexture);gl.uniform1i(U.groundTex,0);
    gl.uniform1f(U.isGround,1);cube(0,-.12,0,W*K,.20,H*K,[1,1,1]);gl.uniform1f(U.isGround,0);
    for(const b of blocks){if(Math.abs(b.x-x)>175||Math.abs(b.z-z)>175)continue;
      const c=colors[b.c]||colors[0];buildingSolid(b,b.h*.5,b.h,c);
      if(b.h>13)buildingSolid(b,b.h+.10,.18,roof,.18);
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
  $('fullscreen-btn').addEventListener('click',fullScreen);$('view-btn').addEventListener('click',viewMode);
  $('pause-btn').addEventListener('click',togglePause);$('map-btn').addEventListener('click',()=>toggleMap());
  $('close-map').addEventListener('click',()=>toggleMap(false));$('interact-btn').addEventListener('click',enterExit);
  window.addEventListener('keydown',e=>{if(keyMap[e.code]){keys[keyMap[e.code]]=true;e.preventDefault();}
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

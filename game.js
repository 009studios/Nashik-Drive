/* NASHIK: FIRST DRIVE — BUILDING BLOCKOUT / v0.7
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
  const W=1175,H=1280,K=.65;
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
  let blocks=[],loaded=false,groundTexture=null;
  const img=new Image();
  const mapPromise=fetch('map_edits.json?v='+Date.now()).then(r=>r.ok?r.json():{}).catch(()=>({}));
  const blocksPromise=fetch('blocks.json?v='+Date.now()).then(r=>r.ok?r.json():Promise.reject(new Error('Building data missing'))).then(data=>{
    blocks=data.map(([u,v,w,d,h,c,angle=0])=>({x:wx(u),z:wz(v),w:w*K,d:d*K,h,c,yaw:angle*rad}));
  });
  const imagePromise=new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('terrain.png missing'));img.src='terrain.png';});
  Promise.all([mapPromise,blocksPromise,imagePromise]).then(([edits])=>{
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
    if(Math.abs(localX)<b.w*.5+pad&&Math.abs(localZ)<b.d*.5+pad)return true;
  }return false;}
  function insideBounds(x,z){return Math.abs(x)<W*K*.5-5 && Math.abs(z)<H*K*.5-5;}
  function canMove(x,z,pad){return insideBounds(x,z)&&!hitBuilding(x,z,pad);}
  // Static fuel station landmark is a deliberately simple block beside the starting point.
  function drawPump(){const x=wx(815),z=wz(541);
    cube(x,2.65,z,24,0.65,15,[.17,.39,.70]);cube(x,2.20,z,24,.18,15,[.98,.77,.28]);
    for(const dx of [-9,9])for(const dz of [-5,5])cube(x+dx,1.2,z+dz,.65,2.5,.65,[.82,.82,.77]);
    for(const dz of [-4,4])cube(x,0.84,z+dz,1.4,1.65,.9,[.30,.43,.57]);
  }
  function drawCar(){const x=car.x,z=car.z,a=car.yaw;const s=Math.sin(a),c=Math.cos(a);
    const part=(side,forward,height,sw,sh,sd,color)=>{const X=x+c*side+s*forward,Z=z-s*side+c*forward;cube(X,height,Z,sw,sh,sd,color,a);};
    part(0,0,.85,2.15,1.2,4.6,carBody);part(0,-.30,1.66,1.80,.70,2.75,carBody);part(0,.58,1.76,1.80,.52,.13,glass);
    for(const side of [-1,1])for(const f of [-1.42,1.40])part(side*1.12,f,.44,.36,.79,.73,wheel);
    for(const side of [-.73,.73]){part(side,2.33,.85,.48,.23,.1,headlight);part(side,-2.34,.85,.45,.24,.10,[.82,.15,.13]);}
  }
  function drawPerson(){const x=person.x,z=person.z;cube(x,.91,z,.67,1.23,.45,[.23,.40,.50],person.yaw);cube(x,1.80,z,.47,.52,.45,[.72,.52,.42],person.yaw);for(const d of [-.22,.22])cube(x+d,.32,z,.18,.6,.22,[.22,.25,.30]);}
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
      const c=colors[b.c];cube(b.x,b.h*.5,b.z,b.w,b.h,b.d,c,b.yaw);
      if(b.h>13)cube(b.x,b.h+.10,b.z,b.w+.27,.18,b.d+.27,roof,b.yaw);
    }
    if(Math.hypot(wx(815)-x,wz(541)-z)<210)drawPump();
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

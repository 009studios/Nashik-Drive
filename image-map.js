/* Image → 3D Map assistant: local, no upload, no paid API.
 * Color-region connected components approximate building blocks; roads remain a visible
 * raster reference and can optionally be cleaned using a sampled road color.
 * This is NOT satellite-image machine learning or survey-grade GIS reconstruction.
 */
(()=>{'use strict';
const W=1175,H=1280,byId=id=>document.getElementById(id);
const dlg=byId('image-map-modal');if(!dlg)return;
const canvas=byId('image-map-canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
const base=document.createElement('canvas');base.width=W;base.height=H;
const bc=base.getContext('2d',{willReadFrequently:true});
const terrain=document.createElement('canvas');terrain.width=W;terrain.height=H;
const tc=terrain.getContext('2d',{willReadFrequently:true});
const st={img:null,imgName:'',layout:'contain',mode:'building',colors:[],road:null,threshold:17,minSize:8,floors:3,blocks:[],roadCoverage:0,detected:false};
const update=(id,value)=>byId(id).textContent=value;
const setNotice=(s,type='')=>{const n=byId('image-map-note');n.textContent=s;n.dataset.type=type;};
const rgb=(p)=>`rgb(${p[0]}, ${p[1]}, ${p[2]})`;
function drawBase(){
 bc.fillStyle='#b6b6a7';bc.fillRect(0,0,W,H);
 if(!st.img)return;
 const s=st.layout==='contain'?Math.min(W/st.img.width,H/st.img.height):Math.max(W/st.img.width,H/st.img.height);
 const w=st.img.width*s,h=st.img.height*s;
 bc.drawImage(st.img,(W-w)/2,(H-h)/2,w,h);
 st.detected=false;st.blocks=[];makeTerrain();redraw();updateSummary();
}
function rgbDist(p,q){const a=p[0]-q[0],b=p[1]-q[1],c=p[2]-q[2];return a*a+b*b+c*c;}
function matches(p,samples,limit){for(let i=0;i<samples.length;i++)if(rgbDist(p,samples[i])<=limit)return i;return -1;}
function makeTerrain(){
 tc.clearRect(0,0,W,H);tc.drawImage(base,0,0);
 st.roadCoverage=0;
 if(!st.road||!byId('image-map-clean').checked)return;
 const input=bc.getImageData(0,0,W,H),out=tc.createImageData(W,H),d=input.data,o=out.data;
 const limit=(st.threshold+10)**2*3;
 let count=0;
 for(let i=0;i<W*H;i++){
   const a=i*4,p=[d[a],d[a+1],d[a+2]],isRoad=rgbDist(p,st.road)<=limit;
   if(isRoad)count++;
   o[a]=isRoad?46:175;o[a+1]=isRoad?55:176;o[a+2]=isRoad?62:163;o[a+3]=255;
 }
 st.roadCoverage=+(count/(W*H)*100).toFixed(1);
 tc.putImageData(out,0,0);
}
function redraw(){
 if(!canvas.width)return;
 ctx.clearRect(0,0,W,H);ctx.drawImage(terrain,0,0,W,H);
 if(st.detected){
  ctx.strokeStyle='#73ebaa';ctx.fillStyle='rgba(101,240,166,.32)';ctx.lineWidth=2;
  st.blocks.forEach(b=>{ctx.beginPath();ctx.rect(b[0]-b[2]/2,b[1]-b[3]/2,b[2],b[3]);ctx.fill();ctx.stroke();});
 }
}
function updateSummary(){
 update('image-map-detected',st.detected?st.blocks.length:'—');
 update('image-map-swatches',st.colors.length);
 update('image-map-road-count',st.road?'Selected':'Not selected');
 const colors=byId('image-map-chips');colors.innerHTML='';
 st.colors.forEach((c,i)=>{
  const btn=document.createElement('button');btn.className='image-map-chip';btn.type='button';btn.title='Remove building color '+(i+1);
  btn.style.setProperty('--chip',rgb(c));btn.innerHTML=`<span></span><b>×</b>`;btn.onclick=()=>{st.colors.splice(i,1);st.detected=false;st.blocks=[];redraw();updateSummary();};colors.appendChild(btn);
 });
 byId('image-map-road-swatch').style.background=st.road?rgb(st.road):'transparent';
 byId('image-map-generate').disabled=!st.img||!st.colors.length;
 byId('image-map-apply').disabled=!st.detected||!st.blocks.length;
}
function pick(e){
 if(!st.img)return;
 const r=canvas.getBoundingClientRect(),x=Math.max(0,Math.min(W-1,Math.floor((e.clientX-r.left)*W/r.width))),y=Math.max(0,Math.min(H-1,Math.floor((e.clientY-r.top)*H/r.height)));
 const p=bc.getImageData(x,y,1,1).data,clr=[p[0],p[1],p[2]];
 if(st.mode==='building'){
   if(st.colors.length>=10){setNotice('Maximum 10 building color samples. Remove one to add another.','warning');return;}
   if(st.colors.some(c=>rgbDist(c,clr)<64)){setNotice('That color is already sampled.','warning');return;}
   st.colors.push(clr);setNotice('Building color added. Sample other building colors, then Generate.');
 }else{
   st.road=clr;setNotice('Road color selected. Turn on Clean Roads if you want simplified streets.');
 }
 st.detected=false;st.blocks=[];makeTerrain();redraw();updateSummary();
}
function generate(){
 if(!st.colors.length||!st.img)return;
 const d=bc.getImageData(0,0,W,H).data;
 const mask=new Uint8Array(W*H),visited=new Uint8Array(W*H);
 const tol=st.threshold*st.threshold;
 for(let i=0;i<W*H;i++){
  const k=i*4,p=[d[k],d[k+1],d[k+2]];
  mask[i]=matches(p,st.colors,tol)+1;
 }
 const stack=new Int32Array(W*H),components=[];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const start=y*W+x;if(!mask[start]||visited[start])continue;
  const type=mask[start];let size=0,minX=x,minY=y,maxX=x,maxY=y,top=0;
  stack[top++]=start;visited[start]=1;
  while(top){
   const j=stack[--top],jx=j%W,jy=(j/W)|0;size++;
   if(jx<minX)minX=jx;if(jx>maxX)maxX=jx;if(jy<minY)minY=jy;if(jy>maxY)maxY=jy;
   const left=jx>0?j-1:-1,right=jx<W-1?j+1:-1,up=jy>0?j-W:-1,down=jy<H-1?j+W:-1;
   if(left>=0&&!visited[left]&&mask[left]===type){visited[left]=1;stack[top++]=left;}
   if(right>=0&&!visited[right]&&mask[right]===type){visited[right]=1;stack[top++]=right;}
   if(up>=0&&!visited[up]&&mask[up]===type){visited[up]=1;stack[top++]=up;}
   if(down>=0&&!visited[down]&&mask[down]===type){visited[down]=1;stack[top++]=down;}
  }
  let w=maxX-minX+1,h=maxY-minY+1;
  // Ignore isolated specks, lines, labels, park-sized regions and loosely shaped areas.
  if(w<st.minSize||h<st.minSize||w>170||h>170||size<w*h*.52||size>20000)continue;
  components.push({x:minX+w/2,y:minY+h/2,w,h,size,type:type-1});
 }
 components.sort((a,b)=>b.size-a.size);
 if(components.length>750)components.length=750;
 st.blocks=components.map((b,i)=>[
  +b.x.toFixed(2),+b.y.toFixed(2),b.w,b.h,+(3.2*st.floors).toFixed(2),b.type%5,0,st.floors,
  st.floors>3?'mixed':'residential',3.2,'rect',[],{windows:true,balconies:false,roof:i%4===0?'tank':'flat'}
 ]);
 st.detected=true;makeTerrain();redraw();updateSummary();
 if(st.blocks.length>=600)setNotice(`Detected ${st.blocks.length} buildings. Large worlds may run slowly on mobile. Consider a smaller map crop.`, 'warning');
 else if(!st.blocks.length)setNotice('No clear building regions found. Pick a different building color, lower minimum size or increase color tolerance.','warning');
 else setNotice(`Detected ${st.blocks.length} possible building footprints. Green outlines show the result. Check for false detections before applying.`);
}
function exportImage(){
 makeTerrain();
 // JPEG keeps the entire one-file world.json manageable for localStorage & mobile downloads.
 return terrain.toDataURL('image/jpeg',0.81);
}
function apply(){
 if(!st.detected||!st.blocks.length)return;
 if(st.road&&byId('image-map-clean').checked&&st.roadCoverage>52){setNotice('More than half the map matches your road color. Choose a more specific road color or turn off Clean Roads.','warning');return;}
 const replace=byId('image-map-replace').checked;
 const mode=replace?'replace':'merge';
 if(!confirm(`${replace?'Replace the current buildings':'Add to existing buildings'} with ${st.blocks.length} detected building blocks? Your previous map will still be available through Undo until you close the editor.`))return;
 const image=exportImage();
 const mapScale=Math.min(4,Math.max(.15,(Number(byId('image-map-width-metres').value)||764)/W));
 let spawn=[Math.round(W/2),Math.round(H/2),180];
 if(st.road){
  const pixels=bc.getImageData(0,0,W,H).data,limit=(st.threshold+8)**2*3;
  let best=1e10;
  for(let y=24;y<H-24;y+=4)for(let x=24;x<W-24;x+=4){
   const k=(y*W+x)*4,d=rgbDist([pixels[k],pixels[k+1],pixels[k+2]],st.road);
   if(d>limit)continue;
   if(st.blocks.some(b=>Math.abs(x-b[0])<b[2]/2+6&&Math.abs(y-b[1])<b[3]/2+6))continue;
   const distance=(x-W/2)**2+(y-H/2)**2;if(distance<best){best=distance;spawn=[x,y,180];}
  }
 }
 const event=new CustomEvent('image-map:apply',{detail:{blocks:st.blocks,mapImage:image,mode,spawn,mapScale}});
 window.dispatchEvent(event);
 dlg.hidden=true;document.body.classList.remove('image-map-open');
}
async function useImage(img,name){
 st.img=img;st.imgName=name;st.blocks=[];st.detected=false;
 update('image-map-filename',`${name} · ${img.naturalWidth} × ${img.naturalHeight}`);
 drawBase();setNotice('Choose “Building color” and click inside a building footprint. Add more colors if needed, then Generate.');
}
async function loadFile(file){
 if(!file)return;
 st.colors=[];st.road=null;st.detected=false;st.blocks=[];updateSummary();
 if(!/^image\/(png|jpeg|webp)$/.test(file.type)){setNotice('Please upload a PNG, JPG or WebP image.','warning');return;}
 if(file.size>16*1024*1024){setNotice('Image is too large. Please use an image below 16 MB.','warning');return;}
 const u=URL.createObjectURL(file),img=new Image();
 img.onload=()=>{URL.revokeObjectURL(u);useImage(img,file.name);};
 img.onerror=()=>{URL.revokeObjectURL(u);setNotice('Could not read that image.','warning');};img.src=u;
}
function open(){dlg.hidden=false;document.body.classList.add('image-map-open');canvas.width=W;canvas.height=H;redraw();}
function close(){dlg.hidden=true;document.body.classList.remove('image-map-open');}
byId('image-map-open').onclick=open;
byId('image-map-close').onclick=close;
byId('image-map-cancel').onclick=close;
byId('image-map-upload').addEventListener('change',e=>{loadFile(e.target.files[0]);e.target.value='';});
byId('image-map-demo').onclick=()=>{const img=new Image();img.onload=()=>{
 st.colors=[[197,169,146],[137,169,182],[151,185,170],[201,157,148]];
 st.road=[43,51,59];useImage(img,'Existing Nashik map (demo)');
 updateSummary();
 };img.src='map_preview.png';};
byId('image-map-canvas').addEventListener('click',pick);
dlg.querySelectorAll('[data-sample]').forEach(btn=>{btn.onclick=()=>{st.mode=btn.dataset.sample;dlg.querySelectorAll('[data-sample]').forEach(e=>e.classList.toggle('active',e===btn));};});
byId('image-map-tolerance').oninput=e=>{st.threshold=+e.target.value;update('image-map-tolerance-value',st.threshold);st.detected=false;updateSummary();redraw();};
byId('image-map-min-size').oninput=e=>{st.minSize=+e.target.value;update('image-map-min-size-value',st.minSize);st.detected=false;updateSummary();redraw();};
byId('image-map-floors').onchange=e=>{st.floors=Math.max(1,Math.min(20,+e.target.value||3));st.detected=false;updateSummary();redraw();};
byId('image-map-clean').onchange=()=>{makeTerrain();redraw();if(st.road)setNotice(`Clean road preview: ${st.roadCoverage}% of map pixels match the sample.`);};
byId('image-map-layout').onchange=e=>{st.layout=e.target.value;drawBase();};
byId('image-map-generate').onclick=()=>{generate();};
byId('image-map-apply').onclick=apply;
dlg.addEventListener('click',e=>{if(e.target===dlg)close();});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!dlg.hidden)close();});
updateSummary();
})();

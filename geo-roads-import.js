/* Owner-only GeoJSON road importer UI. Roads are georeferenced, no map scraping. */
(()=>{'use strict';
const $=id=>document.getElementById(id),G=window.NashikGeoRoads;
const modal=$('geo-modal'),cv=$('geo-preview'),ctx=cv.getContext('2d');
let parsed=null,projected=null,reference=new Image(),refImage='',oldScale=.65;
const params=['geo-offset-x','geo-offset-y','geo-rotation','geo-reference-opacity'];
function note(msg,error=false){$('geo-status').textContent=msg;$('geo-status').classList.toggle('error',error);}
function openModal(data){refImage=data.mapImage||'map_preview.png';oldScale=data.mapScale||.65;reference=new Image();reference.onload=draw;reference.src=refImage;
  modal.hidden=false;document.body.classList.add('geo-open');draw();}
function close(){modal.hidden=true;document.body.classList.remove('geo-open');}
function draw(){ctx.clearRect(0,0,cv.width,cv.height);ctx.fillStyle='#a6b4a4';ctx.fillRect(0,0,cv.width,cv.height);
  const alpha=Number($('geo-reference-opacity').value)/100;
  if(reference.complete&&reference.naturalWidth&&alpha>0){ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(reference,0,0,cv.width,cv.height);ctx.restore();}
  if(projected){G.draw(ctx,projected,{highlight:true});if($('geo-junctions').checked){ctx.fillStyle='#e7ba54';for(const [x,y] of projected.junctions){ctx.beginPath();ctx.arc(x,y,2.6,0,2*Math.PI);ctx.fill();}}}
}
function refresh(){if(!parsed){draw();return;}
  try{const mode=$('geo-import-mode').value;
    const options={width:cv.width,height:cv.height,rotation:Number($('geo-rotation').value),offsetX:Number($('geo-offset-x').value),offsetY:Number($('geo-offset-y').value)};
    if(mode==='overlay')options.metresPerPixel=oldScale;
    projected=G.project(parsed,options);projected.geoTransform={rotation:options.rotation,offsetX:options.offsetX,offsetY:options.offsetY};$('geo-apply').disabled=false;
    $('geo-count').textContent=`${projected.roads.length} roads · ${projected.junctions.length} detected connection points · ${projected.metresPerPixel.toFixed(3)} m/pixel`;
    note(mode==='replace'?'New world: road positions and scale come directly from geographic coordinates.':'Overlay: uses your OLD image scale. Alignment is approximate until calibrated to known points.');
  }catch(e){projected=null;$('geo-apply').disabled=true;note(e.message,true);}draw();}
$('geo-import-open').onclick=()=>window.dispatchEvent(new CustomEvent('geo-roads:request-open'));
$('geo-close').onclick=$('geo-cancel').onclick=close;
modal.addEventListener('click',e=>{if(e.target===modal)close();});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)close();});
window.addEventListener('geo-roads:open',e=>openModal(e.detail||{}));
$('geo-file').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>12*1024*1024){note('The file is over 12 MB. Export a smaller area.',true);return;}
  try{parsed=G.parseGeoJSON(JSON.parse(await f.text()));$('geo-file-name').textContent=f.name;note(`${parsed.roads.length} roads found. Review their positions in the preview.`);refresh();}
  catch(err){parsed=null;projected=null;$('geo-apply').disabled=true;$('geo-file-name').textContent='No valid file';note(err.message,true);draw();}
};
for(const id of params)$(id).addEventListener('input',refresh);
for(const id of ['geo-import-mode','geo-junctions'])$(id).addEventListener('change',refresh);
$('geo-reference-opacity').value=0;
$('geo-import-mode').onchange=()=>{
  $('geo-reference-opacity').value=$('geo-import-mode').value==='overlay'?60:0;refresh();
};
$('geo-apply').onclick=()=>{if(!projected)return;
 const mode=$('geo-import-mode').value;
 if(mode==='replace'&&!confirm('Create a NEW road-first world? This will clear the 180 old building blocks, props and manual painted roads. Your current world will download as a backup first, and Undo also works.'))return;
 if(mode==='overlay'&&!confirm('Overlay mapped roads on the existing image? They may not line up until the image is properly calibrated.'))return;
 const blank=document.createElement('canvas');blank.width=cv.width;blank.height=cv.height;
 const c=blank.getContext('2d');c.fillStyle='#a6b4a4';c.fillRect(0,0,blank.width,blank.height);
 const image=mode==='replace'?blank.toDataURL('image/jpeg',.80):null;
 window.dispatchEvent(new CustomEvent('geo-roads:apply',{detail:{mode,roadNetwork:projected,mapImage:image}}));close();
};
})();

/* Owner-only, in-browser GeoJSON combined road and building import */
(()=>{'use strict';
const $=id=>document.getElementById(id),G=window.NashikGeoRoads,B=window.NashikGeoBuildings,cv=$('city-canvas'),ctx=cv.getContext('2d');
let parsed=null,existing=null,preview=null;
function feedback(msg,error=false){const el=$('city-summary');el.textContent=msg;el.classList.toggle('error',error);$('city-apply').disabled=error||!preview?.blocks?.length;}
function draw(){ctx.fillStyle='#a6b4a4';ctx.fillRect(0,0,cv.width,cv.height);
 const net=preview?.network||existing;
 if(net?.roads?.length)G.draw(ctx,net,{metresPerPixel:net.metresPerPixel});
 if(preview?.blocks?.length){ctx.fillStyle='#5ae7a955';ctx.strokeStyle='#37a77c';ctx.lineWidth=1.3;
  for(const b of preview.blocks){const [x,y,w,d,,,,,,,shape,pts]=b;if(!pts?.length)continue;ctx.beginPath();pts.forEach(([px,py],i)=>{const xx=x+px*w,yy=y+py*d;i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);});ctx.closePath();ctx.fill();ctx.stroke();}}
 const sp=preview?.spawn||preview?.currentSpawn;if(sp){ctx.beginPath();ctx.fillStyle='#45eda7';ctx.arc(sp[0],sp[1],7,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f5fff9';ctx.lineWidth=2;ctx.stroke();}
}
function refresh(){if(!parsed){preview=null;feedback('Choose a GeoJSON file to preview buildings.',true);draw();return;}
 try{
  const mode=$('city-mode').value;
  let network;
  if(mode==='existing'){
   if(!existing?.roads?.length)throw new Error('No imported road world found. Choose New world from roads + buildings, or import the saved road world.json into Studio first.');
   network=existing;
  }else{
   if(!parsed.roadsGeoJSON.features.length)throw new Error('This file contains buildings but no roads. Export both highway ways and building ways in one GeoJSON file.');
   const parsedRoads=G.parseGeoJSON(parsed.roadsGeoJSON);
   network=G.project(parsedRoads,{width:1175,height:1280});
   network.geoTransform={rotation:0,offsetX:0,offsetY:0};
  }
  if(!parsed.footprints.length)throw new Error('No OSM building polygons detected. Export ways with the building tag. Your selected area may have incomplete mapping.');
  const result=B.project(parsed,network,{floors:Number($('city-floors').value),maxBuildings:Number($('city-limit').value),avoidRoads:$('city-avoid').checked});
  if(!result.blocks.length)throw new Error(`Found ${parsed.footprints.length} footprints, but none fit this road world. Try a matching geographic area or untick road-overlap filtering.`);
  preview={...result,network,mode,currentSpawn:window.__nashikCitySpawn||null};
  const s=result.statistics;
  feedback(`${s.created} editable buildings ready from ${s.total} mapped footprints.\n${s.outside} outside current world · ${s.roadOverlap} near roads · ${s.small} too small · ${s.invalid} unsupported.\nRoad network: ${network.roads.length} paths · map scale ${network.metresPerPixel.toFixed(2)} m/pixel.`);
 }catch(e){preview=null;feedback(e.message,true);}draw();
}
function open(){parsed=null;preview=null;existing=null;$('city-file').value='';$('city-modal').hidden=false;document.body.classList.add('geo-open');window.dispatchEvent(new CustomEvent('geo-city:request-world'));}
function close(){$('city-modal').hidden=true;document.body.classList.remove('geo-open');}
$('city-open').addEventListener('click',open);$('city-close').addEventListener('click',close);$('city-cancel').addEventListener('click',close);
$('city-modal').addEventListener('click',e=>{if(e.target===$('city-modal'))close();});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('city-modal').hidden)close();});
window.addEventListener('geo-city:world',e=>{existing=e.detail?.roadNetwork||null;window.__nashikCitySpawn=e.detail?.spawn||null;
 $('city-mode').value=existing?.roads?.length?'existing':'new';refresh();});
$('city-file').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;
 if(file.size>18*1024*1024){feedback('File over 18 MB. Export a smaller area.',true);return;}
 try{parsed=B.parse(JSON.parse(await file.text()));refresh();}catch(err){parsed=null;preview=null;feedback(err.message,true);draw();}
});
for(const name of ['city-floors','city-limit','city-avoid'])$(name).addEventListener('input',refresh);
$('city-mode').addEventListener('change',refresh);
$('city-apply').addEventListener('click',()=>{if(!preview?.blocks?.length)return;
 const destructive=preview.mode==='new'||$('city-replace').checked;
 if(destructive&&!confirm(preview.mode==='new'?'Create a new roads + buildings world? Existing roads, buildings and props will be backed up before replacement.':'Replace currently placed buildings with these imported footprints? Your road network and props will stay. A backup will download first.'))return;
 window.dispatchEvent(new CustomEvent('geo-city:apply',{detail:{blocks:preview.blocks,network:preview.network,mode:preview.mode,replaceBuildings:$('city-replace').checked}}));close();
});
})();

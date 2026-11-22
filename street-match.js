/* Owner-only local photo comparison. Images never enter world.json. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const state={x:null,y:null,heading:180};
const photoKey='nashik-street-match-ref';
const pointKey='nashik-street-match-camera';
const dialog=$('street-modal'),preview=$('street-photo-preview'),placeholder=$('street-photo-placeholder');
function message(v){$('street-message').textContent=v;}
function render(){
  $('street-coords').textContent=state.x==null?'Not selected':`X ${state.x.toFixed(1)} · Y ${state.y.toFixed(1)}`;
  $('street-angle').value=String(state.heading);
  $('street-angle-output').textContent=state.heading+'°';
  $('street-preview-game').disabled=state.x==null;
}
function show(){dialog.hidden=false;window.dispatchEvent(new Event('street-match:request-position'));render();}
function close(){dialog.hidden=true;}
try{
 const previous=JSON.parse(localStorage.getItem(pointKey)||'null');
 if(previous&&Number.isFinite(previous.x)&&Number.isFinite(previous.y)&&Number.isFinite(previous.heading))Object.assign(state,previous);
 const photo=localStorage.getItem(photoKey);
 if(photo?.startsWith('data:image/')){preview.src=photo;preview.hidden=false;placeholder.hidden=true;}
}catch(e){message('Local photo storage is unavailable. The position preview still works.');}
window.addEventListener('street-match:position',e=>{
 if(state.x!==null)return;
 const spawn=e.detail?.spawn;
 if(Array.isArray(spawn)){state.x=Number(spawn[0]);state.y=Number(spawn[1]);state.heading=((Math.round(Number(spawn[2]))%360)+360)%360;render();}
});
window.addEventListener('street-match:picked',e=>{
 if(!Number.isFinite(e.detail?.x)||!Number.isFinite(e.detail?.y))return;
 state.x=e.detail.x;state.y=e.detail.y;
 try{localStorage.setItem(pointKey,JSON.stringify(state));}catch(e){}
 dialog.hidden=false;message('Camera point selected. Set the heading and preview.');render();
});
$('street-match-open').onclick=show;
$('street-close').onclick=close;
dialog.addEventListener('click',e=>{if(e.target===dialog)close();});
$('street-pick').onclick=()=>{close();window.dispatchEvent(new Event('street-match:pick-start'));};
$('street-angle').oninput=e=>{
 state.heading=Number(e.target.value);render();
 try{localStorage.setItem(pointKey,JSON.stringify(state));}catch(e){}
};
$('street-photo-file').onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 if(!file.type.startsWith('image/')||file.size>15*1024*1024){message('Select a PNG, JPEG or WebP smaller than 15 MB.');return;}
 try{
   const url=URL.createObjectURL(file),img=new Image();
   await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
   const ratio=Math.min(1,1100/img.naturalWidth,850/img.naturalHeight);
   const cv=document.createElement('canvas');cv.width=Math.round(img.naturalWidth*ratio);cv.height=Math.round(img.naturalHeight*ratio);
   const ctx=cv.getContext('2d');ctx.drawImage(img,0,0,cv.width,cv.height);
   const data=cv.toDataURL('image/jpeg',.72);URL.revokeObjectURL(url);
   localStorage.setItem(photoKey,data);preview.src=data;preview.hidden=false;placeholder.hidden=true;
   message('Photo saved in this browser only. It is not included in the game ZIP or exported world.');
 }catch(err){message('Could not store the photo. Try a smaller image, or free browser storage.');}
 e.target.value='';
};
$('street-preview-game').onclick=()=>{
 if(state.x==null||state.y==null)return;
 try{localStorage.setItem(pointKey,JSON.stringify(state));}catch(e){}
 // Preview only; does not move the permanent spawn or save changes to world.json.
 const qp=new URLSearchParams({preview:'1',street:'1',sx:state.x.toFixed(2),sy:state.y.toFixed(2),heading:String(state.heading)});
 window.open('index.html?'+qp.toString(),'_blank','noopener');
};
render();
})();

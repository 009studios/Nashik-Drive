/* Nashik First Drive — City Explorer v2.1
   Uses only locally generated road/building geometry. No remote map tiles.
   Allows inspecting the complete map and teleporting to an existing mapped road.
   The in-game minimap remains a separate, player-following view.
*/
(function(root){
  'use strict';
  const W=1175,H=1280,BUCKET=28;
  const valid=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1]);
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const districts=[
    {name:'College Road',lat:20.003805,lon:73.760559},
    {name:'Panchavati',lat:20.007357,lon:73.792992},
    {name:'Satpur',lat:20.00049,lon:73.73765},
    {name:'Nashik Road',lat:19.94806,lon:73.84208}
  ];
  function projection(lat,lon,center,metresPerPixel){
    const c=center||{lat:20,lon:73.79};
    return [W/2+(lon-c.lon)*111195*Math.cos(c.lat*Math.PI/180)/metresPerPixel,
            H/2-(lat-c.lat)*111195/metresPerPixel];
  }
  function createRoadIndex(roads,cellSize=BUCKET){
    const cells=new Map(),usable=[];
    roads.forEach((r,i)=>{
      const points=(r.points||[]).filter(valid);
      if(points.length<2)return;
      const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
      const bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
      usable[i]={road:r,points,bounds};
      const a=Math.floor(bounds[0]/cellSize),b=Math.floor(bounds[2]/cellSize);
      const c=Math.floor(bounds[1]/cellSize),d=Math.floor(bounds[3]/cellSize);
      // A single very long path should not create an unbounded number of cells.
      if((b-a+1)*(d-c+1)>1800)return;
      for(let x=a;x<=b;x++)for(let y=c;y<=d;y++){
        const key=x+','+y;
        if(!cells.has(key))cells.set(key,[]);
        cells.get(key).push(i);
      }
    });
    const indexed={cells,usable,cellSize};
    indexed.query=(x0,y0,x1,y1)=>{
      const found=new Set();
      for(let x=Math.floor(x0/cellSize);x<=Math.floor(x1/cellSize);x++)
        for(let y=Math.floor(y0/cellSize);y<=Math.floor(y1/cellSize);y++)
          for(const i of cells.get(x+','+y)||[])found.add(i);
      return [...found];
    };
    return indexed;
  }
  function nearestRoad(index,u,v,maxDistance=Infinity){
    const scan=Number.isFinite(maxDistance)?maxDistance:1500;
    let indices=index.query(u-scan,v-scan,u+scan,v+scan);
    // Search the complete collection only when a caller deliberately requests it.
    if(!indices.length&&!Number.isFinite(maxDistance))indices=index.usable.map((_,i)=>i);
    let nearest=null,bestDist=maxDistance;
    for(const i of indices){
      const item=index.usable[i];if(!item)continue;
      const pts=item.points;
      for(let k=0;k<pts.length-1;k++){
        const a=pts[k],b=pts[k+1],dx=b[0]-a[0],dy=b[1]-a[1];
        const t=clamp(((u-a[0])*dx+(v-a[1])*dy)/(dx*dx+dy*dy||1),0,1);
        const x=a[0]+t*dx,y=a[1]+t*dy,d=Math.hypot(u-x,v-y);
        if(d<bestDist){bestDist=d;nearest={u:x,v:y,heading:(Math.atan2(dx,dy)*180/Math.PI+360)%360,
          road:item.road,distancePixels:d};}
      }
    }
    return nearest;
  }
  function indexBuildings(blocks,cellSize=BUCKET){
    const cells=new Map();
    blocks.forEach((b,i)=>{
      if(!Array.isArray(b)||!Number.isFinite(b[0])||!Number.isFinite(b[1]))return;
      const hx=Math.max(0,Number(b[2])||0)/2,hy=Math.max(0,Number(b[3])||0)/2;
      const a=Math.floor((b[0]-hx)/cellSize),c=Math.floor((b[1]-hy)/cellSize);
      const bb=Math.floor((b[0]+hx)/cellSize),d=Math.floor((b[1]+hy)/cellSize);
      if((bb-a+1)*(d-c+1)>40)return;
      for(let x=a;x<=bb;x++)for(let y=c;y<=d;y++){
        const key=x+','+y;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);
      }
    });
    return {query(x0,y0,x1,y1){const found=new Set();
      for(let x=Math.floor(x0/cellSize);x<=Math.floor(x1/cellSize);x++)
        for(let y=Math.floor(y0/cellSize);y<=Math.floor(y1/cellSize);y++)
          for(const i of cells.get(x+','+y)||[])found.add(i);
      return [...found];}};
  }
  function create(opts){
    const c=opts.canvas,ctx=c?.getContext?.('2d',{alpha:false});
    if(!ctx)return null;
    const rds=opts.roads||[],blks=opts.blocks||[],base=opts.baseCanvas;
    const roadIndex=createRoadIndex(rds),buildingIndex=indexBuildings(blks);
    const K=Math.max(.15,Number(opts.metresPerPixel)||.65);
    const center=opts.center||{lat:20,lon:73.79};
    const $=id=>root.document?.getElementById(id);
    const canvasStage=$('explorer-stage');
    const hint=$('explorer-message'),selectionText=$('explorer-selection'),goButton=$('map-teleport');
    const results=$('map-results'),search=$('map-search');
    const setMessage=text=>{if(hint)hint.textContent=text;};
    let opened=false,zoom=1,focus=[W/2,H/2],selected=null,player=[W/2,H/2],drag=null;
    let screenWidth=0,screenHeight=0,scale=1;
    function measure(){
      const rect=c.getBoundingClientRect();
      screenWidth=Math.max(1,rect.width||canvasStage?.clientWidth||600);
      screenHeight=Math.max(1,rect.height||canvasStage?.clientHeight||560);
      const dpr=Math.min(2,root.devicePixelRatio||1);
      const tw=Math.round(screenWidth*dpr),th=Math.round(screenHeight*dpr);
      if(c.width!==tw||c.height!==th){c.width=tw;c.height=th;}
      scale=Math.min(screenWidth/W,screenHeight/H)*zoom;
      return dpr;
    }
    function fromScreen(sx,sy){return [focus[0]+(sx-screenWidth/2)/scale,focus[1]+(sy-screenHeight/2)/scale];}
    function screen(u,v){return [screenWidth/2+(u-focus[0])*scale,screenHeight/2+(v-focus[1])*scale];}
    function render(){
      if(!opened)return;
      const dpr=measure();
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.fillStyle='#a9b7a9';ctx.fillRect(0,0,screenWidth,screenHeight);
      ctx.save();ctx.translate(screenWidth/2,screenHeight/2);ctx.scale(scale,scale);ctx.translate(-focus[0],-focus[1]);
      if(base)ctx.drawImage(base,0,0,W,H);
      const x0=focus[0]-screenWidth/(2*scale),x1=focus[0]+screenWidth/(2*scale);
      const y0=focus[1]-screenHeight/(2*scale),y1=focus[1]+screenHeight/(2*scale);
      // At close zoom, redraw local vectors over the overview image for crisp streets.
      if(zoom>=2.4){
        const ids=roadIndex.query(x0-4,y0-4,x1+4,y1+4);
        ctx.strokeStyle='#283a42';ctx.lineJoin='round';ctx.lineCap='round';
        for(const i of ids){const info=roadIndex.usable[i];if(!info)continue;
          ctx.lineWidth=Math.max(.25,(Number(info.road.widthM)||6)/K);
          ctx.beginPath();info.points.forEach(([x,y],j)=>j?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
        if(zoom>=5){
          ctx.fillStyle='#778f83';ctx.strokeStyle='#536f66';ctx.lineWidth=Math.max(.06,.5/scale);
          for(const i of buildingIndex.query(x0,y0,x1,y1)){
            const b=blks[i],poly=opts.shapes?.worldPoints?.(b);if(!poly||poly.length<3)continue;
            ctx.beginPath();poly.forEach(([x,y],j)=>j?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();ctx.stroke();
          }
        }
      }
      ctx.restore();
      function marker(loc,color,outer){const [x,y]=screen(loc[0],loc[1]);if(!Number.isFinite(x+y))return;
        ctx.beginPath();ctx.arc(x,y,outer,0,2*Math.PI);ctx.fillStyle='rgba(9,35,39,.45)';ctx.fill();
        ctx.beginPath();ctx.arc(x,y,outer-3,0,2*Math.PI);ctx.fillStyle=color;ctx.fill();
        ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke();}
      marker(player,'#42edbd',9);
      if(selected){marker([selected.u,selected.v],'#f5be70',11);
        const [px,py]=screen(selected.u,selected.v);
        if(px>=0&&px<=screenWidth&&py>=0&&py<=screenHeight){
          ctx.fillStyle='#10242e';ctx.font='bold 12px system-ui';
          const label=(selected.label||selected.road?.name||'Selected road').slice(0,45);
          const width=ctx.measureText(label).width+14;
          ctx.fillRect(clamp(px+13,5,screenWidth-width-5),clamp(py-25,7,screenHeight-29),width,23);
          ctx.fillStyle='#eefaf5';ctx.fillText(label,clamp(px+20,12,screenWidth-width+2),clamp(py-9,23,screenHeight-12));
        }
      }
      // Human-readable distance bar, valid at every zoom level.
      const metresPerScreenPixel=K/scale;
      const ideal=metresPerScreenPixel*95;
      const exp=Math.pow(10,Math.floor(Math.log10(ideal||1)));
      const nice=[1,2,5,10].map(v=>v*exp).filter(v=>v<=ideal).pop()||exp;
      const bw=nice/metresPerScreenPixel;
      ctx.strokeStyle='#173d40';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(20,screenHeight-27);ctx.lineTo(20+bw,screenHeight-27);ctx.stroke();
      ctx.fillStyle='#173d40';ctx.font='bold 12px system-ui';ctx.fillText(nice>=1000?(nice/1000)+' km':nice+' m',20,screenHeight-34);
      $('map-zoom-label').textContent=Math.round(zoom*100)+'%';
    }
    function select(point,label){
      selected=point?{...point,label:label||(point.road?.name||'Unlabeled road')}:null;
      if(selectionText)selectionText.textContent=selected?(selected.label+' · '+Math.round(selected.distancePixels*K)+' m from selection'):'Choose a road to inspect';
      if(goButton)goButton.disabled=!selected;
      if(selected)focus=[selected.u,selected.v];
      render();
      return selected;
    }
    function choose(u,v,label,maxMetres=500){
      const found=nearestRoad(roadIndex,u,v,maxMetres/K);
      if(!found){select(null);setMessage('No mapped road nearby. Select a street within the imported area.');return null;}
      setMessage('Selected a mapped road. Teleporting will move your car there without changing the saved world.');
      return select(found,label);
    }
    function chooseDistrict(d){
      const [u,v]=projection(d.lat,d.lon,center,K);
      if(u<0||v<0||u>W||v>H){setMessage(d.name+' is outside this map extract.');return null;}
      const found=choose(u,v,d.name,900);
      if(found){zoom=Math.max(zoom,4);render();}
      return found;
    }
    function chooseNamedRoad(q){
      const normalized=q.trim().toLocaleLowerCase();if(normalized.length<2)return [];
      const named=new Map();
      for(const road of rds){const name=typeof road.name==='string'?road.name.trim():'';
        if(!name||!name.toLocaleLowerCase().includes(normalized))continue;
        const first=road.points?.[Math.floor(road.points.length/2)];if(!valid(first))continue;
        const key=name.toLocaleLowerCase();if(!named.has(key))named.set(key,{name,u:first[0],v:first[1]});
        if(named.size>=35)break;
      }
      return [...named.values()].slice(0,12);
    }
    function updateResults(value){
      if(!results)return;
      results.replaceChildren();
      const matches=chooseNamedRoad(value);
      if(!value.trim()){const p=root.document.createElement('p');p.textContent='Search roads from the imported map, or choose a district.';results.appendChild(p);return;}
      if(!matches.length){const p=root.document.createElement('p');p.textContent='No matching named roads in this map.';results.appendChild(p);return;}
      matches.forEach(result=>{
        const b=root.document.createElement('button');b.type='button';b.className='explorer-result';b.textContent=result.name;
        b.addEventListener('click',()=>{choose(result.u,result.v,result.name,500);zoom=Math.max(zoom,6);render();});
        results.appendChild(b);
      });
    }
    let gestures=0;
    c.addEventListener('pointerdown',e=>{
      if(!opened)return;
      const rect=c.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,
        initialX:e.clientX,initialY:e.clientY,origin:[...focus],moved:false};
      c.setPointerCapture?.(e.pointerId);
    });
    c.addEventListener('pointermove',e=>{
      if(!drag||drag.id!==e.pointerId)return;
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(Math.hypot(e.clientX-drag.initialX,e.clientY-drag.initialY)>6)drag.moved=true;
      focus=[drag.origin[0]-dx/scale,drag.origin[1]-dy/scale];
      render();
    });
    function stopDrag(e){
      if(!drag||drag.id!==e.pointerId)return;
      const wasClick=!drag.moved;
      drag=null;
      if(wasClick){
        const r=c.getBoundingClientRect();const [u,v]=fromScreen(e.clientX-r.left,e.clientY-r.top);
        choose(u,v,null,Math.max(100,240/zoom));
      }
    }
    c.addEventListener('pointerup',stopDrag);c.addEventListener('pointercancel',()=>drag=null);
    c.addEventListener('wheel',e=>{
      if(!opened)return;e.preventDefault();
      const rect=c.getBoundingClientRect(),px=e.clientX-rect.left,py=e.clientY-rect.top;
      const [u,v]=fromScreen(px,py);
      zoom=clamp(zoom*(e.deltaY<0?1.25:.8),1,24);
      measure();focus=[u-(px-screenWidth/2)/scale,v-(py-screenHeight/2)/scale];render();
    },{passive:false});
    function applyZoom(factor){zoom=clamp(zoom*factor,1,24);render();}
    $('map-zoom-in')?.addEventListener('click',()=>applyZoom(1.7));
    $('map-zoom-out')?.addEventListener('click',()=>applyZoom(1/1.7));
    $('map-fit')?.addEventListener('click',()=>{zoom=1;focus=[W/2,H/2];render();});
    $('map-locate')?.addEventListener('click',()=>{focus=[...player];zoom=Math.max(zoom,6);render();});
    search?.addEventListener('input',e=>updateResults(e.target.value));
    $('map-teleport')?.addEventListener('click',()=>{
      if(!selected)return;
      opts.onTeleport?.({u:selected.u,v:selected.v,heading:selected.heading,label:selected.label});
    });
    const panel=$('explorer-districts');
    if(panel){panel.replaceChildren();for(const d of (opts.cityMode?districts:[])){
      const b=root.document.createElement('button');b.type='button';b.textContent=d.name;
      b.addEventListener('click',()=>chooseDistrict(d));panel.appendChild(b);
    }}
    updateResults('');
    function updatePlayer(u,v){if(!Number.isFinite(u+v))return;player=[u,v];if(opened)render();}
    function open(u,v){opened=true;player=[u,v];if(!selected)focus=[u,v];
      zoom=1;focus=[W/2,H/2];render();}
    function close(){opened=false;}
    return {open,close,render,updatePlayer,choose,chooseDistrict,nearestRoad:(u,v,metres)=>nearestRoad(roadIndex,u,v,metres/K),
      search:chooseNamedRoad,get selection(){return selected;}};
  }
  root.NashikCityExplorer={create,projection,createRoadIndex,nearestRoad,districts};
})(typeof window==='undefined'?globalThis:window);

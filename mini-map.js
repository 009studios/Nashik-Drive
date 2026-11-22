/* NASHIK: Nearby-player minimap. No external map tiles and no whole-city thumbnail.
   World data is in existing game-image pixels. Features are indexed spatially for
   city-scale datasets; the view is drawn around the current player in metres. */
(function (root) {
  'use strict';
  const validPoint = p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);
  function indexFeatures(roads, blocks, shapes, tileSize = 64) {
    const cells = new Map();
    const put = (minX,minY,maxX,maxY,type,index) => {
      if (![minX,minY,maxX,maxY].every(Number.isFinite)) return;
      for (let y=Math.floor(minY/tileSize);y<=Math.floor(maxY/tileSize);y++)
        for(let x=Math.floor(minX/tileSize);x<=Math.floor(maxX/tileSize);x++){
          const key=x+','+y;
          if(!cells.has(key))cells.set(key,[]);
          cells.get(key).push({type,index});
        }
    };
    const validRoads = (roads||[]).map((r,i)=>{
      const points=(Array.isArray(r.points)?r.points:[]).filter(validPoint);
      if(points.length<2)return null;
      const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
      const bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
      put(bounds[0],bounds[1],bounds[2],bounds[3],'road',i);
      return {road:r,points,bounds};
    });
    const validBlocks = (blocks||[]).map((b,i)=>{
      if(!shapes?.worldPoints)return null;
      const poly=shapes.worldPoints(b).filter(validPoint);
      if(poly.length<3)return null;
      const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);
      const bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
      put(bounds[0],bounds[1],bounds[2],bounds[3],'building',i);
      return {poly,bounds};
    });
    return {cells,validRoads,validBlocks,tileSize};
  }
  function queryNearby(index, cx,cy,extent){
    const {cells,tileSize}=index, seenRoads=new Set(),seenBuildings=new Set();
    const minX=Math.floor((cx-extent)/tileSize),maxX=Math.floor((cx+extent)/tileSize);
    const minY=Math.floor((cy-extent)/tileSize),maxY=Math.floor((cy+extent)/tileSize);
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      const cell=cells.get(x+','+y);if(!cell)continue;
      for(const f of cell){(f.type==='road'?seenRoads:seenBuildings).add(f.index);}
    }
    return {roads:Array.from(seenRoads),buildings:Array.from(seenBuildings)};
  }
  // Find the player's current mapped street without calling any external API.
  // Distance is measured against the actual road segments, not their bounding boxes.
  function currentStreet(index,u,v,metresPerPixel,searchMetres=85){
    const nearby=queryNearby(index,u,v,searchMetres/metresPerPixel);
    let nearest=null, named=null;
    for(const id of nearby.roads){
      const feature=index.validRoads[id];if(!feature)continue;
      // Exclude bounding boxes that are nowhere near the player's local area.
      const [left,top,right,bottom]=feature.bounds,rad=searchMetres/metresPerPixel;
      if(u<left-rad||u>right+rad||v<top-rad||v>bottom+rad)continue;
      let min=Infinity;
      const pts=feature.points;
      for(let j=1;j<pts.length;j++){
        const a=pts[j-1],b=pts[j],dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy;
        if(length2<1e-9)continue;
        const t=Math.max(0,Math.min(1,((u-a[0])*dx+(v-a[1])*dy)/length2));
        const d=Math.hypot(u-a[0]-t*dx,v-a[1]-t*dy)*metresPerPixel;
        if(d<min)min=d;
      }
      if(min>searchMetres)continue;
      const road=feature.road,name=typeof road.name==='string'?road.name.trim():'';
      const hit={road,distanceMetres:min,name};
      if(!nearest||min<nearest.distanceMetres)nearest=hit;
      if(name&&(!named||min<named.distanceMetres))named=hit;
    }
    // A named road is the player's street only when the car is plausibly on it.
    const nearestOnRoad=nearest&&nearest.distanceMetres<=Math.max(10,(Number(nearest.road.widthM)||6)/2+5);
    if(nearestOnRoad&&nearest.name)return {label:nearest.name,kind:'street',distanceMetres:nearest.distanceMetres};
    // Never identify a nearby street as the street the player is actually on.
    if(named&&named.distanceMetres<=65)return {label:`Near ${named.name}`,kind:'near',distanceMetres:named.distanceMetres};
    if(nearestOnRoad)return {label:'Unnamed street',kind:'unnamed',distanceMetres:nearest.distanceMetres};
    return {label:'Nashik',kind:'unknown',distanceMetres:nearest?.distanceMetres??Infinity};
  }
  function create(canvas,options={}){
    if(!canvas || typeof canvas.getContext!=='function')return null;
    const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return null;
    const roads=options.roads||[],blocks=options.blocks||[],shapes=options.shapes;
    const metresPerPixel=Math.max(.1,Number(options.metresPerPixel)||.65);
    const visibleMetres=Math.max(80,Number(options.visibleMetres)||160);
    const index=indexFeatures(roads,blocks,shapes,Math.max(12,175/metresPerPixel));
    const haveVectors=roads.length>0;
    let lastSize=0, lastRatio=0;
    // Same coordinate frame as the WebGL game: +x east, +z south, map origin at W/2,H/2.
    // The road surface renderer and this HUD both use network.points and widthM.
    function fromWorld(x,z,mapWidth=1175,mapHeight=1280){
      return [x/metresPerPixel+mapWidth/2,z/metresPerPixel+mapHeight/2];
    }
    function drawWorld(x,z,mapWidth=1175,mapHeight=1280){
      const [u,v]=fromWorld(x,z,mapWidth,mapHeight);draw(u,v);
    }
    function draw(u,v){
      if(!Number.isFinite(u)||!Number.isFinite(v))return;
      const cssSize=canvas.clientWidth||150;
      const pixelRatio=Math.max(1,Math.min(2,root.devicePixelRatio||1));
      const target=Math.round(cssSize*pixelRatio);
      if(target!==lastSize||pixelRatio!==lastRatio){canvas.width=target;canvas.height=target;lastSize=target;lastRatio=pixelRatio;}
      const s=target/(visibleMetres/metresPerPixel),extent=target/(2*s);
      ctx.setTransform(1,0,0,1,0,0);
      ctx.fillStyle='#a9b7a9';ctx.fillRect(0,0,target,target);
      ctx.save();ctx.beginPath();ctx.rect(0,0,target,target);ctx.clip();
      ctx.translate(target/2,target/2);ctx.scale(s,s);ctx.translate(-u,-v);
      if(!haveVectors&&options.baseImage?.complete){
        ctx.drawImage(options.baseImage,0,0,options.mapWidth||1175,options.mapHeight||1280);
      }else{
        const nearby=queryNearby(index,u,v,extent+12/metresPerPixel);
        ctx.fillStyle='#7f9388';ctx.strokeStyle='#688478';ctx.lineWidth=1/s;
        for(const i of nearby.buildings){const b=index.validBlocks[i];if(!b)continue;
          ctx.beginPath();b.poly.forEach((p,j)=>j?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();ctx.stroke();}
        const roadFeatures=nearby.roads.map(i=>index.validRoads[i]).filter(Boolean);
        // Widths are OSM estimates in metres; convert into game-image pixels.
        // Two strokes produce legible asphalt edges even on a small mobile HUD.
        for(const edgePass of [true,false]){
          ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle=edgePass?'#74857d':'#34424b';
          for(const feature of roadFeatures){const r=feature.road;
            const widthMetres=Math.max(2.2,Math.min(25,Number(r.widthM)||6));
            ctx.lineWidth=(widthMetres+(edgePass?1.0:0))/metresPerPixel;
            ctx.beginPath();feature.points.forEach((p,j)=>j?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();}
        }
      }
      ctx.restore();
      // A restrained scale bar: short enough not to obscure streets.
      ctx.strokeStyle='rgba(12,33,40,.8)';ctx.lineWidth=2*pixelRatio;
      const bar=Math.round(50/visibleMetres*target),x=10*pixelRatio,y=target-12*pixelRatio;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+bar,y);ctx.stroke();
      ctx.fillStyle='#143238';ctx.font=`${Math.max(9,Math.round(9*pixelRatio))}px sans-serif`;
      ctx.fillText('50 m',x,y-5*pixelRatio);
      ctx.font=`bold ${Math.max(10,Math.round(10*pixelRatio))}px sans-serif`;
      ctx.fillText('N',target-16*pixelRatio,16*pixelRatio);
    }
    return {draw,drawWorld,fromWorld,
      query:(u,v)=>queryNearby(index,u,v,visibleMetres/(2*metresPerPixel)),
      locate:(u,v)=>currentStreet(index,u,v,metresPerPixel),
      visibleMetres};
  }
  root.NashikMiniMap={create,indexFeatures,queryNearby,currentStreet};
})(typeof window==='undefined'?globalThis:window);

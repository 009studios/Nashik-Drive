/* Non-destructive city edits, shared by owner World Studio and the public game.
   Base OSM coordinates are never rewritten. No network dependencies. */
(function(root, factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.NashikWorldOverrides=api;
})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const FORMAT='nashik-world-overrides';
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const clone=o=>JSON.parse(JSON.stringify(o));
  function blockId(block,index){
    const external=block?.[12]?.osmId;
    return external!=null&&String(external)?'osm:'+external:'index:'+index;
  }
  function signature(base){
    const c=base?.roadNetwork?.center||{};
    return {scale:Number(base?.mapScale)||.65,cityMode:!!base?.cityMode,
      roads:base?.roadNetwork?.roads?.length||0,blocks:base?.blocks?.length||0,
      centerLat:Number(c.lat)||0,centerLon:Number(c.lon)||0};
  }
  function empty(base){return {format:FORMAT,version:1,base:signature(base),
    buildings:{},roads:{},assetsAdded:[],assetsDeleted:[],savedAt:null};}
  function validate(p,base){
    if(!p||typeof p!=='object'||p.format!==FORMAT||p.version!==1)throw Error('Not a Nashik World Studio override (v1).');
    const expected=signature(base),actual=p.base;
    if(!actual||!finite(actual.scale)||Math.abs(actual.scale-expected.scale)>.00001 || actual.cityMode!==expected.cityMode ||
        actual.roads!==expected.roads||actual.blocks!==expected.blocks||
        Math.abs((actual.centerLat||0)-expected.centerLat)>.00001||
        Math.abs((actual.centerLon||0)-expected.centerLon)>.00001)
      throw Error('Edits belong to another Nashik map. The map was not changed.');
    const o=empty(base);
    if(p.buildings&&typeof p.buildings==='object'&&!Array.isArray(p.buildings))o.buildings=p.buildings;
    if(p.roads&&typeof p.roads==='object'&&!Array.isArray(p.roads))o.roads=p.roads;
    if(Array.isArray(p.assetsAdded))o.assetsAdded=p.assetsAdded;
    if(Array.isArray(p.assetsDeleted))o.assetsDeleted=p.assetsDeleted;
    o.savedAt=typeof p.savedAt==='string'?p.savedAt:null;
    if(Object.keys(o.buildings).length>12000||Object.keys(o.roads).length>12000||o.assetsAdded.length>12000)
      throw Error('Edit file is unexpectedly large.');
    return o;
  }
  function patchBlock(base,change){
    if(!Array.isArray(base)||!change||typeof change!=='object')return base;
    if(change.deleted===true)return null;
    const b=base.slice();
    const fields={x:[0,-50000,50000],y:[1,-50000,50000],w:[2,.1,3000],d:[3,.1,3000],h:[4,1,300],rot:[6,-36000,36000],floors:[7,1,80]};
    for(const [key,[i,min,max]] of Object.entries(fields))if(finite(change[key]))b[i]=Math.min(max,Math.max(min,change[key]));
    if(['residential','mixed','commercial','industrial','office'].includes(change.kind))b[8]=change.kind;
    if(change.facade&&typeof change.facade==='object'&&!Array.isArray(change.facade)){
      b[12]={...(b[12]||{})};
      if(change.facade.windows!==undefined)b[12].windows=!!change.facade.windows;
      if(change.facade.balconies!==undefined)b[12].balconies=!!change.facade.balconies;
      if(['flat','parapet','tank'].includes(change.facade.roof))b[12].roof=change.facade.roof;
    }
    return b;
  }
  function patchRoad(base,change){
    if(!change||typeof change!=='object')return base;
    if(change.deleted===true)return null;
    const r={...base};
    if(finite(change.widthM))r.widthM=Math.max(2,Math.min(35,change.widthM));
    return r;
  }
  const allowedTypes=['tree','lamp','traffic-signal','median','planter','billboard','sign','shop','wall','fence','crosswalk','parking','bollard','bench','bus-stop','speedbump'];
  function safeAsset(a){
    if(!a||typeof a!=='object'||Array.isArray(a))return null;
    if(!allowedTypes.includes(a.type)||typeof a.id!=='string'||!/^studio:[A-Za-z0-9_-]{4,80}$/.test(a.id))return null;
    const r={id:a.id,type:a.type};
    for(const [k,mn,mx] of [['x',-50000,50000],['y',-50000,50000],['w',.15,500],['d',.15,500],['h',.1,70],['rot',-36000,36000]]){
      if(!finite(a[k]))return null;r[k]=Math.max(mn,Math.min(mx,a[k]));
    }
    return r;
  }
  function apply(world,patch){
    const o=validate(patch,world);
    // Operates only on an in-memory copy. Never overwrites city-world.json.
    world.blocks=world.blocks.flatMap((b,i)=>{
      const key=blockId(b,i);
      const v=Object.hasOwn(o.buildings,key)?patchBlock(b,o.buildings[key]):b;
      return v?[v]:[];
    });
    if(world.roadNetwork?.roads){world.roadNetwork.roads=world.roadNetwork.roads.flatMap(r=>{
      const v=Object.hasOwn(o.roads,String(r.id))?patchRoad(r,o.roads[String(r.id)]):r;
      return v?[v]:[];
    });}
    const removed=new Set(o.assetsDeleted.filter(x=>typeof x==='string'));
    const baseAssets=(world.assets||[]).filter(a=>!removed.has(a.id));
    const owned=new Map();for(const a of o.assetsAdded){const clean=safeAsset(a);if(clean&&!removed.has(clean.id))owned.set(clean.id,clean);}
    world.assets=baseAssets.concat([...owned.values()]);
    return world;
  }
  return {FORMAT,empty,validate,signature,blockId,patchBlock,patchRoad,safeAsset,allowedTypes,apply,clone};
});

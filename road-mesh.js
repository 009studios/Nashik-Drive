/* Procedural metre-accurate road ribbons. Each imported OSM path retains its
   actual centreline; smooth mitres replace per-point discs (which caused
   jagged fat patches on curves). Two layers allow subtle roadside shoulders.
   No road / map data is modified by this renderer. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.NashikRoadMesh=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function build(network,scale,width=1175,height=1280,options={}){
  if(!network||!Array.isArray(network.roads))return {vertices:new Float32Array(0),segments:0,paths:0};
  const k=Number.isFinite(scale)&&scale>0?scale:.65;
  const elevation=Number.isFinite(options.elevation)?options.elevation:.055;
  const extraWidth=Number.isFinite(options.extraWidth)?options.extraWidth:0;
  const vertices=[];let segments=0,paths=0;
  const pt=([u,v])=>[(u-width/2)*k,(v-height/2)*k];
  function vertex(v){vertices.push(v[0],elevation,v[1],0,1,0);}
  function tri(a,b,c){vertex(a);vertex(b);vertex(c);}
  function cap(p,r,first,dir){ // round cap, only at path ends, not every bend
   const base=Math.atan2(dir[1],dir[0])+(first?Math.PI:0);
   // The interior half-disc is already covered by the road strip.
   for(let i=0;i<8;i++){
    const a=base-Math.PI/2+i*Math.PI/8;
    const b=base-Math.PI/2+(i+1)*Math.PI/8;
    tri(p,[p[0]+Math.cos(a)*r,p[1]+Math.sin(a)*r],[p[0]+Math.cos(b)*r,p[1]+Math.sin(b)*r]);
   }
  }
  for(const road of network.roads){
   if(!Array.isArray(road.points)||road.points.length<2)continue;
   const points=[];
   for(const src of road.points){
    if(!Array.isArray(src)||!Number.isFinite(src[0])||!Number.isFinite(src[1]))continue;
    const p=pt(src);
    if(!points.length||Math.hypot(p[0]-points.at(-1)[0],p[1]-points.at(-1)[1])>.035)points.push(p);
   }
   if(points.length<2)continue;
   let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
   for(const p of points){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minZ=Math.min(minZ,p[1]);maxZ=Math.max(maxZ,p[1]);}
   const radius=clamp(Number(road.widthM)||6,2,35)/2+extraWidth/2;
   if(maxX<-width*k/2-radius||minX>width*k/2+radius||maxZ<-height*k/2-radius||minZ>height*k/2+radius)continue;
   paths++;
   const normals=[];
   for(let i=0;i<points.length-1;i++){
    const dx=points[i+1][0]-points[i][0],dz=points[i+1][1]-points[i][1],l=Math.hypot(dx,dz)||1;
    normals.push([-dz/l,dx/l]);
   }
   const sides=[];
   for(let i=0;i<points.length;i++){
    let n=i===0?normals[0]:i===points.length-1?normals.at(-1):null,mag=radius;
    if(!n){
     const a=normals[i-1],b=normals[i],sx=a[0]+b[0],sz=a[1]+b[1],len=Math.hypot(sx,sz);
     if(len<.05){n=b;}else{
      n=[sx/len,sz/len];const dot=Math.abs(n[0]*b[0]+n[1]*b[1]);
      mag=radius*clamp(1/Math.max(.1,dot),1,1.8);
     }
    }
    const p=points[i];sides.push([[p[0]+n[0]*mag,p[1]+n[1]*mag],[p[0]-n[0]*mag,p[1]-n[1]*mag]]);
   }
   for(let i=0;i<sides.length-1;i++){
    const [a,b]=sides[i],[d,c]=sides[i+1];
    tri(a,b,c);tri(a,c,d);segments++;
   }
   const d0=[normals[0][1],-normals[0][0]],dn=[normals.at(-1)[1],-normals.at(-1)[0]];
   cap(points[0],radius,true,d0);cap(points.at(-1),radius,false,dn);
  }
  return {vertices:new Float32Array(vertices),segments,paths};
 }
 return {build};
});

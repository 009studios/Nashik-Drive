/* Shared geometry: part of the public game, contains no owner controls. */
(function(){'use strict';
const presets={
 rect:[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]],
 square:[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]],
 triangle:[[0,-.5],[.5,.5],[-.5,.5]],
 hex:[[-.25,-.5],[.25,-.5],[.5,0],[.25,.5],[-.25,.5],[-.5,0]],
 l:[[-.5,-.5],[.5,-.5],[.5,-.14],[-.12,-.14],[-.12,.5],[-.5,.5]],
 u:[[-.5,-.5],[.5,-.5],[.5,.5],[.18,.5],[.18,-.13],[-.18,-.13],[-.18,.5],[-.5,.5]],
 t:[[-.5,-.5],[.5,-.5],[.5,-.14],[.18,-.14],[.18,.5],[-.18,.5],[-.18,-.14],[-.5,-.14]],
 oval:[],circle:[]
};
for(const [key,n] of [['circle',24],['oval',24]])presets[key]=Array.from({length:n},(_,i)=>{const a=Math.PI*2*i/n;return [Math.cos(a)*.5,Math.sin(a)*.5]});
function footprint(kind,points){if(kind==='custom'&&Array.isArray(points)&&points.length>=3)return points;return presets[kind]||presets.rect;}
function bounds(points){return points.reduce((o,p)=>({minx:Math.min(o.minx,p[0]),maxx:Math.max(o.maxx,p[0]),miny:Math.min(o.miny,p[1]),maxy:Math.max(o.maxy,p[1])}),{minx:Infinity,maxx:-Infinity,miny:Infinity,maxy:-Infinity});}
function worldPoints(o){let x,y,w,d,rot,shape,custom;if(Array.isArray(o)){x=o[0];y=o[1];w=o[2];d=o[3];rot=o[6];shape=o[10];custom=o[11];}else({x,y,w,d,rot=0,shape='rect',points:custom}=o);const a=(rot||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return footprint(shape||'rect',custom||[]).map(([u,v])=>[x+c*(u*w)+s*(v*d),y-s*(u*w)+c*(v*d)]);}
function pointInside(x,y,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function area(p){let r=0;for(let i=0;i<p.length;i++){let a=p[i],b=p[(i+1)%p.length];r+=a[0]*b[1]-b[0]*a[1];}return r*.5}
function triangleIndices(raw){const p=raw.slice(),V=p.map((_,i)=>i),tri=[],isCCW=area(p)>0;let guard=0;
function cross(a,b,c){return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])}
function inTri(pt,a,b,c){let p1=cross(pt,a,b),p2=cross(pt,b,c),p3=cross(pt,c,a),neg=p1<0||p2<0||p3<0,pos=p1>0||p2>0||p3>0;return!(neg&&pos)}
while(V.length>3&&guard++<100){let clipped=false;for(let k=0;k<V.length;k++){const i=V[(k+V.length-1)%V.length],j=V[k],l=V[(k+1)%V.length],a=p[i],b=p[j],c=p[l];const cr=cross(a,b,c);if(isCCW?cr<=1e-7:cr>=-1e-7)continue;if(V.some(z=>z!==i&&z!==j&&z!==l&&inTri(p[z],a,b,c)))continue;tri.push(i,j,l);V.splice(k,1);clipped=true;break;}if(!clipped)break;}
if(V.length===3)tri.push(...V);return tri;}
window.NashikShapes={presets,footprint,worldPoints,pointInside,triangleIndices,area,bounds};
})();

/* Nashik First Drive — stylized, optimized Creta-style compact SUV.
   Original procedural vehicle; based on supplied visual references, not a ripped 3D asset.
   Front faces local +Z, positive X is vehicle right. All dimensions are metres.
   Exports colored interleaved vertex batches for the existing WebGL 2 renderer.
*/
(function(root){
'use strict';
const C={
 body:[.77,.79,.81],light:[.92,.93,.91],shoulder:[.84,.86,.86],under:[.11,.15,.18],
 black:[.065,.079,.088],glass:[.105,.21,.26],glassTop:[.18,.30,.35],
 chrome:[.69,.73,.74],chromeHi:[.90,.93,.92],grey:[.29,.34,.35],
 tyre:[.042,.055,.065],rim:[.57,.62,.65],rimDark:[.23,.28,.32],
 red:[.88,.14,.14],redHi:[1,.28,.23],led:[.96,.96,.88],amber:[1,.60,.18],
 badge:[.84,.87,.87],plate:[.94,.94,.88],plateInk:[.065,.11,.14],
 roof:[.12,.15,.16],arch:[.16,.19,.21],shadow:[.38,.43,.45],
};
const groups=new Map();let triangles=0;
const get=mat=>{if(!groups.has(mat))groups.set(mat,[]);return groups.get(mat)};
function tri(mat,a,b,c){
 const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
 let n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
 const mag=Math.hypot(...n)||1;n=n.map(v=>v/mag);
 const g=get(mat);for(const p of [a,b,c])g.push(...p,...n);triangles++;
}
function quad(mat,a,b,c,d){tri(mat,a,b,c);tri(mat,a,c,d)}
function polygon(mat,points){for(let i=1;i<points.length-1;i++)tri(mat,points[0],points[i],points[i+1])}
function box(mat,x,y,z,w,h,d){
 const x0=x-w/2,x1=x+w/2,y0=y-h/2,y1=y+h/2,z0=z-d/2,z1=z+d/2;
 quad(mat,[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]);
 quad(mat,[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]);
 quad(mat,[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]);
 quad(mat,[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]);
 quad(mat,[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]);
 quad(mat,[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]);
}
function segment(mat,a,b,width,height){
 // Thin beam along arbitrary segment in the XZ plane, width horizontal, height vertical.
 const dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;
 const ox=-dz/l*width/2,oz=dx/l*width/2;
 const y0=a[1]-height/2,y1=a[1]+height/2;
 quad(mat,[a[0]+ox,y0,a[2]+oz],[b[0]+ox,y0,b[2]+oz],[b[0]+ox,y1,b[2]+oz],[a[0]+ox,y1,a[2]+oz]);
 quad(mat,[a[0]-ox,y0,a[2]-oz],[b[0]-ox,y0,b[2]-oz],[b[0]-ox,y1,b[2]-oz],[a[0]-ox,y1,a[2]-oz]);
 quad(mat,[a[0]+ox,y1,a[2]+oz],[b[0]+ox,y1,b[2]+oz],[b[0]-ox,y1,b[2]-oz],[a[0]-ox,y1,a[2]-oz]);
}
function lineOnSide(mat,side,z0,y0,z1,y1,width=.014){
 const x=side*.968,dy=y1-y0,dz=z1-z0,l=Math.hypot(dy,dz)||1;
 const offy=-dz/l*width*.5,offz=dy/l*width*.5;
 quad(mat,[x,y0+offy,z0+offz],[x,y1+offy,z1+offz],[x,y1-offy,z1-offz],[x,y0-offy,z0-offz]);
}
function wheel(side,z){
 const R=.385,cy=.422,x=side*.96,th=.235;
 const N=16;
 function ring(mat,rr,rInner,faceX){
   for(let i=0;i<N;i++){
     const a=i*2*Math.PI/N,b=(i+1)*2*Math.PI/N;
     const p=(r,ang)=>[faceX,cy+Math.sin(ang)*r,z+Math.cos(ang)*r];
     quad(mat,p(rr,a),p(rr,b),p(rInner,b),p(rInner,a));
   }
 }
 for(let i=0;i<N;i++){
   const a=i*2*Math.PI/N,b=(i+1)*2*Math.PI/N;
   const p=(xx,t)=>[xx,cy+R*Math.sin(t),z+R*Math.cos(t)];
   quad('tyre',p(x-th*side*.12,a),p(x-th*side*.12,b),p(x+side*th*.90,b),p(x+side*th*.90,a));
 }
 const outer=x+side*th*.90;
 ring('tyre',R,.282,outer+.004*side);
 ring('rimDark',.283,.240,outer+.014*side);
 ring('rim',.240,.191,outer+.02*side);
 ring('rimDark',.189,.100,outer+.024*side);
 ring('badge',.095,0,outer+.029*side);
 for(let i=0;i<5;i++){
   const t=i*Math.PI*2/5,ds=.075,dt=.26;
   const p=(r,ang)=>[outer+.04*side,cy+Math.sin(ang)*r,z+Math.cos(ang)*r];
   polygon('rim', [p(.084,t-.22),p(.235,t-.18),p(.255,t+.18),p(.09,t+.24)]);
 }
 // Wheel arch trim, a visible black semi-circle on the body panel.
 const faceX=side*.977;
 for(let i=0;i<14;i++){
   const t0=Math.PI*i/14,t1=Math.PI*(i+1)/14;
   const p=(r,t)=>[faceX,cy+Math.sin(t)*r,z+Math.cos(t)*r];
   quad('arch',p(.475,t0),p(.475,t1),p(.425,t1),p(.425,t0));
 }
}
function glyphs(text,centerX,y,z,height,mat){
 const bitmap={
  C:['01110','10001','10000','10000','10000','10001','01110'],
  R:['11110','10001','10001','11110','10100','10010','10001'],
  E:['11111','10000','10000','11110','10000','10000','11111'],
  T:['11111','00100','00100','00100','00100','00100','00100'],
  A:['01110','10001','10001','11111','10001','10001','10001'],
  M:['10001','11011','10101','10101','10001','10001','10001'],
  H:['10001','10001','10001','11111','10001','10001','10001'],
  1:['00100','01100','00100','00100','00100','00100','01110'],
  5:['11111','10000','11110','00001','00001','10001','01110'],
  ' ':['00000','00000','00000','00000','00000','00000','00000'],
 };
 const h=height/7,w=h*.73,advance=w*6.5,total=text.length*advance;
 let first=centerX-total/2;
 for(let j=0;j<text.length;j++){
   let rows=bitmap[text[j]]||bitmap[' '];
   for(let r=0;r<7;r++)for(let c=0;c<5;c++)if(rows[r][c]==='1'){
     const xx=first+j*advance+c*w, yy=y+height*(.5-(r+.5)/7);
     quad(mat,[xx,yy-h*.5,z],[xx+w*.83,yy-h*.5,z],[xx+w*.83,yy+h*.5,z],[xx,yy+h*.5,z]);
   }
 }
}
// Body surfaces: beveled box following shaped cross-sections along the car length.
const rings=[
 {z:-2.18,w:.76,base:.30,shoulder:1.13},
 {z:-2.03,w:.92,base:.29,shoulder:1.29},
 {z:-1.45,w:.95,base:.30,shoulder:1.33},
 {z:.55,w:.96,base:.31,shoulder:1.28},
 {z:1.48,w:.95,base:.30,shoulder:1.21},
 {z:2.07,w:.91,base:.30,shoulder:1.12},
 {z:2.20,w:.79,base:.33,shoulder:1.07},
];
function section(r){
 const w=r.w,t=r.shoulder,lo=r.base,z=r.z;
 return [[-w*.88,lo,z],[w*.88,lo,z],[w,lo+.17,z],[w,t-.23,z],[w*.92,t,z],[w*.72,t+.05,z],[-w*.72,t+.05,z],[-w*.92,t,z],[-w,t-.23,z],[-w,lo+.17,z]];
}
for(let i=0;i<rings.length-1;i++){
 const a=section(rings[i]),b=section(rings[i+1]);
 for(let j=0;j<a.length;j++){
   const k=(j+1)%a.length,mat=j===3||j===6?'shoulder':j===0||j===1||j===8?'shadow':'body';
   quad(mat,a[j],a[k],b[k],b[j]);
 }
}
polygon('body',section(rings[0]));polygon('body',section(rings[rings.length-1]));
// Lower dark rocker panels and graphite bumper valance.
for(const sign of [-1,1]){
 box('under',sign*.89,.35,0,.16,.26,3.90);
 box('chrome',sign*.90,.52,0,.045,.032,2.52);
}
box('under',0,.44,2.19,1.66,.25,.07);
box('under',0,.43,-2.20,1.65,.24,.08);
box('grey',0,.45,2.26,1.15,.090,.09);
box('grey',0,.48,-2.27,1.1,.090,.08);
// Dark panoramic roof and sculpted cabin section. Side window sloped pillars.
const cabin=[
 {z:-1.59,half:.81,y:1.28},
 {z:-1.05,half:.716,y:1.735},
 {z:.78,half:.725,y:1.745},
 {z:1.33,half:.818,y:1.23},
];
for(let i=0;i<cabin.length-1;i++){
 const p=cabin[i],q=cabin[i+1];
 const A=[-p.half,p.y,p.z],B=[p.half,p.y,p.z],D=[-q.half,q.y,q.z],E=[q.half,q.y,q.z];
 quad(i===1?'roof':'glass',A,B,E,D);
}
for(const s of [-1,1]){
 for(let i=0;i<cabin.length-1;i++){
   const a=cabin[i],b=cabin[i+1];
   quad('roof',[s*a.half,1.23,a.z],[s*b.half,1.24,b.z],[s*b.half,b.y,b.z],[s*a.half,a.y,a.z]);
 }
 // Lifted side glass panes with black B and C pillar strips.
 polygon('glass',[[s*.834,1.29,-1.51],[s*.745,1.685,-1.00],[s*.735,1.685,-.24],[s*.836,1.29,-.24]]);
 polygon('glassTop',[[s*.835,1.29,-.20],[s*.738,1.685,-.16],[s*.741,1.686,.70],[s*.836,1.29,1.20]]);
 box('roof',s*.751,1.48,-.205,.048,.52,.092);
 box('roof',s*.815,1.46,-1.16,.070,.46,.06);
 box('chrome',s*.822,1.275,-.02,.030,.026,2.54);
 // Side doors and handles, subtle body-side character creases.
 lineOnSide('shadow',s,-.23,.54,-.23,1.16,.014);
 lineOnSide('shadow',s,1.18,.53,1.18,1.12,.012);
 lineOnSide('shadow',s,-1.86,.94,1.80,.91,.021);
 for(const zz of [-.64,.80]){
   box('under',s*.981,1.155,zz,.042,.066,.34);
   box('chrome',s*.997,1.19,zz,.036,.052,.32);
 }
 // Side mirrors with black struts and body-color top.
 box('under',s*.90,1.24,1.17,.24,.12,.15);
 box('body',s*1.105,1.30,1.17,.32,.20,.27);
 box('chrome',s*1.27,1.31,1.17,.022,.092,.18);
 // Roof rails above each side, no excessive geometry.
 box('roof',s*.655,1.79,-.15,.055,.045,2.10);
 box('chrome',s*.655,1.81,-.15,.023,.025,1.90);
 wheel(s,-1.44);wheel(s,1.41);
}
// Windshield tint and thin silver perimeter on the leading edge.
quad('glassTop',[-.82,1.245,1.345],[.82,1.245,1.345],[.718,1.733,.78],[-.718,1.733,.78]);
box('under',0,1.262,1.349,1.51,.038,.030); // wipers
// rear glass backing and brake lamp upper bar.
quad('glass',[-.805,1.29,-1.60],[.805,1.29,-1.60],[.714,1.73,-1.052],[-.714,1.73,-1.052]);
box('red',0,1.50,-1.53,.75,.036,.030);
// Front LED signature: continuous horizon DRL with inverted-L edges.
box('black',0,1.010,2.197,1.75,.30,.08);
box('led',0,1.148,2.256,1.71,.047,.035);
for(const s of [-1,1]){
 box('led',s*.833,1.045,2.251,.040,.27,.043);
 box('led',s*.75,.856,2.275,.235,.115,.047);
 box('amber',s*.70,.776,2.274,.190,.032,.05);
}
// Angular Hyundai-style dark parametric grille with metallic raster.
polygon('black',[[-.76,.99,2.263],[.76,.99,2.263],[.70,.57,2.271],[.58,.49,2.275],[-.58,.49,2.275],[-.70,.57,2.271]]);
for(let row=0;row<5;row++){
 const yy=.91-row*.083,maxx=.70-(row/5)*.08;
 for(let i=0;i<11;i++){
  const x=(i-5)*.122+(row%2)*.035;
  if(Math.abs(x)>maxx)continue;
  box(row%2?'chrome':'grey',x,yy,2.282,.065,.035,.016);
 }
}
box('chrome',0,.515,2.27,.94,.045,.05);
box('under',0,.26,2.17,1.32,.10,.12);
// Silver Hyundai-like stylized H within oval frame, without any external logos/textures.
const emblemZ=2.294;
for(let i=0;i<16;i++){
 const a=i*2*Math.PI/16,b=(i+1)*2*Math.PI/16;
 segment('badge',[Math.cos(a)*.135,.865+Math.sin(a)*.075,emblemZ],[Math.cos(b)*.135,.865+Math.sin(b)*.075,emblemZ],.015,.012);
}
segment('badge',[-.070,.812,emblemZ],[-.040,.914,emblemZ],.018,.022);
segment('badge',[.070,.812,emblemZ],[.045,.914,emblemZ],.018,.022);
box('badge',0,.867,emblemZ,.099,.019,.018);
// Front licence area.
box('plate',0,.345,2.288,.52,.14,.025);
glyphs('MH 15',0,.353,2.310,.095,'plateInk');
// Rear styling: dark center band, seamless red LEDs and distinctive vertical accents.
box('black',0,1.11,-2.202,1.67,.215,.063);
box('red',0,1.162,-2.246,1.55,.062,.020);
box('redHi',0,1.175,-2.260,.75,.027,.013);
for(const s of [-1,1]){
 box('red',s*.764,1.09,-2.249,.126,.235,.03);
 box('redHi',s*.782,1.08,-2.263,.043,.215,.018);
 box('red',s*.70,.90,-2.263,.19,.07,.02);
 box('amber',s*.74,.77,-2.268,.10,.046,.02);
}
// Side body cut line and black rear bumper trim.
box('shadow',0,.77,-2.229,1.47,.012,.026);
box('under',0,.38,-2.267,1.67,.25,.12);
box('grey',0,.265,-2.332,.73,.07,.04);
// Rear crest lettering and license plate, readable in chase camera.
glyphs('CRETA',0,1.000,-2.277,.105,'badge');
box('plate',0,.61,-2.331,.535,.155,.024);
glyphs('MH 15',0,.615,-2.350,.09,'plateInk');
// Reverse lamps and reflectors.
for(const s of [-1,1]){
 box('red',s*.70,.45,-2.317,.16,.055,.02);
 box('led',s*.62,.38,-2.334,.22,.036,.014);
}
const batches=[];
for(const [name,data] of groups){if(!data.length)continue;batches.push({name,color:C[name],vertices:new Float32Array(data),count:data.length/6});}
root.NashikCretaModel={name:'Creta-inspired SUV',batches,triangleCount:triangles,dimensions:{width:2.18,length:4.40,height:1.84},forward:'+Z'};
})(typeof window!=='undefined'?window:globalThis);

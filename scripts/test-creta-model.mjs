import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
const context={window:{}};
runInNewContext(readFileSync('creta-car.js','utf8'),context);
const v=context.window.NashikCretaModel;
assert.ok(v,'vehicle script exports model');
assert.ok(v.triangleCount>2500&&v.triangleCount<8000,'reasonable triangle budget');
assert.ok(v.batches.length>10,'materials exist');
const materials=new Set(v.batches.map(g=>g.name));
for(const name of ['body','glass','tyre','rim','black','red','led','badge','plate'])assert.ok(materials.has(name),`material ${name}`);
let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],faces=0;
for(const g of v.batches){
 assert.equal(g.vertices.length%18,0,'each triangle is 3 vertices with position and normal');
 assert.equal(g.count*6,g.vertices.length,'draw count matches vertex data');
 assert.equal(g.color.length,3,'color RGB');
 for(let i=0;i<g.vertices.length;i+=6){
   for(let a=0;a<3;a++){
     assert.ok(Number.isFinite(g.vertices[i+a]),'finite vertex position');
     min[a]=Math.min(min[a],g.vertices[i+a]);max[a]=Math.max(max[a],g.vertices[i+a]);
   }
 }
 faces+=g.count/3;
}
assert.equal(faces,v.triangleCount);
assert.ok(max[0]-min[0]>2&&max[0]-min[0]<3,'compact SUV width plus mirrors');
assert.ok(max[2]-min[2]>4.3&&max[2]-min[2]<4.9,'compact SUV length');
assert.ok(max[1]-min[1]>1.6&&max[1]-min[1]<2.0,'vehicle height');
const html=readFileSync('index.html','utf8');
assert.ok(html.indexOf('src="creta-car.js"')<html.indexOf('src="game.js"'),'model loaded before game');
const game=readFileSync('game.js','utf8');
assert.ok(game.includes('window.NashikCretaModel'),'game consumes new model');
assert.ok(game.includes('gl.drawArrays(gl.TRIANGLES,0,part.count)'),'vehicle drawn with mesh geometry');
console.log(`PASS Creta-inspired SUV: ${v.triangleCount} triangles, ${v.batches.length} materials, length ${(max[2]-min[2]).toFixed(2)} m.`);

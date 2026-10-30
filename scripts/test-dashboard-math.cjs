const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const root=require('node:path').resolve(__dirname,'..');const req=createRequire(root+'/package.json');
const ts=req('typescript');const fs=require('node:fs');const Module=require('node:module');
const filename=root+'/src/pages/admin/dashboard/chartMath.ts';
const compiled=new Module(filename,module);compiled._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {percent,sectors,sectorPath,timelineBuckets,axisTicks}=compiled.exports;
assert.equal(percent(1,3),'33.3%');assert.equal(percent(0,0),'0%');
assert.equal(sectorPath(0,0),'');assert.equal((sectorPath(0,Math.PI*2).match(/A /g)||[]).length,2);assert.equal((sectorPath(0,Math.PI*2,54).match(/A /g)||[]).length,4);
assert.equal(sectors([{count:0}])[0].start,sectors([{count:0}])[0].end);
const slices=sectors([{count:1},{count:2},{count:7}]);assert.ok(Math.abs(slices[0].end-slices[0].start-Math.PI*.2)<1e-10);
for(const days of [7,30,90]){
 const points=Array.from({length:days},(_,i)=>({date:`date-${i}`,news:i%3,events:i%2,resources:0}));
 const result=timelineBuckets(points);assert.ok(result.length<=7);assert.equal(result[0].date,'date-0');assert.equal(result.at(-1).endDate,'date-'+(days-1));
 for(const key of ['news','events','resources'])assert.equal(result.reduce((sum,row)=>sum+row[key],0),points.reduce((sum,row)=>sum+row[key],0));
}
for(const max of [0,1,2,3,5,8,19,154]){const ticks=axisTicks(max);assert.equal(ticks[0],0);assert.ok(ticks.at(-1)>=max);assert.ok(ticks.every(Number.isInteger));}
console.log('PASS chart geometry: zero/full circle, exact proportions, bucket totals and integer axes.');

const assert=require('node:assert/strict');
const {createRequire}=require('node:module');const Module=require('node:module');const path=require('node:path');
const root=process.env.CLASSHUB_ROOT||path.resolve(__dirname,'..');const req=createRequire(root+'/package.json');
(async()=>{
 const built=await req('esbuild').build({entryPoints:[root+'/src/lib/memberAssistant.ts'],bundle:true,platform:'node',format:'cjs',write:false,packages:'external',plugins:[{name:'stub-api',setup(build){build.onResolve({filter:/^\.\/axios$/},()=>({path:'api',namespace:'memory'}));build.onLoad({filter:/.*/,namespace:'memory'},()=>({contents:'export default {get(){},post(){},patch(){},delete(){}};',loader:'js'}));}}]});
 const compiled=new Module(__filename,module);compiled.filename=__filename;compiled.paths=[root+'/node_modules'];compiled._compile(built.outputFiles[0].text,__filename);
 const {safeAssistantSources,boundedAssistantHistory,validateAssistantImages}=compiled.exports;
 assert.deepEqual(safeAssistantSources([{id:'1',title:'本站资源',url:'/resources',type:'site'},{id:'2',title:'链接',url:'https://example.com/a',type:'web'},{title:'x',url:'javascript:alert(1)'},{title:'x',url:'//evil.test'},{title:'x',url:'https://user:secret@example.com'},{title:'x',url:'/admin/settings',type:'web'}]).map(x=>x.url),['/resources','https://example.com/a']);
 const history=boundedAssistantHistory(Array.from({length:22},(_,i)=>({role:i%2?'assistant':'user',content:String(i).repeat(2000)})));
 assert.ok(history.length<=10);assert.ok(history.reduce((n,x)=>n+x.content.length,0)<=16000);assert.equal(history.at(-1).role,'assistant');
 const file=(type,size,name='photo.png')=>({type,size,name});
 assert.equal(validateAssistantImages([file('image/png',1024)]),null);assert.match(validateAssistantImages([file('text/html',10)]),/图片/);assert.match(validateAssistantImages([file('image/png',2097153)]),/2 MB/);assert.match(validateAssistantImages(Array.from({length:5},()=>file('image/jpeg',10))),/4/);
 console.log('PASS assistant client: safe citations, bounded conversation and photo limits');
})().catch(error=>{console.error(error);process.exitCode=1;});

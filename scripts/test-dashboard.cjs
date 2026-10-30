const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const Module=require('node:module');
const root=require('node:path').resolve(__dirname,'..');const req=createRequire(root+'/package.json');
const {JSDOM}=req('./uniclub-backend/node_modules/jsdom');
const dom=new JSDOM('<div id="root"></div>',{url:'http://isolated.test/admin',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','SVGElement','Element','Event','MouseEvent','KeyboardEvent','getComputedStyle'])global[key]=key==='getComputedStyle'?dom.window.getComputedStyle:dom.window[key];
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});
global.IS_REACT_ACT_ENVIRONMENT=true;
let reduced=true;
window.matchMedia=query=>({matches:query.includes('no-preference')?!reduced:query.includes('reduce')?reduced:false,media:query,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
const React=req('react'),{act}=React,{createRoot}=req('react-dom/client'),{MemoryRouter,useLocation}=req('react-router-dom');
const counters={users:51,events:3,news:19,resources:2};
function fixture(days=30,zero=false){const values=zero?{users:0,events:0,news:0,resources:0}:counters;return {...values,breakdown:{admins:zero?0:11,pendingNews:0,pendingResources:zero?0:1},roles:[{role:'student',label:'学生',count:zero?0:38},{role:'committee',label:'班委',count:zero?0:1},{role:'teacher',label:'老师',count:zero?0:1},{role:'admin',label:'管理员',count:zero?0:11}],timeline:{days,timeZone:'Asia/Shanghai',basis:'createdAt',startDate:'2026-09-28',endDate:'2026-10-27',points:Array.from({length:days},(_,i)=>({date:new Date(Date.UTC(2026,9,28-days+i)).toISOString().slice(0,10),news:zero?0:i%2,events:zero?0:i===0?1:0,resources:0})),undated:{news:0,events:0,resources:0}},generatedAt:'2026-10-27T00:00:00Z'};}
let calls=[],pending=[];
global.__dashboardApi={getStats:(days,signal)=>{calls.push({days,signal});return new Promise((resolve,reject)=>pending.push({resolve,reject}));},errorMessage:failure=>failure.message};
(async()=>{
 const build=await req('esbuild').build({stdin:{contents:`export {default as AdminDashboard} from './src/pages/admin/AdminDashboard';export {AdminSessionContext} from './src/pages/admin/adminSession';export {default as DashboardCharts} from './src/pages/admin/dashboard/DashboardCharts';`,resolveDir:root,loader:'tsx'},bundle:true,platform:'node',format:'cjs',packages:'external',write:false,jsx:'automatic',plugins:[{name:'test-api-boundary',setup(build){build.onResolve({filter:/^\.\/adminApi$/},()=>({path:'api',namespace:'memory'}));build.onLoad({filter:/.*/,namespace:'memory'},()=>({contents:'export const {getStats,errorMessage}=globalThis.__dashboardApi;',loader:'js'}));build.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));}}]});
 const compiled=new Module(__filename,module);compiled.filename=__filename;compiled.paths=[root+'/node_modules'];compiled._compile(build.outputFiles[0].text,__filename);
 const {AdminDashboard,AdminSessionContext,DashboardCharts}=compiled.exports;
 let host=createRoot(document.getElementById('root'));
 function Location(){return React.createElement('output',{'data-route':''},useLocation().pathname);}
 const wrap=component=>React.createElement(MemoryRouter,{initialEntries:['/admin'],future:{v7_startTransition:true,v7_relativeSplatPath:true}},React.createElement(AdminSessionContext.Provider,{value:{id:'actor',role:'admin',isAdmin:true}},component),React.createElement(Location));
 await act(async()=>host.render(wrap(React.createElement(AdminDashboard))));
 assert.match(document.querySelector('[role="status"]').getAttribute('aria-label'),/正在读取/);assert.equal(calls[0].days,30);
 await act(async()=>pending.shift().resolve(fixture()));
 assert.equal(document.querySelectorAll('.ch-metric').length,4);assert.equal(document.querySelectorAll('.ch-chart').length,3);
 assert.match(document.body.textContent,/51/);assert.match(document.body.textContent,/老师/);assert.equal(document.querySelectorAll('.ch-chart__legend button').length,4);
 for(const expected of ['/admin/events','/admin/news','/admin/resources','/admin/members'])assert.ok(document.querySelector(`.ch-dash__shortcuts a[href="${expected}"]`));
 const legend=[...document.querySelectorAll('.ch-chart__legend button')].find(node=>node.textContent.includes('班委'));
 await act(async()=>legend.click());assert.equal(legend.getAttribute('aria-pressed'),'true');assert.ok(document.querySelector('.ch-chart__slice[data-active="true"]'));
 const keyboard=document.querySelector('.ch-chart__hit[role="button"]');await act(async()=>keyboard.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));assert.equal(keyboard.getAttribute('aria-pressed'),'true');
 const bar=document.querySelector('.ch-chart__bar-control');await act(async()=>bar.focus());assert.match(document.querySelector('.ch-chart--bars .ch-chart__readout').textContent,/条/);
 const select=document.querySelector('select[aria-label="内容新增统计时间范围"]');
 await act(async()=>{select.value='7';select.dispatchEvent(new Event('change',{bubbles:true}));});assert.equal(calls.at(-1).days,7);assert.equal(select.disabled,true);
 await act(async()=>pending.shift().resolve(fixture(7)));assert.equal(select.value,'7');assert.equal(document.querySelectorAll('.ch-chart__data tbody tr').length,7);
 const refresh=()=>document.querySelector('.ch-dash__refresh');await act(async()=>refresh().click());assert.equal(calls.length,3);
 await act(async()=>pending.shift().reject(new Error('统计数据暂时无法读取')));assert.match(document.querySelector('[role="alert"]').textContent,/上次成功读取/);assert.equal(document.querySelectorAll('.ch-metric').length,4);
 // Unmount while a request is pending: cancel it and ignore a late response.
 await act(async()=>refresh().click());const late=pending.shift();const signal=calls.at(-1).signal;
 await act(async()=>host.unmount());assert.equal(signal.aborted,true);await act(async()=>late.resolve(fixture(90)));
 host=createRoot(document.getElementById('root'));
 const empty=fixture(7,true);const props={roles:empty.roles,timeline:empty.timeline,content:[{key:'news',label:'新闻',count:0,to:'/admin/news'},{key:'events',label:'活动',count:0,to:'/admin/events'},{key:'resources',label:'资源',count:0,to:'/admin/resources'}],onDaysChange(){},busy:false};
 await act(async()=>host.render(wrap(React.createElement(DashboardCharts,props))));assert.match(document.body.textContent,/还没有平台内容/);assert.match(document.body.textContent,/还没有成员账号/);assert.equal(document.querySelectorAll('.ch-chart__bar').length,0);assert.equal(document.querySelectorAll('.ch-chart__slice').length,0);
 // A single nonzero category must draw a full circle, and zero legends remain.
 const content=[{key:'news',label:'新闻',count:1,to:'/admin/news'},{key:'events',label:'活动',count:0,to:'/admin/events'},{key:'resources',label:'资源',count:0,to:'/admin/resources'}];
 await act(async()=>host.render(wrap(React.createElement(DashboardCharts,{...props,content}))));
 assert.equal(document.querySelectorAll('.ch-chart--pie .ch-chart__slice').length,1);assert.equal(document.querySelectorAll('.ch-chart--pie .ch-chart__legend a').length,3);assert.match(document.querySelector('.ch-chart--pie .ch-chart__legend').textContent,/100%/);
 const ids=[...document.querySelectorAll('[id]')].map(node=>node.id);assert.equal(new Set(ids).size,ids.length);
 const link=document.querySelector('.ch-chart--pie .ch-chart__legend a[href="/admin/news"]');await act(async()=>link.click());assert.equal(document.querySelector('[data-route]').textContent,'/admin/news');
 await act(async()=>host.unmount());
 // Exercise the actual GSAP lifecycle as well as the reduced-motion path.
 reduced=false;host=createRoot(document.getElementById('root'));
 await act(async()=>{host.render(wrap(React.createElement(AdminDashboard)));});
 await act(async()=>pending.shift().resolve(fixture()));
 assert.ok(req('gsap').gsap.globalTimeline.getChildren().length>0);
 await act(async()=>host.unmount());
 assert.equal(req('gsap').gsap.globalTimeline.getChildren().filter(item=>item.isActive()).length,0);
 req('gsap').gsap.ticker.sleep();dom.window.close();
 console.log('PASS dashboard component integration: live count fixtures, 3 charts, role highlight/keyboard, tooltips, range/refetch, failure preservation, abort/unmount, empty/single pie, unique SVG IDs and management routes.');
})().catch(error=>{console.error(error);req('gsap').gsap.ticker.sleep();process.exitCode=1;});

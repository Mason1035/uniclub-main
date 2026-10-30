const assert=require('node:assert/strict');const {createRequire}=require('node:module');const Module=require('node:module');const path=require('node:path');
const root=process.env.CLASSHUB_ROOT||path.resolve(__dirname,'..'),req=createRequire(root+'/package.json');const {JSDOM}=req('./uniclub-backend/node_modules/jsdom');
const dom=new JSDOM('<button id="opener">AI 模式</button><div id="root"></div>',{url:'http://isolated.test/',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','SVGElement','Element','Node','NodeFilter','DocumentFragment','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','File','getComputedStyle'])global[key]=key==='getComputedStyle'?dom.window.getComputedStyle:dom.window[key];
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});global.IS_REACT_ACT_ENVIRONMENT=true;
global.requestAnimationFrame=window.requestAnimationFrame.bind(window);global.cancelAnimationFrame=window.cancelAnimationFrame.bind(window);
window.matchMedia=query=>({matches:query.includes('reduce')||query.includes('fine'),media:query,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
global.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};window.ResizeObserver=global.ResizeObserver;
HTMLElement.prototype.scrollIntoView=function(){};
const revoked=[];let urlCount=0;URL.createObjectURL=()=>`blob:isolated-${++urlCount}`;URL.revokeObjectURL=url=>revoked.push(url);
const React=req('react'),{act}=React,{createRoot}=req('react-dom/client'),{MemoryRouter}=req('react-router-dom');
let quota={limit:100000,windowHours:24,usedTokens:0,reservedTokens:0,remainingTokens:100000,resetAt:null,blocked:false},feedbackCalls=[],feedbackPending=[],submissions=[],submitPending=[];
let user={id:'user-1',name:'测试同学',displayName:'',email:'test@invalid.test',uniqueId:'123'},memory={enabled:true,entries:[]},calls=[],pending=[],searches=[],memoryAdds=[];
const api={get:async(url,options)=>{searches.push({url,options});return {data:{results:[{id:'r1',type:'resource',title:'React 入门',url:'/resources'}]}};}};
global.__assistantTest={useUser:()=>({user}),api,
 getAssistantQuota:async()=>({...quota}),isAssistantQuotaError:error=>error.code==='AI_QUOTA_EXCEEDED',
 askAssistantFeedback:(...args)=>{feedbackCalls.push(args);return new Promise((resolve,reject)=>{feedbackPending.push({resolve,reject});args[3].addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});});},submitAssistantFeedback:(...args)=>{submissions.push(args);return new Promise(resolve=>submitPending.push(resolve));},
 getAssistantStatus:async()=>({configured:true,model:'deepseek',limits:{prompt:4000,images:4,imageBytes:2097152},memoryEnabled:true}),
 askAssistant:(...args)=>{calls.push(args);return new Promise((resolve,reject)=>{pending.push({resolve,reject,args});args[4].addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});});},
 assistantError:error=>error.message,
 validateAssistantImages:files=>files.some(file=>file.type==='text/html')?'请选择图片。':null,
 getAssistantMemory:async()=>memory,setMemoryEnabled:async enabled=>{memory={...memory,enabled};return memory;},
 saveMemory:async(text,id)=>{memoryAdds.push({text,id});memory={...memory,entries:[{id:'memo-1',text,createdAt:'2026-10-27',updatedAt:'2026-10-27'}]};},
 removeMemory:async()=>{memory={...memory,entries:[]};},exportMemory:async()=>new Blob(['memory'])};
(async()=>{
 const built=await req('esbuild').build({entryPoints:[root+'/src/components/SearchDialog.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,jsx:'automatic',plugins:[{name:'boundaries',setup(build){
 build.onResolve({filter:/memberAssistant$/},()=>({path:'client',namespace:'mock'}));build.onResolve({filter:/userContextState$/},()=>({path:'user',namespace:'mock'}));build.onResolve({filter:/\/axios$/},()=>({path:'api',namespace:'mock'}));build.onResolve({filter:/AiAnswer$/},()=>({path:'answer',namespace:'mock'}));
 build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='api'?'export default globalThis.__assistantTest.api;':args.path==='answer'?"import React from 'react';export default function Answer({text}){return React.createElement('div',{className:'test-answer'},text)}":'export const {useUser,getAssistantQuota,isAssistantQuotaError,askAssistantFeedback,submitAssistantFeedback,getAssistantStatus,askAssistant,assistantError,validateAssistantImages,getAssistantMemory,setMemoryEnabled,saveMemory,removeMemory,exportMemory}=globalThis.__assistantTest;',loader:'js',resolveDir:root}));
 build.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));}}]});
 const compiled=new Module(__filename,module);compiled.filename=__filename;compiled.paths=[root+'/node_modules'];compiled._compile(built.outputFiles[0].text,__filename);const SearchDialog=compiled.exports.default;
 let host=createRoot(document.getElementById('root'));const opener=document.getElementById('opener');opener.focus();let open=true;const close=()=>{open=false;render();};
 const render=()=>host.render(React.createElement(MemoryRouter,{future:{v7_startTransition:true,v7_relativeSplatPath:true}},React.createElement(SearchDialog,{isOpen:open,onClose:close,restoreFocusRef:{current:opener}})));
 const click=async node=>act(async()=>node.click());const input=async(node,value)=>act(async()=>{Object.getOwnPropertyDescriptor(node.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));});
 const tab=label=>[...document.querySelectorAll('[role="tab"]')].find(node=>node.textContent===label);
 await act(async()=>render());assert.equal(document.querySelectorAll('[role="dialog"]').length,1);assert.match(document.body.textContent,/测试同学/);
 assert.equal(document.querySelectorAll('.assistant-feedback-link').length,0,'remove the duplicate unstyled feedback icon/link');assert.doesNotMatch(document.body.textContent,/未计入已报告用量|AI 额度暂不可用。最早|站内搜索、个人记忆和手动反馈仍可使用/);
 await click([...document.querySelectorAll('.assistant-suggestions button')][0]);const editor=document.querySelector('textarea[aria-label="向 ClassHub AI 提问"]');assert.match(editor.value,/学习资料/);
 const web=document.querySelector('.assistant-web');await click(web);assert.equal(web.getAttribute('aria-pressed'),'true');
 const fileInput=document.querySelector('input[type="file"]');Object.defineProperty(fileInput,'files',{configurable:true,value:[new File(['abc'],'test.png',{type:'image/png'})]});await act(async()=>fileInput.dispatchEvent(new Event('change',{bubbles:true})));assert.equal(document.querySelectorAll('.assistant-photos li').length,1);
 const submit=()=>document.querySelector('.assistant-composer').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await act(async()=>{submit();submit();});assert.equal(calls.length,1);assert.equal(calls[0][3],true);assert.equal(calls[0][2].length,1);
 await click(document.querySelector('[aria-label="停止回答"]'));assert.equal(calls[0][4].aborted,true);assert.match(document.querySelector('[role="alert"]').textContent,/停止/);
 await click([...document.querySelectorAll('[role="alert"] button')][0]);assert.equal(calls.length,2);await act(async()=>pending.at(-1).resolve({answer:'这里有你需要的 React 资料。',sources:[{id:'r1',title:'React 入门',url:'/resources',type:'site'}],usage:{promptTokens:80,completionTokens:20,totalTokens:100,reported:true}}));
 assert.equal(document.querySelector('.assistant-sources a').getAttribute('href'),'/resources');assert.match(document.body.textContent,/100 tokens/);assert.equal(document.querySelectorAll('.assistant-photos li').length,0);assert.ok(revoked.length>=1);
 await input(editor,'请记住：我喜欢代码示例');await act(async()=>submit());await act(async()=>pending.at(-1).resolve({answer:'已记住：我喜欢代码示例。',sources:[],localAction:'memory_saved',usage:{promptTokens:0,completionTokens:0,totalTokens:0,reported:false}}));assert.match(document.body.textContent,/已记住：我喜欢代码示例/);assert.match(document.body.textContent,/这里有你需要的 React 资料/);assert.equal(document.querySelectorAll('.assistant-message__usage').length,1);assert.doesNotMatch(document.body.textContent,/本次用量暂未/);
 await input(editor,'随机抽一个人');await act(async()=>submit());await act(async()=>pending.at(-1).resolve({answer:'本次随机抽取：测试同学。',sources:[{id:'random-call',title:'随机点名',url:'/functions/random-call',type:'site'}],localAction:'random_call',usage:{promptTokens:0,completionTokens:0,totalTokens:0,reported:false}}));
 assert.match(document.body.textContent,/本次随机抽取：测试同学/);assert.equal(document.querySelectorAll('.assistant-message__usage').length,1);assert.doesNotMatch(document.body.textContent,/本次用量暂未/);assert.ok([...document.querySelectorAll('.assistant-sources a')].some(node=>node.getAttribute('href')==='/functions/random-call'));
 await click(tab('站内搜索'));assert.equal(document.querySelectorAll('[role="dialog"]').length,1);const search=document.querySelector('input[aria-label="搜索本站内容"]');await input(search,'React');await act(async()=>new Promise(resolve=>setTimeout(resolve,230)));assert.equal(searches.at(-1).options.params.q,'React');assert.match(document.querySelector('.search-results').textContent,/React 入门/);
 await click(tab('个人记忆'));assert.match(document.body.textContent,/只记住你想留下的事/);const memo=document.querySelector('#assistant-memory-text');await input(memo,'喜欢带示例的解释');await act(async()=>document.querySelector('.assistant-memory__form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(memoryAdds[0].text,'喜欢带示例的解释');assert.match(document.querySelector('.assistant-memory__list').textContent,/喜欢带示例/);
 await click(document.querySelector('.assistant-memory__switch input'));assert.equal(memory.enabled,false);await click(document.querySelector('[aria-label^="删除记忆"]'));assert.equal(memory.entries.length,0);
 await click(tab('AI 模式'));await input(document.querySelector('textarea[aria-label="向 ClassHub AI 提问"]'),'后续问题');await act(async()=>submit());const inFlight=calls.at(-1)[4];
 user={...user,id:'user-2',name:'另一同学'};await act(async()=>render());assert.equal(inFlight.aborted,true);assert.doesNotMatch(document.querySelector('[role="dialog"]').textContent,/这里有你需要的/);assert.match(document.querySelector('[role="dialog"]').textContent,/另一同学/);

 // Feedback is a distinct, editable confirmation flow, never auto-submitted.
 const feedbackButton=()=>[...document.querySelectorAll('.assistant-suggestions button')].find(node=>node.textContent.includes('向开发者'));
 await click(feedbackButton());const feedbackEditor=document.querySelector('[aria-label="向反馈助手描述问题"]');
 await input(feedbackEditor,'手机资源页面找不到下载按钮');await act(async()=>document.querySelector('.assistant-feedback-panel .assistant-composer').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(feedbackCalls.length,1);assert.equal(submissions.length,0);
 await act(async()=>feedbackPending.shift().resolve({answer:'我整理了草稿，请确认后再提交。',draft:{title:'下载入口建议',description:'手机资源页面找不到下载按钮',expected:'希望入口清晰',page:'/resources'},requestId:'fixture',quota:{...quota}}));
 await input(document.querySelector('#assistant-feedback-title'),'建议改进手机资源下载');
 const submitFeedback=()=>document.querySelector('.assistant-feedback-draft').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
 await act(async()=>{submitFeedback();submitFeedback();});assert.equal(submissions.length,1);assert.equal(submissions[0][0].title,'建议改进手机资源下载');assert.match(submissions[0][1],/^[a-f0-9-]{36}$/);
 await act(async()=>submitPending.shift()({id:'receipt-1',status:'new',createdAt:'2026-10-27'}));assert.match(document.body.textContent,/反馈已提交给管理员/);
 // An exhausted account cannot invoke AI but can still confirm manual feedback.
 quota={...quota,usedTokens:100000,remainingTokens:0,blocked:true,resetAt:'2026-10-28T00:00:00Z'};user={...user,id:'user-3'};await act(async()=>render());
 await input(document.querySelector('[aria-label="向 ClassHub AI 提问"]'),'问题');assert.equal(document.querySelector('[aria-label="发送问题"]').disabled,true);
 assert.match(document.body.textContent,/100,000/);assert.equal(document.querySelectorAll('.assistant-quota small').length,0);assert.doesNotMatch(document.querySelector('.assistant-quota').textContent,/正在处理|额度暂不可用|滚动窗口恢复/);await click(feedbackButton());assert.equal(document.querySelector('[aria-label="发送给反馈助手"]').disabled,true);
 await input(document.querySelector('#assistant-feedback-title'),'无需AI也能反馈');await input(document.querySelector('#assistant-feedback-description'),'希望改进页面体验');
 await act(async()=>submitFeedback());assert.equal(submissions.length,2);await act(async()=>submitPending.shift()({id:'receipt-2',status:'new',createdAt:'2026-10-27'}));assert.match(document.body.textContent,/receipt-2/);
 await act(async()=>{open=false;render();});await act(async()=>new Promise(resolve=>setTimeout(resolve,30)));assert.equal(document.activeElement,opener);await act(async()=>host.unmount());dom.window.close();
 console.log('PASS assistant UI: one accessible dialog, genuine identity, prompt chips, web toggle, photos cleanup, duplicate prevention, abort/retry, citations, ordinary search, memory CRUD/toggle, account isolation and restored focus, 24h quota blocking, conversational feedback review and manual submission after quota exhaustion.');
})().catch(error=>{console.error(error);dom.window.close();process.exitCode=1;});

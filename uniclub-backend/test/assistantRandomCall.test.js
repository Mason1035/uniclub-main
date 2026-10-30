const {test,before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const jwt=require('jsonwebtoken');
process.env.JWT_SECRET='isolated-assistant-random-call-only';
const member='111111111111111111111111',admin='222222222222222222222222',outside='333333333333333333333333';
let accounts,roster,reads,randomCalls;
function query(value){return{select(fields){reads.push(fields);return this;},sort(){return this;},lean:async()=>typeof value==='function'?value():value};}
const users={findById:id=>query(()=>accounts[id]||null),find:filter=>query(()=>Object.values(accounts).filter(row=>row.isEnrolled===filter.isEnrolled&&filter.uniqueId.$in.includes(row.uniqueId)))};
const RosterModel={async distinct(){return [...roster];}};
const userPath=require.resolve('../models/User');require.cache[userPath]={id:userPath,filename:userPath,loaded:true,exports:users};
const {AssistantRandomCallService,parseRandomCallCommand}=require('../services/AssistantRandomCallService');
const {createRandomCallMembersService}=require('../services/RandomCallMembersService');
const {MemberAssistantService}=require('../services/MemberAssistantService');
const {createAssistantRouter}=require('../routes/assistantRouter');
const localUsage={promptTokens:0,completionTokens:0,totalTokens:0,reported:false};
const never=async()=>{throw new Error('random roll call must not invoke a model, RAG, web search, memory context or usage ledger');};
const draw=new AssistantRandomCallService({members:createRandomCallMembersService({UserModel:users,RosterModel}),randomInt:max=>{randomCalls++;return max-1;}});
const service=new MemberAssistantService({userModel:users,randomCall:draw,assistant:{apiKey:never,completion:never},knowledge:{retrieve:never},memory:{context:never},usage:{begin:never,report:never,finish:never},withUsage:never,web:{search:never}});
beforeEach(()=>{accounts={
 [member]:{_id:member,name:'张同学',uniqueId:'student',isEnrolled:true,role:'student',tokenVersion:0,email:'private@invalid.test',passwordHash:'never-return'},
 [admin]:{_id:admin,name:'李同学',uniqueId:'student-admin',isEnrolled:true,role:'admin',tokenVersion:0,profile:{avatar:{data:'private-image'}}},
 [outside]:{_id:outside,name:'外部管理员',uniqueId:'outsider',isEnrolled:true,role:'admin',tokenVersion:0},
};roster=['student','student-admin'];reads=[];randomCalls=0;});
test('recognizes explicit natural Chinese draw commands and bounded counts',()=>{
 for(const prompt of ['随机抽一个人','随机抽取一名同学','请帮我随机抽一位同学。','帮我随机点名','随机点名','抽一个同学','再抽一个','从全班中随机抽一个人'])assert.equal(parseRandomCallCommand(prompt).count,1,prompt);
 for(const [prompt,count] of [['随机抽3个人',3],['随机抽取两名同学',2],['请从班级名单中随机抽取五位同学',5],['抽取十个人，不重复',10],['帮我抽２名同学',2]])assert.equal(parseRandomCallCommand(prompt).count,count,prompt);
 for(const prompt of ['随机抽0个人','随机抽51个人'])assert.throws(()=>parseRandomCallCommand(prompt),error=>error.code==='INVALID_DRAW_COUNT');
});
test('instructions inside quotes, explanations, memory, documents and history are not current draw commands',()=>{
 for(const prompt of ['解释随机抽一个人是什么意思','不要随机抽一个人','请记住：随机抽一个人','总结公告：随机抽一个人','"随机抽一个人"','随机抽一个男同学','帮我写一个随机点名程序','随机抽一张照片','帮我随机抽取一篇新闻'])assert.equal(parseRandomCallCommand(prompt),null,prompt);
});
test('draws from the existing current member pool, including student administrators, without replacement',async()=>{
 const result=await draw.draw(member,2);assert.deepEqual(result.names,['李同学','张同学']);assert.equal(result.poolSize,2);assert.equal(randomCalls,2);
 assert.ok(reads.includes('uniqueId isEnrolled'));assert.ok(reads.includes('_id name profile.avatar.contentType'));
 assert.equal(JSON.stringify(result).includes('never-return'),false);assert.equal(JSON.stringify(result).includes('private@'),false);assert.equal(JSON.stringify(result).includes('private-image'),false);
});
test('roster removal and unenrollment apply immediately even to a student administrator',async()=>{
 await draw.draw(admin,1);roster=['student'];await assert.rejects(draw.draw(admin,1),error=>error.status===403);
 accounts[member].isEnrolled=false;await assert.rejects(draw.draw(member,1),error=>error.status===403);
 await assert.rejects(draw.draw(outside,1),error=>error.status===403);
});
test('empty pools and excess requested counts never invent or repeat names',async()=>{
 await assert.rejects(draw.draw(member,3),error=>error.code==='DRAW_COUNT_EXCEEDS_POOL');
 accounts[member].name='';accounts[admin].name='';await assert.rejects(draw.draw(member,1),error=>error.code==='RANDOM_CALL_EMPTY');
});
test('roster failure is controlled and raw database details cannot reach the user',async()=>{
 const unavailable=new AssistantRandomCallService({members:async()=>{throw new Error('mongodb://private-db password');}});
 await assert.rejects(unavailable.draw(member),error=>error.code==='RANDOM_CALL_UNAVAILABLE'&&error.status===503&&!error.message.includes('mongodb'));
});
test('member AI returns the real local result without DeepSeek, unrelated sources or token consumption',async()=>{
 const deltas=[],statuses=[];
 const result=await service.chat(member,{prompt:'随机抽一个人',webSearch:true},[],{onDelta:delta=>deltas.push(delta),onStatus:status=>statuses.push(status)});
 assert.equal(result.localAction,'random_call');assert.match(result.answer,/李同学/);assert.match(result.answer,/2/);assert.equal(deltas.join(''),result.answer);assert.ok(statuses.length);
 assert.deepEqual(result.usage,localUsage);assert.equal(result.sources.length,1);assert.equal(result.sources[0].url,'/functions/random-call');
 assert.equal(result.answer.includes('private'),false);assert.equal(result.answer.includes('外部管理员'),false);
});
test('a cancelled draw emits no result and does not touch the class pool',async()=>{
 const controller=new AbortController();controller.abort();await assert.rejects(service.chat(member,{prompt:'随机抽一个人'},[],{signal:controller.signal,onDelta(){assert.fail('cancelled result must not be emitted');}}),error=>error.code==='CANCELLED');assert.equal(randomCalls,0);
});
let server,origin;
before(async()=>{const app=express();app.use(express.json());app.use('/api/assistant',createAssistantRouter({service,requestLimit:100}));server=await new Promise(resolve=>{const started=app.listen(0,'127.0.0.1',()=>resolve(started));});origin=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{server?.closeAllConnections();if(server)await new Promise(resolve=>server.close(resolve));});
async function post(id,body,accept='application/json'){
 const response=await fetch(origin+'/api/assistant/chat',{method:'POST',headers:{'Content-Type':'application/json',Accept:accept,...(id&&{Authorization:'Bearer '+jwt.sign({userId:id,tokenVersion:0,role:'admin'},process.env.JWT_SECRET)})},body:JSON.stringify(body)});
 return{status:response.status,headers:response.headers,text:await response.text()};
}
test('the existing authenticated chat route handles both JSON and SSE draws',async()=>{
 const response=await post(member,{prompt:'随机抽一个人'});assert.equal(response.status,200);assert.equal(JSON.parse(response.text).localAction,'random_call');
 const stream=await post(admin,{prompt:'随机抽取两名同学'},'text/event-stream');assert.equal(stream.status,200);assert.match(stream.text,/event: status/);assert.match(stream.text,/event: delta/);assert.match(stream.text,/event: result/);assert.match(stream.text,/李同学/);assert.match(stream.text,/张同学/);assert.match(stream.headers.get('cache-control'),/no-store/);
});
test('guests, outside administrators and caller-supplied user ids cannot draw from the roster',async()=>{
 assert.equal((await post(null,{prompt:'随机抽一个人'})).status,401);
 assert.equal((await post(outside,{prompt:'随机抽一个人'})).status,403);
 assert.equal((await post(member,{prompt:'随机抽一个人',userId:admin})).status,400);
 assert.equal(randomCalls,0);
});

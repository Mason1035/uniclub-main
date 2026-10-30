const {test}=require('node:test');
const assert=require('node:assert/strict');
const {AssistantQuotaService,withAssistantUsage,inputTokenUpperBound}=require('../services/AssistantQuotaService');
const {DeepSeekAssistant}=require('../services/DeepSeekAssistant');
const {createQuotaModel,createUsageService}=require('./fixtures/assistantQuotaMemory');
const member='111111111111111111111111';
const messages=[{role:'user',content:'hello'}];
const usage=(promptTokens,completionTokens)=>({promptTokens,completionTokens,totalTokens:promptTokens+completionTokens,reported:true});
function setup({now='2026-10-27T08:00:00Z',legacy=[]}={}){
  let time=new Date(now);const model=createQuotaModel();const options={quotaModel:model,legacyUsageModel:{find(){return{select(){return this;},lean:async()=>structuredClone(legacy)};}},clock:()=>new Date(time)};
  return{model,quota:new AssistantQuotaService(options),another:()=>new AssistantQuotaService(options),advance:ms=>{time=new Date(time.getTime()+ms);},setTime:value=>{time=new Date(value);}};
}
test('rolling 24h quota includes existing usage and expires exact boundary without midnight reset',async()=>{
  const ctx=setup({legacy:[{_id:'old',createdAt:new Date('2026-10-27T07:00:00Z'),reported:true,totalTokens:90000}]});
  const initial=await ctx.quota.status(member);assert.equal(initial.usedTokens,90000);assert.equal(initial.remainingTokens,10000);
  ctx.setTime('2026-10-27T16:00:00Z');assert.equal((await ctx.quota.status(member)).usedTokens,90000);
  ctx.setTime('2026-10-28T07:00:00Z');assert.equal((await ctx.quota.status(member)).usedTokens,0);
});
test('two server instances reserve atomically and cannot overspend together',async()=>{
  const ctx=setup();const attempts=await Promise.allSettled([ctx.quota.reserve(member,messages,60000),ctx.another().reserve(member,messages,60000)]);
  assert.equal(attempts.filter(r=>r.status==='fulfilled').length,2);const allocations=attempts.map(r=>r.value);assert.ok(allocations[1].maxTokens<60000||allocations[0].maxTokens<60000);
  assert.equal((await ctx.quota.status(member)).remainingTokens,0);await assert.rejects(ctx.another().reserve(member,messages,1),e=>e.code==='AI_QUOTA_EXCEEDED');
});
test('settling exact provider usage is idempotent and releases only its reservation',async()=>{
  const ctx=setup(),first=await ctx.quota.reserve(member,messages,4096),second=await ctx.quota.reserve(member,messages,4096);
  await ctx.quota.settle(member,first.callId,usage(20,2));await ctx.quota.settle(member,first.callId,usage(999,999));
  const state=await ctx.quota.status(member);assert.equal(state.usedTokens,22);assert.equal(state.reservedTokens,second.reservedTokens);
});
test('unknown or cancelled requests keep their budget for 24h and late usage cannot touch another call',async()=>{
  const ctx=setup(),first=await ctx.quota.reserve(member,messages,4096);assert.equal((await ctx.another().status(member)).reservedTokens,first.reservedTokens);
  ctx.advance(24*60*60*1000);const second=await ctx.quota.reserve(member,messages,1024);await ctx.quota.settle(member,first.callId,usage(2,2));assert.equal((await ctx.quota.status(member)).reservedTokens,second.reservedTokens);
});
test('input bound excludes image base64 and output is clamped near the limit',async()=>{
  const text=inputTokenUpperBound(messages),photo=inputTokenUpperBound([{role:'user',content:[{type:'text',text:'hello'},{type:'image_url',image_url:{url:'data:image/png;base64,'+'A'.repeat(1000000)}}]}]);
  assert.ok(photo-text>=1024);assert.ok(photo-text<1500);
  const ctx=setup({legacy:[{_id:'old',createdAt:new Date('2026-10-27T07:00:00Z'),reported:true,totalTokens:100000-text-25}]});
  const reserved=await ctx.quota.reserve(member,messages,4096);assert.equal(reserved.maxTokens,25);assert.equal(reserved.reservedTokens,text+25);
});
test('shared completion blocks before HTTP and aggregates known usage for every call',async()=>{
  let calls=0;const ctx=setup(),accounting=createUsageService();const client=new DeepSeekAssistant({httpClient:{async post(_path,body){calls++;return{data:{choices:[{message:{content:'OK'},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:2,total_tokens:12}}};}}});
  const result=await withAssistantUsage(member,async()=>{await client.completion('fake',messages);return client.completion('fake',messages);},{source:'test',quotaService:ctx.quota,usageService:accounting});
  assert.equal(calls,2);assert.equal(result.usage.totalTokens,24);assert.equal(result.quota.usedTokens,24);
  const blocked=setup({legacy:[{_id:'full',createdAt:new Date('2026-10-27T07:00:00Z'),reported:true,totalTokens:100000}]});
  await assert.rejects(withAssistantUsage(member,()=>client.completion('fake',messages),{source:'admin',quotaService:blocked.quota,usageService:accounting}),e=>e.code==='AI_QUOTA_EXCEEDED');assert.equal(calls,2);
});

test('nested accounting cannot silently charge another user',async()=>{
  const ctx=setup(),accounting=createUsageService();
  await assert.rejects(withAssistantUsage(member,()=>withAssistantUsage('222222222222222222222222',async()=>{}),{quotaService:ctx.quota,usageService:accounting}),error=>error.code==='FORBIDDEN');
});
test('a retry keeps the uncertain first reservation and counts the second actual completion',async()=>{
  let calls=0;const ctx=setup(),accounting=createUsageService();
  const client=new DeepSeekAssistant({httpClient:{async post(){calls++;if(calls===1)throw new Error('isolated network failure');return{data:{choices:[{message:{content:'OK'},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:2,total_tokens:12}}};}}});
  const result=await withAssistantUsage(member,()=>client.completion('fake',messages,{retries:1}),{quotaService:ctx.quota,usageService:accounting});
  assert.equal(calls,2);assert.equal(result.usage.totalTokens,12);assert.equal(result.quota.usedTokens,12);assert.ok(result.quota.reservedTokens>4096);assert.equal(result.usage.reported,false);
});
test('unknown legacy usage cannot consume an invented full allowance',async()=>{
  const legacy=[{_id:'unknown',createdAt:new Date('2026-10-27T07:00:00Z'),reported:false,totalTokens:0,state:'started'}];
  const ctx=setup({legacy});
  const state=await ctx.quota.status(member);assert.equal(state.usedTokens,0);assert.equal(state.reservedTokens,0);assert.equal(state.remainingTokens,100000);assert.equal(state.blocked,false);
  assert.ok((await ctx.quota.reserve(member,messages,100)).maxTokens>0);
  assert.equal(legacy[0].reported,false,'unknown ledger evidence must not be fabricated');
});
test('existing incorrect full legacy reservation is repaired without resetting actual usage or live reservations',async()=>{
  const ctx=setup({legacy:[{_id:'unknown',createdAt:new Date('2026-10-27T07:00:00Z'),reported:false,totalTokens:0}]});
  await ctx.model.create({_id:member,revision:4,entries:[
    {callId:'legacy:known',at:new Date('2026-10-27T07:30:00Z'),reservedTokens:0,usedTokens:24641},
    {callId:'legacy:unknown',at:new Date('2026-10-27T07:00:00Z'),reservedTokens:100000,usedTokens:null},
    {callId:'live-call',at:new Date('2026-10-27T07:59:00Z'),reservedTokens:3000,usedTokens:null},
  ]});
  const state=await ctx.quota.status(member);assert.equal(state.usedTokens,24641);assert.equal(state.reservedTokens,3000);assert.equal(state.remainingTokens,72359);assert.equal(state.blocked,false);
  const revision=ctx.model.rows.get(member).revision;
  assert.equal((await ctx.another().status(member)).remainingTokens,72359);assert.equal(ctx.model.rows.get(member).revision,revision,'repair is idempotent');
  assert.equal((await ctx.quota.reserve(member,messages,100)).maxTokens,100);
});
test('known partial usage in an old request remains counted even with missing calls',async()=>{
  const ctx=setup({legacy:[{_id:'partial',createdAt:new Date('2026-10-27T07:00:00Z'),reported:true,unknownCalls:1,totalTokens:24641}]});
  const state=await ctx.quota.status(member);assert.equal(state.usedTokens,24641);assert.equal(state.reservedTokens,0);assert.equal(state.remainingTokens,75359);
});

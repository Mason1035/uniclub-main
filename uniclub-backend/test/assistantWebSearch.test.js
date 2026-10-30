const test = require('node:test');
const assert = require('node:assert/strict');
const { AssistantWebSearch } = require('../services/AssistantWebSearch');
const { AiError } = require('../utils/aiSecret');

function setup(results = []) {
  const calls = [];
  const assistant = { apiKey: async () => 'test-key-never-a-real-key', http: { post: async (...args) => { calls.push(args); return { data: { results } }; } } };
  return { service: new AssistantWebSearch({ assistant }), calls, assistant };
}
test('uses existing provider key and fixed general-web endpoint with bounded query and result count', async () => {
  const {service,calls} = setup([{title:'官方说明',url:'https://example.com/docs',summary:'可验证的搜索摘要',content:'not requested'}]);
  const result = await service.search('现在有哪些学习资源？'.repeat(30));
  assert.equal(result.performed,true); assert.equal(calls.length,1);
  assert.equal(calls[0][0],'/v1/tools/search');
  assert.equal(calls[0][1].count,4); assert.equal(calls[0][1].need_content,false);
  assert.equal(Array.from(calls[0][1].query).length,128);
  assert.equal(calls[0][2].headers.Authorization,'Bearer test-key-never-a-real-key');
  assert.equal(calls[0][2].maxRedirects,0); assert.ok(calls[0][2].timeout<=20000);
  assert.equal(result.sources[0].type,'web'); assert.equal(result.sources[0].text,'可验证的搜索摘要');
  assert.ok(!JSON.stringify(result).includes('not requested'));
});
test('rejects invalid query and cancellation before credential/provider access', async () => {
  const {service,calls,assistant}=setup(); let reads=0;assistant.apiKey=async()=>{reads++;return 'fake';};
  for(const question of ['', '   ', {},null])await assert.rejects(service.search(question),error=>error.code==='INVALID_QUESTION');
  const controller=new AbortController();controller.abort();
  await assert.rejects(service.search('test',{signal:controller.signal}),error=>error.code==='CANCELLED');
  assert.equal(reads,0);assert.equal(calls.length,0);
});
test('filters unsafe citations, deduplicates and caps retrieved data without fetching any result URL', async () => {
  const rows=[{title:'private',url:'http://127.0.0.1/secret',summary:'no'}, {title:'script',url:'javascript:alert(1)',summary:'no'}, {title:'user',url:'https://user:password@example.com/',summary:'no'}, ...Array.from({length:12},(_,i)=>({title:`<b>来源${i}</b>`,url:`https://example.com/${Math.floor(i/2)}#fragment`,summary:'<p>正文</p>'.repeat(1000)}))];
  const {service,calls}=setup(rows);const result=await service.search('资源');
  assert.equal(calls.length,1);assert.equal(result.sources.length,4);assert.equal(new Set(result.sources.map(row=>row.url)).size,4);
  for(const row of result.sources){assert.ok(row.text.length<=1800);assert.ok(!row.text.includes('<p>'));assert.ok(!row.title.includes('<b>'));assert.ok(!row.url.includes('#'));}
});
test('empty results are real empty search rather than fabricated evidence; invalid payload fails safely', async () => {
  const {service,assistant}=setup();assert.deepEqual(await service.search('zero'),{sources:[],performed:true});
  assistant.http.post=async()=>({data:{unexpected:true}});
  await assert.rejects(service.search('x'),error=>error.code==='SEARCH_UNAVAILABLE'&&!error.message.includes('unexpected'));
});
test('provider/network errors do not expose keys or request data; cancellation propagates', async () => {
  const {service,assistant}=setup();assistant.http.post=async()=>{throw new Error('Authorization Bearer secret request body');};
  await assert.rejects(service.search('hello'),error=>error.code==='SEARCH_UNAVAILABLE'&&!error.message.includes('secret'));
  assistant.apiKey=async()=>{throw new AiError('NOT_CONFIGURED','未配置密钥',503);};
  await assert.rejects(service.search('hello'),error=>error.code==='NOT_CONFIGURED');
});

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const sharp = require('sharp');
process.env.JWT_SECRET = 'admin-ai-isolated-test-only';
process.env.AI_SECRET_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
const { DeepSeekAssistant, publicSettings, providerError, BASE_URL } = require('../services/DeepSeekAssistant');
const { encrypt, decrypt } = require('../utils/aiSecret');
const { EXAMPLES, SCENARIOS, systemPrompt } = require('../utils/aiPrompts');
const { LIMITS, imageParts, parseStructured, validateInput } = require('../utils/aiValidation');
const SettingsSchema = require('../models/AiSettings');
const realModels = { Event: require('../models/Event'), News: require('../models/News'), Resource: require('../models/Resource'), Announcement: require('../models/Announcement') };
const admin = '111111111111111111111111', member = '222222222222222222222222';
const key1 = 'sk-isolated-test-secret-never-use-1234', key2 = 'sk-isolated-test-secret-never-use-5678';
let row, requests, replies, accounts, creates, server, origin;
const query = value => ({ select() { return this; }, lean() { return this; }, populate() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const model = {
  findById() { let selected = false; return { select() { selected = true; return this; }, lean() { const doc = row ? structuredClone(row) : null; if (doc && !selected) delete doc.secret; return Promise.resolve(doc); } }; },
  findOneAndUpdate(filter, update) { assert.deepEqual(filter, { _id: 'deepseek' }); row ||= { _id: 'deepseek' }; Object.assign(row, update.$set, { updatedAt: new Date().toISOString() }); for (const k of Object.keys(update.$unset || {})) delete row[k]; return query(structuredClone(row)); },
};
const httpClient = { async post(path, body, options) {
  requests.push({ path, body, options });
  const reply = replies.shift() || { answer: 'OK' };
  if (reply.error) throw reply.error;
  if (reply.stream) return { data: Readable.from(reply.stream) };
  return { data: { choices: [{ message: { content: reply.answer }, finish_reason: reply.finish || 'stop' }] } };
} };
const assistant = new DeepSeekAssistant({ settingsModel: model, httpClient });
function stub(name, exports) { const id = require.resolve(name); require.cache[id] = { id, filename: id, loaded: true, exports }; }
const User = {
  findById: id => query(accounts[id] || null),
  findByIdAndUpdate: async () => {},
};
stub('../models/User', User);
for (const [name, Real] of Object.entries(realModels)) {
  class MemoryModel {
    constructor(data) { this.doc = new Real(data); Object.assign(this, this.doc.toObject()); }
    static async create(data) { const doc = new this(data); await doc.save(); return doc; }
    async save() { const error = this.doc.validateSync(); if (error) throw error; creates.push({ model: name, data: this.doc.toObject() }); }
    async populate() { return this; }
    toJSON() { const data = { ...this }; delete data.doc; return data; }
  }
  stub(`../models/${name}`, MemoryModel);
}
stub('../services/NewsCurationService', class {});
const requireAdmin = require('../middleware/admin');
const { createAiRouter } = require('../routes/admin/ai');
const token = id => jwt.sign({ userId: id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '5m' });
const call = async (path, method = 'GET', body, id = admin, accept) => {
  const response = await fetch(origin + path, { method, headers: { ...(id && { Authorization: `Bearer ${token(id)}` }), ...(body && { 'Content-Type': 'application/json' }), ...(accept && { Accept: accept }) }, ...(body && { body: JSON.stringify(body) }) });
  return { status: response.status, data: accept ? await response.text() : await response.json() };
};
before(async () => {
  const app = express(); app.use(express.json({ limit: '10mb' }));
  app.use('/api/admin/ai', requireAdmin, createAiRouter({ assistant }));
  app.use('/api/admin/announcements', requireAdmin, require('../routes/admin/announcements'));
  app.use('/api/events', require('../routes/eventRouter'));
  app.use('/api/news', require('../routes/newsRouter'));
  app.use('/api/resources', require('../routes/resourceRouter'));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server?.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
beforeEach(() => { row = null; requests = []; replies = []; creates = []; accounts = { [admin]: { _id: admin, isAdmin: true, tokenVersion: 0 }, [member]: { _id: member, isAdmin: false, tokenVersion: 0 } }; });
const save = () => assistant.saveKey(key1, admin);
const valid = kind => {
  const draft = structuredClone(EXAMPLES[kind]); draft.title = '班级技术分享';
  if (kind === 'activity') Object.assign(draft, { description: '交流学习经验', startDate: '2026-10-10T14:00:00+08:00', endDate: '2026-10-10T16:00:00+08:00', location: { type: 'physical', address: '教学楼', room: '101', virtualLink: '' }, eventType: 'Meetup' });
  if (kind === 'announcement') draft.body = '请按实际要求准备材料';
  if (kind === 'news') Object.assign(draft, { excerpt: '班级同学交流学习经验', content: '同学们分享自己的学习过程。', source: '班级供稿' });
  if (kind === 'resource') Object.assign(draft, { description: '学习资源说明', type: 'Tutorial', category: '学习网站', linkUrl: 'https://example.com/lesson' });
  return draft;
};

test('all AI endpoints enforce authenticated DB-backed admin rights', async () => {
  for (const [method, path] of [['GET','settings'],['GET','status'],['PUT','settings'],['DELETE','settings'],['POST','test'],['POST','generate']]) {
    assert.equal((await call(`/api/admin/ai/${path}`, method, method === 'GET' ? undefined : {}, null)).status, 401);
    assert.equal((await call(`/api/admin/ai/${path}`, method, method === 'GET' ? undefined : {}, member)).status, 403);
  }
  assert.equal(requests.length, 0); assert.equal(row, null);
});
test('AES-GCM key is encrypted, authenticated, select:false and never returned', async () => {
  assert.equal(SettingsSchema.schema.path('secret').options.select, false);
  const response = await call('/api/admin/ai/settings', 'PUT', { apiKey: key1 });
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.data).sort(), ['configured','last4','model','provider','updatedAt','updatedBy']);
  assert.equal(response.data.last4, '1234'); assert.equal(decrypt(row.secret), key1);
  assert.ok(!JSON.stringify(row).includes(key1));
  assert.ok(!JSON.stringify(response.data).includes(row.secret.ciphertext));
  const cipher = encrypt(key1); cipher.authTag = crypto.randomBytes(16).toString('base64');
  assert.throws(() => decrypt(cipher), { code: 'SECRET_UNREADABLE' });
  for (const path of ['settings', 'status']) { const result = await call(`/api/admin/ai/${path}`); assert.ok(!JSON.stringify(result.data).includes(key1)); assert.ok(!JSON.stringify(result.data).includes('ciphertext')); }
  assert.deepEqual(publicSettings({ ...row, apiKey: key1 }), response.data);
});
test('key replacement, connection test and deletion use the server key only', async () => {
  await save(); await assistant.saveKey(key2, admin);
  const result = await call('/api/admin/ai/test','POST',{});
  assert.equal(result.status, 200); assert.equal(requests[0].options.headers.Authorization, `Bearer ${key2}`);
  assert.equal(requests[0].body.model, 'deepseek-flash'); assert.equal(requests[0].path, '/chat/completions');
  assert.equal(new DeepSeekAssistant().http.defaults.baseURL, BASE_URL);
  assert.ok(!JSON.stringify(result.data).includes(key2));
  assert.equal((await call('/api/admin/ai/settings','DELETE',{})).data.configured, false);
  assert.equal(row.secret, undefined);
  assert.equal((await call('/api/admin/ai/generate','POST',{ scenario:'free',prompt:'问题' })).data.code, 'NOT_CONFIGURED');
});
test('missing/wrong master key fails safely without changing stored secret', async () => {
  const old = process.env.AI_SECRET_ENCRYPTION_KEY;
  try {
    delete process.env.AI_SECRET_ENCRYPTION_KEY;
    const failed = await call('/api/admin/ai/settings','PUT',{apiKey:key1}); assert.equal(failed.status,503); assert.equal(row,null);
    process.env.AI_SECRET_ENCRYPTION_KEY = old; await save();
    process.env.AI_SECRET_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
    await assert.rejects(assistant.apiKey(),{code:'SECRET_UNREADABLE'});
  } finally { process.env.AI_SECRET_ENCRYPTION_KEY=old; }
});
test('text generation uses deepseek-flash, correct messages and separate publication', async () => {
  await save(); replies.push({answer:'# 回答\n\n- 要点\n\n```js\nconst a = 1;\n```'});
  const output = await call('/api/admin/ai/generate','POST',{scenario:'free',prompt:'问题',history:[{role:'user',content:'之前的问题'},{role:'assistant',content:'之前的回答'}]});
  assert.equal(output.status,200); assert.equal(output.data.publishType,null); assert.match(output.data.answer,/# 回答/);
  assert.equal(requests[0].body.model,'deepseek-flash'); assert.equal(requests[0].body.messages[0].role,'system'); assert.deepEqual(requests[0].body.thinking,{type:'disabled'});
  assert.equal(requests[0].body.messages[3].content,'问题'); assert.equal(creates.length,0);
});
test('all four structured scenarios follow actual model fields and never auto-publish', async () => {
  await save();
  for (const kind of ['activity','announcement','news','resource']) {
    replies.push({answer:JSON.stringify(valid(kind))});
    const output=await assistant.generate({scenario:kind,prompt:'使用上述真实资料'},[]);
    assert.equal(output.publishType,kind);assert.deepEqual(output.structured,valid(kind));
    assert.deepEqual(requests.at(-1).body.response_format,{type:'json_object'});
    assert.match(systemPrompt(kind),/不得编造/);
  }
  assert.equal(Object.keys(SCENARIOS).length,12);assert.equal(creates.length,0);
});
test('structured output is repaired once and falls back to non-publishable text', async () => {
  await save(); replies.push({answer:'错误 JSON'},{answer:JSON.stringify(valid('news'))});
  assert.equal((await assistant.generate({scenario:'news',prompt:'材料'},[])).publishType,'news');assert.equal(requests.length,2);
  requests=[];replies.push({answer:'无法解析的原回答'},{answer:'仍然错误'});
  const result=await assistant.generate({scenario:'activity',prompt:'材料'},[]);
  assert.equal(result.publishType,null);assert.equal(result.structured,null);assert.equal(result.answer,'无法解析的原回答');assert.match(result.warning,/无法转换/);assert.equal(requests.length,2);
  assert.throws(()=>parseStructured('news',JSON.stringify({...valid('news'),categories:['imaginary']})));
});
test('vision validates actual MIME, corrupt bytes, formats, dimensions and size', async () => {
  await save();
  for (const [format,mime] of [['jpeg','image/jpeg'],['png','image/png'],['gif','image/gif'],['webp','image/webp']]) {
    const buffer=await sharp({create:{width:8,height:8,channels:3,background:'white'}}).toFormat(format).toBuffer();
    replies.push({answer:'图片中的内容'});
    const result=await assistant.generate({scenario:'vision',prompt:'说明图片'},[{buffer,mimetype:mime}]);
    assert.equal(result.publishType,null);
    const parts=requests.at(-1).body.messages.at(-1).content;assert.equal(parts[0].type,'text');assert.equal(parts[1].type,'image_url');assert.ok(parts[1].image_url.url.startsWith(`data:${mime};base64,`));
    assert.equal(requests.at(-1).body.messages.filter(m=>Array.isArray(m.content)).length,1);
    await assert.rejects(imageParts([{buffer,mimetype:'text/html'}]),{code:'INVALID_IMAGE'});
  }
  await assert.rejects(imageParts([{buffer:Buffer.from('<html>fake</html>'),mimetype:'image/png'}]),{code:'INVALID_IMAGE'});
  await assert.rejects(imageParts(Array(5).fill({})),{code:'TOO_MANY_IMAGES'});
  await assert.rejects(imageParts([{buffer:Buffer.alloc(LIMITS.imageBytes+1),mimetype:'image/png'}]),{code:'IMAGE_TOO_LARGE'});
});
test('multipart image + text reaches vision without a disk/COS upload', async () => {
  await save();replies.push({answer:'识别完成'});
  const image=await sharp({create:{width:8,height:8,channels:3,background:'white'}}).png().toBuffer();
  const body=new FormData();body.append('scenario','vision');body.append('prompt','识别这张图');body.append('history','[]');body.append('images',new Blob([image],{type:'image/png'}),'sample.png');
  const response=await fetch(origin+'/api/admin/ai/generate',{method:'POST',headers:{Authorization:`Bearer ${token(admin)}`},body});
  assert.equal(response.status,200);assert.equal((await response.json()).answer,'识别完成');assert.equal(creates.length,0);
});
test('SSE preserves split UTF-8, emits final result and rejects incomplete streams', async () => {
  await save();
  const stream=Buffer.from('data: '+JSON.stringify({choices:[{delta:{content:'你好'}}]})+'\n\n'+'data: [DONE]\n\n');
  replies.push({stream:Array.from(stream).map(b=>Buffer.from([b]))});
  const response=await call('/api/admin/ai/generate','POST',{scenario:'free',prompt:'测试'},admin,'text/event-stream');
  assert.equal(response.status,200);assert.match(response.data,/event: delta/);assert.match(response.data,/你好/);assert.match(response.data,/event: result/);
  replies.push({stream:['data: '+JSON.stringify({choices:[{delta:{content:'未完成'}}]})+'\n\n']});
  await assert.rejects(assistant.generate({scenario:'free',prompt:'测试'},[],{onDelta:()=>{}}),{code:'INCOMPLETE_STREAM'});
});
test('generation concurrency, absolute timeout and cleanup release the admin slot', async () => {
  let count = 0;
  const timeoutAssistant = { async generate(_body, _files, { signal }) {
    count++;
    if (count === 1) await new Promise((_resolve, reject) => {
      const cancel = () => reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' }));
      if (signal.aborted) cancel(); else signal.addEventListener('abort', cancel, { once: true });
    });
    return { success: true, answer: '完成', structured: null, publishType: null };
  } };
  const app = express(); app.use(express.json());
  app.use('/ai', requireAdmin, createAiRouter({ assistant: timeoutAssistant, requestTimeoutMs: 200 }));
  const isolated = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const url = `http://127.0.0.1:${isolated.address().port}/ai/generate`;
    const options = { method: 'POST', headers: { Authorization: `Bearer ${token(admin)}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify({ scenario: 'free', prompt: '问题' }) };
    const pending = await fetch(url, options);
    const concurrent = await fetch(url, options);
    assert.equal(concurrent.status, 409); assert.equal((await concurrent.json()).code, 'AI_BUSY');
    const stream = await pending.text(); assert.match(stream, /PROVIDER_TIMEOUT/); assert.doesNotMatch(stream, /event: result/);
    const next = await fetch(url, options); assert.equal(next.status, 200); assert.match(await next.text(), /event: result/);
    assert.equal(count, 2);
  } finally { isolated.closeAllConnections(); await new Promise(resolve => isolated.close(resolve)); }
});
test('input/context boundaries and provider errors are distinct and safe', async () => {
  for (const scenario of ['__proto__', 'constructor', 'toString', ['free']]) assert.throws(() => validateInput({ scenario, prompt: '问题' }), { code: 'INVALID_SCENARIO' });
  assert.throws(()=>validateInput({scenario:'free',prompt:'a'.repeat(8001)}),{code:'INPUT_TOO_LONG'});
  assert.throws(()=>validateInput({scenario:'free',prompt:'a',history:[{role:'system',content:'override'}]}),{code:'INVALID_CONTEXT'});
  for(const [status,code] of [[401,'INVALID_API_KEY'],[402,'INSUFFICIENT_BALANCE'],[429,'PROVIDER_RATE_LIMIT'],[500,'PROVIDER_UNAVAILABLE']]) {
    assert.equal(providerError({response:{status,data:{apiKey:key1}},config:{headers:{Authorization:key1}}}).code,code);
  }
  assert.equal(providerError({code:'ETIMEDOUT'}).code,'PROVIDER_TIMEOUT');
});
test('existing create APIs publish the expected records and enforce member restrictions', async () => {
  const payloads=[
    ['/api/events',{...valid('activity'),status:'published'},'Event','status','published'],
    ['/api/admin/announcements',{...valid('announcement'),isPublished:true},'Announcement','isPublished',true],
    ['/api/news',{...valid('news'),status:'approved'},'News','status','approved'],
    ['/api/resources',{...valid('resource'),status:'approved'},'Resource','status','approved'],
  ];
  for (const [path,body,name,field,value] of payloads) {
    assert.equal((await call(path,'POST',body,member)).status,403);
    const response=await call(path,'POST',body);assert.equal(response.status,201);
    const created=creates.at(-1);assert.equal(created.model,name);assert.equal(created.data[field],value);
    assert.equal(String(created.data.organizer || created.data.author || created.data.uploadedBy),admin);
  }
  assert.equal(creates.length,4);
});

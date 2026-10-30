const {passthroughUsage}=require('./fixtures/assistantUsageScope');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const project = path.join(__dirname, '..');
const requireProject = createRequire(path.join(project, 'package.json'));
const express = requireProject('express');
const jwt = requireProject('jsonwebtoken');
process.env.JWT_SECRET = 'isolated-staff-business-tests-only';
const oid = n => n.toString(16).padStart(24, '0');
const ids = { student: oid(1), committee: oid(2), teacher: oid(3), admin: oid(4), owner: oid(5) };
const itemId = oid(100), proofId = oid(101);
let accounts, records, calls;

const clone = value => value === undefined ? undefined : structuredClone(value);
const get = (row, key) => key.split('.').reduce((value, segment) => value?.[segment], row);
function set(row, key, value) {
  const parts = key.split('.');
  const last = parts.pop();
  let cursor = row;
  for (const part of parts) cursor = cursor[part] ||= {};
  cursor[last] = value;
}
function projectFields(row, selection) {
  if (!row || !selection) return row;
  if (selection.startsWith('-')) return row;
  const result = { _id: row._id };
  for (const field of selection.split(/\s+/).filter(Boolean)) {
    const value = get(row, field);
    if (value !== undefined) set(result, field, value);
  }
  return result;
}
function query(value) {
  let result = value;
  return {
    select(fields) { result = Array.isArray(result) ? result.map(row => projectFields(row, fields)) : projectFields(result, fields); return this; },
    populate() { return this; }, lean() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
}
function stub(relative, exports) {
  const filename = requireProject.resolve(relative);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
const User = { findById(id) { return query(accounts?.[String(id)] || null); } };
stub('./models/User', User);
stub('./models/EnrolledUser', { exists: async () => true });
function model(name) {
  return class Model {
    constructor(fields) { Object.assign(this, { _id: itemId }, clone(fields)); }
    async save() { calls.push([name, 'save']); records[name].set(String(this._id), this); return this; }
    async populate() { return this; }
    toObject() { return { ...this }; }
    static async create(fields) { const row = new this(fields); return row.save(); }
    static find() { return query([...records[name].values()]); }
    static findById(id) { return query(records[name].get(String(id)) || null); }
    static findByIdAndUpdate(id, update) {
      const row = records[name].get(String(id));
      if (row) {
        for (const [key, value] of Object.entries(update.$set || update)) set(row, key, clone(value));
        for (const key of Object.keys(update.$unset || {})) delete row[key];
        calls.push([name, 'update']);
      }
      return query(row || null);
    }
    static findByIdAndDelete(id) { const row = records[name].get(String(id)) || null; if (row) { records[name].delete(String(id)); calls.push([name,'delete']); } return query(row); }
    static countDocuments() { return query(records[name].size); }
    static aggregate() { return query([]); }
  };
}
for (const name of ['News', 'Resource', 'PastEvent', 'Announcement']) stub(`./models/${name}`, model(name));
stub('./models/Comment', { aggregate: () => query([]), deleteMany: async () => ({ deletedCount: 0 }) });
stub('./models/Notification', { countDocuments: () => query(0) });
stub('./services/NewsCurationService', class {});
stub('./services/ContentCurationService', { curateFeaturedContent: async () => { throw new Error('No paid curation'); }, testCuration: async () => { throw new Error('No paid curation'); } });

stub('./services/DeepSeekAssistant', { DeepSeekAssistant: class {} });
stub('./utils/aiPrompts', { SCENARIOS: {} });

const { requireStaff, isStaffUser } = requireProject('./middleware/admin');
const FeeService = requireProject('./services/FeeService');
const QuantificationService = requireProject('./services/QuantificationService');
const realQuantificationAccess = new QuantificationService({ repository: {
  getUser: id => User.findById(id).select('name email uniqueId role isAdmin').lean(),
}, storage: { describe: () => ({ configured: false }) } });
const quant = {
  run: operation => operation(quant),
  access: id => realQuantificationAccess.access(id),
  collections: async () => { calls.push(['quant', 'collections']); return { collections: [] }; },
  createCollection: async (body, actor) => { calls.push(['quant','create',actor]); return { id: itemId, ...body }; },
  overview: async () => { calls.push(['quant','overview']); return { submissions: [] }; },
  storageFiles: async () => { calls.push(['quant','files']); return { files: [] }; },
  storageDownloads: async () => { calls.push(['quant','fileDownloads']); return { downloads: [] }; },
  storageConfig: () => { calls.push(['quant','storage']); return { configured: true }; },
  saveStorageConfig: async () => { calls.push(['quant','saveStorage']); return { configured: true }; },
  testStorageConfig: async () => { calls.push(['quant','testStorage']); return { ok: true }; },
  cleanup: async () => { calls.push(['quant','cleanup']); return { removed: 0 }; },
};
const feeRepository = {
  settings: async () => null,
  submission: async id => id === proofId ? { _id: proofId, user: ids.owner } : null,
  proof: async () => { calls.push(['fees','proof']); return { proofImageData: Buffer.from('test-image'), proofImageMimeType: 'image/png' }; },
  list: async () => { calls.push(['fees','list']); return { items: [], total: 0 }; },
  confirm: async (id, actor) => { calls.push(['fees','confirm',actor]); return { _id: id, user: ids.owner, status: 'CONFIRMED', confirmedBy: actor }; },
};
const fee = new FeeService(feeRepository, { canManage: isStaffUser });
const quick = {
  list: async () => [],
  create: async (body, actor) => { calls.push(['quick','create',actor]); return { id: itemId, ...body }; },
  delete: async () => { calls.push(['quick','delete']); },
};
const media = Object.fromEntries(['init','order','clearCover','complete','remove'].map(method => [method, async () => { calls.push(['media',method]); return { ok: true }; }]));
const assistant = {
  getSettings: async () => { calls.push(['ai','settings']); return { configured: false }; },
  saveKey: async () => { calls.push(['ai','saveKey']); return { configured: true }; },
  deleteKey: async () => { calls.push(['ai','deleteKey']); return { configured: false }; },
  testConnection: async () => { calls.push(['ai','test']); return { ok: true }; },
  generate: async () => { calls.push(['ai','generate']); return { answer: 'test' }; },
};
const daily = {
  status: async () => { calls.push(['daily','status']); return { history: [], activeDate: null }; },
  requestRun: async () => { calls.push(['daily','run']); return { started: true }; },
  saveSettings: async () => { calls.push(['daily','save']); return { success: true }; },
};
const app = express();
app.use(express.json());
app.use('/api/news', requireProject('./routes/newsRouter'));
app.use('/api/resources', requireProject('./routes/resourceRouter'));
app.use('/api/past-events', requireProject('./routes/pastEventRouter'));
app.use('/api/admin/announcements', requireStaff, requireProject('./routes/admin/announcements'));
const q = requireProject('./routes/quantificationRouter').createRouters(quant);
app.use('/api/quantification', q.router); app.use('/api/admin/quantification', q.adminRouter);
const f = requireProject('./routes/feesRouter').createFeesRouters(fee);
app.use('/api/fees', f.userRouter); app.use('/api/admin/fees', f.adminRouter);
const r = requireProject('./routes/resourceQuickLinksRouter').createResourceQuickLinksRouters(quick);
app.use('/api/admin/resource-quick-links', r.adminRouter);
app.use('/api/events', requireProject('./routes/activityMediaRouter').createActivityMediaRouter(media));
app.use('/api/admin/ai/daily-news', requireProject('./routes/admin/dailyNews').createDailyNewsRouter({ service: daily, quota:{async assertAvailable(){}}, withUsage:passthroughUsage }));
app.use('/api/admin/ai', requireProject('./routes/admin/ai').createAiRouter({ withUsage:passthroughUsage, assistant }));
app.use((error, req, res, _next) => res.status(error.status || 500).json({ error: error.message }));

let origin, server;
function reset() {
  accounts = Object.fromEntries(Object.entries(ids).map(([role, id]) => [id, { _id: id, role: role === 'owner' ? 'student' : role, isAdmin: role === 'admin', tokenVersion: 0, uniqueId: role, name: role, isEnrolled: true }]));
  records = Object.fromEntries(['News','Resource','PastEvent','Announcement'].map(name => [name, new Map()]));
  for (const name of Object.keys(records)) {
    const Model = requireProject(`./models/${name}`);
    records[name].set(itemId, new Model({ _id: itemId, title: '原内容', body: '原正文', content: '新闻内容', status: 'pending', uploadedBy: ids.owner, author: ids.owner, gallery: [], date: new Date() }));
  }
  calls = [];
}
async function request(method, route, role, body, extra = {}) {
  const response = await fetch(origin + route, { method, headers: {
    ...(role ? { Authorization: 'Bearer ' + jwt.sign({ userId: ids[role], tokenVersion: 0, ...extra }, process.env.JWT_SECRET) } : {}),
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const type = response.headers.get('content-type') || '';
  return { status: response.status, body: type.includes('application/json') ? await response.json() : await response.text() };
}
let passed = 0;
async function test(name, run) { reset(); await run(); passed++; console.log('PASS ' + name); }

(async () => {
  server = await new Promise((resolve, reject) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); instance.on('error', reject); });
  origin = `http://127.0.0.1:${server.address().port}`;
  for (const role of ['committee','teacher']) {
    await test(role + ' can create/edit/delete news without gaining the admin flag', async () => {
      assert.equal((await request('POST','/api/news',role,{ title:'新内容',excerpt:'摘要',content:'正文',source:'班级',status:'approved',isFeatured:true })).status,201);
      assert.equal(records.News.get(itemId).status,'approved');
      assert.equal((await request('PUT',`/api/news/${itemId}`,role,{title:'修订'})).status,200);
      assert.equal((await request('DELETE',`/api/news/${itemId}`,role)).status,200);
      assert.equal(accounts[ids[role]].isAdmin,false);
    });
    await test(role + ' can read/review another member resource while students cannot', async () => {
      assert.equal((await request('GET',`/api/resources/${itemId}`,'student')).status,404);
      assert.equal((await request('GET',`/api/resources/${itemId}`,role)).status,200);
      assert.equal((await request('PUT',`/api/resources/${itemId}`,role,{status:'approved',isFeatured:true})).status,200);
      assert.equal(records.Resource.get(itemId).approvedBy,ids[role]);
      assert.equal((await request('DELETE',`/api/resources/${itemId}`,role)).status,200);
    });
    await test(role + ' can maintain announcements, albums, resource links and activity media', async () => {
      assert.equal((await request('POST','/api/admin/announcements',role,{title:'公告',body:'正文'})).status,201);
      assert.equal((await request('PUT',`/api/past-events/${itemId}`,role,{title:'回忆'})).status,200);
      assert.equal((await request('POST','/api/admin/resource-quick-links',role,{name:'工具',url:'https://example.com/'})).status,201);
      assert.equal((await request('POST',`/api/events/${itemId}/media/init`,role,{kind:'cover'})).status,201);
      assert.equal((await request('DELETE',`/api/events/${itemId}/media/cover`,role,{})).status,200);
      assert.equal((await request('DELETE',`/api/events/${itemId}/media/${proofId}`,role,{})).status,200);
    });
    await test(role + ' can manage collections and fee proofs through real route authorization', async () => {
      assert.equal((await request('GET','/api/quantification/access',role)).body.canManage,true);
      assert.equal((await request('GET','/api/admin/quantification/collections',role)).status,200);
      assert.equal((await request('POST','/api/admin/quantification/collections',role,{title:'材料'})).status,201);
      assert.equal((await request('GET',`/api/admin/quantification/collections/${itemId}/submissions`,role)).status,200);
      assert.equal((await request('GET','/api/admin/fees/submissions',role)).status,200);
      assert.equal((await request('POST',`/api/admin/fees/submissions/${proofId}/confirm`,role,{})).status,200);
      assert.equal((await request('GET',`/api/fees/submissions/${proofId}/proof`,role)).status,200);
      assert.equal((await request('GET',`/api/fees/submissions/${proofId}/proof`,'student')).status,404);
    });
    await test(role + ' cannot reach storage config, bucket files, cleanup or database diagnostics', async () => {
      for (const [method,route,body] of [
        ['GET','/api/admin/quantification/storage'],['PUT','/api/admin/quantification/storage',{}],
        ['POST','/api/admin/quantification/storage/test',{}],['GET','/api/admin/quantification/files'],
        ['POST','/api/admin/quantification/files/downloads',{keys:[]}],['POST','/api/admin/quantification/cleanup',{}],
        ['GET','/api/past-events/test/connection'],
      ]) assert.equal((await request(method,route,role,body)).status,403,method+' '+route);
      assert.equal(calls.length,0,'Sensitive services must never be invoked for staff');
    });
    await test(role + ' cannot use AI keys, generation, scheduled news or retired curation aliases', async () => {
      for (const [method,route,body] of [
        ['GET','/api/admin/ai/settings'],['PUT','/api/admin/ai/settings',{apiKey:'fake-test-key'}],
        ['DELETE','/api/admin/ai/settings'],['GET','/api/admin/ai/status'],['POST','/api/admin/ai/test',{}],
        ['POST','/api/admin/ai/generate',{scenario:'free',prompt:'test'}],
        ['GET','/api/admin/ai/daily-news'],['POST','/api/admin/ai/daily-news/run',{confirm:true}],
        ['POST','/api/news/trigger-curation',{}],
      ]) assert.equal((await request(method,route,role,body)).status,403,method+' '+route);
      assert.equal(calls.length,0,'No AI/provider or key operation should run');
    });
  }
  await test('student and anonymous callers cannot inherit content-management rights from forged JWT claims',async()=>{
    assert.equal((await request('PUT',`/api/news/${itemId}`,null,{title:'bad'})).status,401);
    for(const [method,route,body] of [['PUT',`/api/news/${itemId}`,{title:'bad'}],['POST','/api/admin/announcements',{title:'bad',body:'bad'}],['GET','/api/admin/quantification/collections'],['GET','/api/admin/fees/submissions'],['POST',`/api/events/${itemId}/media/init`,{}]]) {
      assert.equal((await request(method,route,'student',body,{role:'admin',isAdmin:true,permissions:['content:manage','system:manage']})).status,403);
    }
    assert.equal((await request('GET','/api/quantification/access','student')).body.canManage,false);
    assert.equal(calls.length,0);
  });
  await test('administrator retains explicit storage, file maintenance and AI access',async()=>{
    for(const [method,route,body] of [['GET','/api/admin/quantification/storage'],['PUT','/api/admin/quantification/storage',{}],['POST','/api/admin/quantification/storage/test',{}],['GET','/api/admin/quantification/files'],['POST','/api/admin/quantification/files/downloads',{keys:[]}],['POST','/api/admin/quantification/cleanup',{}],['GET','/api/admin/ai/settings']]) {
      assert.equal((await request(method,route,'admin',body)).status,200,method+' '+route);
    }
    assert.equal((await request('POST','/api/admin/ai/daily-news/run','admin',{confirm:true})).status,202);
    assert.ok(calls.some(call=>call[0]==='daily'&&call[1]==='run'));
  });
  await test('changing the stored role removes staff authorization without trusting old role claims',async()=>{
    accounts[ids.teacher].role='student';
    assert.equal((await request('PUT',`/api/news/${itemId}`,'teacher',{title:'bad'},{role:'teacher'})).status,403);
    assert.equal((await request('GET','/api/quantification/access','teacher')).body.canManage,false);
    assert.equal(calls.length,0);
  });
  await new Promise(resolve=>server.close(resolve));
  console.log(`\n${passed} staff business authorization cases passed; all data/provider boundaries were memory-only.`);
})().catch(async error=>{console.error(error);if(server)await new Promise(resolve=>server.close(resolve));process.exitCode=1;});

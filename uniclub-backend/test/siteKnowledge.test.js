const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { SiteKnowledgeService, parseKnowledgeQuestion, rankChunks, packContext, MAX_CANDIDATES, MAX_CONTEXT_CHARS } = require('../services/SiteKnowledgeService');

const member = '111111111111111111111111';
const other = '222222222222222222222222';
const now = new Date('2026-10-27T04:00:00Z');
let records, reads, account, enrolled, models;
const at = path => value => path.split('.').reduce((parent, key) => parent?.[key], value);
function matches(row, filter) {
  return Object.entries(filter).every(([field, wanted]) => {
    if (field === '$and') return wanted.every(part => matches(row, part));
    if (field === '$or') return wanted.some(part => matches(row, part));
    const actual = at(field)(row);
    if (wanted instanceof RegExp) return Array.isArray(actual) ? actual.some(item => wanted.test(String(item))) : wanted.test(String(actual ?? ''));
    if (wanted === null) return actual == null;
    if (wanted && typeof wanted === 'object' && !(wanted instanceof Date)) return Object.entries(wanted).every(([op, value]) => {
      if (op === '$lte') return actual != null && new Date(actual) <= value;
      if (op === '$gt') return actual != null && new Date(actual) > value;
      if (op === '$in') return value.includes(actual);
      if (op === '$ne') return actual !== value;
      throw new Error(`Unsupported fixture operator: ${op}`);
    });
    return String(actual) === String(wanted);
  });
}
function select(row, fields) {
  if (!row) return null;
  const out = { _id: row._id };
  for (const field of fields.split(' ')) if (at(field)(row) !== undefined) out[field] = at(field)(row);
  return out;
}
function scalar(expression, row, vars = {}) {
  if (typeof expression === 'string' && expression.startsWith('$$')) {
    const [name, ...path] = expression.slice(2).split('.');
    return path.reduce((parent, key) => parent?.[key], vars[name]);
  }
  if (typeof expression === 'string' && expression.startsWith('$')) return at(expression.slice(1))(row);
  if (expression instanceof RegExp || expression == null || typeof expression !== 'object') return expression;
  if (Array.isArray(expression)) return expression.map(item => scalar(item, row, vars));
  const [op, value] = Object.entries(expression)[0];
  if (op === '$convert') { const input = scalar(value.input, row, vars); return input == null ? value.onNull : typeof input === 'object' ? value.onError : String(input); }
  if (op === '$ifNull') { const [input, fallback] = scalar(value, row, vars); return input ?? fallback; }
  if (op === '$substrCP') { const [input, start, size] = scalar(value, row, vars); return Array.from(input).slice(start, start + size).join(''); }
  if (op === '$max') return Math.max(...scalar(value, row, vars));
  if (op === '$subtract') { const [a,b] = scalar(value,row,vars); return a-b; }
  if (op === '$slice') { const [input, size] = scalar(value,row,vars); return (input || []).slice(0,size); }
  if (op === '$concat') return scalar(value,row,vars).join('');
  if (op === '$reduce') {let output=value.initialValue;for(const item of scalar(value.input,row,vars))output=scalar(value.in,row,{...vars,this:item,value:output});return output;}
  if (op === '$regexFind') { const text=scalar(value.input,row,vars); const match=value.regex.exec(text); return match ? {idx:Array.from(text.slice(0,match.index)).length} : null; }
  if (op === '$let') { const next = {...vars}; for (const [key, val] of Object.entries(value.vars)) next[key]=scalar(val,row,vars); return scalar(value.in,row,next); }
  throw new Error(`Unsupported fixture expression: ${op}`);
}
function aggregate(name, pipeline) {
  let maximum;
  const read = {name,pipeline}; reads.push(read);
  return { option(options) { maximum=options.maxTimeMS;read.options=options;return this; },
    async exec() {
      assert.ok(maximum > 0 && maximum <= 2500);
      let rows=records[name].filter(row=>matches(row,pipeline[0].$match));
      const sort=pipeline.find(stage=>stage.$sort).$sort;
      rows.sort((a,b)=>{for(const [key,order]of Object.entries(sort)){const x=at(key)(a),y=at(key)(b);if(x<y)return -order;if(x>y)return order;}return 0;});
      rows=rows.slice(0,pipeline.find(stage=>stage.$limit).$limit);
      const projection=pipeline.find(stage=>stage.$project).$project;
      return rows.map(row=>Object.fromEntries(Object.entries(projection).map(([key,value])=>[key,value===1?at(key)(row):scalar(value,row)])));
    }
  };
}
beforeEach(() => {
  reads=[];enrolled=true;
  account={_id:member,uniqueId:'2025110301',isEnrolled:true,role:'student',isAdmin:false,passwordHash:'never-read-hash',email:'secret@example.test',name:'Private member'};
  records=Object.fromEntries(['Announcement','News','Event','PastEvent','Resource','ResourceQuickLink','SocialPost'].map(name=>[name,[]]));
  models=Object.fromEntries(Object.keys(records).map(name=>[name,{aggregate:pipeline=>aggregate(name,pipeline)}]));
  models.User={findById(id){reads.push({name:'User',id});let fields;return {select(value){fields=value;assert.equal(fields.includes('name'),false);return this;},maxTimeMS(value){assert.ok(value<=2500);return this;},lean:async()=>id===member?select(account,fields):null};}};
  models.Roster={exists(filter){reads.push({name:'Roster',filter});return {maxTimeMS(value){assert.ok(value<=2500);return this;},exec:async()=>enrolled?{_id:'roster'}:null};}};
  models.AiSettings={findById(){reads.push({name:'AiSettings'});return {select(){return this;},maxTimeMS(){return this;},lean:async()=>({dailyNewsRuntime:{activeBatchId:'active'}})};}};
});
const service = () => new SiteKnowledgeService({models,now:()=>now});
const row = (id,extra={}) => ({_id:id,createdAt:new Date('2026-10-01'),...extra});
const context = {userId:member};

test('empty and invalid questions cannot create unbounded reads or inject Mongo operators', async () => {
  for(const q of ['', '  ', '?!']) assert.deepEqual(await service().retrieve(q,context),[]);
  assert.equal(reads.length,0);
  for(const q of [{$ne:null},['资源'],'a'.repeat(4001)]) await assert.rejects(service().retrieve(q,context),{status:400});
  await assert.rejects(service().retrieve('资源',{}),{status:401});
  const parsed=parseKnowledgeQuestion('查找 C++ .*[ 模板');
  assert.ok(parsed.terms.includes('c++'));
});

test('relevant late paragraphs become chunks, body metadata never grants instructions or leaks author fields', async () => {
  records.News=[row('abc',{title:'开发实践',excerpt:'编程',status:'approved',origin:'manual',publishedAt:now,
    content:'无关段落。'.repeat(6000)+'<p>稀疏检索的召回需要关键词重排。</p><script>danger()</script>',author:{name:'private-name'},sourceHash:'private-hash'})];
  const result=await service().retrieve('稀疏检索',context);
  assert.ok(result.some(item=>item.text.includes('稀疏检索的召回')));
  assert.equal(result[0].url,'/news/abc');
  assert.equal(result[0].type,'site');
  for(const secret of ['danger()','private-name','private-hash','passwordHash','secret@example.test']) assert.equal(JSON.stringify(result).includes(secret),false);
});

test('only live published, nonexpired, nonfuture content and active daily batch are retrievable', async () => {
  records.Announcement=[row('ok',{title:'实验通知',body:'稀疏检索',isPublished:true,publishedAt:now,expiresAt:null}),
    row('hidden',{title:'稀疏检索',isPublished:false,publishedAt:now}),
    row('expired',{title:'稀疏检索',isPublished:true,publishedAt:now,expiresAt:new Date('2026-10-26')}),
    row('future',{title:'稀疏检索',isPublished:true,publishedAt:new Date('2026-10-28')})];
  records.News=[row('active',{title:'稀疏检索',status:'approved',origin:'ai_daily',publishedAt:now,generationBatchId:'active'}),
    row('staged',{title:'稀疏检索',status:'approved',origin:'ai_daily',publishedAt:now,generationBatchId:'uncommitted'}),
    row('draft',{title:'稀疏检索',status:'draft',origin:'manual'}),row('scheduled',{title:'稀疏检索',status:'approved',origin:'manual',publishedAt:new Date('2026-11-01')})];
  records.Resource=[row('pending',{title:'稀疏检索',status:'pending'}),row('archived',{title:'稀疏检索',status:'archived'})];
  assert.deepEqual(new Set((await service().retrieve('稀疏检索',context)).map(item=>item.url)),new Set(['/announcements','/news/active']));
});

test('current role controls drafts, legacy isAdmin cannot override student role, role changes take effect on each request', async () => {
  records.Resource=[row('draft',{title:'稀疏检索',status:'pending'}),row('archived',{title:'稀疏检索',status:'archived'})];
  account.role='committee';
  assert.equal((await service().retrieve('稀疏检索',context))[0]?.url,'/admin/resources');
  account.role='teacher';assert.equal((await service().retrieve('稀疏检索',context)).length,1);
  account.role='student';account.isAdmin=true;
  assert.deepEqual(await service().retrieve('稀疏检索',context),[]);
  account=null;await assert.rejects(service().retrieve('稀疏检索',context),{status:401});
});

test('stale isEnrolled flag cannot expose activities or club posts, and private/friend posts never enter shared RAG', async () => {
  records.Event=[row('event',{title:'稀疏检索',description:'活动介绍',status:'published',endDate:new Date('2026-11-01')})];
  records.SocialPost=['public','club-members','friends','private'].map((visibility,i)=>row(String(i),{content:'稀疏检索讨论',visibility,status:'active',author:i===3?member:other}));
  const ids=(await service().retrieve('稀疏检索',context)).map(item=>item.id);
  assert.equal(ids.some(id=>id.startsWith('event:event:')),true);
  assert.equal(ids.some(id=>id.startsWith('social:1:')),true);
  for(const index of ['2','3']) assert.equal(ids.some(id=>id.startsWith(`social:${index}:`)),false);
  enrolled=false;
  const revoked=(await service().retrieve('稀疏检索',context)).map(item=>item.id);
  assert.equal(revoked.some(id=>id.startsWith('event:')||id.startsWith('social:1:')),false);
  assert.equal(revoked.some(id=>id.startsWith('social:0:')),true);
});

test('soft deleted and unfinished archives are excluded; ended archives and public past events retain real routes', async () => {
  records.Event=[row('hidden',{title:'稀疏检索',status:'published',deletedAt:now}),
    row('future-archive',{title:'稀疏检索',status:'archived',endDate:new Date('2026-11-01')}),
    row('ended',{title:'稀疏检索',status:'archived',endDate:new Date('2026-10-26')})];
  records.PastEvent=[row('past',{title:'稀疏检索',subtitle:'活动回顾',body:'真实内容',date:new Date('2026-10-20')}),row('future',{title:'稀疏检索',date:new Date('2026-11-01')})];
  assert.deepEqual(new Set((await service().retrieve('稀疏检索',context)).map(item=>item.url)),new Set(['/event/ended','/past-events/past']));
});

test('list intent retrieves real recent resources and states the attachment extraction limitation', async () => {
  records.Resource=Array.from({length:30},(_,i)=>row(String(i),{title:`软件工具 ${i}`,description:'学习辅助',status:'approved',file:{originalName:'实验报告.pdf',url:'private-storage.example'},createdAt:new Date(2026,9,i+1)}));
  records.ResourceQuickLink=[row('quick',{name:'GitHub',description:'项目查找',url:'https://example.test/private'})];
  const result=await service().retrieve('有哪些学习资料？',context);
  assert.ok(result.some(item=>item.title.startsWith('软件工具')));
  assert.ok(result.filter(item=>item.id.startsWith('resource:')).every(item=>item.text.includes('未读取附件正文')));
  assert.equal(JSON.stringify(result).includes('private-storage.example'),false);
  assert.equal(JSON.stringify(result).includes('example.test/private'),false);
  assert.ok(reads.filter(read=>read.pipeline).every(read=>read.pipeline.find(stage=>stage.$limit).$limit<=MAX_CANDIDATES));
  assert.ok(reads.filter(read=>read.pipeline).every(read=>['Resource','ResourceQuickLink'].includes(read.name)));
});

test('homepage suggestions and natural catalog questions return genuine bounded recent records', async () => {
  records.Resource=[row('real-resource',{title:'NVIDIA A100 算力平台',description:'免费算力',status:'approved'})];
  records.ResourceQuickLink=[row('real-quick',{name:'学校教务系统',description:'选课入口'})];
  records.Announcement=[row('real-notice',{title:'下周班会',body:'周一晚举行',isPublished:true,publishedAt:now,expiresAt:null})];
  for(const question of ['帮我查找本站的学习资料，并推荐适合入门的资源。','本站有哪些学习资源？','有哪些教材？']) {
    const result=await service().retrieve(question,context);
    assert.ok(result.some(item=>item.id.startsWith('resource:real-resource:')),question);
    assert.ok(result.some(item=>item.id.startsWith('quickLink:real-quick:')),question);
  }
  assert.ok((await service().retrieve('最近有哪些公告？',context)).some(item=>item.id.startsWith('announcement:real-notice:')));
  records.Resource=[];records.ResourceQuickLink=[];
  const empty=await service().retrieve('有哪些量子算法资源？',context);
  assert.equal(empty.some(item=>item.id.startsWith('resource:')),false);
});

test('metadata-only keyword matches are retained and file limitation survives long resource content', async () => {
  records.Resource=[row('tagged',{title:'编程工具',description:'使用指南。'.repeat(500),tags:['稀疏检索'],status:'approved',file:{originalName:'讲义.pdf'}})];
  const result=await service().retrieve('稀疏检索',context);
  assert.ok(result.some(item=>item.id.startsWith('resource:tagged:')));
  assert.ok(result.every(item=>item.text.includes('未读取附件正文')));
});

test('navigation guidance for personal material/fees never loads records or claims to know a payment state', async () => {
  const result=await service().retrieve('我的班费是否缴费？量化材料怎么提交？',context);
  assert.ok(result.some(item=>item.url==='/fees'));
  assert.ok(result.some(item=>item.url==='/quantification'));
  assert.equal(reads.some(read=>/Fee|Quantification|UserEngagement/.test(read.name)),false);
  assert.equal(result.some(item=>item.text.includes('未缴费')||item.text.includes('你已提交')),false);
});

test('all source reads are bounded, keyword-filtered, projection-only; regex input is literal', async () => {
  records.News=[row('literal',{title:'c++ .* 模板',content:'原文',status:'approved',publishedAt:now,origin:'manual'}),row('unrelated',{title:'不相关',status:'approved',publishedAt:now,origin:'manual'})];
  const result=await service().retrieve('c++ .* 模板',context);
  assert.ok(result.some(item=>item.title==='c++ .* 模板'));
  for(const read of reads.filter(item=>item.pipeline)) {
    assert.ok(read.pipeline[0].$match.$and.length>=2);
    assert.ok(read.pipeline.find(stage=>stage.$limit).$limit<=MAX_CANDIDATES);
    const project=JSON.stringify(read.pipeline.find(stage=>stage.$project));
    for(const field of ['passwordHash','profile','file.url','registrations','poster','gallery','uploadedBy']) assert.equal(project.includes(`"${field}"`),false);
    assert.ok(project.includes('$substrCP'));
  }
});

test('context is relevant, deterministic, diverse and bounded including metadata', async () => {
  const chunks=Array.from({length:100},(_,i)=>({id:`resource:${i}:0`,recordId:`resource:${i}`,title:i===50?'稀疏检索入门':'普通材料',url:`/resource/${i}`,type:'site',text:'稀疏检索讲义。'.repeat(1000),source:'resource',date:now}));
  const ranked=rankChunks(chunks,parseKnowledgeQuestion('稀疏检索'));
  assert.equal(ranked[0].title,'稀疏检索入门');
  const packed=packContext(ranked);
  assert.ok(packed.length<=6);assert.ok(JSON.stringify(packed).length<=MAX_CONTEXT_CHARS);
  assert.deepEqual(Object.keys(packed[0]).sort(),['id','text','title','type','url']);
  assert.deepEqual(packed,packContext(ranked));
});

test('aborted and timed-out queries fail closed and do not return partial or stale context', async () => {
  const controller=new AbortController();controller.abort();
  await assert.rejects(service().retrieve('资源',{...context,signal:controller.signal}),{name:'AbortError'});
  assert.equal(reads.length,0);
  models.News.aggregate=()=>({option(){return this;},exec:()=>Promise.reject(Object.assign(new Error('internal database details'),{code:50}))});
  await assert.rejects(service().retrieve('稀疏检索',context),error=>error.status===503&&!error.message.includes('internal database'));
  const active=new AbortController();
  models.User.findById=()=>({select(){return this;},maxTimeMS(){return this;},lean:()=>new Promise(()=>{})});
  const promise=service().retrieve('资源',{...context,signal:active.signal});active.abort();
  await assert.rejects(promise,{name:'AbortError'});
});

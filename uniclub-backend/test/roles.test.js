const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const req = createRequire(require('node:path').join(__dirname, '../package.json'));
const express = req('express'), jwt = req('jsonwebtoken'), bcrypt = req('bcryptjs');
process.env.JWT_SECRET = 'four-role-regression-only-not-a-real-secret';
const { ROLES, normalizeRole, roleInfo, roleFilter, canAssignRole } = req('./utils/roles');
const id = n => n.toString(16).padStart(24, '0');
const actorId = id(1), targetId = id(2), backupId = id(3);
let accounts, lease, writes, leaseWrites, hook;
const copy = row => row == null ? row : structuredClone(row);
function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(v => matches(row, v));
    if (key === '$and') return value.every(v => matches(row, v));
    const actual = row?.[key];
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('$exists' in value) return Object.hasOwn(row, key) === value.$exists;
      if ('$ne' in value) return actual !== value.$ne;
      if ('$nin' in value) return !value.$nin.includes(actual);
      if ('$lte' in value) return actual <= value.$lte;
    }
    if (value instanceof RegExp) return value.test(actual || '');
    return String(actual) === String(value);
  });
}
function query(run) {
  let selection, skip = 0, limit = Infinity;
  const shape = row => {
    if (!row || !selection) return copy(row);
    const result = { _id: row._id };
    for (const field of selection.split(' ')) if (Object.hasOwn(row, field)) result[field] = copy(row[field]);
    return result;
  };
  return { select(fields) { selection = fields; return this; }, lean() { return this; }, maxTimeMS() { return this; },
    sort() { return this; }, skip(n) { skip = n; return this; }, limit(n) { limit = n; return this; },
    async then(resolve, reject) {
      try { const value = await run(); return resolve(Array.isArray(value) ? value.slice(skip, skip + limit).map(shape) : shape(value)); }
      catch(error) { return reject(error); }
    },
  };
}
const User = {
  findById: userId => query(() => accounts[userId] || null),
  findOne: filter => query(() => Object.values(accounts).find(row => matches(row, filter)) || null),
  find: filter => query(() => Object.values(accounts).filter(row => matches(row, filter))),
  countDocuments: filter => query(() => Object.values(accounts).filter(row => matches(row, filter)).length),
  findOneAndUpdate: (filter, update) => query(async () => {
    if (hook) { const run = hook; hook = null; await run(); }
    const row = Object.values(accounts).find(row => matches(row, filter));
    if (!row) return null;
    Object.assign(row, update.$set);
    for (const [key,value] of Object.entries(update.$inc || {})) row[key] = (row[key] || 0) + value;
    writes.push(copy(update)); return row;
  }),
  updateOne: async (filter, update) => { const row = Object.values(accounts).find(row => matches(row, filter)); if (row) { Object.assign(row, update.$set); return { modifiedCount: 1 }; } return { modifiedCount: 0 }; },
  create: async data => { const row = { _id: id(4), ...data }; accounts[row._id] = row; writes.push(copy(data)); return row; },
};
function stub(name, exports) { const filename = req.resolve(name); require.cache[filename] = { id: filename, filename, loaded: true, exports }; }
stub('./models/User', User);
stub('./models/EnrolledUser', { findOne: () => query(() => ({ name:'姓名',uniqueId:'new-user' })) });
stub('./models/RoleAssignmentLock', {
  findOneAndUpdate: (filter, update) => query(() => {
    if (lease && !matches(lease, filter)) throw Object.assign(new Error('Lease occupied'), { code:11000 });
    lease = { _id:filter._id,...update.$set }; leaseWrites++; return lease;
  }),
  deleteOne: filter => query(() => { if (lease && matches(lease, filter)) lease = null; return { deletedCount:1 }; }),
});
const { RoleAssignmentService, acquireRoleLease } = req('./services/RoleAssignmentService');
const service = new RoleAssignmentService();
const app = express(); app.use(express.json());
app.use('/api/auth', req('./routes/authRouter'));
app.use('/api/users', req('./routes/userRouter'));
app.use('/api/admin', req('./routes/adminRouter'));
app.use((error, _req, res, _next) => res.status(error.status || 500).json({error:error.message}));
let server, origin;
before(async () => {
  server = await new Promise((resolve,reject) => { const s = app.listen(0,'127.0.0.1',() => resolve(s)); s.on('error',reject); });
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
function reset(actorRole = 'admin', targetRole = 'student') {
  accounts = Object.fromEntries([[actorId,actorRole],[targetId,targetRole],[backupId,'admin']].map(([key,role]) => [key,{ _id:key,uniqueId:key,name:role,role,isAdmin:role==='admin',tokenVersion:0,roleVersion:0 }]));
  lease = null; writes=[]; leaseWrites=0; hook=null;
  req('./middleware/rateLimit').authLimit.resetKey('127.0.0.1');
}
beforeEach(() => reset());
const token = (key = actorId, extra = {}) => jwt.sign({ userId:key,tokenVersion:0,...extra },process.env.JWT_SECRET);
async function request(method,path,body,credential = token()) {
  const response = await fetch(origin+path,{ method,headers:{ ...(credential ? {Authorization:`Bearer ${credential}`} : {}), ...(body === undefined ? {} : {'Content-Type':'application/json'}) },...(body === undefined ? {} : {body:JSON.stringify(body)}) });
  return { status:response.status,body:await response.json() };
}

test('legacy flags, explicit role precedence, role filters and no-default model compatibility', () => {
  assert.equal(normalizeRole({isAdmin:true}),'admin'); assert.equal(normalizeRole({}),'student');
  assert.equal(normalizeRole({role:'student',isAdmin:true}),'student');
  assert.equal(normalizeRole({role:'teacher',isAdmin:true}),'teacher');
  assert.equal(roleInfo({role:'committee'}).isAdmin,false);
  for (const account of [{isAdmin:true},{isAdmin:false},{},...ROLES.flatMap(role => [true,false].map(isAdmin => ({role,isAdmin})))]) {
    for (const role of ROLES) assert.equal(matches(account,roleFilter(role)),normalizeRole(account)===role);
  }
  const filename = req.resolve('./models/User'); const cached = require.cache[filename]; delete require.cache[filename];
  try { const Model = req('./models/User'); assert.equal(new Model({isAdmin:true}).role,undefined); assert.equal(normalizeRole(new Model({isAdmin:true})),'admin'); }
  finally { require.cache[filename] = cached; }
});

for (const actorRole of ROLES) for (const targetRole of ROLES) for (const nextRole of ROLES) {
  test(`assignment matrix: ${actorRole} changes ${targetRole} to ${nextRole}`, async () => {
    reset(actorRole,targetRole);
    const allowed = actorRole === 'admin' || actorRole === 'teacher' && ['student','committee'].includes(targetRole) && ['student','committee'].includes(nextRole);
    assert.equal(canAssignRole(accounts[actorId],accounts[targetId],nextRole),allowed);
    const response = await request('PATCH',`/api/admin/users/${targetId}/role`,{role:nextRole});
    assert.equal(response.status,allowed ? 200 : 403,JSON.stringify(response));
    assert.equal(accounts[targetId].role,allowed ? nextRole : targetRole);
    if (allowed) { assert.equal(response.body.user.role,nextRole); assert.equal(response.body.user.isAdmin,nextRole==='admin'); }
    else { assert.equal(writes.length,0); assert.equal(leaseWrites,0); }
  });
}

test('legacy admin is never silently demoted; legacy ordinary member can be appointed by teacher', async () => {
  delete accounts[actorId].role;
  assert.equal((await request('PATCH',`/api/admin/users/${targetId}/role`,{role:'teacher'})).status,200);
  reset('teacher','student'); delete accounts[targetId].role;
  assert.equal((await request('PATCH',`/api/admin/users/${targetId}/role`,{role:'committee'})).status,200);
});
test('self demotion and malicious bodies are denied without mutations', async () => {
  for (const role of ['student','committee','teacher']) assert.equal((await request('PATCH',`/api/admin/users/${actorId}/role`,{role})).status,400);
  for(const body of [{role:'owner'}, {role:{$ne:'student'}}, {role:'admin',isAdmin:true}, {}, null]) assert.equal((await request('PATCH',`/api/admin/users/${targetId}/role`,body)).status,400);
  assert.equal((await request('PATCH','/api/admin/users/not-an-id/role',{role:'committee'})).status,400);
  assert.equal((await request('PATCH',`/api/admin/users/${id(99)}/role`,{role:'committee'})).status,404);
  assert.equal(writes.length,0); assert.equal(leaseWrites,0);
});
test('legacy admin endpoint stays admin-only and uses synchronized roles', async () => {
  for(const role of ['student','committee','teacher']) {
    reset(role); assert.equal((await request('PATCH',`/api/admin/users/${targetId}/admin`,{isAdmin:true})).status,403); assert.equal(writes.length,0);
  }
  reset(); assert.equal((await request('PATCH',`/api/admin/users/${targetId}/admin`,{isAdmin:true})).body.user.role,'admin');
  assert.equal((await request('PATCH',`/api/admin/users/${targetId}/admin`,{isAdmin:false})).body.user.role,'student');
});
test('JWT claims cannot grant permissions; stored role revocation affects the old token immediately', async () => {
  reset('student');
  const forged=token(actorId,{role:'admin',isAdmin:true,permissions:['system:manage','roles:manage']});
  assert.equal((await request('PATCH',`/api/admin/users/${targetId}/role`,{role:'admin'},forged)).status,403);
  reset('teacher'); const old=token();
  assert.equal((await request('PATCH',`/api/admin/users/${targetId}/role`,{role:'committee'},old)).status,200);
  accounts[actorId].role='student';
  assert.equal((await request('PATCH',`/api/admin/users/${targetId}/role`,{role:'student'},old)).status,403);
  const me=await request('GET','/api/auth/me',undefined,old); assert.equal(me.status,200); assert.equal(me.body.user.role,'student');
});
test('login, validation and me return the same DB roles and never a password', async () => {
  for(const role of ROLES) {
    reset(role); accounts[actorId].passwordHash=await bcrypt.hash('Regression-password',4);
    const result=await request('POST','/api/auth/login',{uniqueId:actorId,password:'Regression-password'},null);
    assert.equal(result.status,200); assert.equal(result.body.user.role,role); assert.equal(result.body.user.passwordHash,undefined);
    for(const path of ['/api/auth/me','/api/auth/validate']) {
      const verified=await request('GET',path,undefined,result.body.token);
      assert.equal(verified.status,200); assert.equal(verified.body.user.role,role); assert.deepEqual(verified.body.user.permissions,roleInfo(accounts[actorId]).permissions);
    }
  }
});
test('member list returns four roles, filters legacy users consistently, and rejects student access', async () => {
  accounts[id(4)]={_id:id(4),name:'committee',uniqueId:'four',role:'committee',isAdmin:false,tokenVersion:0};
  accounts[id(5)]={_id:id(5),name:'teacher',uniqueId:'five',role:'teacher',isAdmin:false,tokenVersion:0};
  delete accounts[backupId].role;
  for(const role of ROLES) {
    const result=await request('GET','/api/admin/users?role='+role);
    assert.equal(result.status,200); assert.ok(result.body.users.length); assert.ok(result.body.users.every(user=>user.role===role));
    assert.equal(result.body.pagination.total,Object.values(accounts).filter(user=>normalizeRole(user)===role).length);
  }
  for(const role of ['committee','teacher']) { accounts[actorId].role=role; assert.equal((await request('GET','/api/admin/users')).status,200); assert.equal((await request('GET','/api/admin/roster')).status,403); }
  accounts[actorId].role='student'; assert.equal((await request('GET','/api/admin/users')).status,403);
});
test('registration ignores role and admin injection and always provisions a student', async () => {
  assert.equal((await request('POST','/api/auth/signup-step3',{email:'new@example.com',uniqueId:'new-user',name:'新成员',password:'Regression-password',role:'admin',isAdmin:true},null)).status,200);
  assert.equal(accounts[id(4)].role,'student'); assert.equal(accounts[id(4)].isAdmin,false);
});
test('teacher cannot override an account promoted before the locked re-read', async () => {
  reset('teacher');
  const guarded=new RoleAssignmentService({UserModel:User,acquireLease:async()=>{accounts[targetId].role='admin';return {assertValid(){},release:async()=>{}};}});
  await assert.rejects(guarded.assign(actorId,targetId,'committee'),{status:403}); assert.equal(writes.length,0);
});
test('CAS blocks a promotion that races after validation, including roleVersion ABA', async () => {
  for(const concurrent of [()=>{accounts[targetId].role='admin';},()=>{accounts[targetId].roleVersion++;}]) {
    reset('teacher'); hook=concurrent;
    await assert.rejects(service.assign(actorId,targetId,'committee'),{status:409}); assert.equal(writes.length,0);
  }
});
test('actor demotion while acquiring lease is rechecked before writing', async () => {
  reset('teacher');
  const guarded=new RoleAssignmentService({UserModel:User,acquireLease:async()=>{accounts[actorId].role='student';return {assertValid(){},release:async()=>{}};}});
  await assert.rejects(guarded.assign(actorId,targetId,'committee'),{status:403}); assert.equal(writes.length,0);
});
test('shared lease rejects concurrent server mutations and releases safely', async () => {
  const one=await acquireRoleLease(); await assert.rejects(acquireRoleLease(),{status:409});
  await one.release(); const two=await acquireRoleLease(); await two.release(); assert.equal(lease,null);
  reset(); const original=User.countDocuments; User.countDocuments=()=>query(()=>1);
  try { accounts[targetId].role='admin'; await assert.rejects(service.assign(actorId,targetId,'student'),{status:409}); assert.equal(lease,null); assert.equal(writes.length,0); }
  finally { User.countDocuments=original; }
});

test('personal profile, preferences and roster imports cannot smuggle role changes', async () => {
  for (const [method, path, body] of [
    ['PUT', '/api/users/profile', { role: 'admin' }],
    ['PATCH', '/api/users/me/settings', { role: 'admin' }],
    ['PATCH', '/api/users/me/settings', { isAdmin: true }],
  ]) {
    assert.equal((await request(method, path, body)).status, 400);
    assert.equal(writes.length, 0);
  }
  const { normalizeEntry } = req('./utils/rosterPolicy');
  const entry = normalizeEntry({ name: '成员', uniqueId: '2023000010', role: 'admin', isAdmin: true });
  assert.equal(entry.role, undefined); assert.equal(entry.isAdmin, undefined);
});

// No database involved: the actual stats service and authorization path execute
// against bounded aggregate fixtures. The default model aggregate is restored.
test('dashboard counts and ranges stay protected by live four-role authorization', async () => {
  const UserAggregate=User.aggregate;
  const types=['Event','News','Resource'].map(name=>require('../models/'+name));
  const originals=types.map(model=>model.aggregate);
  const emptyContent=()=>({option:()=>Promise.resolve([{total:[{count:2}],pending:[],daily:[],undated:[]}])});
  User.aggregate=()=>({option:()=>Promise.resolve([{roles:[{_id:'admin',count:1},{_id:'teacher',count:1},{_id:'student',count:1}]}])});
  types.forEach(model=>{model.aggregate=emptyContent;});
  try {
    for(const role of ['committee','teacher','admin']){
      reset(role);
      for(const days of [7,30,90]){
        const result=await request('GET','/api/admin/stats?days='+days);
        assert.equal(result.status,200);assert.equal(result.body.users,3);
        assert.equal(result.body.roles.reduce((sum,row)=>sum+row.count,0),3);
        assert.equal(result.body.timeline.points.length,days);
        assert.equal(result.body.timeline.days,days);assert.equal(result.body.timeline.basis,'createdAt');
      }
    }
    reset('student');
    assert.equal((await request('GET','/api/admin/stats?days=30',undefined,token(actorId,{role:'admin',isAdmin:true}))).status,403);
    assert.equal((await request('GET','/api/admin/stats',undefined,null)).status,401);
    reset();
    for(const query of ['days=0','days=365','days=7&days=90','days[x]=30']) assert.equal((await request('GET','/api/admin/stats?'+query)).status,400);
    User.aggregate=()=>({option:()=>Promise.reject(new Error('isolated lookup failure'))});
    const failed=await request('GET','/api/admin/stats');assert.equal(failed.status,503);
    assert.equal(JSON.stringify(failed.body).includes('isolated lookup failure'),false);
    assert.equal(writes.length,0);
  } finally { User.aggregate=UserAggregate;types.forEach((model,index)=>{model.aggregate=originals[index];}); }
});

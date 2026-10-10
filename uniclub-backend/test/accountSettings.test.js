const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
process.env.JWT_SECRET = 'account-center-test-only';
process.env.REQUIRE_ENROLLED_ROSTER = 'false';
const UserSchema = require('../models/User');
const { NOTIFICATION_DEFAULTS } = require('../utils/accountSettingsPolicy');
const a = '111111111111111111111111', b = '222222222222222222222222', admin = '333333333333333333333333';
let accounts, writes, notices, failDb, simulateRace, server, origin, images;
const get = (row, path) => path.split('.').reduce((value, key) => value?.[key], row);
const set = (row, path, value) => { const keys = path.split('.'); const last = keys.pop(); let target = row; for (const key of keys) target = target[key] ||= {}; target[last] = value; };
const unset = (row, path) => { const keys = path.split('.'); const last = keys.pop(); let target = row; for (const key of keys) target = target?.[key]; if (target) delete target[last]; };
const matches = (row, filter) => Object.entries(filter).every(([key, value]) => {
  if (key === '$or') return value.some(condition => matches(row, condition));
  const actual = get(row, key);
  if (value instanceof RegExp) return value.test(actual || '');
  if (value && typeof value === 'object') return Object.hasOwn(value, '$ne') ? actual !== value.$ne : Object.hasOwn(value, '$exists') ? (actual !== undefined) === value.$exists : false;
  return value === null ? actual == null : actual === value;
});
const query = value => ({ select() { return this; }, lean() { return this; }, populate() { return this; }, sort() { return this; }, limit() { return this; }, skip() { return this; }, then(resolve, reject) { return (failDb ? Promise.reject(new Error('offline')) : Promise.resolve(value)).then(resolve, reject); } });
function update(row, changes) {
  for (const [key, value] of Object.entries(changes.$set || {})) set(row, key, value);
  for (const [key, value] of Object.entries(changes.$inc || {})) set(row, key, (get(row, key) || 0) + value);
  for (const key of Object.keys(changes.$unset || {})) unset(row, key);
  writes.push(structuredClone(changes));
}
const userModel = {
  findById: id => query(accounts[id] || null),
  findOne: filter => query(Object.values(accounts).find(row => matches(row, filter)) || null),
  find: () => query(Object.values(accounts)),
  findByIdAndUpdate(id, changes) { const row = accounts[id]; if (row && !failDb) update(row, changes); return query(row || null); },
  async updateOne(filter, changes) { const row = Object.values(accounts).find(row => matches(row, filter)); if (!row || simulateRace) return { modifiedCount: 0 }; update(row, changes); return { modifiedCount: 1 }; },
};
function stub(name, exports) { const id = require.resolve(name); require.cache[id] = { id, filename: id, loaded: true, exports }; }
stub('../models/User', userModel); stub('../models/EnrolledUser', { findOne: () => query(null) });
stub('../models/Notification', { create: async data => { notices.push(data); return data; }, find: filter => query(notices.filter(row => matches(row, filter))), countDocuments: filter => query(notices.filter(row => matches(row, filter)).length) });
const app = express(); app.use(express.json()); app.use('/api/users', require('../routes/userRouter')); app.use('/api/auth', require('../routes/authRouter')); app.use('/api/notifications', require('../routes/notificationRouter'));
const { passwordChangeLimit, avatarUploadLimit } = require('../middleware/rateLimit');
const { createUserNotification } = require('../utils/notificationPreferences');
const token = id => jwt.sign({ userId: id, tokenVersion: accounts[id]?.tokenVersion || 0 }, process.env.JWT_SECRET);
async function request(method, route, actor = a, body, suffix = '', credential) {
  const response = await fetch(origin + route + suffix, { method, headers: { ...(actor ? { Authorization: 'Bearer ' + (credential || token(actor)) } : {}), ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }) });
  return { status: response.status, headers: response.headers, data: response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.arrayBuffer() };
}
before(async () => {
  server = await new Promise(resolve => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); }); origin = 'http://127.0.0.1:' + server.address().port;
  const raw = sharp({ create: { width: 64, height: 40, channels: 4, background: { r: 30, g: 140, b: 200, alpha: 1 } } });
  images = { 'image/png': await raw.clone().png().toBuffer(), 'image/jpeg': await raw.clone().jpeg().toBuffer(), 'image/webp': await raw.clone().webp().toBuffer() };
});
after(async () => { await new Promise(resolve => server.close(resolve)); });
beforeEach(() => {
  accounts = Object.fromEntries([a,b,admin].map((id,index) => [id, { _id:id, name:'真实姓名'+index, uniqueId:'AC-'+index, passwordHash:bcrypt.hashSync('Current-2026!',6), tokenVersion:0, isAdmin:id===admin, profile:{bio:''}, settings:{profileVisibility:'private'}, secret:'never-return' }]));
  accounts[b].email='taken@example.test'; writes=[]; notices=[]; failDb=false;simulateRace=false;
  for (const id of [a,b,admin]) { passwordChangeLimit.resetKey(id);avatarUploadLimit.resetKey(id); }
});
const noSecrets = value => { const text=JSON.stringify(value); for (const key of ['passwordHash','secret','tokenVersion','verificationToken','sessionToken']) assert.equal(text.includes('"'+key+'"'),false); };
test('anonymous account operations are denied', async () => {
  for (const [method,path,body] of [['GET','/api/users/me/settings'],['PUT','/api/users/profile',{bio:'x'}],['PATCH','/api/users/me/email',{email:'a@example.test'}],['POST','/api/auth/change-password',{currentPassword:'x',newPassword:'abcdefgh',confirmPassword:'abcdefgh'}]]) assert.equal((await request(method,path,null,body)).status,401);
  assert.equal(writes.length,0);
});
test('shared identity includes only the signed-in profile and one avatar payload', async () => {
  accounts[a].profile = { bio: '本人简介', location: '成都', website: 'https://example.test', interests: ['绘画'],
    avatar: { data: 'data:image/webp;base64,avatar-bytes', contentType: 'image/webp' }, secret: 'never-return' };
  const result = await request('GET', '/api/auth/me');
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('cache-control'), 'private, no-store');
  assert.equal(result.data.user.id, a);
  assert.equal(result.data.user.isAdmin, false);
  assert.deepEqual(result.data.user.profile, { bio: '本人简介', location: '成都', website: 'https://example.test', interests: ['绘画'] });
  assert.equal(result.data.user.avatar.data, accounts[a].profile.avatar.data);
  assert.equal(JSON.stringify(result.data).split('avatar-bytes').length - 1, 1);
  noSecrets(result.data);
  assert.equal((await request('GET', '/api/auth/me', null)).status, 401);
  assert.equal(writes.length, 0);
});
test('legacy accounts get one safe bundle with nullable metadata and notification defaults', async () => {
  const result=await request('GET','/api/users/me/settings'); assert.equal(result.status,200);noSecrets(result.data);
  assert.equal(result.data.profile.name,accounts[a].name);assert.equal(result.data.profile.displayName,null);assert.equal(result.data.profile.bio,'');assert.equal(result.data.security.email,null);assert.equal(result.data.security.emailVerified,false);assert.equal(result.data.security.lastLoginAt,null);assert.deepEqual(result.data.settings.notifications,NOTIFICATION_DEFAULTS);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(writes.length,0);
});
test('display name and bio persist while formal name and other settings survive', async () => {
  const result=await request('PUT','/api/users/profile',a,{displayName:'  小青  ',bio:'  软件工程三班  '});assert.equal(result.status,200);noSecrets(result.data);
  const saved=(await request('GET','/api/users/me/settings')).data;assert.equal(saved.profile.displayName,'小青');assert.equal(saved.profile.bio,'软件工程三班');assert.equal(saved.profile.name,'真实姓名0');assert.equal(accounts[a].settings.profileVisibility,'private');assert.equal(accounts[b].displayName,undefined);
});
for (const [label,body] of [['real name',{name:'李四'}],['student ID',{uniqueId:'OTHER'}],['other account',{userId:b,bio:'x'}],['oversize name',{displayName:'x'.repeat(31)}],['oversize bio',{bio:'x'.repeat(201)}],['array bio',{bio:[]}],['HTML profile object',{displayName:{html:'x'}}],['Mongo keys',{$set:{isAdmin:true}}]]) test('rejects profile '+label,async()=>{assert.equal((await request('PUT','/api/users/profile',a,body)).status,400);assert.equal(writes.length,0);});
test('clearing display name falls back without changing real identity; text is never treated as HTML', async () => {
  await request('PUT','/api/users/profile',a,{displayName:'',bio:'<img src=x onerror=alert(1)>'});assert.equal(accounts[a].displayName,null);assert.equal(accounts[a].name,'真实姓名0');assert.equal((await request('GET','/api/users/me/settings')).data.profile.bio,'<img src=x onerror=alert(1)>');
});
test('owner email is trimmed and normalized, never falsely verified, and can be removed',async()=>{
  let result=await request('PATCH','/api/users/me/email',a,{email:'  Me@Example.Test  '});assert.equal(result.status,200);assert.equal(result.data.security.email,'me@example.test');assert.equal(result.data.security.emailVerified,false);noSecrets(result.data);
  result=await request('PATCH','/api/users/me/email',a,{email:null});assert.equal(result.status,200);assert.equal(result.data.security.email,null);assert.equal(accounts[a].email,undefined);
});
test('duplicate email is detected case insensitively without exposing its owner',async()=>{
  const result=await request('PATCH','/api/users/me/email',a,{email:'TAKEN@EXAMPLE.TEST'});assert.equal(result.status,409);assert.equal(JSON.stringify(result.data).includes(b),false);assert.equal(accounts[a].email,undefined);
});
for (const [label,body] of [['format',{email:'wrong'}],['type',{email:[]}],['verification flag',{email:'a@example.test',emailVerified:true}],['target user',{email:'a@example.test',userId:b}]]) test('rejects email '+label,async()=>{assert.equal((await request('PATCH','/api/users/me/email',a,body)).status,400);assert.equal(writes.length,0);});
test('self endpoints cannot target or disclose another user, including administrators',async()=>{
  for(const actor of [a,admin]) for(const path of ['/api/users/me/settings','/api/users/me']) assert.equal((await request('GET',path,actor,undefined,'?userId='+b)).status,400);
  assert.equal((await request('PUT','/api/users/profile',admin,{bio:'x',userId:b})).status,400);assert.equal((await request('GET','/api/users',a)).status,403);assert.equal((await request('GET','/api/users/'+b,a)).status,404);
});
test('password change rejects a wrong current password without writing or logging out',async()=>{
  const hash=accounts[a].passwordHash; const result=await request('POST','/api/auth/change-password',a,{currentPassword:'wrong',newPassword:'Next-Password-2026',confirmPassword:'Next-Password-2026'});assert.equal(result.status,400);assert.equal(accounts[a].passwordHash,hash);assert.equal((await request('GET','/api/users/me/settings')).status,200);
});
for(const [label,patch] of [['short',{newPassword:'short',confirmPassword:'short'}],['mismatch',{confirmPassword:'different'}],['bcrypt length',{newPassword:'中'.repeat(30),confirmPassword:'中'.repeat(30)}],['plaintext type',{newPassword:['abcdefgh']}],['target user',{userId:b}]]) test('rejects password '+label,async()=>{
  const result=await request('POST','/api/auth/change-password',a,{currentPassword:'Current-2026!',newPassword:'Next-Password-2026',confirmPassword:'Next-Password-2026',...patch});assert.equal(result.status,400);assert.equal(writes.length,0);
});
test('new password is bcrypt hashed, old JWTs are revoked and only the new password logs in',async()=>{
  const old=token(a);const result=await request('POST','/api/auth/change-password',a,{currentPassword:'Current-2026!',newPassword:'Next-Password-2026',confirmPassword:'Next-Password-2026'});assert.equal(result.status,200);assert.equal(result.data.requiresLogin,true);noSecrets(result.data);assert.equal(bcrypt.getRounds(accounts[a].passwordHash),10);assert.equal(await bcrypt.compare('Next-Password-2026',accounts[a].passwordHash),true);assert.equal(accounts[a].tokenVersion,1);assert.equal(Object.hasOwn(accounts[a],'password'),false);
  assert.equal((await request('GET','/api/users/me/settings',a,undefined,'',old)).status,401);
  assert.equal((await request('POST','/api/auth/login',null,{uniqueId:'AC-0',password:'Current-2026!'})).status,400);
  const login=await request('POST','/api/auth/login',null,{uniqueId:'AC-0',password:'Next-Password-2026'});assert.equal(login.status,200);assert.equal((await request('GET','/api/users/me/settings',a,undefined,'',login.data.token)).status,200);
});
test('concurrent password changes fail safely and failed attempts are limited',async()=>{
  simulateRace=true;assert.equal((await request('POST','/api/auth/change-password',a,{currentPassword:'Current-2026!',newPassword:'Next-Password-2026',confirmPassword:'Next-Password-2026'})).status,409);simulateRace=false;passwordChangeLimit.resetKey(a);
  for(let i=0;i<5;i++)assert.equal((await request('POST','/api/auth/change-password',a,{currentPassword:'wrong',newPassword:'Next-Password-2026',confirmPassword:'Next-Password-2026'})).status,400);
  assert.equal((await request('POST','/api/auth/change-password',a,{currentPassword:'wrong',newPassword:'Next-Password-2026',confirmPassword:'Next-Password-2026'})).status,429);assert.equal(writes.length,0);
});
test('last login is recorded only on successful authentication',async()=>{
  await request('POST','/api/auth/login',null,{uniqueId:'AC-0',password:'wrong'});assert.equal(accounts[a].lastLoginAt,undefined);
  const start=Date.now();assert.equal((await request('POST','/api/auth/login',null,{uniqueId:'AC-0',password:'Current-2026!'})).status,200);assert.ok(accounts[a].lastLoginAt.getTime()>=start);
});
test('partial notification and pet updates preserve each other and reject unknown flags',async()=>{
  let result=await request('PATCH','/api/users/me/settings',a,{notifications:{activities:false,news:true},petSkin:'cat',petActivity:'quiet',petInteractive:false});assert.equal(result.status,200);
  result=await request('PATCH','/api/users/me/settings',a,{notifications:{fees:false},petSize:180});assert.equal(result.data.settings.notifications.activities,false);assert.equal(result.data.settings.notifications.news,true);assert.equal(result.data.settings.petSkin,'cat');assert.equal(result.data.settings.petActivity,'quiet');assert.equal((await request('GET','/api/users/me/settings',b)).data.settings.petSkin,'panda');
  for(const body of [{notifications:{unknown:true}},{notifications:{browser:'true'}},{notifications:[]},{petActivity:'chaotic'},{notifications:{news:false},userId:b}])assert.equal((await request('PATCH','/api/users/me/settings',a,body)).status,400);
});
test('existing comment notices honor news, activity and material preferences',async()=>{
  const data={recipient:a,actor:b,comment:'comment',type:'comment_reply'};assert.equal(await createUserNotification({...data,article:'news'}),null);
  accounts[a].settings.notifications={news:true,activities:false,materials:true};assert.ok(await createUserNotification({...data,article:'news'}));assert.equal(await createUserNotification({...data,event:'event'}),null);assert.ok(await createUserNotification({...data,resource:'resource'}));
  const list=await request('GET','/api/notifications');assert.equal(list.status,200);assert.equal(list.data.notifications.length,2);
  accounts[a].settings.notifications.news=false;assert.equal((await request('GET','/api/notifications')).data.notifications.length,1);assert.equal((await request('GET','/api/notifications/unread-count')).data.count,0);
});
for(const type of ['image/jpeg','image/png','image/webp'])test('avatar '+type+' is validated, reduced and stored only on the owner',async()=>{
  const form=new FormData();form.append('avatar',new Blob([images[type]],{type}),'avatar');const result=await request('POST','/api/users/avatar',a,form);assert.equal(result.status,200);assert.equal(result.data.avatar.contentType,'image/webp');const bytes=Buffer.from(result.data.avatar.data.split(',')[1],'base64');const metadata=await sharp(bytes).metadata();assert.equal(metadata.width,256);assert.equal(metadata.height,256);assert.equal(accounts[b].profile.avatar,undefined);noSecrets(result.data);
  assert.equal((await request('GET','/api/users/avatar/'+a,null)).status,200);await request('DELETE','/api/users/avatar');assert.equal(accounts[a].profile.avatar,undefined);
});
test('fake, unsupported and oversized avatar uploads are rejected without a database write',async()=>{
  for(const [bytes,type] of [[Buffer.from('<svg/>'),'image/svg+xml'],[Buffer.from('not a png'),'image/png'],[images['image/png'],'image/jpeg'],[Buffer.alloc(5*1024*1024+1),'image/png']]){
    const form=new FormData();form.append('avatar',new Blob([bytes],{type}),'avatar');assert.ok([400,413].includes((await request('POST','/api/users/avatar',a,form)).status));
  }
  assert.equal(writes.length,0);
});
test('Mongoose allows absent optional email and enforces lengths and notifications',()=>{
  const row=new UserSchema({name:'真实姓名',uniqueId:'SCHEMA',passwordHash:'hash'});assert.equal(row.validateSync(),undefined);assert.equal(row.displayName,null);assert.equal(row.emailVerified,false);assert.equal(row.settings.notifications.news,false);
  row.displayName='x'.repeat(31);row.profile.bio='x'.repeat(201);assert.ok(row.validateSync());
});

test('notification delivery failure cannot fail an already-saved business action', async () => {
  failDb = true;
  assert.equal(await createUserNotification({ recipient: a, actor: b, comment: 'comment', type: 'comment_reply', article: 'news' }), null);
  assert.equal(notices.length, 0);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { directoryPage, MemberDirectoryService } = require('../services/MemberDirectoryService');
const accounts = [
  { _id:'a1',uniqueId:'2025000001',name:'账号姓名',email:'account@example.test',role:'committee',isAdmin:false,passwordHash:'private-hash',tokenVersion:5,profile:{avatar:{data:'private-image',contentType:'image/png'}} },
  { _id:'a2',uniqueId:'2025000002',name:'名单内管理员',isAdmin:true },
  { _id:'a3',uniqueId:'ADMIN-external',name:'老师',role:'teacher',isAdmin:false },
];
const roster = [
  { _id:'r1',uniqueId:'2025000001',name:'名单姓名',email:'roster@example.test' },
  { _id:'r2',uniqueId:'2025000002',name:'名单内管理员' },
  { _id:'r3',uniqueId:'2025000003',name:'待开通同学' },
];
test('one row per student ID combines accounts and roster without modifying either collection', () => {
  const before = structuredClone({accounts,roster});
  const result=directoryPage(accounts,roster);
  assert.equal(result.members.length,4);
  assert.equal(new Set(result.members.map(member=>member.uniqueId)).size,4);
  assert.deepEqual(result.summary,{total:4,accounts:3,roster:3,registeredRoster:2,pending:1,outside:1});
  assert.deepEqual({accounts,roster},before);
  const joined=result.members.find(member=>member.uniqueId==='2025000001');
  assert.equal(joined.accountId,'a1');assert.equal(joined.rosterId,'r1');assert.equal(joined.name,'账号姓名');
  assert.equal(joined.rosterName,'名单姓名');assert.equal(joined.inRoster,true);assert.equal(joined.role,'committee');
  const pending=result.members.find(member=>member.uniqueId==='2025000003');
  assert.equal(pending.accountId,null);assert.equal(pending.rosterId,'r3');assert.equal(pending.role,'student');assert.equal(pending.registered,false);
});
test('role and membership filters retain all four identities and unprovisioned students', () => {
  for(const role of ['student','committee','teacher','admin']){
    const result=directoryPage(accounts,roster,{role});assert.equal(result.members.length,1);assert.equal(result.members[0].role,role);
  }
  assert.equal(directoryPage(accounts,roster,{membership:'enrolled'}).members.length,3);
  assert.equal(directoryPage(accounts,roster,{membership:'pending'}).members[0].rosterId,'r3');
  assert.equal(directoryPage(accounts,roster,{membership:'outside'}).members[0].accountId,'a3');
  assert.equal(directoryPage(accounts,roster,{role:'admin',membership:'outside'}).members.length,0);
});
test('search includes both roster and account names/contact addresses; plain text cannot inject regex', () => {
  for(const search of ['账号姓名','名单姓名','ACCOUNT@example.test','roster@example.test','2025000001']) assert.equal(directoryPage(accounts,roster,{search}).members[0].accountId,'a1');
  assert.equal(directoryPage(accounts,roster,{search:'.*'}).members.length,0);
  assert.equal(directoryPage(accounts,roster,{search:'missing'}).pagination.total,0);
});
test('pagination is stable and clamps an obsolete page after removal', () => {
  const rows=[1,2,3,4].map(page=>directoryPage(accounts,roster,{page,limit:1}).members[0].id);
  assert.equal(new Set(rows).size,4);
  const last=directoryPage(accounts,roster,{page:99,limit:2});assert.equal(last.pagination.page,2);assert.equal(last.members.length,2);
  const empty=directoryPage([],[],{page:99});assert.deepEqual(empty.pagination,{page:1,limit:20,total:0,pages:1});
});
test('removing a roster record leaves its account, role and history available as an outside account', () => {
  const removed=directoryPage(accounts,roster.filter(entry=>entry._id!=='r1'));
  const member=removed.members.find(row=>row.accountId==='a1');
  assert.equal(member.role,'committee');assert.equal(member.rosterId,null);assert.equal(member.registered,true);assert.equal(member.inRoster,false);
  assert.equal(accounts[0].passwordHash,'private-hash');assert.equal(accounts[0].tokenVersion,5);
});
test('directory output never includes password hashes, session versions or avatar bytes', () => {
  const text=JSON.stringify(directoryPage(accounts,roster));
  for(const secret of ['private-hash','private-image','passwordHash','tokenVersion'])assert.equal(text.includes(secret),false);
  assert.equal(directoryPage(accounts,roster).members.find(row=>row.accountId==='a1').hasAvatar,true);
});
test('invalid filters are rejected and database reads select only directory fields', async () => {
  for(const params of [{role:'owner'},{membership:'deleted'},{search:{$ne:null}},{search:'a'.repeat(201)}])assert.throws(()=>directoryPage(accounts,roster,params),{status:400});
  const picks=[];
  const model=rows=>({find(filter){assert.deepEqual(filter,{});return{select(fields){picks.push(fields);return this;},lean:async()=>rows};}});
  const service=new MemberDirectoryService({UserModel:model(accounts),RosterModel:model(roster)});
  assert.equal((await service.list({membership:'pending'})).members.length,1);
  assert.equal(picks.length,2);assert.equal(picks.some(fields=>fields.includes('passwordHash')||fields.includes('avatar.data')),false);
});

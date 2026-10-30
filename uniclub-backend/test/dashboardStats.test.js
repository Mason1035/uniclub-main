const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dashboardWindow, statsResponse, contentPipeline, DashboardStatsService } = require('../services/DashboardStatsService');
const now = new Date('2026-10-26T16:15:00.000Z');
test('Shanghai calendar windows include exactly 7/30/90 days including today', () => {
  for (const days of [7, 30, 90]) {
    const range = dashboardWindow(String(days), now);
    assert.equal(range.dates.length, days);assert.equal(range.dates.at(-1), '2026-10-27');
    assert.equal(range.start.toISOString(), new Date(Date.parse('2026-10-26T16:00:00Z') - (days - 1) * 86400000).toISOString());
  }
  assert.equal(dashboardWindow(undefined, now).days, 30);
  for (const days of ['0','8','365', ['7'], { $ne: 7 }, '7.0']) assert.throws(() => dashboardWindow(days, now), { status:400 });
});
test('empty statistics contain exact zero-filled dates and four mutually exclusive roles', () => {
  const result = statsResponse({ users:[], news:[], events:[], resources:[] }, dashboardWindow(7,now),now);
  assert.equal(result.users,0);assert.equal(result.roles.length,4);
  assert.equal(result.timeline.points.length,7);assert.ok(result.timeline.points.every(p=>p.news===0&&p.events===0&&p.resources===0));
  assert.equal(result.timeline.basis,'createdAt');assert.equal(result.timeline.timeZone,'Asia/Shanghai');
});
test('aggregate data preserves totals, undated records, exact small daily counts and roles', () => {
  const range=dashboardWindow(7,now);
  const input = {
    users:[{roles:[{_id:'student',count:2},{_id:'committee',count:1},{_id:'teacher',count:1},{_id:'admin',count:3}]}],
    news:[{total:[{count:8}],pending:[{count:2}],daily:[{_id:'2026-10-27',count:1}],undated:[{count:1}]}],
    events:[{total:[{count:4}],pending:[],daily:[{_id:'2026-10-21',count:2}],undated:[]}],
    resources:[{total:[{count:3}],pending:[{count:1}],daily:[],undated:[{count:2}]}],
  };
  const result=statsResponse(input,range,now);
  assert.equal(result.users,7);assert.equal(result.roles.reduce((sum,role)=>sum+role.count,0),7);
  assert.deepEqual([result.news,result.events,result.resources],[8,4,3]);
  assert.deepEqual(result.breakdown,{admins:3,pendingResources:1,pendingNews:2});
  assert.equal(result.timeline.points[0].events,2);assert.equal(result.timeline.points.at(-1).news,1);
  assert.deepEqual(result.timeline.undated,{news:1,events:0,resources:2});
  assert.equal(result.generatedAt,now.toISOString());
});
test('content aggregation uses createdAt dates within the window and never scheduled future data', () => {
  const range=dashboardWindow(30,now), pipeline=contentPipeline(range,now);
  const daily=pipeline[0].$facet.daily;
  assert.deepEqual(daily[0].$match.createdAt,{$type:'date',$gte:range.start,$lte:now});
  assert.equal(daily[1].$group._id.$dateToString.timezone,'Asia/Shanghai');
  assert.equal(daily[1].$group._id.$dateToString.date,'$createdAt');
  assert.equal(JSON.stringify(pipeline).includes('publishedAt'),false);
});
test('service rejects invalid range before querying and never reads personal fields', async () => {
  const pipelines=[];
  const model={aggregate(pipeline){pipelines.push(pipeline);return {option(options){assert.equal(options.maxTimeMS,5000);return Promise.resolve([]);}};}};
  const service=new DashboardStatsService({models:{User:model,News:model,Event:model,Resource:model},now:()=>now});
  await assert.rejects(service.get('invalid'),{status:400});assert.equal(pipelines.length,0);
  assert.equal((await service.get(7)).timeline.points.length,7);assert.equal(pipelines.length,4);
  for (const secret of ['email','passwordHash','uniqueId','profile']) assert.equal(JSON.stringify(pipelines).includes(secret),false);
});

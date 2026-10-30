const { ROLES } = require('../utils/roles');
const DAY = 86400000;
const SHANGHAI_OFFSET = 8 * 60 * 60 * 1000;
const labels = { student:'学生', committee:'班委', teacher:'老师', admin:'管理员' };

function dashboardWindow(value = 30, now = new Date()) {
  if (![7,30,90,'7','30','90'].includes(value)) throw Object.assign(new Error('时间范围仅支持 7、30 或 90 天。'), { status:400 });
  const days=Number(value);
  const today=Math.floor((now.getTime()+SHANGHAI_OFFSET)/DAY)*DAY-SHANGHAI_OFFSET;
  const start=new Date(today-(days-1)*DAY);
  const dates=Array.from({length:days},(_,index)=>new Date(start.getTime()+index*DAY+SHANGHAI_OFFSET).toISOString().slice(0,10));
  return { days, start, dates };
}
function contentPipeline(range, now) {
  return [{ $facet: {
    total:[{$count:'count'}],
    pending:[{$match:{status:'pending'}},{$count:'count'}],
    daily:[{$match:{createdAt:{$type:'date',$gte:range.start,$lte:now}}},
      {$group:{_id:{$dateToString:{date:'$createdAt',format:'%Y-%m-%d',timezone:'Asia/Shanghai'}},count:{$sum:1}}}],
    undated:[{$match:{$expr:{$ne:[{$type:'$createdAt'},'date']}}},{$count:'count'}],
  }}];
}
function statsResponse(data, range, now) {
  const counts = new Map((data.users[0]?.roles || []).map(row=>[row._id,row.count]));
  const roles=ROLES.map(role=>({role,label:labels[role],count:counts.get(role)||0}));
  const count=(type,key)=>data[type][0]?.[key]?.[0]?.count || 0;
  const daily=Object.fromEntries(['news','events','resources'].map(type=>[type,new Map((data[type][0]?.daily||[]).map(row=>[row._id,row.count]))]));
  return {
    users:roles.reduce((sum,row)=>sum+row.count,0), events:count('events','total'),news:count('news','total'),resources:count('resources','total'),
    breakdown:{admins:counts.get('admin')||0,pendingResources:count('resources','pending'),pendingNews:count('news','pending')},
    roles,
    timeline:{days:range.days,timeZone:'Asia/Shanghai',basis:'createdAt',startDate:range.dates[0],endDate:range.dates.at(-1),
      points:range.dates.map(date=>({date,news:daily.news.get(date)||0,events:daily.events.get(date)||0,resources:daily.resources.get(date)||0})),
      undated:{news:count('news','undated'),events:count('events','undated'),resources:count('resources','undated')}},
    generatedAt:now.toISOString(),
  };
}
class DashboardStatsService {
  constructor({ models, now = ()=>new Date() } = {}) {
    this.models=models || {User:require('../models/User'),News:require('../models/News'),Event:require('../models/Event'),Resource:require('../models/Resource')};
    this.now=now;
  }
  async get(days) {
    const now=this.now(), range=dashboardWindow(days,now);
    // Same precedence as normalizeRole: explicit valid role, then legacy flag.
    const role={$cond:[{$in:['$role',ROLES]},'$role',{$cond:[{$eq:['$isAdmin',true]},'admin','student']}]};
    const jobs = { users:this.models.User.aggregate([{$facet:{roles:[{$group:{_id:role,count:{$sum:1}}}]}}]).option({maxTimeMS:5000}) };
    for (const [type,model] of [['events',this.models.Event],['news',this.models.News],['resources',this.models.Resource]]) {
      jobs[type]=model.aggregate(contentPipeline(range,now)).option({maxTimeMS:5000});
    }
    const results=await Promise.all(Object.entries(jobs).map(async([key,query])=>[key,await query]));
    return statsResponse(Object.fromEntries(results),range,now);
  }
}
module.exports={dashboardWindow,contentPipeline,statsResponse,DashboardStatsService};

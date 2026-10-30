const { hasPermission } = require('../utils/roles');
const { publicFilter: activityFilter, typeLabel } = require('../utils/activityPolicy');
const { publicNewsFilter } = require('../utils/dailyNewsVisibility');

const MAX_CANDIDATES = 12;
const MAX_CHUNKS = 6;
const MAX_CONTEXT_CHARS = 12000;
const CHUNK_CHARS = 1600;
const QUERY_TIMEOUT_MS = 2000;
const fail = (message, status, code) => Object.assign(new Error(message), { status, code });
const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const abortError = () => Object.assign(new Error('检索已取消。'), { name: 'AbortError', code: 'ABORT_ERR' });

// Curated route metadata, not a copy of the repository or member records.
const NAVIGATION = Object.freeze([
  { key:'announcement', title:'班级公告', url:'/announcements', terms:['公告','通知','安排'], text:'班级公告展示已发布且未过期的通知、重要安排及相关链接。' },
  { key:'resource', title:'学习资源', url:'/resources', terms:['资源','资料','文档','文件','教程','工具','模板','学习网站','github'], text:'学习资源可按用途分类，查看资源介绍、分类标签以及原始链接或附件入口。AI 检索标题、简介和附件文件名，未读取附件正文或外部网页。' },
  { key:'event', title:'班级活动', url:'/events', terms:['活动','报名','团建','班会','回顾'], text:'班级活动提供活动介绍、时间、地点和报名入口；报名结果及个人状态请在活动页面查看。活动报名和详情按当前班级成员或业务管理权限开放。' },
  { key:'news', title:'新闻资讯', url:'/news', terms:['新闻','资讯','每日精选'], text:'新闻资讯展示已批准发布的内容与当前每日精选，详情页包含原文、摘要和讨论。' },
  { key:'social', title:'班级动态', url:'/social', terms:['动态','交流','帖子','讨论'], text:'班级动态用于分享和交流。AI 仅检索当前可见的公开或班级动态，不检索好友专属、私密帖子及个人资料。' },
  { key:'quantification', title:'量化材料', url:'/quantification', terms:['量化','材料','证明','收集','提交'], text:'量化材料页面显示当前收集安排、提交入口和本人提交记录。具体要求、开放时间及个人审核结果以页面实时数据为准；AI 不读取个人材料或其他成员记录。' },
  { key:'fees', title:'班费缴纳', url:'/fees', terms:['班费','缴费','缴纳','付款','凭证','账单'], text:'班费页面提供缴费说明、上传支付凭证及查看本人提交状态。AI 不读取支付凭证、付款信息或个人缴费状态，不能据此判断是否缴费。' },
  { key:'notifications', title:'我的通知', url:'/notifications', terms:['通知','提醒','未读'], text:'我的通知显示与本人相关的互动提醒。请进入页面查看真实的未读提醒；AI 不读取个人通知记录。' },
  { key:'about', title:'关于 ClassHub', url:'/about', terms:['classhub','班级网站','四川师范大学','软件工程3班','关于','网站功能'], text:'ClassHub 是四川师范大学软件工程 3 班的班级空间，包含公告、活动、新闻、学习资源、班级动态、量化材料和班费入口。' },
]);
const ROUTING = [
  ['announcement', /公告|通知|安排/u], ['resource', /资源|资料|文档|文件|教程|工具|模板|讲义|教材|附件/u],
  ['event', /活动|报名|团建|班会|回顾/u], ['news', /新闻|资讯|每日精选/u],
  ['social', /动态|交流|帖子|讨论/u], ['quantification', /量化|材料|证明|收集/u], ['fees', /班费|缴费|缴纳|付款|凭证|账单/u],
];
const STOP = /(?:请帮我|请问|帮我|帮忙|告诉我|我想要|我想|我需要|我可以|能不能|有没有|有哪些|有什么|有哪|怎么|如何|哪里|什么|是否|一下|最近|近期|最新|本站|网站|本班|我们|我的|查找|查询|搜索|寻找|找到|看看|查看|介绍|总结|推荐|关于|相关|的|了|吗|呢|吧)/gu;
const ROUTE_WORDS = /(?:学习资料|班级公告|班级活动|新闻资讯|班级动态|资源|资料|文档|文件|教程|工具|公告|通知|活动|新闻|资讯|动态|帖子|班级|讲义|教材|附件)/gu;
const GENERIC_CATALOG = /^(?:学习|入门|基础|新手|适合|推荐|并|和|以及|现有|全部|所有|目前|好用|一些|能够|可以|请|我)+$/u;

function normalize(value) { return value.normalize('NFKC').toLowerCase().replace(/[\u0000-\u001f\u007f]/g,' ').trim(); }
function parseKnowledgeQuestion(value) {
  if (typeof value !== 'string' || value.length > 4000) throw fail('问题须为不超过 4000 字的文本。',400,'INVALID_QUESTION');
  const normalized=normalize(value);
  const routes=ROUTING.filter(([,pattern])=>pattern.test(normalized)).map(([key])=>key);
  const remaining=normalized.replace(STOP,' ').replace(ROUTE_WORDS,' ').replace(/[?？!！。；;，,：:“”"'（）()\[\]{}]/gu,' ');
  const terms=[];
  const add=value=>{if(value.length>=2&&!terms.includes(value))terms.push(value);};
  for(const token of remaining.match(/[a-z\d][a-z\d+#._-]*|\p{Script=Han}{2,}/gu)||[]) {
    if(routes.length&&GENERIC_CATALOG.test(token))continue;
    add(token.slice(0,40));
    if(/^\p{Script=Han}{4,}$/u.test(token)) {
      for(let i=0;i<token.length-1&&terms.length<18;i++)add(token.slice(i,i+2));
    }
  }
  const list=routes.length>0&&terms.length===0;
  return {normalized,terms:terms.slice(0,18),routes,list,empty:!/[\p{L}\p{N}]/u.test(normalized)};
}

function cleanText(value) {
  return String(value??'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
    .replace(/<\/(?:p|div|h[1-6]|li|section)>|<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g,'$1')
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39);/gi,entity=>({'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'"})[entity.toLowerCase()])
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,' ').replace(/[ \t]+/g,' ').replace(/\n\s*\n+/g,'\n').trim();
}

// Window around the first keyword match, including matches late in a long
// article. Mongo returns at most this text window, never full article bodies.
function textWindow(field, regex, limit) {
  const text={$convert:{input:`$${field}`,to:'string',onError:'',onNull:''}};
  if(!regex)return {$substrCP:[text,0,limit]};
  return {
    $let: {
      vars: { text },
      in: {
        $let: {
          vars: { match: { $regexFind: { input: '$$text', regex } } },
          in: { $substrCP: ['$$text', { $max: [0, { $subtract: [{ $ifNull: ['$$match.idx', 0] }, 400] }] }, limit] },
        },
      },
    },
  };
}
function sourceProjection(source,regex) {
  const result={_id:1,createdAt:1};
  for(const [alias,field,limit]of source.fields) result[alias]=textWindow(field,regex,limit);
  for(const field of source.raw||[]) result[field]=1;
  for(const [alias,field]of source.arrays||[]) result[alias]={$reduce:{input:{$slice:[{$ifNull:[`$${field}`,[]]},12]},initialValue:'',in:{$concat:['$$value',' · ',{$substrCP:[{$convert:{input:'$$this',to:'string',onError:'',onNull:''}},0,80]}]}}};
  return result;
}
function sentenceChunks(text) {
  const lines=cleanText(text).split(/\n|(?<=[。！？.!?])\s*/u).filter(Boolean);
  const chunks=[];let current='';
  for(const line of lines) {
    if(current.length+line.length+1>CHUNK_CHARS&&current){chunks.push(current);current='';}
    for(let offset=0;offset<line.length;offset+=CHUNK_CHARS) {
      const part=line.slice(offset,offset+CHUNK_CHARS);
      if(part.length===CHUNK_CHARS){if(current){chunks.push(current);current='';}chunks.push(part);}
      else current+=(current?'\n':'')+part;
    }
  }
  if(current)chunks.push(current);
  return chunks.slice(0,12);
}

function recordChunks(source,item,staff) {
  const title=cleanText(item.title||item.name||item.body?.slice(0,60)||'班级内容').slice(0,240);
  const metadata=[item.category,item.categories,item.tags,item.resourceType,item.eventType?typeLabel(item.eventType):'',item.locationAddress,item.locationRoom,item.fileName].filter(Boolean).map(cleanText).join(' · ').slice(0,500);
  const date=item.publishedAt||item.date||item.createdAt;
  const stamp=date&&Number.isFinite(new Date(date).getTime())?new Date(date).toISOString().slice(0,10):'';
  const attachment=source.key==='resource'?'\n检索范围：资源标题、简介、分类与附件文件名；未读取附件正文或外部网页内容。':'';
  const draft=staff&&((source.key==='announcement'&&item.isPublished!==true)||(source.key==='news'&&item.status!=='approved')||(source.key==='resource'&&item.status!=='approved')||(source.key==='event'&&item.status==='draft'));
  const url=draft?source.management:source.route(encodeURIComponent(String(item._id)));
  const prefix=[title,metadata,stamp,draft?'管理区草稿或待审核内容，尚未公开发布。':'',attachment].filter(Boolean).join('\n');
  const body=[item.excerpt,item.body,item.pollQuestion].filter(Boolean).join('\n');
  return sentenceChunks(body||title).map((text,index)=>({
    id:`${source.key}:${String(item._id)}:${index}`,recordId:`${source.key}:${String(item._id)}`,title,url,type:'site',
    text:`${prefix}\n${text}`,source:source.key,date,
  }));
}

function rankChunks(chunks,query) {
  const df=query.terms.map(term=>chunks.reduce((sum,chunk)=>sum+Number(normalize(chunk.text).includes(term)),0));
  const average=chunks.reduce((sum,chunk)=>sum+chunk.text.length,0)/(chunks.length||1);
  return chunks.map((chunk,index)=>{
    const title=normalize(chunk.title), text=normalize(chunk.text);
    let score=0;
    query.terms.forEach((term,i)=>{
      const count=text.split(term).length-1;
      if(count){const tf=Math.min(count,8);score+=Math.log(1+(chunks.length-df[i]+.5)/(df[i]+.5))*tf*2.2/(tf+1.2*(.25+.75*text.length/Math.max(1,average)));}
      if(title.includes(term))score+=4;
    });
    if(query.list&&query.routes.includes(chunk.source==='quickLink'?'resource':chunk.source))score+=chunk.navigation?1:8;
    if(chunk.navigation&&query.routes.includes(chunk.source))score+=query.terms.length?1:2;
    return {...chunk,score,index};
  }).filter(chunk=>chunk.score>0).sort((a,b)=>b.score-a.score||(new Date(b.date).getTime()||0)-(new Date(a.date).getTime()||0)||a.index-b.index);
}
function packContext(chunks) {
  const result=[],perRecord=new Map();
  for(const chunk of chunks) {
    if(result.length>=MAX_CHUNKS)break;
    if((perRecord.get(chunk.recordId)||0)>=2)continue;
    const doc={id:chunk.id,title:chunk.title,url:chunk.url,type:'site',text:chunk.text.slice(0,1850)};
    const room=MAX_CONTEXT_CHARS-JSON.stringify([...result,{...doc,text:''}]).length;
    if(room<180)break;
    doc.text=doc.text.slice(0,room);
    // Escapes in JSON can make the encoded size longer than the text length.
    while(JSON.stringify([...result,doc]).length>MAX_CONTEXT_CHARS)doc.text=doc.text.slice(0,-20);
    result.push(doc);perRecord.set(chunk.recordId,(perRecord.get(chunk.recordId)||0)+1);
  }
  return result;
}

function defaultModels() {
  return Object.fromEntries(['Announcement','News','Event','PastEvent','Resource','ResourceQuickLink','SocialPost','User','AiSettings'].map(name=>[name,require(`../models/${name}`)]).concat([['Roster',require('../models/EnrolledUser')]]));
}
async function boundedRead(factory,signal) {
  if(signal?.aborted)throw abortError();
  let timer,listener;
  const promise=Promise.resolve().then(()=>{if(signal?.aborted)throw abortError();return factory();});
  const stop=new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(fail('站内检索暂时不可用，请稍后再试。',503,'KNOWLEDGE_UNAVAILABLE')),QUERY_TIMEOUT_MS+500);
    if(signal){listener=()=>reject(abortError());signal.addEventListener('abort',listener,{once:true});}
  });
  try{return await Promise.race([promise,stop]);}
  finally{clearTimeout(timer);if(listener)signal.removeEventListener('abort',listener);}
}

class SiteKnowledgeService {
  constructor({models,now=()=>new Date()}={}) { this.models=models||defaultModels();this.now=now; }
  async retrieve(question,{userId,signal}={}) {
    const query=parseKnowledgeQuestion(question);
    if(typeof userId!=='string'||! /^[a-f\d]{24}$/i.test(userId))throw fail('请先登录后使用 AI。',401,'AUTH_REQUIRED');
    if(signal?.aborted)throw abortError();
    if(query.empty)return [];
    try {
      const account=await boundedRead(()=>this.models.User.findById(userId).select('isEnrolled uniqueId role isAdmin').maxTimeMS(QUERY_TIMEOUT_MS).lean(),signal);
      if(!account)throw fail('登录状态已失效，请重新登录。',401,'AUTH_REQUIRED');
      const staff=hasPermission(account,'content:manage');
      const enrolled=account.isEnrolled===true&&typeof account.uniqueId==='string'&&Boolean(await boundedRead(()=>this.models.Roster.exists({uniqueId:account.uniqueId}).maxTimeMS(QUERY_TIMEOUT_MS).exec(),signal));
      const now=this.now();
      const sources=[
        {key:'announcement',model:'Announcement',fields:[['title','title',240],['body','body',8000]],raw:['publishedAt','isPublished'],search:['title','body'],sort:{publishedAt:-1,_id:-1},route:()=>'/announcements',management:'/admin/notifications',filter:{$and:[{publishedAt:{$lte:now}},{$or:[{expiresAt:null},{expiresAt:{$gt:now}}]},...(staff?[]:[{isPublished:true}])]}},
        {key:'news',model:'News',fields:[['title','title',240],['excerpt','excerpt',1200],['body','content',10000]],arrays:[['categories','categories']],raw:['publishedAt','status'],search:['title','excerpt','content','categories'],sort:{publishedAt:-1,createdAt:-1,_id:-1},route:id=>`/news/${id}`,management:'/admin/news'},
        {key:'event',model:'Event',fields:[['title','title',240],['body','description',4000],['excerpt','summary',4000],['eventType','eventType',80],['locationAddress','location.address',240],['locationRoom','location.room',160]],arrays:[['tags','tags'],['categories','category']],raw:['status'],search:['title','description','summary','tags','eventType','location.address','location.room'],sort:{createdAt:-1,_id:-1},route:id=>`/event/${id}`,management:'/admin/events',filter:staff?{$and:[{deletedAt:null},{$or:[{status:'draft'},activityFilter(now)]}]}:enrolled?activityFilter(now):null},
        {key:'pastEvent',model:'PastEvent',fields:[['title','title',240],['excerpt','subtitle',800],['body','body',8000],['category','category',80]],arrays:[['tags','tags']],raw:['date'],search:['title','subtitle','body','category','tags'],sort:{date:-1,_id:-1},route:id=>`/past-events/${id}`,filter:{date:{$lte:now}}},
        {key:'resource',model:'Resource',fields:[['title','title',240],['body','description',2400],['category','category',80],['resourceType','type',80],['fileName','file.originalName',240]],arrays:[['tags','tags']],raw:['status'],search:['title','description','category','tags','file.originalName','type'],sort:{createdAt:-1,_id:-1},route:id=>`/resource/${id}`,management:'/admin/resources',filter:{status:staff?{$in:['approved','pending']}:'approved'}},
        {key:'quickLink',model:'ResourceQuickLink',fields:[['name','name',160],['body','description',500]],search:['name','description'],sort:{createdAt:-1,_id:-1},route:()=>'/resources',filter:{}},
        {key:'social',model:'SocialPost',fields:[['title','projectData.title',240],['excerpt','projectData.description',1000],['body','content',3000],['pollQuestion','poll.question',500]],arrays:[['tags','hashtags']],search:['content','projectData.title','projectData.description','hashtags','poll.question'],sort:{createdAt:-1,_id:-1},route:()=>'/social',filter:{status:'active',visibility:{$in:enrolled?['public','club-members']:['public']}}},
      ];
      const enabled=sources.filter(source=>{
        if(source.filter===null)return false;
        // An explicit list request can select a category; a topic question
        // searches across categories so a notice about resources is not lost.
        if(!query.list)return true;
        if(source.key==='quickLink')return query.routes.includes('resource');
        if(source.key==='pastEvent')return query.routes.includes('event');
        if(source.key==='announcement'&&query.routes.includes('quantification'))return true;
        return query.routes.includes(source.key);
      });
      if(enabled.some(source=>source.key==='news')) {
        const settings=this.models.AiSettings?await boundedRead(()=>this.models.AiSettings.findById('deepseek').select('dailyNewsRuntime.activeBatchId').maxTimeMS(QUERY_TIMEOUT_MS).lean(),signal):null;
        const published=publicNewsFilter(settings?.dailyNewsRuntime?.activeBatchId,now);
        const source=enabled.find(source=>source.key==='news');
        source.filter=staff?{$or:[published,{status:{$in:['draft','pending']},origin:{$ne:'ai_daily'},$or:[{publishedAt:null},{publishedAt:{$lte:now}}]}]}:published;
      }
      const regex=query.terms.length?new RegExp(query.terms.map(escaped).join('|'),'i'):null;
      const batches=await Promise.all(enabled.map(async source=>{
        const match={$and:[source.filter||{},{$or:[{createdAt:null},{createdAt:{$lte:now}}]}]};
        if(regex)match.$and.push({$or:source.search.map(field=>({[field]:regex}))});
        // A generic un-routed question cannot request every latest collection.
        if(!regex&&!query.routes.length)return [];
        const pipeline=[{$match:match},{$sort:source.sort},{$limit:MAX_CANDIDATES},{$project:sourceProjection(source,regex)}];
        const rows=await boundedRead(()=>this.models[source.model].aggregate(pipeline).option({maxTimeMS:QUERY_TIMEOUT_MS}).exec(),signal);
        return rows.flatMap(item=>recordChunks(source,item,staff));
      }));
      if(signal?.aborted)throw abortError();
      const navigation=NAVIGATION.filter(item=>query.routes.includes(item.key)||query.terms.some(term=>item.terms.includes(term)))
        .map(item=>({id:`navigation:${item.key}`,recordId:`navigation:${item.key}`,title:item.title,url:item.url,type:'site',text:item.text,source:item.key,navigation:true}));
      return packContext(rankChunks([...batches.flat(),...navigation],query));
    } catch(error) {
      if(error.name==='AbortError'||[400,401].includes(error.status))throw error;
      throw fail('站内检索暂时不可用，请稍后再试。',503,'KNOWLEDGE_UNAVAILABLE');
    }
  }
}

module.exports={SiteKnowledgeService,parseKnowledgeQuestion,rankChunks,packContext,sentenceChunks,textWindow,MAX_CANDIDATES,MAX_CONTEXT_CHARS};

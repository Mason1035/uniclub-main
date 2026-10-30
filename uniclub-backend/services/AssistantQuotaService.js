const {AsyncLocalStorage}=require('node:async_hooks');
const {randomUUID}=require('node:crypto');
const mongoose=require('mongoose');
const Quota=require('../models/AssistantQuota');
const Usage=require('../models/AssistantUsage');
const {AiError}=require('../utils/aiSecret');
const LIMIT=100000, WINDOW_MS=24*60*60*1000;
const context=new AsyncLocalStorage();
const bounded=query=>typeof query.maxTimeMS==='function'?query.maxTimeMS(5000):query;
const unavailable=()=>new AiError('AI_QUOTA_UNAVAILABLE','暂时无法核实 AI 额度，请稍后重试。',503);
// Old requests have no reliable reservation amount. Import only known usage;
// never invent a full allowance charge for missing provider counters.
const legacyTokens=row=>row?.reported&&Number.isSafeInteger(row.totalTokens)&&row.totalTokens>=0?row.totalTokens:0;
function validOwner(userId){if(!mongoose.Types.ObjectId.isValid(userId))throw new AiError('AUTH_REQUIRED','请先登录。',401);}
function quotaView(entries,now){
  const active=entries.filter(entry=>new Date(entry.at).getTime()>now.getTime()-WINDOW_MS);
  const usedTokens=active.reduce((sum,entry)=>sum+(entry.usedTokens??0),0);
  const reservedTokens=active.reduce((sum,entry)=>sum+(entry.usedTokens==null?entry.reservedTokens:0),0);
  const remainingTokens=Math.max(0,LIMIT-usedTokens-reservedTokens);
  const times=active.filter(entry=>(entry.usedTokens??entry.reservedTokens)>0).map(entry=>new Date(entry.at).getTime()+WINDOW_MS);
  return {limit:LIMIT,windowHours:24,usedTokens,reservedTokens,remainingTokens,resetAt:times.length?new Date(Math.min(...times)).toISOString():null,blocked:remainingTokens===0};
}
function quotaError(quota){const error=new AiError('AI_QUOTA_EXCEEDED','近 24 小时 AI 可用额度不足（每人上限 100,000 token）。请等待额度滚动恢复，或缩短问题、历史对话和图片后重试。',429);error.quota=quota;return error;}
// UTF-8 bytes are a conservative bound for byte-tokenized text, with explicit
// framing headroom. Images are <=1024 tokens each per current provider docs;
// base64 transport bytes are not text tokens. Never display this as actual use.
function inputTokenUpperBound(messages){
  if(!Array.isArray(messages))throw new AiError('INVALID_CONTEXT','模型上下文格式无效。');
  let budget=1024;
  for(const message of messages){
    budget+=64+Buffer.byteLength(String(message.role||''),'utf8');
    if(typeof message.content==='string')budget+=Buffer.byteLength(message.content,'utf8');
    else if(Array.isArray(message.content))for(const part of message.content){
      budget+=64;
      if(part?.type==='text'&&typeof part.text==='string')budget+=Buffer.byteLength(part.text,'utf8');
      else if(part?.type==='image_url')budget+=1024+128;
      else throw new AiError('INVALID_CONTEXT','模型上下文包含不支持的内容。');
    }else throw new AiError('INVALID_CONTEXT','模型上下文格式无效。');
  }
  return budget;
}
class AssistantQuotaService{
  constructor({quotaModel=Quota,legacyUsageModel=Usage,clock=()=>new Date()}={}){this.model=quotaModel;this.legacy=legacyUsageModel;this.clock=clock;}
  async row(userId){
    for(let attempt=0;attempt<30;attempt++){
      const row=await bounded(this.model.findById(userId)).lean();
      const broken=(row?.entries||[]).filter(entry=>entry.callId.startsWith('legacy:')&&entry.usedTokens==null);
      if(!broken.length)return row;
      const ids=broken.map(entry=>entry.callId.slice(7));
      const records=await bounded(this.legacy.find({userId,_id:{$in:ids}})).select('_id reported totalTokens').lean();
      const known=new Map(records.map(record=>[String(record._id),legacyTokens(record)]));
      // Repair only the erroneous legacy holds. Actual use and current calls
      // stay intact; revision comparison prevents overwriting a concurrent call.
      const entries=row.entries.map(entry=>entry.callId.startsWith('legacy:')&&entry.usedTokens==null
        ?{...entry,reservedTokens:0,usedTokens:known.get(entry.callId.slice(7))||0}:entry);
      const saved=await bounded(this.model.findOneAndUpdate({_id:userId,revision:row.revision},{$set:{entries},$inc:{revision:1}},{new:true,runValidators:true})).lean();
      if(saved)return saved;
    }
    throw unavailable();
  }
  async initialize(userId,now){
    const old=await bounded(this.legacy.find({userId,createdAt:{$gt:new Date(now.getTime()-WINDOW_MS)}})).select('_id createdAt reported totalTokens unknownCalls').lean();
    const entries=old.map(row=>({callId:`legacy:${row._id}`,at:new Date(row.createdAt),reservedTokens:0,usedTokens:legacyTokens(row)}));
    try{await this.model.create({_id:userId,revision:0,entries});}catch(error){if(error.code!==11000)throw error;}
  }
  async mutate(userId,change){
    validOwner(userId);
    for(let attempt=0;attempt<30;attempt++){
      const now=this.clock();let old=await this.row(userId);
      if(!old){await this.initialize(userId,now);continue;}
      const entries=(old.entries||[]).filter(entry=>new Date(entry.at).getTime()>now.getTime()-WINDOW_MS).map(entry=>({...entry}));
      const result=change(entries,now);
      const saved=await bounded(this.model.findOneAndUpdate({_id:userId,revision:old.revision},{$set:{entries},$inc:{revision:1}},{new:true,runValidators:true})).lean();
      if(saved)return {result,quota:quotaView(saved.entries,now)};
    }
    throw unavailable();
  }
  async status(userId){
    validOwner(userId);let row=await this.row(userId);
    if(!row){await this.initialize(userId,this.clock());row=await this.row(userId);}
    if(!row)throw unavailable();return quotaView(row.entries||[],this.clock());
  }
  async assertAvailable(userId){const quota=await this.status(userId);if(quota.blocked)throw quotaError(quota);return quota;}
  async reserve(userId,messages,maxTokens){
    const input=inputTokenUpperBound(messages),requested=Number.isSafeInteger(maxTokens)&&maxTokens>0?maxTokens:4096;
    const callId=randomUUID();
    const {result,quota}=await this.mutate(userId,(entries,now)=>{
      const remaining=quotaView(entries,now).remainingTokens;
      if(remaining<=input)throw quotaError(quotaView(entries,now));
      const output=Math.min(requested,remaining-input),reservedTokens=input+output;
      entries.push({callId,at:now,reservedTokens,usedTokens:null});
      return {callId,maxTokens:output,reservedTokens};
    });
    return {...result,quota};
  }
  async settle(userId,callId,usage){
    if(!usage?.reported||![usage.promptTokens,usage.completionTokens,usage.totalTokens].every(value=>Number.isSafeInteger(value)&&value>=0)||usage.totalTokens!==usage.promptTokens+usage.completionTokens)return;
    return this.mutate(userId,entries=>{const entry=entries.find(item=>item.callId===callId);if(entry&&entry.usedTokens==null)entry.usedTokens=usage.totalTokens;});
  }
}
let defaults;
function services(){return defaults||=( {quota:new AssistantQuotaService(),usage:new (require('./AssistantUsageService').AssistantUsageService)()} );}
async function withAssistantUsage(userId,fn,{source='member',requestId=randomUUID(),quotaService,usageService}={}){
  const parent=context.getStore();
  if(parent){
    if(String(parent.userId)!==String(userId))throw new AiError('FORBIDDEN','AI 用量不能跨账号记账。',403);
    return {result:await fn(),requestId:parent.requestId,quota:await parent.quota.status(userId),usage:parent.totals};
  }
  const quota=quotaService||services().quota,usage=usageService||services().usage;
  await quota.assertAvailable(userId);
  await usage.begin(userId,requestId,source);
  const scope={userId,requestId,quota,usage,totals:{promptTokens:0,completionTokens:0,totalTokens:0,reported:false},calls:0,reportedCalls:0};
  try{
    const result=await context.run(scope,fn);
    await usage.finish(userId,requestId,'completed');
    return {result,requestId,usage:scope.totals,quota:await quota.status(userId)};
  }catch(error){try{await usage.finish(userId,requestId,error.code==='CANCELLED'?'cancelled':'failed');}catch{}throw error;}
}
async function reserveCompletion(messages,maxTokens){
  const scope=context.getStore();if(!scope)return null;
  const allocation=await scope.quota.reserve(scope.userId,messages,maxTokens);
  // Persist the unknown call before HTTP. Failure remains reserved, fail closed.
  await scope.usage.beginCall(scope.userId,scope.requestId,allocation.callId);
  scope.calls++;
  let reported=false;
  return {...allocation,async report(usage){
    if(reported||!usage?.reported)return;
    reported=true;
    await scope.quota.settle(scope.userId,allocation.callId,usage);
    await scope.usage.reportCall(scope.userId,scope.requestId,allocation.callId,usage);
    scope.reportedCalls++;
    for(const field of ['promptTokens','completionTokens','totalTokens'])scope.totals[field]+=usage[field];
    scope.totals.reported=scope.reportedCalls===scope.calls;
  }};
}
module.exports={AssistantQuotaService,withAssistantUsage,reserveCompletion,inputTokenUpperBound,quotaView,quotaError,LIMIT,WINDOW_MS};

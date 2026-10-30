const Usage = require('../models/AssistantUsage');
const User = require('../models/User');
const mongoose = require('mongoose');
const {AiError} = require('../utils/aiSecret');
const {normalizeRole} = require('../utils/roles');
const {MODEL} = require('./DeepSeekAssistant');
const TOTAL_FIELDS=['promptTokens','completionTokens','totalTokens','requests','unreportedRequests','webSearchRequests'];
const zeroTotals=()=>Object.fromEntries(TOTAL_FIELDS.map(key=>[key,0]));
const sums=()=>({
  promptTokens:{$sum:{$cond:['$reported','$promptTokens',0]}},
  completionTokens:{$sum:{$cond:['$reported','$completionTokens',0]}},
  totalTokens:{$sum:{$cond:['$reported','$totalTokens',0]}},
  requests:{$sum:1},unreportedRequests:{$sum:{$cond:[{$and:['$reported',{$lte:[{$ifNull:['$unknownCalls',0]},0]}]},0,1]}},
  webSearchRequests:{$sum:'$webSearchRequests'},
});
function usageQuery(query={}) {
  if(Object.keys(query).some(key=>!['page','limit','search'].includes(key)))throw new AiError('INVALID_USAGE_QUERY','不支持该用量筛选参数。');
  const integer=(value,initial,max)=>{
    if(value===undefined)return initial;
    if(typeof value!=='string'||!/^\d{1,7}$/.test(value)||Number(value)<1||Number(value)>max)throw new AiError('INVALID_USAGE_QUERY','用量分页参数无效。');
    return Number(value);
  };
  if(query.search!==undefined&&(typeof query.search!=='string'||query.search.length>100))throw new AiError('INVALID_USAGE_QUERY','搜索关键词不能超过 100 字。');
  return {page:integer(query.page,1,1000000),limit:integer(query.limit,20,100),search:(query.search||'').trim()};
}
class AssistantUsageService {
  constructor({usageModel=Usage,userModel=User,quotaService}={}){this.model=usageModel;this.users=userModel;this.quota=quotaService;}
  async begin(userId,requestId,source='member') {
    await this.model.updateOne({_id:requestId},{$setOnInsert:{userId,source,model:MODEL,reported:false,promptTokens:0,completionTokens:0,totalTokens:0,webSearchRequests:0,state:'started'}},{upsert:true});
  }
  async beginCall(userId,requestId,callId) {
    await this.model.updateOne({_id:requestId,userId,'calls.id':{$ne:callId}},{$push:{calls:{id:callId,reported:false}},$inc:{unknownCalls:1}});
  }
  async reportCall(userId,requestId,callId,usage) {
    if(!usage?.reported)return;
    await this.model.updateOne({_id:requestId,userId,calls:{$elemMatch:{id:callId,reported:false}}},{$set:{'calls.$.reported':true,reported:true},$inc:{promptTokens:usage.promptTokens,completionTokens:usage.completionTokens,totalTokens:usage.totalTokens,unknownCalls:-1}});
  }
  async report(userId,requestId,usage) {
    if(!usage?.reported)return;
    // Never $inc: repeated delivery of a final provider chunk is idempotent.
    await this.model.updateOne({_id:requestId,userId,reported:false},{$set:{reported:true,promptTokens:usage.promptTokens,completionTokens:usage.completionTokens,totalTokens:usage.totalTokens}});
  }
  async recordSearch(userId,requestId) {await this.model.updateOne({_id:requestId,userId},{$set:{webSearchRequests:1}});}
  async finish(userId,requestId,state) {await this.model.updateOne({_id:requestId,userId},{$set:{state}});}
  async list(rawQuery={}) {
    const {page,limit,search}=usageQuery(rawQuery);
    let match={};
    if(search) {
      const literal=search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const accounts=await this.users.find({$or:[{name:{$regex:literal,$options:'i'}},{email:{$regex:literal,$options:'i'}}]}).select('_id').lean();
      match={userId:{$in:accounts.map(user=>new mongoose.Types.ObjectId(String(user._id)))}};
    }
    const [result]=await this.model.aggregate([
      {$match:match},{$facet:{
        users:[{$group:{_id:'$userId',...sums(),lastUsedAt:{$max:'$createdAt'}}},{$sort:{totalTokens:-1,lastUsedAt:-1,_id:1}},{$skip:(page-1)*limit},{$limit:limit}],
        total:[{$group:{_id:null,...sums()}}],count:[{$group:{_id:'$userId'}},{$count:'value'}],
      }},
    ]).option({maxTimeMS:5000});
    const ids=(result?.users||[]).map(item=>item._id);
    const accounts=ids.length?await this.users.find({_id:{$in:ids}}).select('name email role isAdmin').lean():[];
    const people=new Map(accounts.map(account=>[String(account._id),account]));
    const rows=(result?.users||[]).map(item=>{
      const account=people.get(String(item._id));
      return {userId:String(item._id),name:account?.name||'已移除的账号',email:account?.email||'',role:account?normalizeRole(account):'student',...Object.fromEntries(TOTAL_FIELDS.map(key=>[key,item[key]||0])),lastUsedAt:item.lastUsedAt};
    });
    const quota=this.quota||(this.quota=new (require('./AssistantQuotaService').AssistantQuotaService)());
    await Promise.all(rows.map(async row=>{row.quota=await quota.status(row.userId);}));
    const total=result?.count?.[0]?.value||0;
    return {users:rows,totals:{...zeroTotals(),...Object.fromEntries(TOTAL_FIELDS.map(key=>[key,result?.total?.[0]?.[key]||0]))},pagination:{page,limit,total,totalPages:Math.max(1,Math.ceil(total/limit))}};
  }
}
module.exports={AssistantUsageService,usageQuery,sums};

const express = require('express');
const multer = require('multer');
const authenticateToken = require('../middleware/auth');
const requireAdmin = require('../middleware/admin');
const {MemberAssistantService,MEMBER_LIMITS} = require('../services/MemberAssistantService');
const {AssistantMemoryService} = require('../services/AssistantMemoryService');
const {AssistantUsageService} = require('../services/AssistantUsageService');
const {AssistantQuotaService}=require('../services/AssistantQuotaService');
const {AiError} = require('../utils/aiSecret');
const {createAiRateLimiter,sendAiError,aiRequest} = require('../utils/aiHttp');
function memberError(error) {
  if(!(error instanceof AiError))return new AiError('AI_UNAVAILABLE','AI 服务暂不可用，请稍后重试。',503);
  const messages={NOT_CONFIGURED:'AI 尚未启用，请联系管理员配置。',MASTER_KEY_UNAVAILABLE:'AI 服务尚未就绪，请联系管理员。',SECRET_UNREADABLE:'AI 服务配置暂不可用，请联系管理员。',INVALID_API_KEY:'AI 服务配置暂不可用，请联系管理员。',INSUFFICIENT_BALANCE:'AI 服务额度暂不可用，请联系管理员。'};
  return messages[error.code]?new AiError(error.code,messages[error.code],error.status):error;
}
function exactBody(body,key) {if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==1||!Object.hasOwn(body,key))throw new AiError('INVALID_INPUT','请求字段不正确。');return body[key];}
function createAssistantRouter({service,memory=new AssistantMemoryService(),usage=new AssistantUsageService(),quota=new AssistantQuotaService(),requestLimit=30,requestTimeoutMs=120000}={}) {
  const router=express.Router();service||=new MemberAssistantService({memory,usage,quota});
  router.use(authenticateToken);
  router.use((_req,res,next)=>{res.setHeader('Cache-Control','private, no-store');next();});
  const action=handler=>async(req,res)=>{try{res.json(await handler(req));}catch(error){sendAiError(res,error,false,memberError);}};
  router.get('/quota',action(req=>quota.status(req.user.userId)));
  router.get('/status',action(req=>service.status(req.user.userId)));
  // Admin access is checked live in Mongo, never trusted from JWT role claims.
  router.get('/usage',requireAdmin,action(req=>usage.list(req.query)));
  router.get('/memory',action(req=>memory.get(req.user.userId)));
  const memoryLimit=createAiRateLimiter(120,'记忆修改次数较多，请稍后再试。');
  router.patch('/memory',memoryLimit,action(req=>memory.setEnabled(req.user.userId,exactBody(req.body,'enabled'))));
  router.post('/memory',memoryLimit,action(req=>memory.add(req.user.userId,exactBody(req.body,'text'))));
  const entryId=(req,_res,next)=>{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id))return sendAiError(_res,new AiError('MEMORY_NOT_FOUND','该记忆不存在。',404));next();};
  router.patch('/memory/:id',memoryLimit,entryId,action(req=>memory.update(req.user.userId,req.params.id,exactBody(req.body,'text'))));
  router.delete('/memory/:id',memoryLimit,entryId,action(req=>memory.remove(req.user.userId,req.params.id)));
  router.get('/memory/export',async(req,res)=>{try{const content=await memory.export(req.user.userId);res.set({'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':'attachment; filename="classhub-memory.md"','X-Content-Type-Options':'nosniff'});res.send(content);}catch(error){res.removeHeader('Content-Disposition');sendAiError(res,error,false,memberError);}});
  const upload=multer({storage:multer.memoryStorage(),limits:{files:MEMBER_LIMITS.images,fileSize:MEMBER_LIMITS.imageBytes,fields:3,fieldSize:70*1024,parts:7}}).array('images',MEMBER_LIMITS.images);
  const prepare=(req,res)=>!req.is('multipart/form-data')?undefined:new Promise((resolve,reject)=>upload(req,res,error=>{
    if(!error)return resolve();
    if(error.code==='LIMIT_FILE_SIZE')return reject(new AiError('IMAGE_TOO_LARGE','单张图片不能超过 2 MiB。'));
    if(['LIMIT_FILE_COUNT','LIMIT_UNEXPECTED_FILE','LIMIT_PART_COUNT'].includes(error.code))return reject(new AiError('INVALID_IMAGES','最多上传 4 张图片，且仅支持 images 上传字段。'));
    reject(new AiError('INVALID_INPUT','上传内容过长或格式错误。'));
  }));
  router.post('/chat',createAiRateLimiter(requestLimit),aiRequest((req,options)=>service.chat(req.user.userId,req.body,req.files,options),{prepare,requestTimeoutMs,mapError:memberError,releaseBody:true}));
  return router;
}
module.exports=createAssistantRouter();
module.exports.createAssistantRouter=createAssistantRouter;
module.exports.memberError=memberError;

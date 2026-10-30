const express=require('express');
const authenticateToken=require('../middleware/auth');
const {AssistantFeedbackService}=require('../services/AssistantFeedbackService');
const {AiError}=require('../utils/aiSecret');
const {createAiRateLimiter,sendAiError,aiRequest}=require('../utils/aiHttp');
const safeError=error=>error instanceof AiError?error:new AiError('FEEDBACK_UNAVAILABLE','反馈服务暂不可用，请稍后重试。',503);
function createAssistantFeedbackRouter({service=new AssistantFeedbackService(),requestLimit=30}={}){
 const router=express.Router();router.use(authenticateToken);router.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
 router.post('/feedback/chat',createAiRateLimiter(requestLimit),aiRequest((req,options)=>service.chat(req.user.userId,req.body,options),{mapError:safeError,requestTimeoutMs:120000,releaseBody:true}));
 router.post('/feedback',createAiRateLimiter(30,'反馈提交较多，请稍后再试。'),async(req,res)=>{try{const result=await service.submit(req.user.userId,req.body);res.status(result.created?201:200).json(result.item);}catch(error){sendAiError(res,error,false,safeError);}});
 return router;
}
module.exports=createAssistantFeedbackRouter();module.exports.createAssistantFeedbackRouter=createAssistantFeedbackRouter;

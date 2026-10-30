const express=require('express');
const requireAdmin=require('../../middleware/admin');
const {AssistantFeedbackService}=require('../../services/AssistantFeedbackService');
const {AiError}=require('../../utils/aiSecret');
const {sendAiError}=require('../../utils/aiHttp');
const safeError=error=>error instanceof AiError?error:new AiError('FEEDBACK_UNAVAILABLE','反馈收件箱暂不可用，请稍后重试。',503);
function createAdminFeedbackRouter({service=new AssistantFeedbackService()}={}){
 const router=express.Router();router.use(requireAdmin);router.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
 router.get('/',async(req,res)=>{try{res.json(await service.list(req.user.userId,req.query));}catch(error){sendAiError(res,error,false,safeError);}});
 router.patch('/:id',async(req,res)=>{try{res.json(await service.setStatus(req.user.userId,req.params.id,req.body));}catch(error){sendAiError(res,error,false,safeError);}});return router;
}
module.exports=createAdminFeedbackRouter();module.exports.createAdminFeedbackRouter=createAdminFeedbackRouter;

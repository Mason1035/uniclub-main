const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},requestId:{type:String,required:true},
 title:{type:String,required:true,maxlength:120},description:{type:String,required:true,maxlength:3000},expected:{type:String,default:'',maxlength:1500},page:{type:String,default:'',maxlength:300},
 status:{type:String,enum:['new','read','resolved'],default:'new',index:true},
},{timestamps:true,collection:'assistant_feedback'});
schema.index({userId:1,requestId:1},{unique:true});schema.index({createdAt:-1,_id:-1});
module.exports=mongoose.model('AssistantFeedback',schema);

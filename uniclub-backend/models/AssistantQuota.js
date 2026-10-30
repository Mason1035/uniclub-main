const mongoose = require('mongoose');
const entry = new mongoose.Schema({
  callId: {type:String,required:true}, at: {type:Date,required:true},
  reservedTokens: {type:Number,required:true,min:0}, usedTokens: {type:Number,default:null,min:0},
}, {_id:false});
// One revisioned account document is the atomic budget boundary across processes.
const schema = new mongoose.Schema({
  _id: {type:mongoose.Schema.Types.ObjectId,ref:'User'}, revision:{type:Number,required:true,default:0},
  entries:{type:[entry],default:[]},
}, {timestamps:true,collection:'assistant_quotas'});
module.exports=mongoose.model('AssistantQuota',schema);

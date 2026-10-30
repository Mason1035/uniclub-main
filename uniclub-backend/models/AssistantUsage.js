const mongoose = require('mongoose');
// Request UUID is the unique accounting key. No prompts, images, answers or
// memory contents are stored in the usage ledger.
const schema = new mongoose.Schema({
  _id:{type:String,required:true},
  userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  model:{type:String,required:true},
  promptTokens:{type:Number,default:0,min:0},
  completionTokens:{type:Number,default:0,min:0},
  totalTokens:{type:Number,default:0,min:0},
  reported:{type:Boolean,default:false},
  source:{type:String,default:'member'},
  calls:{type:[new mongoose.Schema({id:String,reported:{type:Boolean,default:false}},{_id:false})],default:[]},
  unknownCalls:{type:Number,default:0,min:0},
  webSearchRequests:{type:Number,default:0,min:0},
  state:{type:String,enum:['started','completed','failed','cancelled'],default:'started'},
},{timestamps:true,collection:'assistant_usage'});
schema.index({userId:1,createdAt:-1});
module.exports = mongoose.model('AssistantUsage',schema);

const mongoose = require('mongoose');
const secret = new mongoose.Schema({ version:Number, ciphertext:String, iv:String, authTag:String }, {_id:false});
// One encrypted, portable memory file per account. Contents never appear in
// user lists, analytics or public APIs and have no filesystem-derived filename.
const schema = new mongoose.Schema({
  userId:{type:mongoose.Schema.Types.ObjectId, ref:'User',required:true,unique:true},
  enabled:{type:Boolean,default:true},
  revision:{type:Number,default:0},
  secret:{type:secret,required:true,select:false},
},{timestamps:true,collection:'assistant_memories'});
module.exports = mongoose.model('AssistantMemory',schema);

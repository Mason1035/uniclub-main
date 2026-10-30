const crypto = require('node:crypto');
const Memory = require('../models/AssistantMemory');
const {AiError,encrypt,decrypt} = require('../utils/aiSecret');
const {plainText} = require('../utils/newsAiContext');
const MAX_ENTRIES = 30, MAX_TEXT = 500;
function validateMemoryText(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_TEXT || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(value)) throw new AiError('INVALID_MEMORY','记忆内容须为 1–500 字的文本。');
  return value.trim();
}
function entriesOf(doc) {
  if (!doc) return [];
  try {
    const entries=JSON.parse(decrypt(doc.secret));
    if (!Array.isArray(entries) || entries.length > MAX_ENTRIES || entries.some(entry => typeof entry.id!=='string' || typeof entry.text!=='string' || entry.text.length>MAX_TEXT)) throw new Error('Invalid memory');
    return entries;
  } catch { throw new AiError('MEMORY_UNAVAILABLE','个人记忆暂时无法读取，请稍后重试。',503); }
}
class AssistantMemoryService {
  constructor({memoryModel=Memory,clock=()=>new Date()}={}) {this.model=memoryModel;this.clock=clock;}
  async row(userId) {return this.model.findOne({userId}).select('+secret').lean();}
  view(doc) {return {enabled:doc?.enabled!==false,entries:entriesOf(doc)};}
  async get(userId) {return this.view(await this.row(userId));}
  async mutate(userId,change) {
    // Compare-and-swap protects a per-user file from lost updates across tabs
    // and server instances without requiring a replica-set transaction.
    for(let attempt=0;attempt<5;attempt++) {
      const old=await this.row(userId), entries=entriesOf(old), state={enabled:old?.enabled!==false,entries};
      change(state);
      const update={enabled:state.enabled,secret:encrypt(JSON.stringify(state.entries)),revision:(old?.revision||0)+1};
      let saved;
      if(old) saved=await this.model.findOneAndUpdate({userId,revision:old.revision||0},{$set:update},{new:true,runValidators:true}).select('+secret').lean();
      else {
        try {saved=await this.model.create({userId,...update});}
        catch(error) {if(error.code!==11000)throw error;}
      }
      if(saved)return this.view(saved);
    }
    throw new AiError('MEMORY_CONFLICT','记忆正在另一处更新，请刷新后重试。',409);
  }
  async setEnabled(userId,enabled) {
    if(typeof enabled!=='boolean')throw new AiError('INVALID_MEMORY','记忆开关须为 true 或 false。');
    return this.mutate(userId,state=>{state.enabled=enabled;});
  }
  async add(userId,value) {
    const text=validateMemoryText(value);
    return this.mutate(userId,state=>{
      if(state.entries.length>=MAX_ENTRIES)throw new AiError('MEMORY_LIMIT','最多保存 30 条记忆，请先删除不需要的内容。');
      const now=this.clock().toISOString();
      state.entries.push({id:crypto.randomUUID(),text,createdAt:now,updatedAt:now});
    });
  }
  async update(userId,id,value) {
    const text=validateMemoryText(value);
    return this.mutate(userId,state=>{
      const entry=state.entries.find(item=>item.id===id);
      if(!entry)throw new AiError('MEMORY_NOT_FOUND','该记忆不存在。',404);
      entry.text=text;entry.updatedAt=this.clock().toISOString();
    });
  }
  async remove(userId,id) {
    return this.mutate(userId,state=>{
      if(!state.entries.some(entry=>entry.id===id))throw new AiError('MEMORY_NOT_FOUND','该记忆不存在。',404);
      state.entries=state.entries.filter(entry=>entry.id!==id);
    });
  }
  async context(userId,question) {
    const state=await this.get(userId);if(!state.enabled)return[];
    const words=String(question).toLocaleLowerCase().match(/[a-z0-9]{2,}|[\p{Script=Han}]{1,2}/gu)||[];
    const ranked=state.entries.map((entry,index)=>({entry,index,score:words.reduce((sum,word)=>sum+Number(entry.text.toLocaleLowerCase().includes(word)),0)})).sort((a,b)=>b.score-a.score||b.index-a.index);
    const selected=[];let chars=0;
    for(const {entry}of ranked.slice(0,8)) {const text=plainText(entry.text).slice(0,Math.max(0,2000-chars));if(text){selected.push(text);chars+=text.length;}if(chars>=2000)break;}
    return selected;
  }
  async export(userId) {
    const state=await this.get(userId);
    const escape=value=>String(value).replace(/[\r\n]+/g,' ').replace(/([\\`*_{}\[\]<>])/g,'\\$1');
    return `# ClassHub 个人记忆\n\n记忆用于回答：${state.enabled?'开启':'关闭'}\n\n${state.entries.map(entry=>`- ${escape(entry.text)}\n  - 保存于：${entry.createdAt}`).join('\n') || '暂无已保存记忆。'}\n`;
  }
}
module.exports={AssistantMemoryService,validateMemoryText,MAX_ENTRIES,MAX_TEXT};

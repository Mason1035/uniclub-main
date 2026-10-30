const {randomInt}=require('node:crypto');
const {AiError}=require('../utils/aiSecret');
const {plainText}=require('../utils/newsAiContext');
const {createRandomCallMembersService}=require('./RandomCallMembersService');

const MAX_DRAW_COUNT=50;
const digits={零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
function countNumber(value){
  if(!value)return 1;
  if(/^\d+$/.test(value))return Number(value);
  if(Object.hasOwn(digits,value))return digits[value];
  if(value==='百'||value==='一百')return 100;
  const tens=/^([一二两三四五六七八九])?十([一二三四五六七八九])?$/.exec(value);
  return tens?(tens[1]?digits[tens[1]]:1)*10+(tens[2]?digits[tens[2]]:0):NaN;
}
function validateCount(count){
  if(!Number.isSafeInteger(count)||count<1||count>MAX_DRAW_COUNT)throw new AiError('INVALID_DRAW_COUNT',`每次可以随机抽取 1～${MAX_DRAW_COUNT} 位同学，请明确需要的人数。`,400);
}
// Only a direct command in the current prompt can trigger a draw. Quoted text,
// document content, image contents and prior conversation never invoke it.
function parseRandomCallCommand(prompt){
  if(typeof prompt!=='string')return null;
  const command=prompt.normalize('NFKC').replace(/\s+/gu,'').replace(/[。！!？?]+$/u,'');
  const match=/^(?:可以|能不能|能否|能)?(?:请)?(?:(?:帮|给|替)我|帮忙)?(?:从(?:我们)?(?:的)?(?:班级名单|班级成员|全班|班级|班里|班上)(?:中|里)?)?(?:再)?(?:随机)?(?:抽取?|选取?|挑选?|点名)([0-9零一二两三四五六七八九十百]+)?(?:个|名|位)?(?:同学|班级成员|人)?(?:来?(?:回答问题|发言|上台))?(?:一下)?(?:吗|吧)?(?:[,，]?(?:不重复|不要重复))?$/u.exec(command);
  if(!match)return null;
  const count=countNumber(match[1]);validateCount(count);return{count};
}

class AssistantRandomCallService{
  constructor({members=createRandomCallMembersService(),randomInt:choose=randomInt}={}){
    this.members=members;this.choose=choose;
  }
  async draw(userId,count=1){
    validateCount(count);
    let rows;
    try{rows=await this.members(userId);}
    catch(error){
      if(error.status===403)throw new AiError('FORBIDDEN','仅当前班级成员可以使用随机点名。',403);
      throw new AiError('RANDOM_CALL_UNAVAILABLE','暂时无法读取班级名单，请稍后重试。',503);
    }
    const seen=new Set(),pool=[];
    for(const row of Array.isArray(rows)?rows:[]){
      const name=typeof row?.name==='string'?plainText(row.name).trim().slice(0,120):'';
      if(!row?.id||!name||seen.has(String(row.id)))continue;
      seen.add(String(row.id));pool.push(name);
    }
    if(!pool.length)throw new AiError('RANDOM_CALL_EMPTY','暂无可参与随机点名的班级成员，请联系管理员检查班级名单。',409);
    if(count>pool.length)throw new AiError('DRAW_COUNT_EXCEEDS_POOL',`当前有 ${pool.length} 位可参与抽取的班级成员，不能不重复地抽取 ${count} 位。请减少人数后重试。`,400);
    // A partial Fisher-Yates shuffle using crypto.randomInt is unbiased and
    // samples without replacement. Administrators in the roster stay eligible.
    for(let index=0;index<count;index++){
      const next=index+this.choose(pool.length-index);
      [pool[index],pool[next]]=[pool[next],pool[index]];
    }
    return{names:pool.slice(0,count),poolSize:pool.length};
  }
}
const escapeName=name=>name.replace(/[\\`*_{}\[\]()#+.!|<>~-]/g,'\\$&');
function randomCallAnswer({names,poolSize}){
  const selection=names.length===1?`本次随机抽取：**${escapeName(names[0])}**。`:`本次随机抽取的 ${names.length} 位同学：\n\n${names.map((name,index)=>`${index+1}. **${escapeName(name)}**`).join('\n')}`;
  return `${selection}\n\n从当前班级的 ${poolSize} 位有效成员中随机抽取${names.length>1?'，本次结果不重复':''}。`;
}
module.exports={AssistantRandomCallService,parseRandomCallCommand,randomCallAnswer};

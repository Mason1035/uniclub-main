const clone=value=>value==null?value:structuredClone(value);
const query=value=>({lean:async()=>clone(typeof value==='function'?value():value)});
function createQuotaModel(){
 const rows=new Map();return{rows,findById:id=>query(()=>rows.get(String(id))||null),async create(row){const key=String(row._id);if(rows.has(key))throw Object.assign(new Error('duplicate'),{code:11000});rows.set(key,clone(row));return row;},findOneAndUpdate(filter,update){return query(()=>{const row=rows.get(String(filter._id));if(!row||row.revision!==filter.revision)return null;Object.assign(row,clone(update.$set));row.revision+=update.$inc.revision;return row;});}};
}
function createUsageService(){const rows=new Map();return{rows,async begin(owner,id){if(!rows.has(id))rows.set(id,{owner,calls:[],state:'started'});},async beginCall(owner,id,callId){rows.get(id).calls.push({id:callId});},async reportCall(owner,id,callId,usage){Object.assign(rows.get(id).calls.find(call=>call.id===callId),usage);},async finish(owner,id,state){rows.get(id).state=state;}};}
module.exports={createQuotaModel,createUsageService};

// An explicit injected boundary for tests that exercise old feature contracts.
// The production quota boundary has separate CAS/concurrency/provider tests.
async function passthroughUsage(_userId,fn,{requestId}={}){const result=await fn();return{result,requestId,usage:result?.usage,quota:undefined};}
module.exports={passthroughUsage};

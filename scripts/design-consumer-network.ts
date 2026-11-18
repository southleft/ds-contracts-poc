/** Retry only interrupted reads; verdicts and HTTP refusals are never retried here. */
export async function retryConsumerRead<T>(stage:string,read:()=>Promise<T>,options:{sleep?:(ms:number)=>Promise<void>;report?:(message:string)=>void}={}):Promise<T>{
 const sleep=options.sleep??(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
 const report=options.report??(message=>console.error(message));
 for(let attempt=0;;attempt++){
  try{return await read();}catch(error){
   const cause=error instanceof Error?(error as Error&{cause?:{code?:string}}).cause?.code:undefined;
   const transient=error instanceof TypeError&&['fetch failed','terminated'].includes(error.message)||typeof cause==='string'&&['ECONNRESET','ETIMEDOUT','UND_ERR_SOCKET','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT'].includes(cause);
   if(!transient||attempt===2)throw new Error(`${stage}:${transient?'transport-retries-exhausted':error instanceof Error?error.message:'read-failed'}`,{cause:error});
   report(`${stage}: interrupted read; retry ${attempt+1}/2`);
   await sleep(1000*(attempt+1));
  }
 }
}
/** The checks' Figma REST GET and its 429 policy (2026-11-17). Figma answers a 429 with a short Retry-After (2 to 4 s,
 * 40 times in F→R run 10), and three such waits did not outlast the limit: a set lost its images to one more 429. Each
 * wait is what Retry-After says, never less than the attempt's floor (5 s, doubling, at most `maxWaitSeconds`), at most
 * `retries` times; a Retry-After over `maxWaitSeconds` returns the 429 at once. A 5xx (F→R run 11 lost a set to one
 * HTTP 500) is waited out the same way, at most `serverRetries` times, counted apart. The caller refuses any non-OK
 * response by name, as before. Transport only: what a response means is unchanged. */
export const CHECK_429_POLICY={retries:6,serverRetries:3,floorSeconds:5,maxWaitSeconds:60} as const;
type Answer={status:number;headers?:{get(name:string):string|null}};
export async function fetchFigmaForCheck<T extends Answer=Response>(url:string,token:string,options:{fetchImpl?:(url:string,init:{headers:Record<string,string>})=>Promise<T>;
 sleep?:(ms:number)=>Promise<void>;report?:(message:string)=>void}={}):Promise<T>{
 const call=()=>(options.fetchImpl??(fetch as unknown as (url:string,init:{headers:Record<string,string>})=>Promise<T>))(url,{headers:{'X-Figma-Token':token}});
 const sleep=options.sleep??(ms=>new Promise(resolve=>setTimeout(resolve,ms))),report=options.report??(message=>console.error(message));
 let response=await call();const tries={limited:0,server:0};
 for(;;){
  const kind=response.status===429?'limited':response.status>=500&&response.status<=599?'server':null;
  const limit=kind==='limited'?CHECK_429_POLICY.retries:CHECK_429_POLICY.serverRetries;
  if(!kind||tries[kind]>=limit)return response;
  const attempt=tries[kind]++,raw=response.headers?.get('retry-after')??null,given=raw===null?NaN:Number(raw);
  if(given>CHECK_429_POLICY.maxWaitSeconds)return response;
  const floor=Math.min(CHECK_429_POLICY.floorSeconds*2**attempt,CHECK_429_POLICY.maxWaitSeconds),wait=Math.max(given>=0?given:0,floor);
  report(`figma API ${response.status} — waiting ${wait} s (Retry-After ${raw??'absent'}, floor ${floor} s), retry ${attempt+1} of ${limit}`);
  await sleep(wait*1000);response=await call();
 }
}

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

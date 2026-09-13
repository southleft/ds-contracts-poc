const __u="http://localhost:9231/program?subject=cbds-text-area";
const __src=await (await fetch(__u)).text();
if(__src.length!==6218)throw new Error("PROGRAM-LENGTH:"+__src.length);
let __result=null,__error=null;
try{__result=await (new Function("figma","return (async()=>{"+__src+"\n})()"))(figma);}catch(e){__error=String(e&&e.message?e.message:e);}
const __body=JSON.stringify({slug:"cbds-text-area",run:2,result:__result,error:__error});
const __res=await fetch("http://localhost:9231/observe",{method:"POST",headers:{"content-type":"text/plain"},body:__body});
const __ack=await __res.json();
if(!__res.ok)throw new Error("RECEIVER:"+JSON.stringify(__ack));
return {posted:true,slug:"cbds-text-area",run:2,error:__error,writes:__result?__result.writes:null,variants:__result?__result.variants:null,bytes:__body.length,sceneSha256:__ack.sceneSha256||null};
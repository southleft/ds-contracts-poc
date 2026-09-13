const __u="http://localhost:9231/program?subject=altitude-checkbox";
const __src=await (await fetch(__u)).text();
if(__src.length!==6229)throw new Error("PROGRAM-LENGTH:"+__src.length);
const __result=await (new Function("figma","return (async()=>{"+__src+"\n})()"))(figma);
const __body=JSON.stringify({slug:"altitude-checkbox",run:1,result:__result});
const __res=await fetch("http://localhost:9231/observe",{method:"POST",headers:{"content-type":"text/plain"},body:__body});
const __ack=await __res.json();
if(!__res.ok)throw new Error("RECEIVER:"+JSON.stringify(__ack));
return {posted:true,slug:"altitude-checkbox",run:1,writes:__result.writes,variants:__result.variants,bytes:__body.length,sceneSha256:__ack.sceneSha256};
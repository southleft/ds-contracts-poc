/** Lossless transport only. Decoded observations still require the ordinary
 * source verifier; dictionary entries grant no ownership or fidelity evidence. */
export function packNativeReadback(value: unknown) {
 const entries: unknown[][]=[], known=new Map<string,number>();
 const codec={encode(v:any):number {
  const key=JSON.stringify(v), prior=known.get(key);if(prior!==undefined)return prior;
  const row=Array.isArray(v)?[1,v.map(x=>this.encode(x))]:v&&typeof v==='object'
   ?[2,Object.entries(v).map(([k,x])=>[this.encode(k),this.encode(x)])]:[0,v];
  const id=entries.length;entries.push(row);known.set(key,id);return id;
 }};
 const root=codec.encode(value);
 return {transport:'native-readback-interned-json-v1',data:JSON.stringify({root,entries})};
}

export function unpackNativeReadback(input:unknown):unknown {
 const fail=():never=>{throw Error('native-readback-transport-invalid');};
 const envelope=input as any;
 if(!envelope||envelope.transport!=='native-readback-interned-json-v1'||Object.keys(envelope).sort().join(',')!=='data,transport'||typeof envelope.data!=='string'||envelope.data.length>3*1024*1024)fail();
 let x:any;try{x=JSON.parse(envelope.data);}catch{fail();}
 if(!x||Object.keys(x).sort().join(',')!=='entries,root'||
    !Array.isArray(x.entries)||!x.entries.length||x.entries.length>200000||x.root!==x.entries.length-1)fail();
 const values:any[]=[],sizes:number[]=[];
 for(const row of x.entries){
  if(!Array.isArray(row)||row.length!==2)fail();
  const ref=(id:any)=>{if(!Number.isSafeInteger(id)||id<0||id>=values.length)fail();return values[id];};
  let value:any,size=2;
  if(row[0]===0){value=row[1];if(value!==null&&!['string','number','boolean'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value))fail();size=JSON.stringify(value).length;}
  else if(row[0]===1){if(!Array.isArray(row[1]))fail();value=row[1].map((id:any)=>{const v=ref(id);size+=sizes[id]+1;return v;});}
  else if(row[0]===2){if(!Array.isArray(row[1]))fail();value={};const keys=new Set<string>();for(const pair of row[1]){
   if(!Array.isArray(pair)||pair.length!==2)fail();const key=ref(pair[0]),v=ref(pair[1]);
   if(typeof key!=='string'||keys.has(key))fail();keys.add(key);Object.defineProperty(value,key,{value:v,enumerable:true,writable:true,configurable:true});size+=sizes[pair[0]]+sizes[pair[1]]+2;
  }}else fail();
  if(size>32*1024*1024)fail();values.push(value);sizes.push(size);
 }
 // Detach repeated entries: callers may normalize their own receipt in place.
 return JSON.parse(JSON.stringify(values[x.root]));
}

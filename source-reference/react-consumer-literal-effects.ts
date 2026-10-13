import type {ContextConsumerValueShape as Shape,HelperSourcePoint} from './react-helper-model.mjs';
import type {ReactContextConsumerEffects} from './react-target-effects.js';
import type {ReactConsumerLiteral} from './react-consumer-literals.js';
import type {ReactConsumerLiteralReport,ConsumerLiteralSnapshot as Snapshot,ConsumerLiteralCall} from './react-consumer-literal-runtime.js';
import type {ReactContextValueWitness as Witness} from './react-context-runtime.js';
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const sameSnapshot=(a:Snapshot|undefined,b:Snapshot|undefined)=>!!a&&!!b&&a.record===b.record&&a.dataVerified===b.dataVerified&&a.length===b.length&&same(a.fields,b.fields);
const key=(p:HelperSourcePoint)=>JSON.stringify([p.file,p.sha256,p.start,p.end]);
/** Joins existing literal creation receipts to source-indexed calls and writes.
 * No receipt flag is authority: every allocation, boundary and transition must
 * agree with the rebuilt source model and the independently guarded input. */
export function verifyConsumerLiteralEffects(model:Extract<ReactContextConsumerEffects,{status:'modeled'}>,report:ReactConsumerLiteralReport|undefined,plans:readonly ReactConsumerLiteral[],render:number,input:{value:Witness;fields:Array<[string,Witness]>},leaf:(value:Witness|undefined,shape:Shape)=>boolean){
 function fail(why:string):never{throw Error('context-consumer-literal-effects:'+why);}
 if(!report?.calls||!report.mutations||!model.literalAllocations)fail('capture-missing');
 const records=report!.records,local=records.filter(r=>r.render===render),states=new Map<number,Snapshot>();
 const allocations=new Map<number,Extract<Shape,{kind:'record'|'array'}>>();
 for(const shape of model.literalAllocations!){if((shape.kind!=='record'&&shape.kind!=='array')||!shape.allocation||allocations.has(shape.allocation.id))fail('allocation-model');allocations.set(shape.allocation!.id,shape as Extract<Shape,{kind:'record'|'array'}>);}
 const modelIds=new Map<number,number>(),runtimeIds=new Map<number,number>(),used=new Set<number>(),mutated=new Set<number>();
 for(const r of local){if(records[r.id]!==r||r.creationDataVerified!==true||!same(r.consumer,model.component)||!plans.some(p=>same(p.source,r.source)&&same(p.consumer,r.consumer)&&p.kind===r.kind))fail('creation-origin');states.set(r.id,{record:r.id,fields:r.fields,...(r.kind==='array'?{length:r.length}:{}),dataVerified:true});}
 function match(value:Witness|undefined,shape:Shape,view=states,seen=new Set<number>()):boolean{
  if(shape.kind!=='record'&&shape.kind!=='array')return leaf(value,shape);
  if(!shape.allocation){return shape.kind==='record'&&same(shape,model.input)&&same(value,input.value)&&shape.fields.length===input.fields.length&&shape.fields.every(([k,v],i)=>k===input.fields[i][0]&&match(input.fields[i][1],v,view,seen));}
  if(value?.kind!=='object')return false;
  const candidates=local.filter(r=>same(r.value,value)),r=candidates[0],id=shape.allocation.id;
  if(candidates.length!==1||!r||r.kind!==shape.kind||!same(r.source,shape.allocation.source)||!allocations.has(id)||modelIds.has(id)&&modelIds.get(id)!==r.id||runtimeIds.has(r.id)&&runtimeIds.get(r.id)!==id)return false;
  modelIds.set(id,r.id);runtimeIds.set(r.id,id);used.add(r.id);
  if(seen.has(id))return true;seen=new Set([...seen,id]);
  const state=view.get(r.id),fields=shape.kind==='array'?shape.items.map((v,i)=>[String(i),v] as [string,Shape]):shape.fields;
  return !!state?.dataVerified&&(shape.kind!=='array'||state.length===shape.items.length)&&fields.length===state.fields.length&&fields.every(([k,v],i)=>k===state.fields[i][0]&&match(state.fields[i][1],v,view,seen));
 }
 function closure(values:Witness[]):number[]{
  const ids:number[]=[],seen=new Set<number>();
  const visit=(v:Witness)=>{const rs=local.filter(r=>same(r.value,v));if(rs.length>1)fail('ambiguous-identity');if(!rs.length||seen.has(rs[0].id))return;const id=rs[0].id;seen.add(id);ids.push(id);for(const [,child]of states.get(id)!.fields)visit(child);};
  values.forEach(visit);return ids;
 }
 function boundary(snapshots:Snapshot[],values:Witness[]){if(!same(snapshots.map(s=>s.record),closure(values)))fail('boundary-closure');adopt(snapshots);}
 function adopt(snapshots:Snapshot[]){const seen=new Set<number>();for(const s of snapshots){if(seen.has(s.record)||!s.dataVerified||!states.has(s.record)||!sameSnapshot(s,states.get(s.record)))fail('snapshot-state');seen.add(s.record);}}
 // Creation fields are checked against the source allocation, independently of
 // later state. Mapping happens through actual boundary/transition identities.
 function creations(){const creation=new Map(local.map(r=>[r.id,{record:r.id,fields:r.fields,...(r.kind==='array'?{length:r.length}:{}),dataVerified:true}]));for(const id of used){const r=records[id],shape=allocations.get(runtimeIds.get(id)!);if(!shape||!match(r.value,shape,creation))fail('creation-values');}}
 const calls=report!.calls!.filter(c=>c.render===render),expected=model.contextFunctionCalls.filter(c=>c.phase!=='module-initialization');
 if(calls.length!==expected.length)fail('call-coverage');
 const callMap=new Map<number,ConsumerLiteralCall>();
 const events:Array<{sequence:number;run:()=>void}>=[];
 const allFunctionValues=new Set<string>();
 for(const [i,f]of (report.functions??[]).entries()){
  const owner=report.calls![f.ownerCall],identity=JSON.stringify(f.value);
  if(f.id!==i||!Number.isSafeInteger(f.render)||f.render<0||!Number.isSafeInteger(f.sequence)||f.sequence<0||f.value.kind!=='function'||!Number.isSafeInteger(f.value.identity)||f.value.identity!<0||allFunctionValues.has(identity)||!owner||owner.render!==f.render)fail('function-creation-origin');
  allFunctionValues.add(identity);
 }
 const modeledFunctions=model.functionAllocations??[],observedFunctions=report.functions?.filter(f=>f.render===render)??[];
 if(modeledFunctions.length!==observedFunctions.length||modeledFunctions.length&&!report.functions)fail('function-creation-coverage');
 const functionOrigins=new Map<number,typeof observedFunctions[number]>(),functionValues=new Set<string>(),activeCalls:ConsumerLiteralCall[]=[];
 const byEntry=new Map(expected.map(c=>[c.entry,c]));
 modeledFunctions.forEach((f,i)=>{
  const a=observedFunctions[i],owner=report.calls![a.ownerCall],ownerModel=byEntry.get(f.ownerEntry);
  if(!Number.isSafeInteger(f.id)||functionOrigins.has(f.id)||report.functions![a.id]!==a||key(f.source)!==a.source||!owner||owner.render!==render||!ownerModel||owner.entry!==f.ownerEntry||owner.site!==key(ownerModel.site)||owner.source!==key(ownerModel.source)||a.sequence!==f.sequence||!(owner.entry<a.sequence&&a.sequence<owner.exit!)||a.value.kind!=='function'||!Number.isSafeInteger(a.value.identity)||functionValues.has(JSON.stringify(a.value)))fail('function-creation-origin');
  functionOrigins.set(f.id,a);functionValues.add(JSON.stringify(a.value));
  events.push({sequence:a.sequence,run:()=>{if(activeCalls[activeCalls.length-1]!==owner)fail('function-creation-owner');}});
 });
 function argument(value:Witness,shape:Shape,receiver:ConsumerLiteralCall){
  if(shape.kind!=='callback')return match(value,shape);
  // This proof is only for a direct synchronous argument used while its
  // creation owner is active. It never admits callbacks in output or data.
  const f=shape.allocation,a=f&&functionOrigins.get(f.id),owner=a&&report!.calls![a.ownerCall];
  if(!f||!a||!owner||!activeCalls.includes(owner)||shape.captures.length||shape.dependencies.length||key(shape.source)!==a.source||key(f.source)!==a.source||f.ownerEntry!==owner.entry||f.sequence!==a.sequence||!same(value,a.value)||!(a.sequence<receiver.entry&&receiver.exit!<owner.exit!))return false;
  return calls.some((nested,i)=>expected[i]&&key(expected[i].source)===a.source&&nested.source===a.source&&same(nested.callee,value)&&receiver.entry<nested.entry&&nested.exit!<receiver.exit!);
 }
 expected.forEach((c,i)=>{const a=calls[i];if(report!.calls![a.id]!==a||a.callee?.kind!=='function'||!Number.isSafeInteger(a.callee.identity)||!Number.isSafeInteger(a.entry)||!Number.isSafeInteger(a.exit)||a.site!==key(c.site)||a.source!==key(c.source)||a.returned!==true||a.entry!==c.entry||a.exit!==c.exit||a.arguments.length!==c.arguments.length)fail('call-identity-or-order');callMap.set(i,a);
  events.push({sequence:a.entry,run:()=>{activeCalls.push(a);boundary(a.before,a.arguments);if(!c.arguments.every((s,j)=>argument(a.arguments[j],s,a)))fail('call-arguments');}});
  events.push({sequence:a.exit!,run:()=>{if(activeCalls[activeCalls.length-1]!==a)fail('call-stack');boundary(a.after,[...a.arguments,a.result!]);if(!match(a.result,c.output))fail('call-result');activeCalls.pop();}});
 });
 const writes=model.writes.filter(w=>w.phase==='render'),actual=report!.mutations!.filter(w=>w.render===render);let consumed=0;
 for(const a of actual){const start=consumed,count=a.operation==='assign'?(a.inputs??[]).reduce((n,s)=>n+s.fields.length,0):1,ws=writes.slice(start,start+count);consumed+=count;
  if(!count||ws.length!==count||a.sequence!==ws[0].sequence||ws.some((w,i)=>w.sequence!==a.sequence+i||!w.source||key(w.source)!==a.site||w.origin!=='local'||!w.before||!w.after)||!states.has(a.record)||a.before[0]?.record!==a.record||a.after[0]?.record!==a.record)fail('mutation-coverage-or-source');
  events.push({sequence:a.sequence,run:()=>{
   const r=records[a.record];boundary(a.before,[r.value]);if(!r)fail('mutation-target');
   if(a.operation==='assign'){
    if(!ws[0].assign||!a.arguments||!same(a.arguments[0],r.value)||!same(a.inputValues,a.arguments.slice(1).filter(v=>v.kind!=='null'&&v.kind!=='undefined'))||ws[0].assign.arguments.length!==a.arguments.length||!ws[0].assign.arguments.every((s,i)=>match(a.arguments![i],s))||ws.slice(1).some(w=>w.assign)||!a.inputs?.length||!a.inputValues||!a.inputSnapshots||a.inputValues.length!==a.inputs.length||new Set(a.inputs.map(s=>s.record)).size!==a.inputs.length||a.inputSnapshots.some(s=>s.record===a.record)||!same(a.inputValues.map(v=>local.find(r=>same(r.value,v))?.id),a.inputs.map(s=>s.record))||ws.some(w=>w.operation!=='set'))fail('assign-input-identity');let j=0;boundary(a.inputSnapshots!,a.inputValues!);
    for(const from of a.inputs!){adopt([from]);for(const [name,value] of from.fields){const w=ws[j++];if(w.key!==name||!match(r.value,w.before!)||!match(value,w.value!))fail('assign-transition');const old=states.get(r.id)!;const fields=old.fields.map(x=>[...x] as [string,Witness]);const index=fields.findIndex(([k])=>k===name);if(index<0)fields.push([name,value]);else fields[index]=[name,value];states.set(r.id,{...old,fields});if(!match(r.value,w.after!))fail('assign-transition');}}
   }else{
    const w=ws[0];if(w.assign||w.operation!==a.operation||w.key!==a.key||!match(r.value,w.before!)||a.operation==='set'&&!match(a.value,w.value!))fail('mutation-before-or-value');
    const old=states.get(r.id)!,fields=old.fields.map(x=>[...x] as [string,Witness]),index=fields.findIndex(([k])=>k===a.key);
    if(a.operation==='delete'){if(index>=0)fields.splice(index,1);}else if(index<0)fields.push([a.key!,a.value!]);else fields[index]=[a.key!,a.value!];
    states.set(r.id,{...old,fields});if(!match(r.value,w.after!))fail('mutation-after');
   }
   boundary(a.after,[r.value]);mutated.add(r.id);
  }});
 }
 if(consumed!==writes.length)fail('mutation-coverage');events.sort((a,b)=>a.sequence-b.sequence);
 // Native assign represents several ordered native data-property writes.
 let cursor=0;for(const event of events){if(event.sequence!==cursor)fail('operation-order');event.run();const m=actual.find(a=>a.sequence===event.sequence);cursor+=m?.operation==='assign'?m.inputs!.reduce((n,s)=>n+s.fields.length,0):1;}
 if(activeCalls.length)fail('call-stack');creations();
 for(const id of used){const r=records[id],state=states.get(id)!;if(!r.current||!sameSnapshot(r.current,state)||r.currentValuesVerified!==same(r.fields,state.fields)||!r.currentValuesVerified&&!mutated.has(id))fail('current-state');}
 return {calls:callMap,matches(value:Witness|undefined,shape:Shape){const result=match(value,shape);if(result){creations();for(const id of used){const r=records[id];if(!r.current||!sameSnapshot(r.current,states.get(id)))fail('current-state');}}return result;},get records(){return [...used].map(id=>({record:id,allocation:runtimeIds.get(id)!,source:records[id].source,valuesVerified:true as const,mutationEffectsVerified:mutated.has(id)}));}};
}

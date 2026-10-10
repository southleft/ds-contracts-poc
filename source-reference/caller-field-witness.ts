/** Host-selected supplementary native fields. Never alters a retained native
 * baseline or authorizes assignment; every overlap must still be exact. */
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {canonicalJson} from '../core/contract-provenance.js';
type Row=Record<string,any>;
export interface CallerFieldWitnessSelection {
 witness:string;response:string;before:string;after:string;script:string;
 pins:{witness:string;response:string;before:string;after:string;script:string};
}
const fail:(why:string)=>never=why=>{throw Error('caller-field-witness-'+why);};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const response=(bytes:Buffer)=>{const value=JSON.parse(bytes.toString());if(value.content?.length!==1||value.content[0].type!=='text')fail('envelope');const decoded=JSON.parse(value.content[0].text);if(decoded.success!==true)fail('refused');return decoded;};
export function readCallerFieldWitness(selection:CallerFieldWitnessSelection,native:Row,aliases:ReadonlyMap<string,string>,mainRows:readonly Row[],currentNative?:Row) {
 const data=Object.fromEntries(Object.entries(selection.pins).map(([key,pin])=>{const bytes=readFileSync(selection[key as keyof Omit<CallerFieldWitnessSelection,'pins'>]);if(createHash('sha256').update(bytes).digest('hex')!==pin)fail('pin:'+key);return[key,bytes];})) as Record<string,Buffer>;
 const witness=JSON.parse(data.witness.toString()),raw=response(data.response);
 if(!same(raw.result,witness)||raw.fileContext?.fileKey!==native.fileKey||witness.fileKey!==native.fileKey||witness.kind!=='independent-unfiltered-current-main-caller-field-witness'||witness.status!=='observed'||witness.acceptedContract!==null||witness.nativeQualification!=='unqualified'||witness.stableDuringRead!==true||!same(witness.before,witness.after))fail('actual-result');
 if(!same(response(data.before).result,native)||!same(response(data.after).result,native))fail('surrounding-readback');
 const byId=new Map<string,Row>(native.content.nodes.map((n:Row)=>[n.id,n])),mains=new Map(mainRows.map(n=>[n.id,n]));
 const pairIds=new Set<string>(),coverageDifferences:Row[]=[];
 for(const pair of witness.before.rows){
  const caller=byId.get(pair.currentCallerId),main=mains.get(pair.mainId);
  if(!caller||!main||aliases.get(pair.bornCallerId)!==pair.currentCallerId||pair.caller.id!==caller.id||pair.main.id!==main.id||pairIds.has(caller.id))fail('part-identity');pairIds.add(caller.id);
  for(const [captured,retained]of [[pair.caller,caller],[pair.main,main]]){
   if(captured.type!==retained.type||captured.parentId!==retained.parentId||!same(captured.childIds,retained.childIds)||captured.key!==(retained.key??null))fail('part-topology');
   for(const[key,value]of Object.entries(captured.metadata)){
    if(Object.hasOwn(retained.metadata,key)){if(!same(value,retained.metadata[key]))fail('part-metadata:'+key);}
    else if(['nativeSourceOperation','nativeSourceAllocation','nativeContractPart'].includes(key))fail('part-authority-unobserved:'+key);
    else coverageDifferences.push({nodeId:captured.id,field:'metadata.'+key,historical:'unobserved',current:value,usedAsAuthority:false});
   }
   for(const[key,field]of Object.entries(captured.fields) as [string,Row][]){
    if(!['arcData','strokeCap','strokes','strokeWeight'].includes(key))fail('part-field-unexpected');
    if(Object.hasOwn(retained.values,key)){if(field.present!==true||!same(field.value,retained.values[key]))fail('part-field-changed:'+key);}
    else if(!['strokeCap','arcData'].includes(key))fail('part-field-unobserved:'+key);
   }
  }
 }
 const expectedPairs=native.content.nodes.filter((n:Row)=>Boolean(n.metadata.nativeContractPart)).map((n:Row)=>n.id);
 if(pairIds.size!==witness.sourcePartPairs||pairIds.size!==expectedPairs.length||expectedPairs.some((id:string)=>!pairIds.has(id)))fail('part-count');
 const texts=native.content.nodes.filter((n:Row)=>n.type==='TEXT'),seen=new Set<string>();
 for(const row of witness.before.texts){const retained=byId.get(row.id);
  if(!retained||retained.type!=='TEXT'||row.type!=='TEXT'||seen.has(row.id)||row.characters!==retained.values.characters)fail('text-identity');seen.add(row.id);
  for(const[key,field]of Object.entries(row.fields) as [string,Row][]){
   if(Object.hasOwn(retained.values,key)){if(field.present!==true||!same(field.value,retained.values[key]))fail('text-field-changed:'+key);}
   else if(!['textAutoResize','fontWeight','arcData'].includes(key))fail('text-field-unobserved:'+key);
  }
  for(const key of ['textAutoResize','fontWeight','fontName','fontSize','lineHeight','letterSpacing','textCase','textDecoration','fills','boundVariables'])if(row.fields[key]?.present!==true)fail('text-field-missing:'+key);
 }
 if(seen.size!==texts.length||seen.size!==witness.callerTexts)fail('text-census');
 if(currentNative) verifyCallerFieldWitnessCurrent(witness,currentNative);
 return {witness,pins:structuredClone(selection.pins),coverageDifferences};
}

/** Additional current receipt coverage cannot contradict the actual unfiltered
 * witness. Absent reader fields stay absent; nothing is filled or normalized. */
export function verifyCallerFieldWitnessCurrent(witness:Row,currentNative:Row) {
 const current=new Map<string,Row>(currentNative.content.nodes.map((n:Row)=>[n.id,n]));
 const parts=new Set<string>();
 for(const pair of witness.before.rows){
  const n=current.get(pair.currentCallerId),seen=pair.caller;
  if(!n||n.type!==seen.type||n.parentId!==seen.parentId||!same(n.childIds,seen.childIds)||(n.key??null)!==seen.key||parts.has(n.id))fail('current-part-topology');parts.add(n.id);
  for(const[key,value]of Object.entries(n.metadata))if(Object.hasOwn(seen.metadata,key)&&!same(value,seen.metadata[key]))fail('current-part-metadata:'+key);
  for(const[key,field]of Object.entries(seen.fields) as [string,Row][])if(Object.hasOwn(n.values,key)&&(field.present!==true||!same(n.values[key],field.value)))fail('current-part-field:'+key);
 }
 const expected=currentNative.content.nodes.filter((n:Row)=>Boolean(n.metadata.nativeContractPart));
 if(parts.size!==expected.length||expected.some((n:Row)=>!parts.has(n.id)))fail('current-part-census');
 const texts=new Set<string>();
 for(const seen of witness.before.texts){
  const n=current.get(seen.id);if(!n||n.type!=='TEXT'||n.values.characters!==seen.characters||texts.has(n.id))fail('current-text-identity');texts.add(n.id);
  for(const[key,field]of Object.entries(seen.fields) as [string,Row][])if(Object.hasOwn(n.values,key)&&(field.present!==true||!same(n.values[key],field.value)))fail('current-text-field:'+key);
 }
 if(texts.size!==currentNative.content.nodes.filter((n:Row)=>n.type==='TEXT').length)fail('current-text-census');
}

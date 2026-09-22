/** Opt-in SDK identity evidence for a settled caller TEXT inside its pinned SLOT.
 * Historical programs retain strict IDs. Allocation stamps alone never grant
 * an alias: both SDK lookups must return the same live object synchronously. */
import { nativeSlotIdentityRuntime } from './native-slot-identity.js';
import type { NativeSourceReadback } from './native-source-observation.js';

export type NativeTemplateCallerIdentity = 'sdk-slot-alias-v1';
export function cleanNativeTemplateCallerReadback(raw: NativeSourceReadback, identity?: NativeTemplateCallerIdentity, requireEvidence = false): NativeSourceReadback {
  const result = structuredClone(raw) as NativeSourceReadback & { slotIdentityAliases?: { recordedId: string; liveId: string }[] };
  delete result.images;
  if (identity) {
    const aliases = result.slotIdentityAliases;
    if (requireEvidence && aliases === undefined) throw Error('native-template-caller-alias-evidence-missing');
    if (aliases !== undefined && (!Array.isArray(aliases) ||
        aliases.some(a => !a || Object.keys(a).sort().join(',') !== 'liveId,recordedId' ||
          typeof a.recordedId !== 'string' || typeof a.liveId !== 'string' || a.recordedId === a.liveId ||
          !result.nodes?.some(n => n.id === a.recordedId && n.type === 'TEXT' && a.liveId.startsWith(n.parentId + ';'))) ||
        new Set(aliases.map(a => a.recordedId)).size !== aliases.length || new Set(aliases.map(a => a.liveId)).size !== aliases.length))
      throw Error('native-template-caller-alias-evidence-invalid');
    delete result.slotIdentityAliases;
  }
  return result;
}

export function emitNativeTemplateCallerIdentityReadback(script: string, creation: Record<string, any>, synchronous: boolean): string {
  return `const observed=${synchronous ? '(()=>{' : 'await(async()=>{'}${script}})();
if(observed.status!=='native-readback-collected')return observed;
try{
 const canonicalJson=value=>JSON.stringify((function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sort(v[k])]));return v;})(value));
 ${nativeSlotIdentityRuntime()}
 const creation=${JSON.stringify(creation)},rows=resolveNativeSlotIdentities(creation,observed.nodes);
 if(!rows||typeof figma.${synchronous ? 'getNodeById' : 'getNodeByIdAsync'}!=='function')throw Error('native-template-caller-alias-inventory');
 const aliases=[];
 for(let i=0;i<rows.length;i++){
  const row=rows[i],actual=observed.nodes[i],born=creation.nodes.find(n=>n.id===row.id);
  const recorded=${synchronous ? 'figma.getNodeById' : 'await figma.getNodeByIdAsync'}(row.id),live=${synchronous ? 'figma.getNodeById' : 'await figma.getNodeByIdAsync'}(actual.id);
  if(!recorded||!live||recorded!==live||live.id!==actual.id||live.type!==row.type||
     live.parent?.id!==actual.parentId||canonicalJson((live.children||[]).map(n=>n.id))!==canonicalJson(actual.childIds))
   throw Error('native-template-caller-alias-sdk-conflict');
  if(row.id!==actual.id){
   const slot=rows.find(n=>n.id===row.parentId),instance=rows.find(n=>n.id===slot?.parentId);
   if(row.type!=='TEXT'||!born.slotIdentity||canonicalJson(born.slotIdentity)!==canonicalJson({slotId:row.parentId,path:[0]})||
      slot?.type!=='SLOT'||instance?.type!=='INSTANCE'||creation.comparisons[0].instanceId!==instance.id||
      !actual.id.startsWith(slot.id+';')||row.metadata.nativeSourceAllocation!==row.id)
    throw Error('native-template-caller-alias-role-conflict');
   aliases.push({recordedId:row.id,liveId:actual.id});
  }
 }
 observed.nodes=rows;observed.slotIdentityAliases=aliases;
}catch(error){observed.status='refused';observed.problems.push(error&&error.message?error.message:String(error));}
return observed;`;
}

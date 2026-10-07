import type {DumpSet} from './types.js';
/** Corroborate the captured remote domain; no original-library authority follows. */
export function validateRemoteSetSnapshot(set:DumpSet,fileKey:string|undefined):void {
 const s=set.remoteSnapshot;
 const fail=()=>{throw Error('remote-set-snapshot-identity-or-domain-unqualified');};
 const key=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{40}$/i.test(v);
 if(!s||s.kind!=='remote-set-snapshot')return fail();
 if(typeof s.nodeId!=='string'||!s.nodeId||!fileKey||s.captureFileKey!==fileKey||s.componentKey!==set.key||s.nodeId!==set.nodeId||!key(s.componentKey)||set.type!=='COMPONENT_SET')fail();
 const axes=Object.entries(set.propertyDefinitions??{}).flatMap(([name,d])=>d.type==='VARIANT'?[[name,d] as const]:[]);
 if(!axes.length||axes.some(([,d])=>!Array.isArray(d.variantOptions)||!d.variantOptions.length||new Set(d.variantOptions).size!==d.variantOptions.length))fail();
 const count=axes.reduce((n,[,d])=>n*d.variantOptions!.length,1);
 if(count>4096||count!==set.variants.length||!Array.isArray(s.variants)||count!==s.variants.length||s.variants.some(r=>!r||typeof r.nodeId!=='string'||!r.nodeId||!key(r.componentKey)||!r.values||typeof r.values!=='object'||Array.isArray(r.values)))fail();
 const seen=new Set<string>(),ids=new Set<string>(),keys=new Set<string>();
 for(const v of set.variants){
  const tuple=v.variantProperties??{};
  const rows=s.variants.filter(r=>r.nodeId===v.nodeId);
  if(v.type!=='COMPONENT'||!v.nodeId||!key(v.componentKey)||rows.length!==1)fail();
  const row=rows[0];
  if(row.componentKey!==v.componentKey||Object.keys(tuple).length!==axes.length||Object.keys(row.values??{}).length!==axes.length||
      axes.some(([name,d])=>!d.variantOptions!.includes(tuple[name])||row.values[name]!==tuple[name]))fail();
  const t=JSON.stringify(axes.map(([name])=>tuple[name]));
  if(seen.has(t)||ids.has(v.nodeId!)||keys.has(v.componentKey!))fail();
  seen.add(t);ids.add(v.nodeId!);keys.add(v.componentKey!);
 }
}

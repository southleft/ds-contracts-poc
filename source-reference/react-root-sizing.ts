/** Authenticated fixed sizes, distinct from measured content/caller geometry. */
import {enumerate,type EnumAxisSpec,type CapturedNode} from '../extract/computed/lib.js';
import {flattenTokens,makeResolveLiteral} from '../core/tokens.js';
import {mintTokens,type MintObservation} from '../core/mint-tokens.js';
import {tokensByPropEntries,resolveTokens,resolveLiterals,type Contract} from '../scripts/contract-schema.js';
import type {ReactRootVisual} from './react-root-visual.js';
export interface ReactSizingReport {channel:string;status:'retained'|'intrinsic'|'fill'|'unresolved';reason?:string}
export function prepareReactRootSizing(axes:EnumAxisSpec[],baseAxisValues:Record<string,string>,roots:Map<string,CapturedNode>,projections:Map<string,Pick<ReactRootVisual['roots'][number],'sourceSizing'>>){
 const enumeration=enumerate(axes,[],256,baseAxisValues),channels=new Set<string>(),fill=new Set<string>(),reports:ReactSizingReport[]=[];
 const conditional:Array<{channel:string;prop:string;values:Array<{value:string;px:number}>}>=[];
 for(const channel of ['width','height'] as const){
  const rows=enumeration.combos.map(combo=>({combo,fact:projections.get(combo.key)?.sourceSizing?.find(s=>s.channel===channel)}));
  if(rows.some(r=>!r.fact||r.fact.status==='unresolved')){
   reports.push({channel,status:'unresolved',reason:[...new Set(rows.filter(r=>!r.fact||r.fact.status==='unresolved').map(r=>r.fact?.reason??'source-size-evidence-missing'))].sort().join(',')});continue;
  }
  if(rows.every(r=>r.fact!.status==='auto')){reports.push({channel,status:'intrinsic'});continue;}
  // An own declared fill is never a fixed or automatic plane. It stays named
  // here until the assembling layout proves it can carry a parent's width.
  if(rows.some(r=>r.fact!.status==='fill')){
   const every=rows.every(r=>r.fact!.status==='fill'&&r.fact!.value==='100%');if(every)fill.add(channel);
   reports.push({channel,status:'unresolved',reason:every?'own-declared-fill-needs-layout-qualification':'fill-size-presence-needs-joint-mapping'});continue;
  }
  if(rows.every(r=>r.fact!.status==='fixed')){
   for(const {combo,fact} of rows){if(roots.get(combo.key)?.style[channel]!==fact!.value)throw Error('react-root-sizing-observation-mismatch');}
   channels.add(channel);reports.push({channel,status:'retained'});continue;
  }
  // An AUTO plane carries no fixed binding. A complete one-axis factorization
  // proves when a fixed dimension should be present; AUTO is never minted as
  // the measured size of the sample's text. More complex presence stays named.
  const axis=axes.find(a=>a.values.every(value=>new Set(rows.filter(r=>r.combo.axisValues[a.prop]===value).map(r=>r.fact!.value)).size===1));
  if(!axis){reports.push({channel,status:'unresolved',reason:'fixed-size-presence-needs-joint-mapping'});continue;}
  const fixed=axis.values.flatMap(value=>{const fact=rows.find(r=>r.combo.axisValues[axis.prop]===value)!.fact!;return fact.status==='fixed'?[{value,px:parseFloat(fact.value!)}]:[];});
  if(fixed.some(f=>f.value===axis.unset)){reports.push({channel,status:'unresolved',reason:'fixed-omission-size-needs-auto-override'});continue;}
  if(fixed.some(f=>!Number.isFinite(f.px)||f.px<0))throw Error('react-root-sizing-invalid-fixed-value');
  conditional.push({channel,prop:axis.prop,values:fixed});reports.push({channel,status:'retained'});
 }
 return {channels,fill,reports,verify:(contract:Contract,tokens:Record<string,unknown>)=>{
  const literal=makeResolveLiteral(flattenTokens(tokens));
  for(const report of reports.filter(r=>r.status==='retained'))for(const combo of enumeration.combos){
   const fact=projections.get(combo.key)!.sourceSizing!.find(s=>s.channel===report.channel)!;
   let ref=resolveTokens(contract.anatomy.root,combo.axisValues)[report.channel];
   for(const [name,value] of Object.entries(combo.axisValues))ref=ref?.replaceAll('{'+name+'}',value);
   const value=ref?literal(ref.slice(1,-1)):resolveLiterals(contract.anatomy.root,combo.axisValues)[report.channel];
   if(fact.status==='auto'?value!==undefined:value!==fact.value)throw Error('react-root-sizing-projection-mismatch:'+report.channel+':'+combo.key);
  }
 },apply:(contract:Contract,tokens:Record<string,unknown>)=>{
  if(!conditional.length)return;
  const observations:MintObservation[]=conditional.flatMap((entry,index)=>entry.values.map((v,i)=>({nodePath:`root-${index}-${i}`,part:`root-${index}-${i}`,cssProperty:entry.channel,kind:'px',occurrences:[{variant:'fixed',axisValues:{},value:v.px}]})));
  const minted=mintTokens(contract.name+'Sizing',observations,[]);
  const merge=(target:Record<string,any>,source:Record<string,any>)=>{for(const [key,value] of Object.entries(source)){
   if(!Object.hasOwn(target,key)){target[key]=structuredClone(value);continue;}
   if(value&&typeof value==='object'&&!('$value' in value)&&target[key]&&typeof target[key]==='object')merge(target[key],value);
   else if(JSON.stringify(target[key])!==JSON.stringify(value))throw Error('react-root-sizing-token-collision');
  }};merge(tokens,minted.tree);
  const entries=tokensByPropEntries(contract.anatomy.root).map(entry=>({...entry,map:Object.assign(Object.create(null),entry.map)}));
  for(const [index,entry] of conditional.entries()){
   let target=entries.find(e=>e.prop===entry.prop);
   if(!target){target={prop:entry.prop,map:Object.create(null)};entries.push(target);}
   for(const [i,value] of entry.values.entries()){
    const binding=minted.bindings.find(b=>b.nodePath===`root-${index}-${i}`&&b.cssProperty===entry.channel);
    if(!binding?.ref)throw Error('react-root-sizing-token-unminted');
    (target.map[value.value]??=Object.create(null))[entry.channel]=binding.ref;
   }
  }
  contract.anatomy.root.tokensByProp=entries;
 }};
}

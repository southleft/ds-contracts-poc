import type {DumpSet,DumpHostOverride,DumpNode} from '../extract/figma/types.js';
import {revisionOf} from './contract-provenance.js';
import {walkAnatomy,type Contract} from '../scripts/contract-schema.js';
import {qualifySolidFillColorBinding} from '../packages/schema/src/solid-fill-binding.js';
/** Selected-context appearance only. Consumer evidence qualifies the exact
 * resolved color; the finite native/React override input does not recreate a
 * variable binding. Never resolve an ambiguous display name from global tokens. */
export function observedTextOverrideColor(h:DumpHostOverride):string|undefined{
 const fill=h.fill;if(!fill)return;
 let hex=fill.hex;
 if(fill.var){
  const matches=Object.entries(h.variableConsumers??{}).filter(([,c])=>c.name===fill.var);
  if(matches.length!==1)throw Error('text-color-demand-consumer-ambiguous-or-missing');
  const [id,consumer]=matches[0],value=consumer.value;
  if(!value||typeof value!=='object')throw Error('text-color-demand-consumer-not-color');
  qualifySolidFillColorBinding({variableId:id,paint:{color:{r:value.r,g:value.g,b:value.b},opacity:fill.alpha??1,blendMode:'NORMAL'}},h.variableConsumers);
  const resolved=[value.r,value.g,value.b].map(n=>Math.round(n*255).toString(16).padStart(2,'0')).join('');
  if(hex!==undefined&&hex.toLowerCase()!==resolved)throw Error('text-color-demand-consumer-hex-conflict');
  hex=resolved;
 }
 if(!/^[0-9a-f]{6}$/i.test(hex??''))return;
 const a=fill.alpha;if(a!==undefined&&(!Number.isFinite(a)||a<0||a>1))throw Error('text-color-demand-alpha-invalid');
 return '#'+hex!.toLowerCase()+(a===undefined||a===1?'':Math.round(a*255).toString(16).padStart(2,'0'));
}
export type TextColorDemand={fileKey:string;target:NonNullable<DumpHostOverride['textFillTarget']>;color:string};
export type TextColorBinding={fileKey:string;setKey:string;componentId:string;childPath:number[];prop:string;contractRevision:string};
export function textColorDemandsFromDumps(dump:Record<string,unknown>,fileKey:string):TextColorDemand[]{
 const out:TextColorDemand[]=[];const visit=(n:DumpNode)=>{for(const h of n.hostOverrides??[])if(h.textFillTarget&&h.fill){
  // Nested host overrides have no direct caller-to-child route. Keep them
  // on hostOverrides for the named fidelity report; do not let an unsupported
  // caller demand prevent the independently captured main from proposing.
  // demandedTextColorNodes still refuses nested targets supplied as authority.
  if(h.textFillTarget.instancePath.length)continue;
  const color=observedTextOverrideColor(h);if(color===undefined)continue;
  out.push({fileKey,target:h.textFillTarget,color});
 }for(const c of n.children??[])visit(c);};
 for(const value of Object.values(dump))if(value&&typeof value==='object'&&Array.isArray((value as DumpSet).variants))for(const v of (value as DumpSet).variants)visit(v);return out;
}
export function demandedTextColorNodes(set:DumpSet,fileKey:string|null|undefined,demands:readonly TextColorDemand[]):Map<string,TextColorDemand[]>{
 const out=new Map<string,TextColorDemand[]>();for(const d of demands){const t=d.target,variant=set.variants.find(v=>v.nodeId===t.componentId);if(!variant)continue;
 if(set.contractId||!fileKey||fileKey!==d.fileKey||!set.key||t.instancePath.length||!t.childPath.length||!t.childPath.every(i=>Number.isInteger(i)&&i>=0))throw Error('text-color-demand-source-identity-unqualified');
 let n:DumpNode|undefined=variant;for(const i of t.childPath){if(n?.type==='INSTANCE')throw Error('text-color-demand-crosses-instance-owner');n=n?.children?.[i];}
 if(!n?.nodeId||n.type!=='TEXT'||t.nodeId!==`I${t.instanceId};${n.nodeId}`)throw Error('text-color-demand-source-target-unqualified');
 out.set(n.nodeId,[...(out.get(n.nodeId)??[]),d]);}return out;
}
export function textColorBindingMatches(b:TextColorBinding,c:Contract,fileKey:string|null|undefined,t:NonNullable<DumpHostOverride['textFillTarget']>):boolean{
 return !!fileKey&&b.fileKey===fileKey&&c.bindings.figma.anchors.fileKey===fileKey&&b.setKey===c.bindings.figma.anchors.componentSetKey&&b.componentId===t.componentId&&!t.instancePath.length&&JSON.stringify(b.childPath)===JSON.stringify(t.childPath)&&b.contractRevision===revisionOf(c)&&walkAnatomy(c).filter(w=>w.part.textColorOverrideProp===b.prop).length===1;
}

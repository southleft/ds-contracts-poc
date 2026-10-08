import {ContractSchema,walkAnatomy,type Contract,type Part} from '../scripts/contract-schema.js';
import {validateContract} from '../packages/core/src/validate.js';
import type {DumpNode,DumpSet,DumpHostOverride} from '../extract/figma/types.js';
import type {DumpBatchResult} from './propose-figma.js';
export type SourceInstancePart={nodeId:string;partKey:string;childId:string};
type Proposal=DumpBatchResult['proposals'][number];
type Witness=NonNullable<DumpHostOverride['instanceProperties']>;
const spelling=(s:string)=>s.replace(/#[0-9]+:[0-9]+(?::[0-9]+)?$/,'');
const nodes=(n:DumpNode):DumpNode[]=>[n,...(n.children??[]).flatMap(nodes)];
function sourcePart(p:Proposal,c:Contract,id:string):Part|undefined{
 const hits=p.sourceInstanceParts?.filter(x=>x.nodeId===id)??[];
 if(hits.length!==1)return;
 const parts=walkAnatomy(c).filter(x=>x.name===hits[0].partKey&&(x.part.component?.id===hits[0].childId||x.part.slot?.defaultContent?.[0]?.id===hits[0].childId));
 return parts.length===1?parts[0].part:undefined;
}
function valueFor(p:Contract['props'][number],observed:Witness['properties'][string]):string|boolean|undefined{
 const b=p.bindings.figma;
 if(b.kind!==observed.type)return;
 if(b.kind==='TEXT')return typeof observed.value==='string'?observed.value:undefined;
 if(b.kind==='BOOLEAN')return typeof observed.value==='boolean'?observed.value:undefined;
 if(b.kind!=='VARIANT'||typeof observed.value!=='string')return;
 const keys=Object.entries(b.values??{}).filter(([,v])=>v===observed.value).map(([k])=>k);
 if(keys.length!==1)return;
 if(p.type==='boolean')return keys[0]==='true'?true:keys[0]==='false'?false:undefined;
 return typeof p.type==='object'&&'enum'in p.type&&p.type.enum.includes(keys[0])?keys[0]:undefined;
}
// Copy only literal child arguments; owner-dependent expressions cannot be
// moved into the caller's prop scope without explicit forwarding evidence.
function callerIndependent(part:Part):boolean{
 if(Object.keys(part).some(k=>!['component','layout','parts'].includes(k)))return false;
 const c=part.component;
 if(c&&(Object.keys(c).some(k=>!['id','props','text','rootFill','rootOverrides','contentSlot','contentSlots'].includes(k))||Object.values(c.props??{}).some(v=>typeof v!=='string'&&typeof v!=='boolean'||typeof v==='string'&&/^\{.*\}$/.test(v))))return false;
 return Object.values(part.parts??{}).every(callerIndependent);
}
function resolveSwapInput(name:string,observation:Witness['properties'][string],child:Contract,dump:Record<string,unknown>,fileKey:string,proposals:Proposal[]):{slot:string;part:Part}|undefined{
 const selected=observation.selected;
 if(typeof observation.value!=='string'||!selected||observation.value!==selected.nodeId)return;
 const slots=walkAnatomy(child).flatMap(p=>p.part.slot?.bindings?.figma?.property&&spelling(p.part.slot.bindings.figma.property)===spelling(name)?[p.part.slot]:[]);
 if(slots.length!==1)return;
 const matches=proposals.flatMap(proposal=>{
  const set=dump[proposal.setName] as DumpSet;
  if(!set?.variants||set.contractId)return [];
  return set.variants.filter(v=>v.nodeId===selected.nodeId&&(v.componentKey??(set.type==='COMPONENT'?set.key:undefined))===selected.componentKey).map(main=>({proposal,main}));
 });
 if(matches.length!==1)return;
 const {proposal,main}=matches[0],target=ContractSchema.parse(proposal.contract);
 if(target.bindings.figma.anchors.fileKey!==fileKey)return;
 const props:Record<string,string|boolean>={};
 for(const [key,value]of Object.entries(main.variantProperties??{})){
  const candidates=target.props.filter(p=>p.bindings.figma.kind==='VARIANT'&&p.bindings.figma.property===key);
  if(candidates.length!==1)return;
  const mapped=valueFor(candidates[0],{type:'VARIANT',value});if(mapped===undefined)return;props[candidates[0].name]=mapped;
 }
 return {slot:slots[0].name,part:{component:{id:target.id,...(Object.keys(props).length?{props}:{})}}};
}
/** Generated wrapper slots retain defaults; evidence selects exact occurrences.
 * Source mappings are emitted during proposal, never reconstructed from names. */
export function settleNestedPropertyInputs(dump:Record<string,unknown>,fileKey:string|undefined,proposals:Proposal[],protectedIds:ReadonlySet<string>):void{
 if(!fileKey)return;
 const byKey=new Map(proposals.map(p=>[ContractSchema.parse(p.contract).bindings.figma.anchors.componentSetKey,p]));
 const promoted=new Map<string,string>();
 for(const parentProposal of proposals){
  const source=dump[parentProposal.setName] as DumpSet;
  if(!source?.variants||source.contractId||protectedIds.has(String(parentProposal.contract.id)))continue;
  for(const usage of source.variants.flatMap(nodes)){
   const witnesses=usage.hostOverrides?.flatMap(h=>h.instanceProperties?[h.instanceProperties]:[])??[];
   if(!witnesses.length)continue;
   const fail=(reason:string)=>parentProposal.notes.push(`${parentProposal.setName}: nested-property-input-not-carried — ${reason}`);
   const ownerProposal=byKey.get(usage.instanceSetKey??usage.instanceKey??null);
   if(!ownerProposal||ownerProposal===parentProposal||protectedIds.has(String(ownerProposal.contract.id))){fail('owner is unavailable or protected');continue;}
   const ownerSet=dump[ownerProposal.setName] as DumpSet;
   if(ownerSet.contractId){fail('wrapper is stamped');continue;}
   const mains=ownerSet.variants.filter(v=>v.nodeId===usage.instanceGeometry?.componentId&&(v.componentKey??(ownerSet.type==='COMPONENT'?ownerSet.key:undefined))===usage.instanceKey);
   if(mains.length!==1){fail('wrapper selected main identity is incomplete');continue;}
   const owner=ContractSchema.parse(ownerProposal.contract),parent=ContractSchema.parse(parentProposal.contract);
   if(owner.bindings.figma.anchors.fileKey!==fileKey||parent.bindings.figma.anchors.fileKey!==fileKey){fail('source file identity disagrees');continue;}
   const caller=usage.nodeId?sourcePart(parentProposal,parent,usage.nodeId):undefined;
   if(!caller?.component||caller.component.id!==owner.id){fail('caller source occurrence has no unique generated part');continue;}
   const peerIds=parentProposal.sourceInstanceParts?.filter(p=>p.partKey===parentProposal.sourceInstanceParts?.find(r=>r.nodeId===usage.nodeId)?.partKey).map(p=>p.nodeId)??[];
   if(new Set(peerIds).size!==1){fail('caller occurrence varies across source planes');continue;}
   const main=mains[0],pending=new Map<string,string>();let valid=true;
   const seen=new Set<string>();
   for(const w of witnesses){
    const pathKey=JSON.stringify(w.path);
    if(seen.has(pathKey)||!w.path.length||w.path.length>8||!w.path.every(i=>Number.isSafeInteger(i)&&i>=0)||w.ownerId!==usage.nodeId||w.ownerComponentId!==usage.instanceGeometry?.componentId||w.ownerComponentId!==main.nodeId||w.ownerComponentKey!==usage.instanceKey||w.ownerComponentKey!==(main.componentKey??ownerSet.key)){valid=false;break;}
    seen.add(pathKey);let target:DumpNode|undefined=main;
    for(const i of w.path){if(target?.type==='INSTANCE'){target=undefined;break;}target=target?.children?.[i];}
    const prefix=usage.nodeId!.startsWith('I')?usage.nodeId!:'I'+usage.nodeId;
    const key=w.componentSetKey??w.componentKey,childProposal=byKey.get(key),childSet=childProposal&&dump[childProposal.setName] as DumpSet|undefined;
    const selected=childSet?.variants.find(v=>v.nodeId===w.componentId&&(v.componentKey??(childSet.type==='COMPONENT'?childSet.key:undefined))===w.componentKey);
    if(!target?.nodeId||target.type!=='INSTANCE'||w.nodeId!==prefix+';'+target.nodeId||(target.instanceSetKey??target.instanceKey)!==key||!selected||!childProposal||childSet?.contractId){valid=false;break;}
    const child=ContractSchema.parse(childProposal.contract),part=sourcePart(ownerProposal,owner,target.nodeId);
    if(child.bindings.figma.anchors.fileKey!==fileKey||!part){valid=false;break;}
    const partIdentity=ownerProposal.sourceInstanceParts?.find(x=>x.nodeId===target.nodeId)?.partKey;
    const route=JSON.stringify([owner.id,partIdentity]);let slot=promoted.get(route)??pending.get(route);
    const fallbackKey='nestedDefault'+partIdentity;
    const originalPart=slot?part.parts?.[fallbackKey]:structuredClone(part);
    const original=originalPart?.component;
    if(!original||original.id!==child.id||(!slot&&(part.slot||Object.keys(part).some(k=>!['component','layout','parts'].includes(k))||Object.keys(part.layout??{}).some(k=>!['grow','growBasis'].includes(k))))){valid=false;break;}
    if(!callerIndependent(originalPart!)){valid=false;break;}
    const supplied:Record<string,string|boolean>={},swaps:Array<{slot:string;part:Part}>=[];
    for(const [name,observation]of Object.entries(w.properties)){
     if(observation.type==='INSTANCE_SWAP'){
      const swap=resolveSwapInput(name,observation,child,dump,fileKey,proposals);
      if(!swap||swaps.some(s=>s.slot===swap.slot)){valid=false;break;}swaps.push(swap);continue;
     }
     if(observation.type==='VARIANT'&&selected.variantProperties?.[name]!==observation.value){valid=false;break;}
     const props=child.props.filter(p=>p.bindings.figma.kind===observation.type&&'property'in p.bindings.figma&&typeof p.bindings.figma.property==='string'&&spelling(p.bindings.figma.property)===spelling(name));
     if(props.length!==1){valid=false;break;}
     const value=valueFor(props[0],observation);if(value===undefined){valid=false;break;}supplied[props[0].name]=value;
    }
    if(!valid)break;
    if(!slot){
     const names=new Set([...owner.props.map(p=>p.name),...walkAnatomy(owner).flatMap(p=>p.part.slot?[p.part.slot.name]:[])]);
     const stem='nestedContent'+w.path.join('_');slot=stem;let suffix=2;while(names.has(slot))slot=stem+suffix++;
     delete part.component;
     if(Object.values(original.props??{}).some(v=>typeof v!=='string'&&typeof v!=='boolean'||typeof v==='string'&&/^\{.*\}$/.test(v))){valid=false;break;}
     part.slot={name:slot,renderDefault:true,defaultContent:[{id:child.id,...(original.props?{props:original.props as Record<string,string|boolean>}:{}),...(original.text!==undefined?{text:original.text}:{})}]};
     part.layout={...part.layout,display:'flex',direction:'row',...(original.rootFill?.includes('width')?{grow:true,growBasis:'zero' as const}:{})};
     part.parts={[fallbackKey]:originalPart!};pending.set(route,slot);
    }
    const occupied=new Set(walkAnatomy(parent).map(p=>p.name));let callerKey='nestedUsage'+w.path.join('_'),suffix=2;while(occupied.has(callerKey))callerKey='nestedUsage'+w.path.join('_')+suffix++;
    const previous=Object.keys(caller.parts??{});
    const suppliedPart:Part={...structuredClone(originalPart!),component:{...original,props:{...original.props,...supplied}}};
    for(const [index,swap]of swaps.entries()){
     const content=suppliedPart.component!,previousKeys=Object.keys(suppliedPart.parts??{});
     const routes={...(content.contentSlots??(previousKeys.length?{[content.contentSlot??'children']:previousKeys}:{}))};
     const key=callerKey+'Swap'+index;
     if(suppliedPart.parts?.[key]){valid=false;break;}
     const obsolete=routes[swap.slot]??[];routes[swap.slot]=[key];
     suppliedPart.parts={...suppliedPart.parts,[key]:swap.part};
     for(const old of obsolete)if(!Object.values(routes).some(keys=>keys.includes(old)))delete suppliedPart.parts[old];
     content.contentSlots=routes;delete content.contentSlot;
    }
    if(!valid)break;
    caller.parts={...caller.parts,[callerKey]:suppliedPart};
    caller.component.contentSlots={...(caller.component.contentSlots??(previous.length?{[caller.component.contentSlot??'children']:previous}:{})),[slot]:[callerKey]};delete caller.component.contentSlot;
    if(!valid)break;
   }
   if(!valid){fail('source identity, property domain or default is incomplete');continue;}
   const scope=new Map(proposals.map(p=>{const c=ContractSchema.parse(p.contract);return[c.id,c] as const;})),before:string[]=[],after:string[]=[];
   for(const c of [scope.get(parent.id)!,scope.get(owner.id)!])validateContract(c,scope,before,new Map());
   scope.set(parent.id,parent);scope.set(owner.id,owner);
   for(const c of [parent,owner])validateContract(c,scope,after,new Map());
   if(after.some(e=>!before.includes(e))){fail('forwarding introduces contract validation errors: '+after.filter(e=>!before.includes(e)).join('; '));continue;}
   parentProposal.contract=parent as unknown as Proposal['contract'];ownerProposal.contract=owner as unknown as Proposal['contract'];for(const [k,v]of pending)promoted.set(k,v);
   parentProposal.notes.push(`${parentProposal.setName}: ${witnesses.length} identity-qualified nested property occurrences forwarded with unchanged wrapper defaults; caller-owned child props use existing component slots; live native qualification remains pending`);
  }
 }
}

/** Retain occurrence identity before repeat inference groups equal component names. */
export function nestedPropertySourceNodes(dump:Record<string,unknown>):ReadonlySet<string>{
 const sets=Object.values(dump).filter((x):x is DumpSet=>!!x&&typeof x==='object'&&Array.isArray((x as DumpSet).variants));
 const mains=new Map(sets.flatMap(s=>s.variants.map(v=>[v.nodeId,v] as const))),out=new Set<string>();
 for(const set of sets)for(const usage of set.variants.flatMap(nodes))for(const h of usage.hostOverrides??[]){
  const w=h.instanceProperties;if(!w||w.ownerId!==usage.nodeId||w.ownerComponentId!==usage.instanceGeometry?.componentId)continue;
  let n=mains.get(w.ownerComponentId);for(const i of w.path){if(!Number.isSafeInteger(i)||i<0||n?.type==='INSTANCE'){n=undefined;break;}n=n?.children?.[i];}
  if(n?.type==='INSTANCE'&&n.nodeId)out.add(n.nodeId);
 }
 return out;
}

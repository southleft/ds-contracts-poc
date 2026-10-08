import {ContractSchema,slotsOf,walkAnatomy,type Contract} from '../scripts/contract-schema.js';
import {validateContract} from '../packages/core/src/validate.js';
import type {DumpNode,DumpSet,DumpHostOverride} from '../extract/figma/types.js';
import type {DumpBatchResult} from './propose-figma.js';
type Witness=NonNullable<DumpHostOverride['instanceProperties']>;
const spelling=(name:string)=>name.replace(/#[0-9]+:[0-9]+(?::[0-9]+)?$/,'');
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const nodes=(root:DumpNode):DumpNode[]=>[root,...(root.children??[]).flatMap(nodes)];
const at=(root:DumpNode,path:number[])=>path.reduce<DumpNode|undefined>((n,index)=>n?.children?.[index],root);

/** Promote only fresh generated APIs whose complete source family proves one
 * unambiguous nested content route. No supplied contract or display-name match
 * supplies authority. Edits to owner and caller are committed together. */
export function settleNestedSlotSelections(dump:Record<string,unknown>,fileKey:string|undefined,
 proposals:DumpBatchResult['proposals'],protectedIds:ReadonlySet<string>):void {
 if(!fileKey)return;
 const promoted=new Map<string,string>();
 const byKey=new Map<string,typeof proposals[number]>();
 for(const p of proposals){const c=ContractSchema.safeParse(p.contract);if(c.success&&c.data.bindings.figma.anchors.fileKey===fileKey){const key=c.data.bindings.figma.anchors.componentSetKey;if(key)byKey.set(key,p);}}
 for(const parentProposal of proposals){
  const source=dump[parentProposal.setName] as DumpSet|undefined;
  if(!source?.variants||source.contractId||protectedIds.has(String(parentProposal.contract.id)))continue;
  const uses=source.variants.flatMap(v=>nodes(v));
  const demanded=[...new Set(uses.filter(n=>n.hostOverrides?.some(h=>h.instanceProperties)).map(n=>n.instanceSetKey??n.instanceKey))];
  for(const key of demanded){
   const refuse=(why:string)=>parentProposal.notes.push(`${parentProposal.setName}: nested-slot-route-not-carried — ${why}`);
   const ownerProposal=key?byKey.get(key):undefined;
   if(!ownerProposal||ownerProposal===parentProposal||protectedIds.has(String(ownerProposal.contract.id))){refuse('owner is missing, supplied or self-referential');continue;}
   const ownerSet=dump[ownerProposal.setName] as DumpSet;
   if(ownerSet.contractId){refuse('stamped owner API is protected');continue;}
   const occurrences=uses.filter(n=>(n.instanceSetKey??n.instanceKey)===key);
   const witnesses=occurrences.map(n=>n.hostOverrides?.filter(h=>h.instanceProperties).map(h=>h.instanceProperties!));
   if(!occurrences.length||witnesses.some(rows=>rows?.length!==1)){refuse('every owner usage must have one complete nested selection');continue;}
   const observed=witnesses.map(rows=>rows![0]),first=observed[0];
   const swaps=Object.entries(first.properties).filter(([,p])=>p.type==='INSTANCE_SWAP');
   if(swaps.length!==1||!first.componentSetKey||!first.path.length||first.path.length>8||!first.path.every(n=>Number.isSafeInteger(n)&&n>=0)){
    refuse('nested selection is not a unique bounded swap route');continue;
   }
   const [property,selection]=swaps[0],selected=selection.selected;
   if(!selected||selection.value!==selected.nodeId||observed.some(w=>!equal(w.path,first.path)||w.componentSetKey!==first.componentSetKey||!equal(w.properties,first.properties))){refuse('selected content or nested properties vary or lack identity');continue;}
   const nestedProposal=byKey.get(first.componentSetKey),selectedProposal=byKey.get(selected.componentKey);
   if(!nestedProposal||!selectedProposal){refuse('nested API or selected definition is unavailable');continue;}
   let valid=true;
   for(let i=0;i<occurrences.length;i++){
    const n=occurrences[i],w=observed[i],variant=ownerSet.variants.find(v=>v.nodeId===w.ownerComponentId&&v.componentKey===w.ownerComponentKey),target=variant&&at(variant,w.path);
    if(w.ownerId!==n.nodeId||w.ownerComponentId!==n.instanceGeometry?.componentId||w.ownerComponentKey!==n.instanceKey||
      !w.nodeId.startsWith((w.ownerId.startsWith('I')?w.ownerId:'I'+w.ownerId)+';')||!target||target.type!=='INSTANCE'||target.instanceSetKey!==w.componentSetKey||target.instanceKey!==w.componentKey||target.instanceGeometry?.componentId!==w.componentId)valid=false;
   }
   const targets=ownerSet.variants.map(v=>at(v,first.path));
   // Every source variant must route the same nested API at that path, and it
   // must occur exactly once; otherwise contract component identity is ambiguous.
   if(targets.some((n,i)=>!n||n.type!=='INSTANCE'||n.instanceSetKey!==first.componentSetKey||
     nodes(ownerSet.variants[i]).filter(x=>x.instanceSetKey===first.componentSetKey).length!==1))valid=false;
   const defaults=targets.map(n=>n?.fixedSwaps?.[spelling(property)]),base=defaults[0];
   if(!base?.key||!base.id||defaults.some(d=>d?.id!==base.id||d?.key!==base.key))valid=false;
   for(const n of targets){
    const props=Object.fromEntries(Object.entries(first.properties).filter(([,p])=>p.type!=='INSTANCE_SWAP').map(([k,p])=>[k,p.value]));
    if(!n||!equal(Object.entries(n.componentProperties??{}).sort(),Object.entries(props).sort()))valid=false;
   }
   if(!valid){refuse('captured path, main identity or complete source family disagrees');continue;}
   const parent=ContractSchema.safeParse(parentProposal.contract),owner=ContractSchema.safeParse(ownerProposal.contract),chosen=ContractSchema.safeParse(selectedProposal.contract);
   const defaultProposal=base?.key?byKey.get(base.key):undefined;
   if(!parent.success||!owner.success||!chosen.success||!defaultProposal){refuse('complete generated contracts are unavailable');continue;}
   if(chosen.data.bindings.figma.anchors.nodeId!==selected.nodeId||chosen.data.props.some(p=>p.bindings.figma.kind==='VARIANT'||p.required&&p.default===undefined)||chosen.data.id===owner.data.id||chosen.data.id===parent.data.id){refuse('selected definition is not a standalone usable child');continue;}
   const nested=walkAnatomy(owner.data).filter(p=>p.part.component?.id===nestedProposal.contract.id);
   const destination=walkAnatomy(parent.data).filter(p=>p.part.slot?.renderDefault&&p.part.slot.defaultContent?.length===1&&p.part.slot.defaultContent[0].id===owner.data.id);
   if(nested.length!==1||destination.length!==1||destination[0].part.parts){refuse('generated owner or caller route is ambiguous or occupied');continue;}
   const content=nested[0].part.parts,entries=Object.entries(content??{});
   const routeKey=JSON.stringify([owner.data.id,first.path,property]),prior=promoted.get(routeKey);
   if(entries.length!==1||(prior ? entries[0][1].slot?.name!==prior||entries[0][1].slot?.defaultContent?.[0]?.id!==defaultProposal.contract.id : entries[0][1].component?.id!==defaultProposal.contract.id||Object.keys(entries[0][1]).length!==1)){refuse('nested default contains additional layout, state or override authority');continue;}
   const names=new Set([...owner.data.props.map(p=>p.name),...slotsOf(owner.data).map(s=>s.slot.name)]);
   let name=prior??'nestedContent',suffix=2;if(!prior)while(names.has(name))name=`nestedContent${suffix++}`;
   const fallback=entries[0][1],original=fallback.component;
   if(!prior){delete fallback.component;fallback.parts={defaultGlyph:{component:original!}};}
   fallback.slot={name,renderDefault:true,defaultContent:[{id:String(defaultProposal.contract.id)}]};
   const destinationPart=destination[0].part,item=destinationPart.slot!.defaultContent![0];
   destinationPart.parts={nestedDefault:{component:{...item,contentSlot:name},parts:{selectedGlyph:{component:{id:chosen.data.id}}}}};
   const scope=new Map(proposals.flatMap(p=>{const c=ContractSchema.safeParse(p.contract);return c.success?[[c.data.id,c.data] as const]:[]}));
   const before:string[]=[];for(const id of [owner.data.id,parent.data.id])validateContract(scope.get(id)!,scope,before,new Map());
   scope.set(owner.data.id,owner.data);scope.set(parent.data.id,parent.data);
   const after:string[]=[];for(const c of [owner.data,parent.data])validateContract(c,scope,after,new Map());
   if(after.some(error=>!before.includes(error))){refuse('proposed routing introduces contract validation errors');continue;}
   promoted.set(routeKey,name);
   ownerProposal.contract=owner.data as unknown as typeof ownerProposal.contract;
   parentProposal.contract=parent.data as unknown as typeof parentProposal.contract;
   ownerProposal.notes.push(`${ownerProposal.setName}: generated ${name} slot preserves the source default across ${ownerSet.variants.length} variants; supplied and stamped APIs are unchanged`);
   parentProposal.notes.push(`${parentProposal.setName}: identity-qualified nested selection ${chosen.data.id} routed through ${owner.data.id}.${name}; paint and geometry overrides remain independently qualified`);
  }
 }
}

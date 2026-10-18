import {ContractSchema,walkAnatomy,type Contract,type Part} from '../scripts/contract-schema.js';
import {validateContract} from '../packages/core/src/validate.js';
import type {DumpNode,DumpSet,DumpHostOverride} from '../extract/figma/types.js';
import type {DumpBatchResult} from './propose-figma.js';
import {fixedSwapOwnerRoots,fixedSwapVariantOwner,qualifyFixedSwapVariantSelection,capturedSelectedDefaultsMatch,type FixedSwapOwnerRoot} from './fixed-swap-root-allocation.js';
export type SourceInstancePart={nodeId:string;partKey:string;childId:string};
type Proposal=DumpBatchResult['proposals'][number];
type Witness=NonNullable<DumpHostOverride['instanceProperties']>;
const spelling=(s:string)=>s.replace(/#[0-9]+:[0-9]+(?::[0-9]+)?$/,'');
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
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

/** Clone only plain caller-owned component content. Part keys are global;
 * every cloned descendant receives a fresh key and explicit slot routes move
 * with it. Controls or other part-reference-bearing structures still refuse. */
function rekeyCallerChildren(part:Part,prefix:string,taken:Set<string>):boolean{
 const rename=new Map<string,string>();
 for(const [name,child]of Object.entries(part.parts??{})){
  if(Object.keys(child).some(key=>!['component','layout','parts','visibleWhen','presenceByCombination'].includes(key))||
    child.component&&Object.keys(child.component).some(key=>!['id','props','text','rootFill','rootOverrides','contentSlot','contentSlots','overrides'].includes(key)))return false;
  let next=prefix+name[0].toUpperCase()+name.slice(1),i=2;while(taken.has(next))next=prefix+name[0].toUpperCase()+name.slice(1)+i++;
  taken.add(next);rename.set(name,next);
 }
 if(part.component?.contentSlots){
  if(Object.values(part.component.contentSlots).some(keys=>keys.some(key=>!rename.has(key))))return false;
  part.component.contentSlots=Object.fromEntries(Object.entries(part.component.contentSlots).map(([slot,keys])=>[slot,keys.map(key=>rename.get(key)!)]));
 }
 part.parts=part.parts&&Object.fromEntries(Object.entries(part.parts).map(([name,child])=>[rename.get(name)!,child]));
 return Object.entries(part.parts??{}).every(([name,child])=>rekeyCallerChildren(child,name,taken));
}
/** Isolate an original caller occurrence without moving its arguments into a
 * different scope. Every original source tuple participates in both gates;
 * omissions, duplicate tuples and a source property absent from the API refuse.
 * The sibling keeps the prior part intact on all remaining source rows. */
export function isolateCaller(p:Proposal,c:Contract,source:DumpSet,usage:DumpNode):{part:Part;sourceParts:SourceInstancePart[]}|undefined{
 const mapping=p.sourceInstanceParts??[],own=mapping.filter(row=>row.nodeId===usage.nodeId);
 if(own.length!==1)return;
 const peers=mapping.filter(row=>row.partKey===own[0].partKey);
 const part=sourcePart(p,c,usage.nodeId!);if(!part)return;
 if(new Set(peers.map(row=>row.nodeId)).size===1)return {part,sourceParts:mapping};
 if(peers.length!==new Set(peers.map(row=>row.nodeId)).size||peers.some(row=>row.childId!==own[0].childId))return;
 const axes=c.props.filter(prop=>prop.bindings.figma.kind==='VARIANT');
 if(!axes.length||axes.length>8)return;
 const names=axes.map(prop=>prop.name),properties=axes.map(prop=>prop.bindings.figma.property);
 if(properties.some(property=>typeof property!=='string')||new Set(properties).size!==properties.length)return;
 const tuples=new Set<string>(),observed=new Set<string>();let selected=0;
 const rows:Array<{values:Array<string|null>;present:boolean}>=[];
 for(const variant of source.variants){
  const values=variant.variantProperties;
  if(!values||Object.keys(values).length!==axes.length||properties.some(property=>!Object.hasOwn(values,property!)))return;
  const tuple=axes.map(prop=>valueFor(prop,{type:'VARIANT',value:values[prop.bindings.figma.property!]}));
  if(tuple.some(value=>value===undefined))return;
  const serialized=tuple.map(value=>String(value)),key=JSON.stringify(serialized);if(tuples.has(key))return;tuples.add(key);
  const occurrences=nodes(variant).filter(node=>peers.some(peer=>peer.nodeId===node.nodeId));
  if(occurrences.length>1)return;
  if(occurrences.length){if(observed.has(occurrences[0].nodeId!))return;observed.add(occurrences[0].nodeId!);}
  const present=occurrences[0]?.nodeId===usage.nodeId;if(present)selected++;
  // Existing availability may further restrict the original part. Preserve
  // that gate exactly; neither new branch may create a formerly absent part.
  const prior=part.presenceByCombination;
  if(prior){
   const indices=prior.props.map(name=>names.indexOf(name));if(indices.some(i=>i<0))return;
   const matches=prior.rows.filter(row=>equal(row.values,indices.map(i=>serialized[i])));
   if(matches.length!==1||present&&!matches[0].present)return;
   rows.push({values:serialized,present:matches[0].present&&present});
  }else rows.push({values:serialized,present});
 }
 if(selected!==1||observed.size!==peers.length)return;
 const path=walkAnatomy(c).find(row=>row.part===part)?.path;if(!path||path.length<2)return;
 let container:Part|undefined=c.anatomy[path[0]];
 for(const key of path.slice(1,-1))container=container?.parts?.[key];
 if(!container?.parts||container.parts[path.at(-1)!]!==part)return;
 const routes=container.component?.contentSlots;
 if(routes&&Object.values(routes).filter(keys=>keys.includes(own[0].partKey)).length!==1)return;
 const taken=new Set(walkAnatomy(c).map(row=>row.name));let key=own[0].partKey+'SourceCaller',suffix=2;
 while(taken.has(key))key=own[0].partKey+'SourceCaller'+suffix++;
 const isolated=structuredClone(part);
 if(mapping.some(row=>row.partKey!==own[0].partKey&&walkAnatomy({...c,anatomy:{root:isolated}}).some(p=>p.name===row.partKey))||!rekeyCallerChildren(isolated,key,taken))return;
 isolated.presenceByCombination={props:names,rows};
 const prior=part.presenceByCombination;
 part.presenceByCombination={props:names,rows:rows.map(row=>{
  const match=prior?.rows.find(previous=>equal(previous.values,prior.props.map(name=>row.values[names.indexOf(name)])));
  return {values:row.values,present:!row.present&&(prior?match!.present:true)};
 })};
 container.parts=Object.fromEntries(Object.entries(container.parts).flatMap(([name,value])=>name===own[0].partKey?[[name,value],[key,isolated]]:[[name,value]]));
 if(routes)container.component!.contentSlots=Object.fromEntries(Object.entries(routes).map(([name,keys])=>[name,keys.flatMap(member=>member===own[0].partKey?[member,key]:[member])]));
 return {part:isolated,sourceParts:mapping.map(row=>row.nodeId===usage.nodeId?{...row,partKey:key}:row)};
}
// Copy only literal child arguments; owner-dependent expressions cannot be
// moved into the caller's prop scope without explicit forwarding evidence.
function callerIndependent(part:Part,staticSemanticOverrides=false):boolean{
 if(Object.keys(part).some(k=>!['component','layout','parts'].includes(k)))return false;
 const c=part.component;
 if(c&&(Object.keys(c).some(k=>!['id','props','text','rootFill','rootOverrides','contentSlot','contentSlots',...(staticSemanticOverrides?['overrides']:[])].includes(k))||Object.values(c.props??{}).some(v=>typeof v!=='string'&&typeof v!=='boolean'||typeof v==='string'&&/^\{.*\}$/.test(v))))return false;
 if(staticSemanticOverrides&&c?.overrides&&Object.entries(c.overrides).some(([name,value])=>!['size','color'].includes(name)||typeof value!=='string'||!/^\{[^{}]+\}$/.test(value)))return false;
 return Object.values(part.parts??{}).every(child=>callerIndependent(child,staticSemanticOverrides));
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
export type SourceRoute={node:DumpNode;parentId?:string;owner:FixedSwapOwnerRoot;hop?:{property:string;owner:FixedSwapOwnerRoot;selected:FixedSwapOwnerRoot;row:NonNullable<NonNullable<DumpNode['fixedSwaps']>[string]['observedInstances']>[number]}};
const densePath=(path:unknown):path is number[]=>Array.isArray(path)&&path.length>0&&path.length<=8&&Array.from({length:path.length},(_,i)=>Object.hasOwn(path,i)&&Number.isSafeInteger(path[i])&&path[i]>=0).every(Boolean);
/** A path crosses at most one explicitly selected source boundary. Never walk
 * the placeholder's children or infer a selected component from a name. */
function sourceRoute(usage:DumpNode,w:Pick<Witness,'ownerId'|'ownerComponentId'|'ownerComponentKey'|'path'|'nodeId'> & Partial<Pick<Witness,'componentKey'|'componentSetKey'>>,roots:ReadonlyMap<string,readonly FixedSwapOwnerRoot[]>,textTarget?:{instanceId:string;componentId:string}):SourceRoute|undefined{
 const candidates=roots.get(w.ownerComponentId),owner=candidates?.[0];
 if(!candidates||candidates.length!==1||!owner||!usage.nodeId||w.ownerId!==usage.nodeId||w.ownerComponentId!==usage.instanceGeometry?.componentId||
    w.ownerComponentKey!==usage.instanceKey||(owner.node.componentKey??(owner.setType==='COMPONENT'?owner.setKey:undefined))!==w.ownerComponentKey||
    (usage.instanceSetKey??usage.instanceKey)!==owner.setKey||!densePath(w.path))return;
 let current=owner.node,currentOwner=owner,prefix=usage.nodeId.startsWith('I')?usage.nodeId:'I'+usage.nodeId;
 let hop:SourceRoute['hop'],parent:DumpNode|undefined;
 for(let at=0;at<w.path.length;at++){
  if(current.type==='INSTANCE'){
   if(hop||!current.nodeId||typeof current.propRefs?.mainComponent!=='string')return;
   const property=current.propRefs.mainComponent;
   const defs=Object.entries(currentOwner.propertyDefinitions??{}).filter(([name])=>spelling(name)===spelling(property));
   const swaps=Object.entries(usage.fixedSwaps??{}).filter(([name])=>spelling(name)===spelling(property));
   if(defs.length!==1||defs[0][1].type!=='INSTANCE_SWAP'||swaps.length!==1)return;
   const swap=swaps[0][1],selected=fixedSwapVariantOwner(swap,roots),rows=swap.observedInstances,row=rows?.[0];
   if(!selected||!Array.isArray(rows)||rows.length!==1||!Object.hasOwn(rows,0)||!row||!densePath(row.path)||!equal(row.path,w.path.slice(0,at))||
      row.nodeId!==prefix+';'+current.nodeId||row.componentId!==swap.id)return;
   const proof=row.selectedRoot;
   if(proof&&(proof.kind!=='selected-slot-root-v1'||proof.hostId!==usage.nodeId||proof.hostMainId!==w.ownerComponentId||proof.property!==defs[0][0]||proof.componentKey!==swap.key||proof.componentSetKey!==selected.setKey))return;
   hop={property,owner:currentOwner,selected,row};prefix+=';'+current.nodeId;current=selected.node;currentOwner=selected;
  }
  parent=current;current=current.children?.[w.path[at]]!;if(!current)return;
 }
 if(textTarget){
  if(current.type!=='TEXT'||!current.nodeId||w.nodeId!==prefix+';'+current.nodeId||textTarget.instanceId!==prefix||textTarget.componentId!==currentOwner.node.nodeId)return;
 }else if(current.type!=='INSTANCE'||!current.nodeId||w.nodeId!==prefix+';'+current.nodeId||(current.instanceSetKey??current.instanceKey)!==(w.componentSetKey??w.componentKey))return;
 return {node:current,parentId:parent===currentOwner.node?prefix:parent?.nodeId?prefix+';'+parent.nodeId:undefined,owner:currentOwner,...(hop?{hop}:{})};
}
/** A text target uses the same bounded selected-instance traversal. It must
 * end in the exact nearest owner's TEXT, never a placeholder's descendant. */
export function sourceTextRoute(usage:DumpNode,w:NonNullable<DumpHostOverride['textSizeOverride']>,roots:ReadonlyMap<string,readonly FixedSwapOwnerRoot[]>):SourceRoute|undefined{
 const t=w.target;if(!densePath(t.childPath)||!Array.isArray(t.instancePath)||t.instancePath.length>8||t.instancePath.length&&!densePath(t.instancePath))return;
 return sourceRoute(usage,{ownerId:w.ownerId,ownerComponentId:w.ownerComponentId,ownerComponentKey:w.ownerComponentKey,nodeId:t.nodeId,path:[...t.instancePath,...t.childPath]},roots,t);
}
/** Follow the already emitted slot route, with exact selected variant props.
 * Duplicate candidates refuse; this does not search unrelated descendants. */
export function selectedCaller(caller:Part,wrapper:Contract,target:Contract,route:SourceRoute,
 roots:ReadonlyMap<string,readonly FixedSwapOwnerRoot[]>,fileKey:string):Part|undefined{
 const hop=route.hop;if(!hop)return caller;
 const props=qualifyFixedSwapVariantSelection({id:hop.selected.node.nodeId!,key:hop.selected.node.componentKey},roots,target,fileKey);if(!props)return;
 const slots=walkAnatomy(wrapper).flatMap(p=>p.part.slot?.bindings?.figma?.property&&spelling(p.part.slot.bindings.figma.property)===spelling(hop.property)?[p.part.slot]:[]);
 if(slots.length!==1||!caller.component)return;
 const keys=caller.component.contentSlots?.[slots[0].name]??((caller.component.contentSlot??'children')===slots[0].name?Object.keys(caller.parts??{}):[]);
 if(new Set(keys).size!==keys.length)return;
 const candidates=keys.map(key=>caller.parts?.[key]).filter((part):part is Part=>!!part&&part.component?.id===target.id&&
  Object.entries(props).every(([name,value])=>part.component?.props?.[name]===value));
 if(candidates.length!==1)return;
 const selected=candidates[0];
 if(hop.row.selectedRoot&&!capturedSelectedDefaultsMatch(hop.row.selectedRoot.properties,target,selected.component!.props??{}))return;
 return selected;
}
/** Expand only the selected owner's literal inputs before copying its root
 * token references into a different caller scope. Unknown expressions refuse. */
function localizeRootOverrides(part:Part,ownerInputs:Record<string,unknown>,callerGate:Part['presenceByCombination']):boolean{
 for(const [key,value]of Object.entries(part.component?.rootOverrides??{})){
  if(/^\{[a-z0-9.-]+\}$/i.test(value))continue;
  const names=[...value.matchAll(/\{([^{}]+)\}/g)].map(match=>match[1]);
  if(!names.length||names.some(name=>!Object.hasOwn(ownerInputs,name)||!['string','boolean'].includes(typeof ownerInputs[name])))return false;
  const localized=value.replace(/\{([^{}]+)\}/g,(_,name:string)=>String(ownerInputs[name]));
  if(/^\{[a-z0-9.-]+\}$/i.test(localized))part.component!.rootOverrides![key as keyof NonNullable<NonNullable<Part['component']>['rootOverrides']>]=localized;
  else {
   // Some existing token paths use non-ASCII enum values. Retain a caller
   // placeholder only when the isolated source gate fixes it to exactly the
   // same selected-owner literal on every row where this caller can appear.
   const present=callerGate?.rows.filter(row=>row.present)??[];
   if(!present.length||names.some(name=>!callerGate?.props.includes(name)||present.some(row=>row.values[callerGate!.props.indexOf(name)]!==String(ownerInputs[name]))))return false;
  }
 }
 return Object.values(part.parts??{}).every(child=>localizeRootOverrides(child,ownerInputs,callerGate));
}
/** HUG belongs to this exact captured occurrence. A selected main's height
 * alone never authorizes deleting the old standalone instance constraint. */
function retireCapturedHugHeight(part:Part,source:DumpNode,selected:DumpNode,w:Witness,route:SourceRoute):boolean{
 const g=w.layout;
 const size=(v:unknown):v is {width:number;height:number}=>!!v&&typeof v==='object'&&['width','height'].every(k=>typeof (v as Record<string,unknown>)[k]==='number'&&Number.isFinite((v as Record<string,number>)[k])&&(v as Record<string,number>)[k]>0);
 const matrix=g?.relativeTransform;
 if(!g||g.kind!=='nested-instance-layout-v1'||g.nodeId!==w.nodeId||g.componentId!==w.componentId||!route.parentId||g.parentId!==route.parentId||
    !size(g.localSize)||!size(g.parentSize)||!Array.isArray(matrix)||matrix.length!==2||!Array.from({length:2},(_,i)=>Object.hasOwn(matrix,i)).every(Boolean)||matrix.some(row=>!Array.isArray(row)||row.length!==3||Array.from({length:3},(_,i)=>Object.hasOwn(row,i)&&typeof row[i]==='number'&&Number.isFinite(row[i])).some(valid=>!valid))||
    matrix[0][0]!==1||matrix[0][1]!==0||matrix[1][0]!==0||matrix[1][1]!==1||g.inFlow!==true||g.sizeBound!==false||
    g.sizing?.vertical!=='HUG'||Object.hasOwn(g.sizing,'height')||source.instanceSizing?.vertical!=='HUG'||Object.hasOwn(source.instanceSizing,'height')||
    !['FIXED','HUG','FILL'].includes(g.sizing.horizontal??'')||(g.sizing.horizontal==='FIXED'?g.sizing.width!==g.localSize.width:Object.hasOwn(g.sizing,'width'))||!size(selected.bbox)||selected.bbox.height!==g.localSize.height||
    !(selected.layout?.mode==='HORIZONTAL'&&selected.layout.counterSizing==='AUTO'||selected.layout?.mode==='VERTICAL'&&selected.layout.primarySizing==='AUTO')||
    !part.component?.rootOverrides?.height)return false;
 // When the nested Input is a direct child of the selected root, its parent
 // allocation has an independent captured selected-root row in this path.
 if(route.hop&&route.parentId===route.hop.row.nodeId&&(!size(route.hop.row.size)||!equal(route.hop.row.size,g.parentSize)))return false;
 delete part.component.rootOverrides.height;
 if(!Object.keys(part.component.rootOverrides).length)delete part.component.rootOverrides;
 return true;
}
/** Generated wrapper slots retain defaults; evidence selects exact occurrences.
 * Source mappings are emitted during proposal, never reconstructed from names. */
export function settleNestedPropertyInputs(dump:Record<string,unknown>,fileKey:string|undefined,proposals:Proposal[],protectedIds:ReadonlySet<string>):void{
 if(!fileKey)return;
 const byKey=new Map(proposals.map(p=>[ContractSchema.parse(p.contract).bindings.figma.anchors.componentSetKey,p]));
 const roots=fixedSwapOwnerRoots(Object.values(dump).filter((set):set is DumpSet=>!!set&&typeof set==='object'&&Array.isArray((set as DumpSet).variants)));
 const promoted=new Map<string,string>();
 for(const parentProposal of proposals){
  const source=dump[parentProposal.setName] as DumpSet;
  if(!source?.variants||source.contractId||protectedIds.has(String(parentProposal.contract.id)))continue;
  for(const usage of source.variants.flatMap(nodes)){
   const witnesses=usage.hostOverrides?.flatMap(h=>h.instanceProperties?[h.instanceProperties]:[])??[];
   if(!witnesses.length)continue;
   const fail=(reason:string)=>parentProposal.notes.push(`${parentProposal.setName}: nested-property-input-not-carried — ${reason}`);
   const wrapperProposal=byKey.get(usage.instanceSetKey??usage.instanceKey??null);
   if(!wrapperProposal||wrapperProposal===parentProposal||protectedIds.has(String(wrapperProposal.contract.id))){fail('owner is unavailable or protected');continue;}
   const ownerSet=dump[wrapperProposal.setName] as DumpSet;
   if(ownerSet.contractId){fail('wrapper is stamped');continue;}
   const mains=ownerSet.variants.filter(v=>v.nodeId===usage.instanceGeometry?.componentId&&(v.componentKey??(ownerSet.type==='COMPONENT'?ownerSet.key:undefined))===usage.instanceKey);
   if(mains.length!==1){fail('wrapper selected main identity is incomplete');continue;}
   const wrapper=ContractSchema.parse(wrapperProposal.contract),parent=ContractSchema.parse(parentProposal.contract);
   if(wrapper.bindings.figma.anchors.fileKey!==fileKey||parent.bindings.figma.anchors.fileKey!==fileKey){fail('source file identity disagrees');continue;}
   const isolated=usage.nodeId?isolateCaller(parentProposal,parent,source,usage):undefined;
   const caller=isolated?.part;
   if(!caller?.component||caller.component.id!==wrapper.id){fail('caller source occurrence or complete source tuple is unqualified');continue;}
   const staged=new Map<string,{proposal:Proposal;contract:Contract}>([[wrapper.id,{proposal:wrapperProposal,contract:wrapper}]]);
   const main=mains[0],pending=new Map<string,string>();let valid=true;
   const seen=new Set<string>(),limitations:string[]=[];
   for(const w of witnesses){
    const pathKey=JSON.stringify(w.path);
    if(seen.has(pathKey)||!w.path.length||w.path.length>8||!w.path.every(i=>Number.isSafeInteger(i)&&i>=0)||w.ownerId!==usage.nodeId||w.ownerComponentId!==usage.instanceGeometry?.componentId||w.ownerComponentId!==main.nodeId||w.ownerComponentKey!==usage.instanceKey||w.ownerComponentKey!==(main.componentKey??ownerSet.key)){valid=false;break;}
    seen.add(pathKey);const route=sourceRoute(usage,w,roots),target=route?.node;
    if(!route){valid=false;break;}
    const ownerProposal=route.hop?byKey.get(route.owner.setKey):wrapperProposal;
    if(!ownerProposal||ownerProposal===parentProposal||protectedIds.has(String(ownerProposal.contract.id))||(dump[ownerProposal.setName] as DumpSet)?.contractId){valid=false;break;}
    let owner=staged.get(String(ownerProposal.contract.id))?.contract;
    if(!owner){owner=ContractSchema.parse(ownerProposal.contract);staged.set(owner.id,{proposal:ownerProposal,contract:owner});}
    const destination=selectedCaller(caller,wrapper,owner,route,roots,fileKey);
    if(!destination?.component){valid=false;break;}
    const key=w.componentSetKey??w.componentKey,childProposal=byKey.get(key),childSet=childProposal&&dump[childProposal.setName] as DumpSet|undefined;
    const selectedMatches=childSet?.variants.filter(v=>v.nodeId===w.componentId&&(v.componentKey??(childSet.type==='COMPONENT'?childSet.key:undefined))===w.componentKey);
    const selected=selectedMatches?.length===1?selectedMatches[0]:undefined;
    if(!target?.nodeId||target.type!=='INSTANCE'||(target.instanceSetKey??target.instanceKey)!==key||!selected||!childProposal||childSet?.contractId){valid=false;break;}
    const child=ContractSchema.parse(childProposal.contract),part=sourcePart(ownerProposal,owner,target.nodeId);
    if(child.bindings.figma.anchors.fileKey!==fileKey||!part){valid=false;break;}
    const partIdentity=ownerProposal.sourceInstanceParts?.find(x=>x.nodeId===target.nodeId)?.partKey;
    const routeKey=JSON.stringify([owner.id,partIdentity]);let slot=promoted.get(routeKey)??pending.get(routeKey);
    const fallbackKey='nestedDefault'+partIdentity;
    const originalPart=slot?part.parts?.[fallbackKey]:structuredClone(part);
    // These source-owned presence gates stay on the wrapper slot. They cannot
    // be copied into caller content, where the same prop name has a new scope.
    if(originalPart&&!slot){delete originalPart.visibleWhen;delete originalPart.presenceByCombination;}
    const original=originalPart?.component;
    if(!original||original.id!==child.id||(!slot&&(part.slot||Object.keys(part).some(k=>!['component','layout','parts','visibleWhen','presenceByCombination'].includes(k))||Object.keys(part.layout??{}).some(k=>!['grow','growBasis'].includes(k))))){valid=false;break;}
    if(!callerIndependent(originalPart!,!!route.hop)){valid=false;break;}
    const supplied:Record<string,string|boolean>={},swaps:Array<{slot:string;part:Part}>=[];
    for(const [name,observation]of Object.entries(w.properties)){
     if(observation.type==='INSTANCE_SWAP'){
      // A selected boundary does not need to re-import an unchanged source
      // adornment. Preserve its already emitted defaults and geometry.
      const prior=Object.entries(target.fixedSwaps??{}).filter(([key])=>spelling(key)===spelling(name));
      if(route.hop&&prior.length===1&&typeof observation.value==='string'&&observation.selected?.nodeId===observation.value&&
         prior[0][1].id===observation.value&&typeof observation.selected.componentKey==='string'&&prior[0][1].key===observation.selected.componentKey)continue;
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
     part.parts={[fallbackKey]:originalPart!};pending.set(routeKey,slot);
    }
    const occupied=new Set(walkAnatomy(parent).map(p=>p.name));let callerKey='nestedUsage'+w.path.join('_'),suffix=2;while(occupied.has(callerKey))callerKey='nestedUsage'+w.path.join('_')+suffix++;
    const previous=Object.keys(destination.parts??{});
    const suppliedPart:Part={...structuredClone(originalPart!),component:{...structuredClone(original),props:{...original.props,...supplied}}};
    if(route.hop&&!localizeRootOverrides(suppliedPart,destination.component.props??{},caller.presenceByCombination)){valid=false;break;}
    if(route.hop&&suppliedPart.component?.rootOverrides?.height&&Object.entries(supplied).some(([name,value])=>child.props.some(p=>p.name===name&&p.bindings.figma.kind==='VARIANT')&&original.props?.[name]!==value)){
     if(retireCapturedHugHeight(suppliedPart,target,selected,w,route))limitations.push(`${parentProposal.setName}: nested-property-height-retired — ${w.nodeId} uses its authenticated current HUG height; no fixed height was inferred`);
     else limitations.push(`${parentProposal.setName}: nested-property-size-not-carried — ${w.nodeId} retains its existing height override; typed variant selection is captured, but current nested sizing/height is absent or unqualified`);
    }
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
    if(route.hop&&!rekeyCallerChildren(suppliedPart,callerKey,occupied)){valid=false;break;}
    destination.parts={...destination.parts,[callerKey]:suppliedPart};
    destination.component.contentSlots={...(destination.component.contentSlots??(previous.length?{[destination.component.contentSlot??'children']:previous}:{})),[slot]:[callerKey]};delete destination.component.contentSlot;
    if(!valid)break;
   }
   if(!valid){fail('source identity, property domain or default is incomplete');continue;}
   // Cloning a part may duplicate a single-target control or invalidate a
   // local presence domain. Schema refinements are independent of the
   // cross-contract checks below; commit neither side unless both pass.
   const changed=[parent,...[...staged.values()].map(row=>row.contract)];
   if(changed.some(contract=>!ContractSchema.safeParse(contract).success)){fail('forwarding violates the owner or caller schema');continue;}
   const scope=new Map(proposals.map(p=>{const c=ContractSchema.parse(p.contract);return[c.id,c] as const;})),before:string[]=[],after:string[]=[];
   for(const c of changed)validateContract(scope.get(c.id)!,scope,before,new Map());
   for(const c of changed)scope.set(c.id,c);
   for(const c of changed)validateContract(c,scope,after,new Map());
   if(after.some(e=>!before.includes(e))){fail('forwarding introduces contract validation errors: '+after.filter(e=>!before.includes(e)).join('; '));continue;}
   parentProposal.contract=parent as unknown as Proposal['contract'];parentProposal.sourceInstanceParts=isolated!.sourceParts;
   for(const {proposal,contract}of staged.values())proposal.contract=contract as unknown as Proposal['contract'];
   for(const [k,v]of pending)promoted.set(k,v);
   parentProposal.notes.push(...limitations);
   parentProposal.notes.push(`${parentProposal.setName}: ${witnesses.length} identity-qualified nested property occurrences forwarded with unchanged wrapper defaults; caller-owned child props use existing component slots; live native qualification remains pending`);
  }
 }
}

/** Retain occurrence identity before repeat inference groups equal component names. */
export function nestedPropertySourceNodes(dump:Record<string,unknown>):ReadonlySet<string>{
 const sets=Object.values(dump).filter((x):x is DumpSet=>!!x&&typeof x==='object'&&Array.isArray((x as DumpSet).variants));
 const mains=new Map(sets.flatMap(s=>s.variants.map(v=>[v.nodeId,v] as const))),roots=fixedSwapOwnerRoots(sets),out=new Set<string>();
 for(const set of sets)for(const usage of set.variants.flatMap(nodes))for(const h of usage.hostOverrides??[]){
  const w=h.instanceProperties;if(!w||w.ownerId!==usage.nodeId||w.ownerComponentId!==usage.instanceGeometry?.componentId)continue;
  // Preserve the existing direct-path retention rule. Collection is not
  // authority to forward; settlement independently checks every identity.
  let n=mains.get(w.ownerComponentId);for(const i of w.path){if(!Number.isSafeInteger(i)||i<0||n?.type==='INSTANCE'){n=undefined;break;}n=n?.children?.[i];}
  if(n?.type==='INSTANCE'&&n.nodeId){out.add(n.nodeId);continue;}
  const route=sourceRoute(usage,w,roots);if(route?.node.nodeId)out.add(route.node.nodeId);
 }
 return out;
}

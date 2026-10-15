import {fixedSwapOwnerRoots,fixedSwapVariantOwner} from './fixed-swap-root-allocation.js';
import type {DumpSet,DumpNode} from '../extract/figma/types.js';
import {revisionOf} from './contract-provenance.js';
import {walkAnatomy,resolvePresence,type Contract,type Part} from '../scripts/contract-schema.js';
type Target=NonNullable<DumpNode['textOverrideTargets']>[string];
/** forwardTarget links a fixed instance input to its independently qualified leaf. */
export type CharacterDemand={fileKey:string;target:Target;forwardTarget?:Target};
export type CharacterOwnerDomain={rows:Array<{componentId:string;values:Record<string,string|boolean>;partPath:string[]|null;childPath:number[]|null}>};
export type CharacterBinding={fileKey:string;setKey:string;componentId:string;childPath:number[];prop:string;contractRevision:string;forwarded?:boolean;ownerDomain?:CharacterOwnerDomain};
export function characterDemandsFromDumps(dump:Record<string,unknown>,fileKey:string):CharacterDemand[]{
 const out:CharacterDemand[]=[];
 const visit=(n:DumpNode)=>{for(const [path,target] of Object.entries(n.textOverrideTargets??{}))
  if(typeof n.textOverrides?.[path]==='string'&&!target.instancePath.length)out.push({fileKey,target});
  for(const child of n.children??[])visit(child);};
 for(const value of Object.values(dump))if(value&&typeof value==='object'&&Array.isArray((value as DumpSet).variants))for(const v of (value as DumpSet).variants)visit(v);
 for(const route of nestedCharacterRoutes(dump)){
  out.push({fileKey,target:route.target});
  if(!route.slotProperty)out.push({fileKey,target:route.ownerTarget,forwardTarget:route.target});
 }
 return out;
}
export function demandedCharacterNodes(set:DumpSet,fileKey:string|null|undefined,demands:readonly CharacterDemand[]):Map<string,CharacterDemand[]>{
 const out=new Map<string,CharacterDemand[]>();
 for(const d of demands){const t=d.target,variant=set.variants.find(v=>v.nodeId===t.componentId);if(!variant)continue;
  if(set.contractId||!fileKey||fileKey!==d.fileKey||!set.key||t.instancePath.length||!t.childPath.length||!t.childPath.every(i=>Number.isInteger(i)&&i>=0))throw Error('character-demand-source-identity-unqualified');
  let n:DumpNode|undefined=variant;for(const i of t.childPath){if(n?.type==='INSTANCE')throw Error('character-demand-crosses-instance-owner');n=n?.children?.[i];}
  if(!n?.nodeId||(d.forwardTarget ? n.type!=='INSTANCE'||n.instanceGeometry?.componentId!==d.forwardTarget.componentId||n.nodeId!==d.forwardTarget.instanceId : n.type!=='TEXT'||typeof n.text?.characters!=='string')||t.nodeId!==`I${t.instanceId};${n.nodeId}`)throw Error('character-demand-source-target-unqualified');
  out.set(n.nodeId,[...(out.get(n.nodeId)??[]),d]);
 }return out;
}
function activeCharacterOwners(c:Contract,prop:string,values:Record<string,string|boolean>):string[][]|undefined {
 const active:string[][]=[];let qualified=true;
 const contains=(part:Part):boolean=>part.content?.prop===prop||Object.values(part.parts??{}).some(contains);
 const visit=(part:Part,path:string[],enabled:boolean)=>{
  if(!contains(part))return;
  if(part.stylesWhen?.some(row=>row.styles.display!==undefined)||part.states && Object.values(part.states).some(row=>row.display!==undefined)){qualified=false;return;}
  let on=enabled;
  try{if(!resolvePresence(part,values))on=false;}catch{qualified=false;return;}
  if(part.visibleWhen){const gate=part.visibleWhen,p=c.props.find(p=>p.name===gate.prop);
   if(!p||p.bindings.figma.kind!=='VARIANT'||!Object.hasOwn(values,gate.prop)){qualified=false;return;}
   const value=values[gate.prop];on=on&&(gate.equals===undefined?value===true:(Array.isArray(gate.equals)?gate.equals:[gate.equals]).some(v=>v===value));
  }
  if(on&&part.content?.prop===prop)active.push(path);
  for(const[key,child]of Object.entries(part.parts??{}))visit(child,[...path,key],on);
 };
 for(const[key,root]of Object.entries(c.anatomy))visit(root,[key],true);
 return qualified?active:undefined;
}

/** One shared TEXT input may own disjoint original paths, never two in one
 * source tuple. Source-node ownership and the emitted visibility tree must
 * agree over the entire independently retained drawn domain. */
export function qualifyCharacterOwnerDomain(source:DumpSet,c:Contract,prop:string,
 owners:ReadonlyMap<string,ReadonlySet<Record<string,unknown>>>|undefined):CharacterOwnerDomain|undefined {
 const input=c.props.find(p=>p.name===prop),property=input?.bindings.figma.property;
 if(!owners||!source.key||!source.nodeId||source.contractId||!property||input?.type!=='text'||input.bindings.figma.kind!=='TEXT'||
    c.bindings.figma.anchors.componentSetKey!==source.key||c.bindings.figma.anchors.nodeId!==source.nodeId||!c.bindings.figma.drawnVariants)return;
 const targets=walkAnatomy(c).filter(w=>w.part.content?.prop===prop);
 if(targets.length<2||targets.some(w=>w.part.component||w.part.slot||w.part.repeat||w.part.parts))return;
 const axes=c.props.filter(p=>p.bindings.figma.kind==='VARIANT'),rows:CharacterOwnerDomain['rows']=[],seenIds=new Set<string>(),seenTuples=new Set<string>(),nodeIds=new Set<string>([source.nodeId]);
 for(const main of source.variants){
  if(!main.nodeId||seenIds.has(main.nodeId)||!main.variantProperties||Object.keys(main.variantProperties).length!==axes.length)return;
  seenIds.add(main.nodeId);const values:Record<string,string|boolean>={};
  for(const axis of axes){const raw=main.variantProperties[axis.bindings.figma.property!],mapped=Object.entries(axis.bindings.figma.values??{}).filter(([,v])=>v===raw);
   if(mapped.length!==1)return;const v=mapped[0][0];if(axis.type==='boolean'){if(v!=='true'&&v!=='false')return;values[axis.name]=v==='true';}
   else if(typeof axis.type==='object'&&'enum'in axis.type&&axis.type.enum.includes(v))values[axis.name]=v;else return;
  }
  const tuple=JSON.stringify(Object.entries(values).sort());if(seenTuples.has(tuple))return;seenTuples.add(tuple);
  const native:Array<{node:DumpNode;path:number[]}>=[];let safe=true;
  const visit=(n:DumpNode,path:number[])=>{
   if(!n.nodeId||nodeIds.has(n.nodeId)){safe=false;return;}nodeIds.add(n.nodeId);
   if((n.hidden!==undefined&&n.hidden!==false)||n.propRefs?.visible||n.bound?.visible){
    // Only reject hidden/bound ancestry of a source owner, not unrelated icons.
    const contains=(x:DumpNode):boolean=>x.type==='TEXT'&&x.propRefs?.characters===property||x.type!=='INSTANCE'&&(x.children??[]).some(contains);
    if(contains(n))safe=false;
   }
   if(n.type==='INSTANCE')return;
   if(n.type==='TEXT'&&n.propRefs?.characters===property){if(!n.nodeId||typeof n.text?.characters!=='string'||n.children?.length)safe=false;native.push({node:n,path});}
   for(const[i,child]of(n.children??[]).entries())visit(child,[...path,i]);
  };visit(main,[]);if(!safe||native.length>1)return;
  const visible=activeCharacterOwners(c,prop,values);if(!visible||visible.length!==native.length)return;
  let partPath:string[]|null=null,childPath:number[]|null=null;
  if(native.length){const owned=owners.get(native[0].node.nodeId!);if(!owned||owned.size!==1)return;
   const matches=targets.filter(w=>owned.has(w.part as unknown as Record<string,unknown>));if(matches.length!==1||JSON.stringify(matches[0].path)!==JSON.stringify(visible[0]))return;
   partPath=matches[0].path;childPath=native[0].path;
  }
  rows.push({componentId:main.nodeId,values,partPath,childPath});
 }
 const declared=c.bindings.figma.drawnVariants;
 if(rows.length!==declared.length||declared.some(tuple=>rows.filter(row=>Object.keys(row.values).length===Object.keys(tuple).length&&Object.entries(tuple).every(([k,v])=>row.values[k]===v)).length!==1))return;
 return {rows};
}

function qualifiedSharedCharacterOwner(b:CharacterBinding,c:Contract,t:Target):boolean {
 const rows=b.ownerDomain?.rows,declared=c.bindings.figma.drawnVariants;
 if(!Array.isArray(rows)||!declared||rows.length!==declared.length||Array.from({length:rows.length},(_,i)=>Object.hasOwn(rows,i)).some(v=>!v)||
    rows.some(row=>!row||typeof row.componentId!=='string'||!row.values||typeof row.values!=='object'||Array.isArray(row.values)||
      row.partPath!==null&&(!Array.isArray(row.partPath)||row.partPath.some(k=>typeof k!=='string'))||row.childPath!==null&&(!Array.isArray(row.childPath)||row.childPath.some(k=>!Number.isSafeInteger(k)||k<0)))||
    new Set(rows.map(r=>r.componentId)).size!==rows.length)return false;
 for(const tuple of declared){const matches=rows.filter(row=>Object.keys(row.values).length===Object.keys(tuple).length&&Object.entries(tuple).every(([k,v])=>row.values[k]===v));if(matches.length!==1)return false;
  const row=matches[0],active=activeCharacterOwners(c,b.prop,row.values);if(!active||active.length>1||JSON.stringify(active[0]??null)!==JSON.stringify(row.partPath))return false;
 }
 const target=rows.filter(row=>row.componentId===t.componentId);
 return target.length===1&&target[0].partPath!==null&&JSON.stringify(target[0].childPath)===JSON.stringify(t.childPath);
}
export function characterBindingMatches(b:CharacterBinding,c:Contract,fileKey:string|null|undefined,t:Target):boolean{
 return !!fileKey&&b.fileKey===fileKey&&c.bindings.figma.anchors.fileKey===fileKey&&b.setKey===c.bindings.figma.anchors.componentSetKey&&b.componentId===t.componentId&&!t.instancePath.length&&JSON.stringify(b.childPath)===JSON.stringify(t.childPath)&&b.contractRevision===revisionOf(c)&&c.props.some(p=>p.name===b.prop&&p.type==='text'&&p.bindings.figma.kind==='TEXT')&&(walkAnatomy(c).filter(w=>b.forwarded ? Object.values(w.part.component?.props??{}).some(v=>v==='{'+b.prop+'}') : w.part.content?.prop===b.prop).length===1||!b.forwarded&&qualifiedSharedCharacterOwner(b,c,t));
}

export type NestedCharacterRoute={hostId:string;path:string;ownerKey:string;ownerMain:string;slotProperty?:string;targetKey:string;target:Target;ownerTarget:Target};
/** Resolve one captured instance boundary by numeric paths and source keys.
 * A fixed intermediate becomes a generated text input; swap slots keep their
 * existing caller-content route. Uncaptured intermediates stay unqualified. */
export function nestedCharacterRoutes(dump:Record<string,unknown>):NestedCharacterRoute[]{
 const mains=new Map<string,{set:DumpSet;node:DumpNode}>();
 for(const value of Object.values(dump))if(value&&typeof value==='object'&&Array.isArray((value as DumpSet).variants)){
  const set=value as DumpSet;for(const node of set.variants)if(node.nodeId)mains.set(node.nodeId,{set,node});
 }
 const roots=fixedSwapOwnerRoots(Object.values(dump).filter((value):value is DumpSet=>!!value && typeof value==='object' && Array.isArray((value as DumpSet).variants)));
 const routes:NestedCharacterRoute[]=[];
 const visit=(n:DumpNode)=>{
  const ownerId=n.instanceGeometry?.componentId,owner=ownerId&&mains.get(ownerId);
  for(const [path,t]of Object.entries(n.textOverrideTargets??{})){
   if(!n.nodeId||!owner||!owner.set.key||owner.set.contractId||owner.set.key!==(n.instanceSetKey??n.instanceKey)||typeof n.textOverrides?.[path]!=='string'||!t.instancePath.length||!t.instancePath.every(i=>Number.isSafeInteger(i)&&i>=0))continue;
   let inner:DumpNode|undefined=owner.node;
   for(const i of t.instancePath){if(inner?.type==='INSTANCE'){inner=undefined;break;}inner=inner?.children?.[i];}
   const leaf=mains.get(t.componentId),property=inner?.propRefs?.mainComponent;
   if(!inner?.nodeId||inner.type!=='INSTANCE'||!leaf?.set.key||leaf.set.contractId||t.instanceId!==`I${n.nodeId};${inner.nodeId}`||!t.childPath.length||!t.childPath.every(i=>Number.isSafeInteger(i)&&i>=0))continue;
   const swap=property?n.fixedSwaps?.[property]:undefined;
   const drawn=swap?.observedInstances;
   const selectedOwner=swap&&fixedSwapVariantOwner(swap,roots);
   const selectedKey=selectedOwner ? selectedOwner.setKey : swap?.key;
   const selected=swap?.id===t.componentId&&selectedKey===leaf.set.key&&drawn?.length===1&&
    drawn[0].nodeId===t.instanceId&&drawn[0].componentId===t.componentId&&JSON.stringify(drawn[0].path)===JSON.stringify(t.instancePath);
   const original=inner.instanceGeometry?.componentId===t.componentId&&leaf.set.key===(inner.instanceSetKey??inner.instanceKey)&&
    (!swap||(swap.id===t.componentId&&swap.key===leaf.set.key));
   if(!original&&!selected)continue;
   let text:DumpNode|undefined=leaf.node;
   for(const i of t.childPath){if(text?.type==='INSTANCE'){text=undefined;break;}text=text?.children?.[i];}
   if(text?.type!=='TEXT'||!text.nodeId||typeof text.text?.characters!=='string'||t.nodeId!==`${t.instanceId};${text.nodeId}`)continue;
   routes.push({hostId:n.nodeId,path,ownerKey:owner.set.key,ownerMain:ownerId!,slotProperty:property,targetKey:leaf.set.key,
    ownerTarget:{nodeId:`I${n.nodeId};${inner.nodeId}`,instanceId:n.nodeId,componentId:ownerId!,instancePath:[],childPath:t.instancePath},
    target:{...t,instancePath:[],instanceId:inner.nodeId,nodeId:`I${inner.nodeId};${text.nodeId}`}});
  }
  for(const c of n.children??[])visit(c);
 };
 for(const value of Object.values(dump))if(value&&typeof value==='object'&&Array.isArray((value as DumpSet).variants))for(const v of (value as DumpSet).variants)visit(v);
 return routes;
}

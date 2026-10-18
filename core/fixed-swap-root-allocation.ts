import type { DumpNode, DumpPropertyDefinition, DumpSet } from '../extract/figma/types.js';
import type { Contract } from '../scripts/contract-schema.js';

/** Original component roots, before sanitation or semantic promotion. Duplicate
 * ids remain ambiguous; no arrival-order source can authorize another host. */
export interface FixedSwapOwnerRoot {
  setKey: string;
  setNodeId?: string;
  setType?: DumpSet['type'];
  node: DumpNode;
  propertyDefinitions?: Record<string, DumpPropertyDefinition>;
}
export function fixedSwapOwnerRoots(sets: readonly DumpSet[]): ReadonlyMap<string, readonly FixedSwapOwnerRoot[]> {
  const roots = new Map<string, FixedSwapOwnerRoot[]>();
  for (const set of sets) for (const node of set.variants) {
    if (!set.key || !node.nodeId) continue;
    const rows = roots.get(node.nodeId) ?? [];
    rows.push({setKey: set.key, setNodeId: set.nodeId, setType: set.type, node, propertyDefinitions: set.propertyDefinitions});
    roots.set(node.nodeId, rows);
  }
  return roots;
}

/** A component key selects a variant only when the original captured set owns
 * that exact id/key and supplies every structured axis. Names are not evidence. */
export function fixedSwapVariantOwner(swap: {id: string; key?: string},
  roots: ReadonlyMap<string, readonly FixedSwapOwnerRoot[]> | undefined): FixedSwapOwnerRoot | undefined {
  const rows=roots?.get(swap.id);
  if(!rows || rows.length!==1 || !Object.hasOwn(rows,0) || !rows[0]) return;
  const owner=rows[0],node=owner.node;
  if(owner.setType!=='COMPONENT_SET' || !owner.setNodeId || !owner.setKey ||
      node.type!=='COMPONENT' || node.nodeId!==swap.id || !swap.key || node.componentKey!==swap.key) return;
  const axes=Object.entries(owner.propertyDefinitions??{}).filter(([,definition])=>definition.type==='VARIANT');
  const values=node.variantProperties;
  if(!axes.length || !values || Object.keys(values).length!==axes.length ||
      axes.some(([name,definition])=>definition.type!=='VARIANT' || typeof values[name]!=='string' ||
        !Array.isArray(definition.variantOptions) || !definition.variantOptions.includes(values[name]))) return;
  return owner;
}

/** Select canonical typed values from the owning contract's explicit bindings.
 * A source variant is never treated as a set default or selected by its name. */
export function qualifyFixedSwapVariantSelection(swap: {id: string; key?: string},
  roots: ReadonlyMap<string, readonly FixedSwapOwnerRoot[]> | undefined,
  target: Contract, fileKey: string | undefined): Record<string,string|boolean> | undefined {
  const owner=fixedSwapVariantOwner(swap,roots),anchor=target.bindings.figma.anchors;
  if(!owner || !fileKey || anchor.fileKey!==fileKey || anchor.nodeId!==owner.setNodeId ||
      anchor.componentSetKey!==owner.setKey || target.props.some(p=>p.bindings.figma.kind!=='VARIANT' && p.required && p.default===undefined)) return;
  const axes=Object.keys(owner.node.variantProperties!),props=target.props.filter(p=>p.bindings.figma.kind==='VARIANT');
  if(props.length!==axes.length || new Set(props.map(p=>p.bindings.figma.property)).size!==axes.length) return;
  const selected:Record<string,string|boolean>={};
  for(const property of axes){
    const matches=props.filter(p=>p.bindings.figma.property===property);
    if(matches.length!==1) return;
    const prop=matches[0],raw=owner.node.variantProperties![property];
    const mapped=Object.entries(prop.bindings.figma.values??{}).filter(([,value])=>value===raw);
    if(mapped.length!==1) return;
    const canonical=mapped[0][0];
    if(prop.type==='boolean'){
      if(canonical!=='true' && canonical!=='false') return;
      selected[prop.name]=canonical==='true';
    }else if(typeof prop.type==='object' && 'enum' in prop.type && prop.type.enum.includes(canonical)) selected[prop.name]=canonical;
    else return;
  }
  const agrees=(tuple:Record<string,unknown>)=>Object.entries(tuple).every(([key,value])=>Object.hasOwn(selected,key) && selected[key]===value);
  if(target.bindings.figma.absentVariants?.some(agrees) ||
      target.bindings.figma.drawnVariants && !target.bindings.figma.drawnVariants.some(agrees)) return;
  return selected;
}

const dense = (value: unknown): value is unknown[] => Array.isArray(value) &&
  Array.from({length: value.length}, (_, i) => Object.hasOwn(value, i)).every(Boolean);
const identity = (value: unknown): value is number[][] => dense(value) && value.length === 2 &&
  value.every(row => dense(row) && row.length === 3 && row.every(cell => typeof cell === 'number' && Number.isFinite(cell))) &&
  (value[0] as number[])[0] === 1 && (value[0] as number[])[1] === 0 && (value[1] as number[])[0] === 0 && (value[1] as number[])[1] === 1;
const size = (value: unknown): value is {width: number; height: number} => !!value && typeof value === 'object' &&
  ['width', 'height'].every(key => Object.hasOwn(value, key) && typeof (value as Record<string, unknown>)[key] === 'number' &&
    Number.isFinite((value as Record<string, number>)[key]) && (value as Record<string, number>)[key] >= 0);
const sameSize = (a: unknown, b: unknown) => size(a) && size(b) && a.width === b.width && a.height === b.height;
const propertyName = (name: string) => name.replace(/#.*$/, '');

/** Non-axis selected properties cannot silently borrow another main default. */
export function capturedSelectedDefaultsMatch(properties:Record<string,string|boolean>,target:Contract,
 selected:Record<string,unknown>):boolean {
 if(!properties||typeof properties!=='object'||Array.isArray(properties))return false;
 for(const[property,value]of Object.entries(properties)){
  const matched=target.props.filter(p=>p.bindings.figma.property===propertyName(property));
  if(matched.length!==1)return false;const prop=matched[0],binding=prop.bindings.figma;
  let canonical:string|boolean;
  if(binding.kind==='VARIANT'){
   const values=Object.entries(binding.values??{}).filter(([,raw])=>raw===value);if(values.length!==1)return false;
   if(prop.type==='boolean'){if(!['false','true'].includes(values[0][0]))return false;canonical=values[0][0]==='true';}
   else canonical=values[0][0];
  }else if(binding.kind==='BOOLEAN'&&typeof value==='boolean'||binding.kind==='TEXT'&&typeof value==='string')canonical=value;
  else return false;
  if((selected[prop.name]??prop.default)!==canonical)return false;
 }
 return true;
}

/** Direct selected-slot allocation from the current original instance, not
 * the placeholder main. This bounded door carries the observed cross-axis allocation;
 * a HUG height stays observational and is never emitted as a fixed input.
 * It never invents width/height override fields or responsive authority. */
function qualifyCapturedSelectedRoot(host:DumpNode,property:string,ownerKey:string,targetId:string,targetKey:string,
 roots:ReadonlyMap<string,readonly FixedSwapOwnerRoot[]>|undefined):
 {width:number;height:number;sizing:NonNullable<DumpNode['instanceSizing']>;remainingFields:string[];channels?:Array<'width'|'height'>}|{issue:string}{
 const refuse=(why:string)=>({issue:'selected-root-'+why});
 const swap=host.fixedSwaps?.[property],rows=swap?.observedInstances,row=rows?.[0],proof=row?.selectedRoot;
 const authority=host.instanceRootOverrides,g=host.instanceGeometry;
 if(!host.nodeId||host.type!=='INSTANCE'||!authority||!g||authority.nodeId!==host.nodeId||g.nodeId!==host.nodeId||
    !authority.componentId||g.componentId!==authority.componentId||!identity(g.transform)||!identity(authority.localTransform)||
    JSON.stringify(g.transform)!==JSON.stringify(authority.localTransform)||!size(g.localSize)||
    (authority.localSize!==undefined&&!sameSize(authority.localSize,g.localSize))||
    (host.instanceSetKey??host.instanceKey)!==ownerKey||authority.componentKey!==host.instanceKey||authority.componentSetKey!==host.instanceSetKey)
  return refuse('host-identity');
 const mains=roots?.get(authority.componentId),main=mains?.[0];
 if(!mains||mains.length!==1||!main||main.setKey!==ownerKey||main.node.nodeId!==authority.componentId||main.node.componentKey!==host.instanceKey||main.node.type!=='COMPONENT')return refuse('host-main');
 const definitions=Object.entries(main.propertyDefinitions??{}).filter(([key])=>propertyName(key)===property);
 if(definitions.length!==1||definitions[0][1].type!=='INSTANCE_SWAP')return refuse('host-property');
 if(!swap||swap.id!==targetId||swap.key!==targetKey||!dense(rows)||rows.length!==1||!row||!proof||proof.kind!=='selected-slot-root-v1'||
    proof.hostId!==host.nodeId||proof.hostMainId!==authority.componentId||proof.property!==definitions[0][0]||
    !dense(row.path)||row.path.length!==1||!Number.isSafeInteger(row.path[0])||row.path[0]<0||proof.parentId!==host.nodeId||
    row.componentId!==targetId||proof.componentKey!==targetKey||proof.inFlow!==true||proof.sizeBound!==false||!identity(row.relativeTransform)||!size(row.size)||!sameSize(row.parentSize,g.localSize))return refuse('observation');
 const leaf=main.node.children?.[row.path[0]];
 if(!leaf||leaf.type!=='INSTANCE'||!leaf.nodeId||leaf.propRefs?.mainComponent!==property||row.nodeId!==`I${host.nodeId};${leaf.nodeId}`)return refuse('property-path');
 const targets=roots?.get(targetId),target=targets?.[0];
 if(!targets||targets.length!==1||!target||target.node.type!=='COMPONENT'||target.node.nodeId!==targetId||target.node.componentKey!==targetKey||
    (target.setType==='COMPONENT_SET'?proof.componentSetKey!==target.setKey:proof.componentSetKey!==undefined)||!sameSize(proof.mainSize,target.node.bbox))return refuse('selected-main');
 const sizing=proof.sizing,layout=proof.parentLayout;
 if(!sizing||sizing.horizontal!=='FILL'||!['HUG','FIXED'].includes(sizing.vertical??'')||Object.hasOwn(sizing,'width')||
    (sizing.vertical==='HUG'?Object.hasOwn(sizing,'height'):sizing.height!==row.size.height)||
    proof.layoutGrow!==0||!layout||layout.mode!=='VERTICAL'||!dense(layout.padding)||layout.padding.length!==4||layout.padding.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0)||
    row.size.width!==g.localSize.width-layout.padding[1]-layout.padding[3]||row.relativeTransform[0][2]!==layout.padding[3])return refuse('layout-allocation');
 if(!dense(proof.fields)||proof.fields.some(field=>typeof field!=='string'||!['counterAxisSizingMode','layoutAlign','primaryAxisSizingMode','height','width','layoutGrow'].includes(field)))return refuse('unmodeled-root-field');
 return {width:row.size.width,height:row.size.height,sizing,remainingFields:proof.fields.filter(f=>f!=='width'&&f!=='height'),channels:sizing.vertical==='HUG'?['width']:['width','height']};
}

/** A descendant measurement is not an ordinary instance override. Join it to
 * the exact original owner main and its independently captured root authority.
 * This transports frozen local pixels only, never FILL/HUG or placement. */
export function qualifyFixedSwapRootAllocation(host: DumpNode, property: string,
  ownerSetKey: string, targetId: string, targetKey: string,
  roots: ReadonlyMap<string, readonly FixedSwapOwnerRoot[]> | undefined):
  {width: number; height: number; sizing: NonNullable<DumpNode['instanceSizing']>; remainingFields: string[]; channels?:Array<'width'|'height'>} | {issue: string} {
  if(host.fixedSwaps?.[property]?.observedInstances?.[0]?.selectedRoot!==undefined)
    return qualifyCapturedSelectedRoot(host,property,ownerSetKey,targetId,targetKey,roots);
  const refuse = (issue: string) => ({issue});
  const swap = host.fixedSwaps?.[property], rows = swap?.observedInstances;
  const owner = host.instanceRootOverrides, hostGeometry = host.instanceGeometry;
  if (!host.nodeId || host.type !== 'INSTANCE' || host.instanceSetKey !== ownerSetKey ||
      owner?.nodeId !== host.nodeId || owner.componentSetKey !== ownerSetKey || owner.componentKey !== host.instanceKey ||
      !owner.componentId || hostGeometry?.nodeId !== host.nodeId || hostGeometry.componentId !== owner.componentId ||
      !size(hostGeometry.localSize) || (owner.localSize !== undefined && !sameSize(owner.localSize,hostGeometry.localSize)) ||
      !identity(owner.localTransform) || JSON.stringify(owner.localTransform) !== JSON.stringify(hostGeometry.transform))
    return refuse('host-identity-or-geometry');
  if (!swap || swap.id !== targetId || swap.key !== targetKey || !dense(rows) || rows.length !== 1)
    return refuse('selected-observation-missing-or-ambiguous');
  const row = rows[0] as NonNullable<typeof rows>[number], mains = roots?.get(owner.componentId);
  if (!dense(mains) || mains.length !== 1) return refuse('owner-main-missing-or-ambiguous');
  const main = mains[0] as FixedSwapOwnerRoot;
  const definitions = Object.entries(main.propertyDefinitions ?? {}).filter(([key]) => propertyName(key) === property);
  if (main.setKey !== ownerSetKey || main.node.nodeId !== owner.componentId || main.node.componentKey !== owner.componentKey || main.node.type !== 'COMPONENT' || definitions.length !== 1 || definitions[0][1].type !== 'INSTANCE_SWAP')
    return refuse('owner-property-identity');
  if (!row || row.componentId !== targetId || !dense(row.path) || row.path.length < 1 || row.path.length > 8 ||
      !row.path.every(index => typeof index === 'number' && Number.isSafeInteger(index) && index >= 0) ||
      !identity(row.relativeTransform) || !size(row.size) || !size(row.parentSize) ||
      !row.constraints || !Object.hasOwn(row.constraints,'horizontal') || !Object.hasOwn(row.constraints,'vertical') ||
      !['LEFT','RIGHT','CENTER'].includes(row.constraints.horizontal) || !['TOP','BOTTOM','CENTER'].includes(row.constraints.vertical))
    return refuse('selected-local-allocation');
  let leaf = main.node, parent: DumpNode | undefined;
  for (const index of row.path) {
    if (!dense(leaf.children) || index >= leaf.children.length) return refuse('selected-descendant-path');
    parent = leaf; leaf = leaf.children[index];
  }
  const targetRoots = roots?.get(targetId);
  if (!dense(targetRoots) || targetRoots.length !== 1) return refuse('selected-main-missing-or-ambiguous');
  const targetMain = targetRoots[0] as FixedSwapOwnerRoot;
  if (targetMain.setKey !== targetKey || targetMain.node.nodeId !== targetId || targetMain.node.componentKey !== targetKey || targetMain.node.type !== 'COMPONENT')
    return refuse('selected-main-identity');
  const w = leaf.instanceRootOverrides, g = leaf.instanceGeometry;
  if (!leaf.nodeId || row.nodeId !== `I${host.nodeId};${leaf.nodeId}` || leaf.type !== 'INSTANCE' ||
      leaf.instanceKey !== targetKey || leaf.instanceSetKey !== undefined || leaf.propRefs?.mainComponent !== property ||
      w?.nodeId !== leaf.nodeId || w.componentId !== targetId || w.componentKey !== targetKey || w.componentSetKey !== undefined ||
      g?.nodeId !== leaf.nodeId || g.componentId !== targetId || leaf.abs || leaf.bound?.width || leaf.bound?.height ||
      !dense(w.fields) || !w.fields.every(field => typeof field === 'string') || !['width', 'height'].every(field => w.fields.includes(field)) ||
      !sameSize(row.size, w.localSize) || !sameSize(row.size, g.localSize) || !sameSize(w.mainSize, targetMain.node.bbox) ||
      !identity(w.localTransform) || JSON.stringify(row.relativeTransform) !== JSON.stringify(w.localTransform) ||
      JSON.stringify(g.transform) !== JSON.stringify(w.localTransform) || (parent?.bbox !== undefined && !sameSize(row.parentSize, parent.bbox)))
    return refuse('selected-root-authority-or-join');
  const sizing = leaf.instanceSizing;
  if (!sizing || typeof sizing.horizontal !== 'string' || typeof sizing.vertical !== 'string' || !['FIXED', 'HUG', 'FILL'].includes(sizing.horizontal) || !['FIXED', 'HUG', 'FILL'].includes(sizing.vertical))
    return refuse('selected-sizing-unobserved');
  if (['width','height'].some((channel,i) => {
    const axis = i === 0 ? sizing.horizontal : sizing.vertical, value = sizing[channel as 'width'|'height'];
    return axis === 'FIXED' ? typeof value !== 'number' || !Number.isFinite(value) || value !== row.size![channel as 'width'|'height'] : Object.hasOwn(sizing,channel);
  })) return refuse('selected-sizing-dimension-conflict');
  return {width: row.size.width, height: row.size.height, sizing,
    remainingFields: w.fields.filter(field => field !== 'width' && field !== 'height')};
}

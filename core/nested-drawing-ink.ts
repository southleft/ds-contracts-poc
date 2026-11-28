import type {DumpNode,DumpSet,DumpHostOverride} from '../extract/figma/types.js';
import {walkAnatomy,type Contract,type Part} from '../scripts/contract-schema.js';
import {canonicalJson,revisionOf} from './contract-provenance.js';

export type DrawingInkOwner={nodeId:string;childPath:number[];partPath:string[]};
export type DrawingInkContext={contractRevision:string;sourceFileKey:string;sourceKey:string;sourceNodeId:string;drawingInk?:DrawingInkOwner};

const placement=new Set(['position','left','right','top','bottom','width','height','overflow-x','overflow-y']);
function passiveInkPart(part:Part,leaf=false):boolean{
 return !Object.entries(part).some(([k,v])=>v!==undefined&&!(leaf?['shape','tokens','literals','declared','absoluteGeometry']:['parts','layout','tokens','literals','declared','absoluteGeometry']).includes(k))&&
  Object.keys(part.tokens??{}).every(k=>placement.has(k)||(leaf&&k==='background-color'))&&
  Object.keys(part.declared??{}).every(k=>placement.has(k))&&
  Object.keys(part.literals??{}).every(k=>placement.has(k)||(leaf&&k==='background-color'));
}

/** A declared color input can reach one path through passive containers.
 * This proves only inherited ink, never resize or transform authority. */
export function inheritedNestedDrawingInk(root:Part):Part|undefined{
 if(root.text!==undefined||root.shape||[root.declared,root.literals,...Object.values(root.states??{})].some(styles=>
    Object.entries(styles??{}).some(([key,value])=>key!=='color'&&/currentcolor/i.test(String(value)))))return;
 let part=root;
 for(let depth=1;depth<=8;depth++){
  const children=Object.values(part.parts??{});if(children.length!==1)return;
  part=children[0];
  const leaf=part.shape?.kind==='path'&&part.literals?.['background-color']==='currentColor';
  if(!passiveInkPart(part,leaf)||leaf&&Object.keys(part.tokens??{}).some(k=>!placement.has(k)))return;
  if(leaf)return depth>1?part:undefined;
 }
}

/** A single native drawing behind nonpainting GROUP or FRAME wrappers may expose ink.
 * Source object identity locates the leaf; names and geometry grant no authority.
 * The wrappers remain intact and this never grants a size or transform input. */
export function promoteNestedDrawingInk(root:Part,set:DumpSet,owners:ReadonlyMap<string,ReadonlySet<object>>|undefined):DrawingInkOwner|undefined{
 if(set.type!=='COMPONENT'||set.variants.length!==1||!set.nodeId||set.variants[0].nodeId!==set.nodeId||
    root.tokens?.color||root.literals?.color||root.declared?.color||root.shape||root.text||!owners)return;
 let source=set.variants[0],part=root;const childPath:number[]=[],seen=new Set<string>();
 while(source.children?.length===1&&Object.keys(part.parts??{}).length===1){
  source=source.children[0];part=Object.values(part.parts!)[0];childPath.push(0);
  if(childPath.length>8||!source.nodeId||seen.has(source.nodeId)||owners.get(source.nodeId)?.size!==1||!owners.get(source.nodeId)?.has(part))return;
  seen.add(source.nodeId);
  if(part.literals?.color||part.declared?.color)return;
  if(source.type==='VECTOR')break;
  if(!['GROUP','FRAME'].includes(source.type)||source.fill||source.stroke||source.text||source.imageFill||!passiveInkPart(part))return;
 }
 if(childPath.length<2||source.type!=='VECTOR'||source.children?.length||source.stroke||part.shape?.kind!=='path'||
    !source.sourceStrokeStack?.complete||source.sourceStrokeStack.paints.length||
    Object.entries(part).some(([k,v])=>v!==undefined&&!['shape','tokens','literals','declared','absoluteGeometry'].includes(k))||
    Object.keys(part.tokens??{}).length!==1||!part.tokens?.['background-color']||part.literals?.['background-color']||part.declared?.['background-color'])return;
 const rows=walkAnatomy({anatomy:{root}} as unknown as Contract).filter(row=>row.part===part);
 if(rows.length!==1)return;
 const owner={nodeId:source.nodeId!,childPath,partPath:rows[0].path};
 (root.tokens??={}).color=part.tokens['background-color'];delete part.tokens['background-color'];
 part.literals={...part.literals,'background-color':'currentColor'};
 root.overridable=[...new Set([...(root.overridable??[]),'color'])];
 return owner;
}

/** Only the exact captured leaf in this exact child revision accepts the
 * caller's paint. Source group layout stays entirely child-owned. */
export function nestedDrawingInkTarget(node:DumpNode,child:Contract,context:DrawingInkContext|undefined,fileKey:string|null|undefined):DumpHostOverride|undefined{
 const owner=context?.drawingInk,anchor=child.bindings.figma.anchors;
 if(!owner||!fileKey||context.sourceFileKey!==fileKey||anchor.fileKey!==fileKey||
    context.contractRevision!==revisionOf(child)||context.sourceKey!==anchor.componentSetKey||context.sourceNodeId!==anchor.nodeId||
    (node.instanceSetKey??node.instanceKey)!==context.sourceKey||!node.nodeId||node.hostOverrides?.length!==1||
    !child.anatomy.root.overridable?.includes('color'))return;
 const h=node.hostOverrides[0],t=h.solidFillTarget;
 if(!t||t.instanceId!==node.nodeId||t.componentId!==anchor.nodeId||t.instancePath.length||
    canonicalJson(t.childPath)!==canonicalJson(owner.childPath)||t.nodeId!==`I${node.nodeId};${owner.nodeId}`||
    !h.fields.includes('fills')||h.fields.some(f=>!['fills','fillStyleId'].includes(f)))return;
 const rows=walkAnatomy(child).filter(row=>canonicalJson(row.path)===canonicalJson(owner.partPath));
 if(rows.length!==1||rows[0].part.shape?.kind!=='path'||rows[0].part.literals?.['background-color']!=='currentColor')return;
 return h;
}

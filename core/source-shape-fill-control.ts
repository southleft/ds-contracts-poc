import type {DumpSet,DumpHostOverride,DumpNode} from '../extract/figma/types.js';
import {revisionOf} from './contract-provenance.js';
import {SolidFillCompositionSchema,walkAnatomy,type Contract} from '../scripts/contract-schema.js';
export type ShapeFillDemand={fileKey:string;target:NonNullable<DumpHostOverride['shapeFillTarget']>;color:string};
export type ShapeFillBinding={fileKey:string;setKey:string;componentId:string;childPath:number[];prop:string;contractRevision:string};
export function shapeFillDemandsFromDumps(dump:Record<string,unknown>,fileKey:string):ShapeFillDemand[]{
 const out:ShapeFillDemand[]=[];const visit=(n:DumpNode)=>{for(const h of n.hostOverrides??[])if(h.shapeFillTarget){
  const color=shapeFillValue(h);if(color===undefined)continue;
  // Nested host overrides have no direct caller-to-child route. Keep them
  // on hostOverrides for the named fidelity report; do not let an unsupported
  // caller demand prevent the independently captured main from proposing.
  // demandedShapeFillNodes still refuses nested targets supplied as authority.
  if(h.shapeFillTarget.instancePath.length)continue;
  out.push({fileKey,target:h.shapeFillTarget,color});
 }for(const c of n.children??[])visit(c);};
 for(const value of Object.values(dump))if(value&&typeof value==='object'&&Array.isArray((value as DumpSet).variants))for(const v of (value as DumpSet).variants)visit(v);return out;
}
export function demandedShapeFillNodes(set:DumpSet,fileKey:string|null|undefined,demands:readonly ShapeFillDemand[]):Map<string,ShapeFillDemand[]>{
 const out=new Map<string,ShapeFillDemand[]>();for(const d of demands){const t=d.target,variant=set.variants.find(v=>v.nodeId===t.componentId);if(!variant)continue;
 if(set.contractId||!fileKey||fileKey!==d.fileKey||!set.key||t.instancePath.length||!t.childPath.length||!t.childPath.every(i=>Number.isInteger(i)&&i>=0))throw Error('shape-fill-demand-source-identity-unqualified');
 let n:DumpNode|undefined=variant;for(const i of t.childPath){if(n?.type==='INSTANCE')throw Error('shape-fill-demand-crosses-instance-owner');n=n?.children?.[i];}
 if(!n?.nodeId||!['FRAME','RECTANGLE','ELLIPSE'].includes(n.type??'')||t.nodeId!==`I${t.instanceId};${n.nodeId}`)throw Error('shape-fill-demand-source-target-unqualified');
 // An identical mask paint is already carried by its captured mask anatomy.
 // Do not manufacture a normal-shape input for it; differing mask paint still
 // requires its own qualified channel and must not silently become a no-op.
 if(n.mask){
  const observed=shapeFillValue({path:'',fields:['fills'],fill:n.fill,sourceNormalFillComposition:n.sourceNormalFillComposition});
  if(observed===d.color)continue;
  throw Error('shape-fill-demand-mask-paint-change-unqualified');
 }
 out.set(n.nodeId,[...(out.get(n.nodeId)??[]),d]);}return out;
}
export function shapeFillBindingMatches(b:ShapeFillBinding,c:Contract,fileKey:string|null|undefined,t:NonNullable<DumpHostOverride['shapeFillTarget']>):boolean{
 return !!fileKey&&b.fileKey===fileKey&&c.bindings.figma.anchors.fileKey===fileKey&&b.setKey===c.bindings.figma.anchors.componentSetKey&&b.componentId===t.componentId&&!t.instancePath.length&&JSON.stringify(b.childPath)===JSON.stringify(t.childPath)&&b.contractRevision===revisionOf(c)&&walkAnatomy(c).filter(w=>w.part.shapeFillOverrideProp===b.prop).length===1;
}

/** Use the independently captured float paint; a rounded legacy hex alone is not authority. */
export function shapeFillValue(h:DumpHostOverride):string|undefined {
 if(h.sourceEmptyFill===true)return !h.fill&&!h.sourceNormalFillComposition?'rgba(0,0,0,0)':undefined;
 const source=h.sourceNormalFillComposition;if(!source||!('paint' in source))return;
 const parsed=SolidFillCompositionSchema.safeParse(source.paint);if(!parsed.success||parsed.data.blendMode!=='NORMAL')return;
 const {color:c,opacity:a}=parsed.data;
 const hex=[c.r,c.g,c.b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
 if(h.fill?.hex?.toLowerCase()!==hex||(h.fill.alpha??1)!==a)return;
 return `rgba(${c.r*255},${c.g*255},${c.b*255},${a})`;
}

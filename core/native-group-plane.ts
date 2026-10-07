import {projectAffineFilledPath} from './affine-filled-path.js';
import type {DumpNode,DumpSet} from '../extract/figma/types.js';

type ProjectedNode=DumpNode & {__nativeGroupCoordinateOwner?:true};
/** A GROUP has no native layout/constraints plane. Its descendants use the
 * containing frame. Use a transparent full-container target wrapper, explicitly
 * synthetic, while each descendant retains its actual native constraints. */
export function projectNativeGroupPlanes(input:DumpSet):{set:DumpSet;notes:string[]} {
 // Browser-importable clone: keep malformed primitive facts intact and do not
 // depend on Node globals or structuredClone in the plugin engine sandbox.
 const clone=(v:unknown):unknown=>Array.isArray(v)?v.map(clone):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,value])=>[k,clone(value)])):v;
 const set=clone(input) as DumpSet,notes:string[]=[];
 const identity=(m:unknown):m is number[][]=>Array.isArray(m)&&m.length===2&&m.every(row=>Array.isArray(row)&&row.length===3&&row.every(n=>typeof n==='number'&&Number.isFinite(n)))&&m[0][0]===1&&m[0][1]===0&&m[1][0]===0&&m[1][1]===1;
 const positive=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>0;
 const close=(a:number,b:number)=>Math.abs(a-b)<.0001;
 const visit=(node:ProjectedNode,parent:DumpNode|undefined,path:string):void=>{
  delete node.__nativeGroupCoordinateOwner;
  const proof=node.nativeContainerPlane;
  if(node.shape?.affineTransform && (parent?.type!=='GROUP'||!parent.nativeContainerPlane))throw Error(`native-group-plane-unqualified:${path}:affine-path-owner-missing`);
  if(node.type!=='GROUP'||!proof){for(const child of node.children??[])visit(child,node,`${path}/${child.name}`);return;}
  const refuse=(reason:string):never=>{throw Error(`native-group-plane-unqualified:${path}:${reason}`);};
  const validate=(n:DumpNode,allowAffine=false)=>{
   const finite=(m:unknown):m is number[][]=>Array.isArray(m)&&m.length===2&&m.every(row=>Array.isArray(row)&&row.length===3&&row.every(n=>typeof n==='number'&&Number.isFinite(n)));
   const p=n.nativeContainerPlane;
   if(!p||p.issue||!p.nodeId||!p.containerId||!p.parentId||!positive(p.size?.width)||!positive(p.size?.height)||!positive(p.containerSize?.width)||!positive(p.containerSize?.height)||!finite(p.relativeTransform)||!finite(p.absoluteTransform)||!allowAffine&&(!identity(p.relativeTransform)||!identity(p.absoluteTransform))||!identity(p.containerAbsoluteTransform))return refuse('native-affine-basis-missing-or-nonidentity');
   if(allowAffine && (!n.shape?.affineTransform || JSON.stringify(n.shape.affineTransform)!==JSON.stringify(p.relativeTransform) || ![0,1].every(i=>[0,1].every(j=>(p.absoluteTransform as number[][])[i][j]===(p.relativeTransform as number[][])[i][j]))))refuse('affine-path-basis-inconsistent');
   if(!close(p.absoluteTransform[0][2],p.containerAbsoluteTransform[0][2]+p.relativeTransform[0][2])||!close(p.absoluteTransform[1][2],p.containerAbsoluteTransform[1][2]+p.relativeTransform[1][2]))return refuse('native-affine-basis-inconsistent');
   return p as typeof p & {size:{width:number;height:number};containerSize:{width:number;height:number};relativeTransform:number[][]};
  };
  const p=validate(node),width=p.containerSize.width,height=p.containerSize.height;
  if(!parent||!['GROUP','FRAME','COMPONENT','INSTANCE'].includes(parent.type??''))refuse('container-owner-unqualified');
  if(parent!.type==='GROUP'){
   if(parent!.nativeContainerPlane?.nodeId!==p.parentId||parent!.nativeContainerPlane?.containerId!==p.containerId)refuse('group-parent-identity-mismatch');
  }else if(p.parentId!==p.containerId||p.containerType!==parent!.type)refuse('frame-parent-identity-mismatch');
  const parentWidth=parent!.bbox?.width??parent!.fixedSize?.width,parentHeight=parent!.bbox?.height??parent!.fixedSize?.height;
  if(parentWidth===undefined||parentHeight===undefined||!close(parentWidth,width)||!close(parentHeight,height))refuse('container-size-mismatch');
  if(p.constraints!==undefined||node.layout||node.bound&&Object.keys(node.bound).length||node.fill||node.stroke||node.gradient||node.imageFill||node.mask||node.opacity!==undefined&&node.opacity!==1||node.effects?.length)refuse('group-paint-or-layout-owner-unqualified');
  if(!node.children?.length)refuse('group-children-missing');
  for(const child of node.children!){
   const cp=validate(child,!!child.shape?.affineTransform);
   if(cp.parentId!==p.nodeId||cp.containerId!==p.containerId||!close(cp.containerSize.width,width)||!close(cp.containerSize.height,height)||JSON.stringify(cp.containerAbsoluteTransform)!==JSON.stringify(p.containerAbsoluteTransform))refuse('child-container-identity-mismatch');
   if(child.type==='GROUP')continue;
   if(!child.shape||child.shape.rotation||child.bound&&Object.keys(child.bound).some(k=>['width','height','x','y'].includes(k))||!close(child.shape.width,cp.size.width)||!close(child.shape.height,cp.size.height))refuse('child-outline-or-size-owner-unqualified');
   const c=cp.constraints as {horizontal?:string;vertical?:string}|undefined;
   const horizontal={MIN:'LEFT',MAX:'RIGHT',CENTER:'CENTER',STRETCH:'STRETCH',SCALE:'SCALE'} as const,vertical={MIN:'TOP',MAX:'BOTTOM',CENTER:'CENTER',STRETCH:'STRETCH',SCALE:'SCALE'} as const;
   if(!c?.horizontal||!c.vertical||!Object.hasOwn(horizontal,c.horizontal)||!Object.hasOwn(vertical,c.vertical))refuse('child-native-constraints-missing');
   let projected;
   const shape=child.shape!;
   if(shape.affineTransform){
    if(shape.kind!=='path'||!shape.paths||child.mask||child.stroke||child.gradient||child.imageFill||child.effects?.length)refuse('affine-path-paint-owner-unqualified');
    projected=projectAffineFilledPath({width:cp.size.width,height:cp.size.height,paths:shape.paths!,transform:shape.affineTransform});
   }
   const x=projected?.x??cp.relativeTransform[0][2],y=projected?.y??cp.relativeTransform[1][2];
   const box={x,y,width:projected?.width??cp.size.width,height:projected?.height??cp.size.height,right:width-x-(projected?.width??cp.size.width),bottom:height-y-(projected?.height??cp.size.height),constraints:{horizontal:horizontal[c!.horizontal as keyof typeof horizontal],vertical:vertical[c!.vertical as keyof typeof vertical]}};
   child.abs=box;child.shape={...child.shape!,...(projected?{paths:projected.paths}:{}),...box};delete child.shape.affineTransform;
  }
  // This box is the target wrapper, not the source GROUP's native bounds.
  node.abs={x:0,y:0,width,height,right:0,bottom:0,constraints:{horizontal:'STRETCH',vertical:'STRETCH'}};
  node.bbox={width,height};node.__nativeGroupCoordinateOwner=true;
  notes.push(`${path}: native GROUP descendants project into observed containing frame ${p.containerId}; transparent full-container wrapper is a synthetic target coordinate owner, not source GROUP constraints. Original GROUP bounds and affine evidence remain in the input dump.`);
  for(const child of node.children!)visit(child,node,`${path}/${child.name}`);
 };
 for(const variant of set.variants)visit(variant,undefined,`${set.setName}/${variant.name}`);
 return{set,notes};
}

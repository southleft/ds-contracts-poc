import type {DumpNode} from '../extract/figma/types.js';
import {allocateInstanceAffine,type InstanceAffineObservation} from '../packages/schema/src/instance-affine.js';
import {filledPathRigidRotation} from '../packages/schema/src/rigid-filled-path.js';

type Plane = {node:DumpNode;box:DumpNode['abs'];affine:InstanceAffineObservation;transformed:boolean;fill:{width:boolean;height:boolean}};
// Only nodes produced by this module can carry a projection. A JSON field in
// an imported dump cannot opt out of the ordinary source/owner guards.
const planes = new WeakMap<DumpNode,Plane>();
export const projectedLocalLayoutPlane = (node:DumpNode) => planes.get(node);
export function hasLocalLayout(node:DumpNode):boolean {
  const pending=[{node,depth:0}];let count=0;
  while(pending.length){const row=pending.pop()!;
    if(++count>512||row.depth>32||row.node.layout)return true;
    for(const child of row.node.children??[])pending.push({node:child,depth:row.depth+1});
  }
  return false;
}
const identity = (m:number[][]) => m[0][0]===1 && m[0][1]===0 && m[1][0]===0 && m[1][1]===1;

/** Normalize a bounded mixed layout tree in each node's captured parent plane.
 * Flow stays flow; only an observed absolute allocation is positioned. Layouts
 * and keyed instances retain their normal compiler paths. Neither world bounds
 * nor missing vector outlines supply geometry here. */
export function projectLocalLayoutPlane(node:DumpNode,parentId:string|undefined,parentSize?:{width:number;height:number}):Plane {
  const refuse:(reason:string)=>never=(reason)=>{throw Error(`local-frame-plane-unqualified:${reason}`);};
  let count=0;
  function project(n:DumpNode,owner:string|undefined,size:{width:number;height:number}|undefined,depth:number):DumpNode {
    if(++count>512||depth>32)refuse('subtree-limit');
    const g=n.localGeometry;
    if(!g||!n.nodeId||g.nodeId!==n.nodeId||!owner||g.parentId!==owner||owner===n.nodeId)refuse('node-parent-identity');
    if(!g.parentSize||![g.parentSize.width,g.parentSize.height].every(v=>Number.isFinite(v)&&v>0)||
      size&&(g.parentSize.width!==size.width||g.parentSize.height!==size.height))refuse('parent-size');
    const allocated=allocateInstanceAffine(g);if('issue'in allocated)refuse(allocated.issue);
    if(n.mask||n.maskFramePlane||n.maskedFramePlane||n.bound?.width||n.bound?.height||n.targetAspectRatio!==undefined)refuse('competing-layout');
    if(n.abs&&(n.fillWidth||n.fillHeight))refuse('absolute-fill');
    if(!['FRAME','RECTANGLE','ELLIPSE','VECTOR','INSTANCE'].includes(n.type))refuse('descendant-kind');
    if(n.layout){
      const l=n.layout;
      if(!['HORIZONTAL','VERTICAL'].includes(l.mode)||l.wrap||l.grid||
        !['MIN','CENTER','MAX','SPACE_BETWEEN'].includes(l.primary??'')||!['MIN','CENTER','MAX','BASELINE'].includes(l.counter??'')||
        !Number.isFinite(l.spacing)||!Array.isArray(l.padding)||l.padding.length!==4||!l.padding.every(Number.isFinite)||
        !['AUTO','FIXED'].includes(l.primarySizing)||!['AUTO','FIXED'].includes(l.counterSizing))refuse('layout-source');
    }
    if(n.type==='INSTANCE'){
      const i=n.instanceGeometry;
      if(!n.instanceOf||!n.instanceKey||!i||i.nodeId!==n.nodeId||!i.componentId||
        JSON.stringify(i.localSize)!==JSON.stringify(g.localSize)||JSON.stringify(i.transform)!==JSON.stringify(g.transform)||
        n.children?.length||n.instanceComposition)refuse('instance-source');
    }else if(n.instanceOf||n.instanceGeometry)refuse('owner-kind');
    if(n.type==='FRAME'&&n.shape||n.type!=='FRAME'&&n.type!=='INSTANCE'&&(n.children?.length||n.layout))refuse('descendant-geometry');
    if(n.shape?.kind==='path'){
      if(filledPathRigidRotation(g.transform)!==(n.shape.rotation??0))
        refuse('path-rotation-source');
    }else if(n.shape?.rotation)refuse('descendant-geometry');
    if(n.shape?.kind==='path'&&(n.shape.width!==g.localSize.width||n.shape.height!==g.localSize.height))refuse('path-local-size');
    const transformed=!identity(g.transform);
    if(transformed&&n.type==='FRAME'&&(n.fillWidth||n.fillHeight)&&g.transform.some(row=>row.slice(0,2).some(v=>Math.abs(v-Math.round(v))>1e-6)))refuse('transformed-fill');
    const a=allocated.allocation.allocation;
    const prior=n.abs??n.shape;
    if(n.abs&&!n.abs.constraints)refuse('missing-constraints');
    let box=n.abs?{x:a.left,y:a.top,width:a.width,height:a.height,
      right:g.parentSize.width-a.left-a.width,bottom:g.parentSize.height-a.top-a.height,
      constraints:structuredClone(n.abs.constraints)}:undefined;
    if(box&&n.shape?.kind==='path'){
      const [[aa,c,tx],[b,d,ty]]=g.transform,w=g.localSize.width,h=g.localSize.height;
      const x=tx+aa*w/2+c*h/2-w/2,y=ty+b*w/2+d*h/2-h/2;
      box={...box,x,y,width:w,height:h,right:g.parentSize.width-x-w,bottom:g.parentSize.height-y-h};
    }
    const {children:_children,...own}=n;
    const out:DumpNode=structuredClone(own);
    // A bbox on an auto-layout frame means an existing size carrier to the
    // ordinary proposer. Do not add one and accidentally suppress its FIXED
    // axis token, or turn an independent HUG axis into a fixed extent.
    if(n.bbox||!n.layout)out.bbox={...g.localSize};
    if(box)out.abs=box;
    if(out.fixedSize)out.fixedSize={...(out.fixedSize.width!==undefined?{width:g.localSize.width}:{}),...(out.fixedSize.height!==undefined?{height:g.localSize.height}:{})};
    if(out.shape&&['rect','ellipse'].includes(out.shape.kind)){
      if(!identity(g.transform))refuse('shape-transform');
      out.shape={...out.shape,x:a.left,y:a.top,width:g.localSize.width,height:g.localSize.height,
        right:g.parentSize.width-a.left-a.width,bottom:g.parentSize.height-a.top-a.height,
        ...(prior?.constraints?{constraints:structuredClone(prior.constraints)}:{})};
    }
    if(n.children)out.children=n.children.map(child=>project(child,n.nodeId,g.localSize,depth+1));
    if(n.type==='FRAME'){
      const body={...out,fixedSize:{...g.localSize}};delete body.abs;
      // Shared descendants keep their private identities through ordinary
      // merge/owner resolution; the raw source tree is never rewritten.
      planes.set(out,{node:body,box,affine:{localSize:{...g.localSize},transform:allocated.allocation.normalizedTransform},transformed,fill:{width:n.fillWidth===true,height:n.fillHeight===true}});
    }
    return out;
  }
  if(node.type!=='FRAME'||node.propRefs?.visible||node.bound?.visible)refuse('owner-kind');
  const projected=project(node,parentId,parentSize,0);
  return planes.get(projected)!;
}

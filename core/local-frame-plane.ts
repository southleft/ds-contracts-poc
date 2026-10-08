import type {DumpNode} from '../extract/figma/types.js';
import {allocateInstanceAffine} from '../packages/schema/src/instance-affine.js';

const identity = (m: number[][]) => Array.isArray(m) && m.length === 2 && m.every(row => Array.isArray(row) && row.length === 3 && row.every(Number.isFinite)) && m[0][0] === 1 && m[0][1] === 0 && m[1][0] === 0 && m[1][1] === 1;
export function hasRotatedLocalFrame(node: DumpNode): boolean {
  return node.type === 'FRAME' && !!node.localGeometry && !identity(node.localGeometry.transform);
}

/** Re-express a free frame and its descendants in their independently observed
 * parent planes. World bounding boxes are never inverse-rotated or guessed.
 * The caller owns the outer allocation and the frame's affine transform. */
export function projectLocalFramePlane(node: DumpNode, parentId: string | undefined, parentSize?: {width:number;height:number}) {
  const refuse = (reason: string): never => { throw Error(`local-frame-plane-unqualified:${reason}`); };
  if (node.type !== 'FRAME') refuse('owner-kind');
  if (node.propRefs?.visible || node.bound?.visible) refuse('live-owner-visibility');
  let count = 0;
  function project(n: DumpNode, owner: string | undefined, parentSize?: {width:number;height:number}, depth = 0): DumpNode {
    if (++count > 512 || depth > 32) refuse('subtree-limit');
    const g = n.localGeometry;
    if (!g || !n.nodeId || g.nodeId !== n.nodeId || !owner || g.parentId !== owner || owner === n.nodeId)
      return refuse('node-parent-identity');
    if (!g.parentSize || ![g.parentSize.width,g.parentSize.height].every(v => Number.isFinite(v) && v > 0) ||
        parentSize && (g.parentSize.width !== parentSize.width || g.parentSize.height !== parentSize.height))
      refuse('parent-size');
    const allocated = allocateInstanceAffine(g);
    if ('issue' in allocated) return refuse(allocated.issue);
    if (n.mask || n.maskFramePlane || n.maskedFramePlane || n.instanceOf || n.layout || n.fillWidth || n.fillHeight ||
        n.bound?.width || n.bound?.height || n.targetAspectRatio !== undefined)
      refuse('competing-layout');
    const frame = n.type === 'FRAME';
    if (!frame && !['RECTANGLE','ELLIPSE'].includes(n.type)) refuse('descendant-kind');
    if (frame && n.shape || !frame && (n.children?.length || !identity(g.transform) || !n.shape ||
        !['rect','ellipse'].includes(n.shape.kind) || n.shape.rotation)) refuse('descendant-geometry');
    const previous = frame ? n.abs : n.shape;
    if (!previous?.constraints) refuse('missing-constraints');
    const a = allocated.allocation.allocation;
    const box = {x:a.left,y:a.top,width:a.width,height:a.height,
      right:g.parentSize.width-a.left-a.width,bottom:g.parentSize.height-a.top-a.height,
      constraints:structuredClone(previous!.constraints!)};
    const out: DumpNode = {...structuredClone(n),bbox:{...g.localSize}};
    // Replaced in local coordinates, including unrotated descendants whose
    // old reader dimensions were contaminated by an ancestor's rotation.
    if (frame) out.abs = box;
    else {out.shape = {...out.shape!,...box,width:g.localSize.width,height:g.localSize.height};delete out.abs;}
    if (out.fixedSize) out.fixedSize = {...g.localSize};
    if (n.children) out.children = n.children.map(child => project(child,n.nodeId,g.localSize,depth+1));
    return out;
  }
  const projected = project(node,parentId,parentSize);
  const g = projected.localGeometry!;
  const allocation = allocateInstanceAffine(g);
  if ('issue' in allocation) return refuse(allocation.issue);
  const box = projected.abs!;
  delete projected.abs;
  projected.fixedSize = {...g.localSize};
  return {node:projected,box,affine:{localSize:{...g.localSize},transform:allocation.allocation.normalizedTransform}};
}

import type {RestNode} from './map.js';
import {filledPathIssue} from '../../../scripts/contract-schema.js';

/** White MULTIPLY preserves RGB only over an opaque backdrop; it still adds
 * source alpha on transparent backing. Flatten only exactly transparent paints.
 * Native Scratch controls at 0.5 and 1 change 336/400 pixels over black. */
export function neutralVectorWrapperPaint(paint: NonNullable<RestNode['fills']>[number]): boolean {
  const opacity = paint.opacity ?? 1;
  const alpha = paint.color?.a ?? 1;
  return paint.type === 'SOLID' && paint.blendMode === 'MULTIPLY' &&
    paint.color?.r === 1 && paint.color.g === 1 && paint.color.b === 1 &&
    Number.isFinite(opacity) && opacity >= 0 && opacity <= 1 &&
    Number.isFinite(alpha) && alpha >= 0 && alpha <= 1 &&
    (opacity === 0 || alpha === 0);
}

/** A usage observation, never an inferred remote main or complete child API.
 * Transparent single-child wrappers admit translation only. Clip rectangles
 * must contain the entire path control hull, so flattening loses no paint. */
export function observeInstanceVector(root: RestNode, components: ReadonlyMap<string,{key?:string}>) {
  if (root.type !== 'INSTANCE' || !root.size || root.size.x <= 0 || root.size.y <= 0) return;
  const source: Array<{nodeId:string;componentId:string;key:string}> = [];
  const wrappers: Array<{x:number;y:number;width:number;height:number}> = [];
  let node=root, x=0, y=0, depth=0;
  const visible=<T extends {visible?:boolean}>(rows?:T[]):T[]=>(rows??[]).filter(p=>p.visible!==false);
  while (node.type !== 'VECTOR') {
    if (++depth>8 || !['INSTANCE','FRAME','GROUP'].includes(node.type) ||
        (node!==root && node.visible===false) || node.isMask || (node.opacity!==undefined&&node.opacity!==1) ||
        !['NORMAL','PASS_THROUGH',undefined].includes(node.blendMode) ||
        visible(node.fills).some(paint => !neutralVectorWrapperPaint(paint)) || visible(node.strokes).length || visible(node.effects).length ||
        (node.cornerRadius??0)!==0 || node.rectangleCornerRadii?.some(v=>v!==0) ||
        !node.size || !Number.isFinite(node.size.x) || !Number.isFinite(node.size.y) ||
        node.size.x<=0 || node.size.y<=0 || node.children?.length!==1 ||
        Object.values(node.componentProperties??{}).some(p=>!['VARIANT','INSTANCE_SWAP'].includes(p.type))) return;
    if(node.type==='INSTANCE') {
      const key=node.componentId ? components.get(node.componentId)?.key : undefined;
      if(!node.componentId || !key || !node.id)return;
      source.push({nodeId:node.id,componentId:node.componentId,key});
    }
    wrappers.push({x,y,width:node.size.x,height:node.size.y});
    node=node.children[0]!;
    const t=node.relativeTransform;
    if(t?.length!==2||t.some(r=>r.length!==3||r.some(v=>!Number.isFinite(v)))||
      t[0]![0]!==1||t[0]![1]!==0||t[1]![0]!==0||t[1]![1]!==1)return;
    x+=t[0]![2]!;y+=t[1]![2]!;
  }
  const paths=node.fillGeometry;
  const fills=visible(node.fills);
  if(node.visible===false||node.isMask||(node.opacity!==undefined&&node.opacity!==1)||
    !['NORMAL','PASS_THROUGH',undefined].includes(node.blendMode)||
    !node.size||!Number.isFinite(node.size.x)||!Number.isFinite(node.size.y)||node.size.x<=0||node.size.y<=0||
    node.children?.length||visible(node.strokes).length||visible(node.effects).length||
    fills.length!==1||fills[0]!.type!=='SOLID'||!paths?.length||paths.length>32||
    paths.some(p=>filledPathIssue(p.path)||!['NONZERO','EVENODD'].includes(p.windingRule)))return;
  const coordinates=paths.flatMap(p=>p.path.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)!.map(Number));
  if(coordinates.some((n,i)=>!Number.isFinite(n)||wrappers.some(w=>{
    const value=n+(i%2===0?x:y),start=i%2===0?w.x:w.y,extent=i%2===0?w.width:w.height;
    return value<start||value>start+extent;
  })))return;
  if(wrappers.some(w=>x<w.x||y<w.y||x+node.size!.x>w.x+w.width||y+node.size!.y>w.y+w.height))return;
  return {source,vector:node,shape:{kind:'path' as const,width:node.size.x,height:node.size.y,
    x,y,right:root.size.x-x-node.size.x,bottom:root.size.y-y-node.size.y,
    paths:paths.map(p=>({data:p.path,windingRule:p.windingRule})),
    parentViewport:{width:root.size.x,height:root.size.y}}};
}

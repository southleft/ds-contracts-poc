import type {RestNode} from './map.js';
import {allocateInstanceAffine,filledPathIssue} from '../../../scripts/contract-schema.js';

type OutlinedNode = RestNode & {strokeGeometry?: Array<{path:string;windingRule:string}>};

/** Supplemental occurrence evidence, not a reconstructed remote main. The
 * consumer must preserve applied inputs and caller bindings when projecting it.
 * Source main identity and applied values remain separate from the snapshot. */
export function observeInstanceComposition(root: RestNode, components: ReadonlyMap<string,{key?:string}>) {
  const key = root.componentId && components.get(root.componentId)?.key;
  if(root.type !== 'INSTANCE' || !root.id || !root.componentId || !key ||
      root.componentPropertyReferences?.mainComponent ||
      Object.keys(root.componentPropertyReferences ?? {}).some(k=>k!=='visible')) return;
  const properties=root.componentProperties ?? {};
  if(Object.values(properties).some(p=>p.type==='BOOLEAN' ? typeof p.value!=='boolean' : p.type!=='VARIANT'||typeof p.value!=='string')) return;
  const outlines:Record<string,NonNullable<OutlinedNode['strokeGeometry']>>={};
  const ids=new Set<string>();let count=0, vectorCount=0;
  const visible=<T extends {visible?:boolean}>(paints?:T[]) => (paints??[]).filter(p=>p.visible!==false);
  const visit=(node:OutlinedNode,depth:number):boolean=>{
    if(++count>128 || depth>8 || !node.id || ids.has(node.id) ||
        (node!==root && !['FRAME','GROUP','VECTOR','ELLIPSE','RECTANGLE'].includes(node.type)) ||
        node.isMask || visible(node.effects).length ||
        !['NORMAL','PASS_THROUGH',undefined].includes(node.blendMode) ||
        (node.opacity!==undefined&&(!Number.isFinite(node.opacity)||node.opacity<0||node.opacity>1)) ||
        !node.size || ![node.size.x,node.size.y].every(n=>Number.isFinite(n)&&n>0) ||
        node!==root && (Object.keys(node.componentPropertyReferences??{}).length>0 || Object.keys(node.componentProperties??{}).length>0)) return false;
    ids.add(node.id);
    const t=node.relativeTransform;
    if(!t || t.length!==2 || t.some(r=>r.length!==3||r.some(n=>!Number.isFinite(n))) ||
        (node===root ? 'issue' in allocateInstanceAffine({transform:t as [[number,number,number],[number,number,number]],localSize:{width:node.size.x,height:node.size.y}}) : t[0]![0]!==1||t[0]![1]!==0||t[1]![0]!==0||t[1]![1]!==1))return false;
    const fills=visible(node.fills),strokes=visible(node.strokes);
    if([...fills,...strokes].some(p=>p.type!=='SOLID'||!p.color||
        ![p.color.r,p.color.g,p.color.b,p.color.a??1,p.opacity??1].every(n=>Number.isFinite(n)&&n>=0&&n<=1)||
        !['NORMAL',undefined].includes(p.blendMode)))return false;
    if(node.type==='VECTOR'){
      if(node.children?.length)return false;
      const paths=strokes.length===0&&fills.length===1 ? node.fillGeometry
        : fills.length===0&&strokes.length===1 ? node.strokeGeometry : undefined;
      if(!paths?.length || paths.length>32 ||
          paths.some(p=>filledPathIssue(p.path)||!['NONZERO','EVENODD'].includes(p.windingRule)))return false;
      vectorCount++;
      // Filled paths already retain their original paint. Stroked paths keep
      // the exact outline beside the original stroke authority. Neither is
      // fitted to bounds or used to invent an unobserved remote main.
      if(strokes.length)outlines[node.id]=structuredClone(paths);
    }
    return (node.children??[]).every(child=>visit(child,depth+1));
  };
  if(!visit(root,0)||!vectorCount)return;
  return {source:{nodeId:root.id,componentId:root.componentId,key},
    appliedProperties:structuredClone(properties),callerBindings:structuredClone(root.componentPropertyReferences??{}),
    root:structuredClone(root),strokeOutlines:outlines};
}

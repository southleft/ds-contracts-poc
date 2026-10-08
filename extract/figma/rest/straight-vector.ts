import type {DumpNode} from '../types.js';
import type {RestNode} from './map.js';
import {observeStraightVectorNetwork} from './straight-vector-network.js';

/** Inspection-only source lowering. Collinear zero-tangent vertices have no
 * join angle: MITER/4 is generated neutral metadata, not a captured setting. */
export function mapStraightVector(node:RestNode,parent:RestNode|null|undefined,mapped:DumpNode):DumpNode|undefined {
 const observed=observeStraightVectorNetwork(node);
 if(!('observation'in observed)||!parent||!['FRAME','COMPONENT'].includes(parent.type)||
    parent.layoutMode&&parent.layoutMode!=='NONE'||!parent.size||
    ![parent.size.x,parent.size.y].every(n=>Number.isFinite(n)&&n>0&&n<=1e6)||
    ['paddingTop','paddingRight','paddingBottom','paddingLeft'].some(k=>Number((parent as any)[k]??0)!==0)||
    parent.strokes?.some(p=>p.visible!==false)||!mapped.stroke||mapped.strokeWeight!==observed.observation.strokeWeight)
  return;
 const t=parent.relativeTransform;
 if(!t||t.length!==2||t.some(r=>r.length!==3||r.some(n=>!Number.isFinite(n)))||t[0]![0]!==1||t[0]![1]!==0||t[1]![0]!==0||t[1]![1]!==1)return;
 const o=observed.observation;
 if(!['SCALE','LEFT_RIGHT'].includes(o.constraints.horizontal)||!['SCALE','TOP_BOTTOM'].includes(o.constraints.vertical))return;
 const constraints={horizontal:o.constraints.horizontal==='SCALE'?'SCALE':'STRETCH',vertical:o.constraints.vertical==='SCALE'?'SCALE':'STRETCH'} as const;
 const out:DumpNode={...mapped,shape:{kind:'stroked-path',width:o.width,height:0,strokePath:{data:o.data,cap:o.cap,join:'MITER',miterLimit:4,
  viewport:{width:parent.size.x,height:parent.size.y,x:o.transform[0]![2]!,y:o.transform[1]![2]!},
  ...(constraints.horizontal==='SCALE'&&constraints.vertical==='SCALE'?{}:{constraints})}},
  straightVectorSource:{nodeId:o.nodeId,networkWidth:o.networkWidth,scaleX:o.scaleX,canonicalJoin:'MITER',canonicalMiterLimit:4}};
 // The source centerline and viewport now own placement. A collinear graph
 // has no corner to round; retaining CSS radius would paint a second shape.
 delete out.abs;delete out.cornerRadius;
 return out;
}

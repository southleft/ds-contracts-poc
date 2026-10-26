import type {RestNode} from './map.js';
import type {DumpFixedSwap} from '../types.js';

/** A literal single-ink straight-edge drawing at the actual selected slot.
 * Network coordinates are retained in their authored basis: Figma resizes a
 * vector's local box without rewriting these coordinates. No SVG export
 * rounding, filled silhouette or main-component drawing substitutes for it. */
export function selectedStrokeDrawing(root:RestNode):NonNullable<DumpFixedSwap['observedInstances']>[number]['strokeDrawing']{
 const positive=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=1e6;
 const identity=(t:unknown):t is number[][]=>Array.isArray(t)&&t.length===2&&t.every(r=>Array.isArray(r)&&r.length===3&&r.every(v=>typeof v==='number'&&Number.isFinite(v)))&&t[0][0]===1&&t[0][1]===0&&t[1][0]===0&&t[1][1]===1;
 const paints=<T extends {visible?:boolean}>(p:T[]|undefined)=>(p??[]).filter(v=>v.visible!==false);
 if(root.type!=='INSTANCE'||root.children?.length!==1||!root.size||!positive(root.size.x)||!positive(root.size.y)||root.isMask||root.visible===false||
   root.rotation&&root.rotation!==0||(root.opacity??1)!==1||!['NORMAL','PASS_THROUGH',undefined].includes(root.blendMode)||root.layoutMode&&root.layoutMode!=='NONE'||
   paints(root.fills).length||paints(root.strokes).length||paints(root.effects).length||!identity(root.relativeTransform))return;
 const n=root.children[0],paint=paints(n.strokes)[0];
 if(n.type!=='VECTOR'||n.visible===false||n.isMask||n.children?.length||!n.size||!positive(n.size.x)||!positive(n.size.y)||!identity(n.relativeTransform)||
    n.constraints?.horizontal!=='SCALE'||n.constraints.vertical!=='SCALE'||n.strokeAlign!=='CENTER'||n.strokeDashes?.length||(n.opacity??1)!==1||
    !['NORMAL','PASS_THROUGH',undefined].includes(n.blendMode)||paints(n.fills).length||paints(n.effects).length||paints(n.strokes).length!==1||
    paint?.type!=='SOLID'||!paint.color||(paint.opacity??1)!==1||(paint.color.a??1)!==1||!['NORMAL',undefined].includes(paint.blendMode)||
    ![paint.color.r,paint.color.g,paint.color.b].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)||!positive(n.strokeWeight)||
    n.strokeCap!=='ROUND'||n.strokeJoin!=='ROUND'||
    n.complexStrokeProperties?.strokeType!=='BASIC'||Object.keys(n.complexStrokeProperties).some(k=>k!=='strokeType'))return;
 const net=n.vectorNetwork as {vertices?:Array<{position:{x:number;y:number};meta?:number}>;segments?:Array<{start:number;end:number;startTangent:{x:number;y:number};endTangent:{x:number;y:number};meta?:number}>;regions?:Array<{loops:number[][];windingRule:string;meta?:number}>}|undefined;
 const point=(p:any)=>p&&Object.keys(p).sort().join(',')==='x,y'&&[p.x,p.y].every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e6);
 if(!net||Object.keys(net).some(k=>!['vertices','segments','regions'].includes(k))||!Array.isArray(net.vertices)||!net.vertices.length||net.vertices.length>256||!Array.isArray(net.segments)||!net.segments.length||net.segments.length>256||
   net.vertices.some(v=>!point(v.position)||Object.keys(v).some(k=>!['position','meta'].includes(k))||![undefined,0,1].includes(v.meta))||
   net.segments.some(s=>Object.keys(s).some(k=>!['start','end','startTangent','endTangent','meta'].includes(k))||![s.start,s.end].every(i=>Number.isSafeInteger(i)&&i>=0&&i<net.vertices!.length)||s.start===s.end||!point(s.startTangent)||!point(s.endTangent)||s.startTangent.x!==0||s.startTangent.y!==0||s.endTangent.x!==0||s.endTangent.y!==0||![undefined,0,1].includes(s.meta))||
   net.regions!==undefined&&(!Array.isArray(net.regions)||net.regions.some(r=>Object.keys(r).some(k=>!['loops','windingRule','meta'].includes(k))||!['nonzero','evenodd'].includes(r.windingRule)||![undefined,0,1].includes(r.meta)||!Array.isArray(r.loops)||r.loops.some(loop=>!Array.isArray(loop)||loop.some(i=>!Number.isSafeInteger(i)||i<0||i>=net.segments!.length)))))return;
 return {nodeId:n.id,parentId:root.id,width:n.size.x,height:n.size.y,relativeTransform:n.relativeTransform.map(r=>[...r]),
   edges:net.segments.map(s=>{const a=net.vertices![s.start].position,b=net.vertices![s.end].position;return[a.x,a.y,b.x,b.y];}),
   cap:n.strokeCap,join:n.strokeJoin,strokeWeight:n.strokeWeight,
   color:'#'+[paint.color.r,paint.color.g,paint.color.b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('')};
}

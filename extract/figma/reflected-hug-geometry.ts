/** Raw local observations for a content-sized frame inside a reflected frame.
 * The consumer still qualifies identity, sizing, constraints and transforms;
 * this record is not permission to render an arbitrary affine transform. */
export interface ReflectedHugGeometry {
  nodeId:string; parentId:string;
  size:{width:number;height:number}; parentSize:{width:number;height:number};
  transform:number[][]; parentTransform:number[][];
  sizing:{horizontal:string;vertical:string}; parentSizing:{horizontal:string;vertical:string};
  constraints:{horizontal:string;vertical:string};
  layoutMode:string; parentLayoutMode:string;
  boundProperties:string[]; parentBoundProperties:string[];
  limits:Array<number|null>; parentLimits:Array<number|null>;
  clipsContent:boolean; parentClipsContent:boolean;
  isMask:boolean; parentIsMask:boolean;
}

type Source = {id?:unknown;type?:unknown;size?:{x?:unknown;y?:unknown};width?:unknown;height?:unknown;
  relativeTransform?:unknown;layoutSizingHorizontal?:unknown;layoutSizingVertical?:unknown;constraints?:unknown;
  layoutMode?:unknown;boundVariables?:unknown;minWidth?:unknown;minHeight?:unknown;maxWidth?:unknown;maxHeight?:unknown;
  clipsContent?:unknown;isMask?:unknown};

export function observeReflectedHugGeometry(node:Source,parent:Source|null):ReflectedHugGeometry|undefined {
  if(!parent||node.type!=='FRAME'||parent.type!=='FRAME'||typeof node.id!=='string'||!node.id||
    typeof parent.id!=='string'||!parent.id||node.id===parent.id)return;
  const matrix=(m:unknown):m is number[][]=>Array.isArray(m)&&m.length===2&&m.every(row=>Array.isArray(row)&&row.length===3&&
    Array.from({length:3},(_,i)=>Object.hasOwn(row,i)&&typeof row[i]==='number'&&Number.isFinite(row[i])).every(Boolean));
  if(!matrix(node.relativeTransform)||!matrix(parent.relativeTransform))return;
  // Capture only the relevant reflected context; exact admissibility is below.
  if(node.relativeTransform[0][0]!==-1||node.relativeTransform[1][1]!==-1||
    parent.relativeTransform[0][0]!==-1||parent.relativeTransform[1][1]!==-1)return;
  const size=(n:Source)=>({width:n.size?.x??n.width,height:n.size?.y??n.height});
  const n=size(node),p=size(parent);
  if(![n.width,n.height,p.width,p.height].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0))return;
  const mode=(n:Source)=>typeof n.layoutMode==='string'?n.layoutMode:n.layoutMode===undefined?'NONE':undefined;
  const sizing=(n:Source)=>typeof n.layoutSizingHorizontal==='string'&&typeof n.layoutSizingVertical==='string'
    ?{horizontal:n.layoutSizingHorizontal,vertical:n.layoutSizingVertical}:undefined;
  const ns=sizing(node),ps=sizing(parent),nm=mode(node),pm=mode(parent),c=node.constraints as {horizontal?:unknown;vertical?:unknown}|undefined;
  if(!ns||!ps||!nm||!pm||!c||typeof c.horizontal!=='string'||typeof c.vertical!=='string')return;
  if(typeof node.clipsContent!=='boolean'||typeof parent.clipsContent!=='boolean')return;
  const bindings=(n:Source):string[]|undefined=>n.boundVariables===undefined?[]:
    n.boundVariables&&typeof n.boundVariables==='object'&&!Array.isArray(n.boundVariables)?Object.keys(n.boundVariables).sort():undefined;
  const limits=(n:Source)=>[n.minWidth,n.minHeight,n.maxWidth,n.maxHeight].map(v=>v===undefined||v===null?null:v);
  const nb=bindings(node),pb=bindings(parent),nl=limits(node),pl=limits(parent);
  if(!nb||!pb||[...nl,...pl].some(v=>v!==null&&(typeof v!=='number'||!Number.isFinite(v)))||
    [node.clipsContent,parent.clipsContent,node.isMask,parent.isMask].some(v=>v!==undefined&&typeof v!=='boolean'))return;
  return {nodeId:node.id,parentId:parent.id,size:n as ReflectedHugGeometry['size'],parentSize:p as ReflectedHugGeometry['size'],
    transform:node.relativeTransform.map(row=>[...row]),parentTransform:parent.relativeTransform.map(row=>[...row]),
    sizing:ns,parentSizing:ps,constraints:{horizontal:c.horizontal,vertical:c.vertical},layoutMode:nm,parentLayoutMode:pm,
    boundProperties:nb,parentBoundProperties:pb,limits:nl as Array<number|null>,parentLimits:pl as Array<number|null>,
    clipsContent:node.clipsContent===true,parentClipsContent:parent.clipsContent===true,isMask:node.isMask===true,parentIsMask:parent.isMask===true};
}

/** The two half-turns compose to an upright child. Its local LEFT constraint
 * therefore fixes the physical right edge. Only round-off from sin(pi) is
 * normalized; this is not a pixel tolerance or an offset fit. */
export function reflectedHugPlacement(g:ReflectedHugGeometry):{right:number}|undefined {
  if(!g||typeof g.nodeId!=='string'||!g.nodeId||typeof g.parentId!=='string'||!g.parentId||g.nodeId===g.parentId)return;
  const halfTurn=(m:unknown):m is number[][]=>Array.isArray(m)&&m.length===2&&m.every(row=>Array.isArray(row)&&row.length===3&&
    Array.from({length:3},(_,i)=>Object.hasOwn(row,i)&&typeof row[i]==='number'&&Number.isFinite(row[i])).every(Boolean))&&
    m[0][0]===-1&&m[1][1]===-1&&Math.abs(m[0][1])<=Number.EPSILON*8&&Math.abs(m[1][0])<=Number.EPSILON*8;
  if(!halfTurn(g.transform)||!halfTurn(g.parentTransform)||
    !g.size||!g.parentSize||![g.size.width,g.size.height,g.parentSize.height].every(v=>Number.isFinite(v)&&v>0)||
    !Number.isFinite(g.parentSize.width)||g.parentSize.width<0||g.sizing?.horizontal!=='HUG'||g.sizing?.vertical!=='HUG'||
    g.parentSizing?.horizontal!=='FIXED'||g.parentSizing?.vertical!=='FILL'||g.constraints?.horizontal!=='LEFT'||g.constraints?.vertical!=='CENTER'||
    !['HORIZONTAL','VERTICAL'].includes(g.layoutMode)||g.parentLayoutMode!=='NONE'||
    g.parentClipsContent!==false||typeof g.clipsContent!=='boolean'||g.isMask!==false||g.parentIsMask!==false)return;
  for(const bindings of [g.boundProperties,g.parentBoundProperties])if(!Array.isArray(bindings)||bindings.length>256||Array.from({length:bindings.length},(_,i)=>Object.hasOwn(bindings,i)&&typeof bindings[i]==='string'&&!['size','width','height','minWidth','maxWidth','minHeight','maxHeight'].includes(bindings[i])).some(v=>!v))return;
  for(const limits of [g.limits,g.parentLimits])if(!Array.isArray(limits)||limits.length!==4||
    Array.from({length:4},(_,i)=>Object.hasOwn(limits,i)&&limits[i]===null).some(v=>!v))return;
  const tolerance=Number.EPSILON*8*Math.max(1,g.size.height,g.parentSize.height);
  if(Math.abs(g.transform[1][2]-(g.parentSize.height+g.size.height)/2)>tolerance)return;
  const right=g.transform[0][2]-g.size.width;
  return Number.isFinite(right)?{right:Object.is(right,-0)?0:right}:undefined;
}

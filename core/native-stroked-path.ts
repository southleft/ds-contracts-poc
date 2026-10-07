import type {NodeSpec} from './emit-figma-script.js';
import {nativePaintStackMatches} from './native-paint-observation.js';
import {strokedPathGeometryIssue, type StrokedPath} from '../scripts/contract-schema.js';
import {strokedPathNativeData} from './stroked-path-native.js';
type Geometry={width:number;height:number;strokePath?:StrokedPath};
/** Compare native endpoints and relative handles, including open subpaths.
 * Bounds alone cannot establish centerline identity. */
function edges(data:string,sx:number,sy:number){
 const tokens=strokedPathNativeData(data).split(/\s+/);let at=0;
 type Point=[number,number];let from:Point=[0,0],start:Point=[0,0];const result:unknown[]=[];
 const pair=():Point=>[Number(tokens[at++])*sx,Number(tokens[at++])*sy];
 const edge=(to:Point,c1:Point=from,c2:Point=to)=>{
  result.push(['edge',...from.map(Math.fround),...to.map(Math.fround),Math.fround(c1[0]-from[0]),Math.fround(c1[1]-from[1]),Math.fround(c2[0]-to[0]),Math.fround(c2[1]-to[1])]);from=to;
 };
 while(at<tokens.length){const command=tokens[at++];
  if(command==='M'){from=start=pair();result.push(['move',...from.map(Math.fround)]);}
  else if(command==='L')edge(pair());
  else if(command==='C'){const a=pair(),b=pair();edge(pair(),a,b);}
  else if(command==='Q'){const c=pair(),to=pair();edge(to,[from[0]+(c[0]-from[0])*2/3,from[1]+(c[1]-from[1])*2/3],[to[0]+(c[0]-to[0])*2/3,to[1]+(c[1]-to[1])*2/3]);}
  else if(command==='Z'){edge(start);result.push(['close']);}
  else throw Error('native-stroked-path-command');
 }
 return result;
}
/** Geometry-only evidence. Paint, ownership, instance identity and variable
 * bindings require independent checks before a native library can qualify. */
export function nativeStrokedPathGeometryMatches(expected:Geometry,observed:Geometry):boolean{
 try{
  if(strokedPathGeometryIssue(expected)||strokedPathGeometryIssue(observed))return false;
  const a=expected.strokePath!,b=observed.strokePath!,ac=a.constraints??{horizontal:'SCALE',vertical:'SCALE'},bc=b.constraints??{horizontal:'SCALE',vertical:'SCALE'};
  if(a.cap!==b.cap||a.join!==b.join||a.miterLimit!==b.miterLimit||ac.horizontal!==bc.horizontal||ac.vertical!==bc.vertical)return false;
  const rx=b.viewport.width/a.viewport.width,ry=b.viewport.height/a.viewport.height;
  // Live native STRETCH resizing snaps a zero-height vector's new extent to
  // whole pixels, preserving even fractional/negative origin offsets. SCALE
  // does not snap. Keep unresized source geometry unchanged.
  const width=ac.horizontal==='STRETCH'
   ? (b.viewport.width===a.viewport.width?expected.width:Math.round(expected.width+b.viewport.width-a.viewport.width))
   : expected.width*rx;
  const height=ac.vertical==='STRETCH'?expected.height:expected.height*ry;
  const x=ac.horizontal==='STRETCH'?a.viewport.x:a.viewport.x*rx,y=ac.vertical==='STRETCH'?a.viewport.y:a.viewport.y*ry;
  const same=(a:number,b:number)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.fround(a)===Math.fround(b);
  if(width<=0||height<0||!same(width,observed.width)||!same(height,observed.height)||!same(x,b.viewport.x)||!same(y,b.viewport.y))return false;
  return JSON.stringify(edges(a.data,width/expected.width,expected.height===0?1:height/expected.height))===JSON.stringify(edges(b.data,1,1));
 }catch{return false;}
}

/** Independently read VECTOR facts. Expected paint and weight must come from
 * the contract and verified token inventory, never from the observed node. */
export function nativeStrokedPathNodeMatches(expected:Geometry,values:Record<string,any>,parent:Record<string,any>):boolean{
 const paths=values.vectorPaths;
 if(parent.layoutMode!=='NONE'||!Array.isArray(paths)||paths.length!==1||paths[0]?.windingRule!=='NONE'||
  values.isMask!==false||values.blendMode!=='PASS_THROUGH'||values.strokeAlign!=='CENTER'||
  !Array.isArray(values.dashPattern)||values.dashPattern.length||!Array.isArray(values.fills)||values.fills.length||
  JSON.stringify(values.relativeTransform)!==JSON.stringify([[1,0,values.x],[0,1,values.y]])||
  values.layoutSizingHorizontal==='FILL'||values.layoutSizingVertical==='FILL')return false;
 return nativeStrokedPathGeometryMatches(expected,{width:values.width,height:values.height,strokePath:{
  data:paths[0].data,cap:values.strokeCap,join:values.strokeJoin,miterLimit:values.strokeMiterLimit,
  constraints:values.constraints,viewport:{width:parent.width,height:parent.height,x:values.x,y:values.y},
 }});
}

export function nativeStrokedPathPaintMatches(spec:NodeSpec,values:Record<string,any>,weight:unknown,bound?:Parameters<typeof nativePaintStackMatches>[2]):boolean{
 const paintSpec:NodeSpec={type:'shape',name:spec.name,...(spec.stroke?{fill:spec.stroke}:{}),...(spec.lits?.strokeColor?{lits:{fillColor:spec.lits.strokeColor}}:{})};
 return typeof weight==='number'&&Number.isFinite(weight)&&weight>0&&
  (values.strokeWeight===weight||values.strokeWeight===Math.fround(weight))&&
  nativePaintStackMatches(paintSpec,values.strokes,bound,values.boundVariables?.strokes);
}

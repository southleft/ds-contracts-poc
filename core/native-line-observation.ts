import {ShapeSchema} from '../scripts/contract-schema.js';
import type {NodeSpec} from './emit-figma-script.js';
const near=(a:unknown,b:number)=>typeof a==='number'&&Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=0.00001;
/** Compare the line's local basis and logical length, never its painted bounds. */
export function nativeLineNodeMatches(spec:NodeSpec,v:Record<string,any>,parent:Record<string,any>|undefined):boolean{
 if(!parent||spec.shape?.kind!=='line'||!ShapeSchema.safeParse(spec.shape).success)return false;
 const line=spec.shape.line,m=line.transform.map(row=>[...row]),a=spec.absolute;
 let length=line.length;
 if(a){
  const dx=Math.abs(m[0][0]),dy=Math.abs(m[1][0]);
  if(a.h==='STRETCH'||a.v==='STRETCH'){
   if(a.h==='STRETCH'&&dx>1e-6&&dy<1e-6)length=(parent.width-(a.left??0)-(a.right??0))/dx;
   else if(a.v==='STRETCH'&&dy>1e-6&&dx<1e-6)length=(parent.height-(a.top??0)-(a.bottom??0))/dy;
   else return false;
  }
  const x=m[0][0]*length,y=m[1][0]*length,w=Math.abs(x),h=Math.abs(y);
  m[0][2]=(a.left??(a.right!==undefined?parent.width-a.right-w:(parent.width-w)/2))-Math.min(0,x);
  m[1][2]=(a.top??(a.bottom!==undefined?parent.height-a.bottom-h:(parent.height-h)/2))-Math.min(0,y);
  if(v.constraints?.horizontal!==(a.h??'MIN')||v.constraints?.vertical!==(a.v??'MIN'))return false;
 }
 return length>0&&near(v.width,length)&&near(v.height,0)&&near(v.x,m[0][2])&&near(v.y,m[1][2])&&
  Array.isArray(v.relativeTransform)&&v.relativeTransform.length===2&&m.every((row,i)=>Array.isArray(v.relativeTransform[i])&&v.relativeTransform[i].length===3&&row.every((n,j)=>near(v.relativeTransform[i][j],n)))&&
  (!a&&parent.layoutMode==='NONE'||v.layoutPositioning==='ABSOLUTE')&&
  v.strokeCap===line.cap&&v.strokeAlign===line.align&&Array.isArray(v.dashPattern)&&v.dashPattern.length===0&&
  Array.isArray(v.fills)&&v.fills.length===0&&v.layoutSizingHorizontal!=='FILL'&&v.layoutSizingVertical!=='FILL';
}

import type {DumpNode} from '../extract/figma/types.js';
import {filledPathsIssue} from '../scripts/contract-schema.js';

/** Exact rectangle contour equivalence, not a bounding-box approximation.
 * Keep the original source occurrence for paint/binding qualification. */
export function isExactRectanglePath(node:DumpNode):boolean {
  const s=node.shape;
  if(!s || s.kind!=='path' || !s.paths ||
    filledPathsIssue(s.paths) || s.paths.length!==1 || !(s.width>0&&s.height>0) ||
    Object.keys(s).some(k=>!['kind','width','height','paths','x','y','right','bottom','constraints'].includes(k)) ||
    node.stroke || node.gradient || node.effects?.length || node.children?.length)
    return false;
  const words=s.paths[0].data.trim().split(/[\s,]+/);
  if(words.pop()!=='Z')return false;
  const points:number[][]=[];
  while(words.length){
    if(words.shift()!==(points.length?'L':'M'))return false;
    const x=Number(words.shift()),y=Number(words.shift());
    if(!Number.isFinite(x)||!Number.isFinite(y))return false;
    points.push([x,y]);
  }
  if(points.length===5 && points[4][0]===points[0][0] && points[4][1]===points[0][1])points.pop();
  if(points.length!==4 || new Set(points.map(p=>p.join(','))).size!==4)return false;
  return points.every(([x,y],i)=>{
    const next=points[(i+1)%4];
    return (x===0||x===s.width)&&(y===0||y===s.height)&&
      ((x===next[0])!==(y===next[1]));
  });
}

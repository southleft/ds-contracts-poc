/** Original REST centerlines only; context and paint are qualified by map.ts. */
interface Point {x:number;y:number}
interface Vertex {position:Point;meta?:number}
interface Segment {start:number;end:number;startTangent:Point;endTangent:Point;meta?:number}
export function networkPath(input: unknown){
 const network = input as {vertices?:Vertex[];segments?:Segment[];regions?:Array<{loops:number[][];windingRule:string;meta?:number}>};
 const fail=(s:string):never=>{throw Error('network-path-'+s)},point=(p:Point)=>p&&Object.keys(p).length===2&&['x','y'].every(k=>Number.isFinite(p[k as keyof Point])&&Math.abs(p[k as keyof Point])<=1e6);
 const vertices=network?.vertices as Vertex[],segments=network?.segments as Segment[];
 if(!Array.isArray(vertices)||!Array.isArray(segments)||!vertices.length||vertices.length>4096||!segments.length||segments.length>4096)fail('bounds');
 if(vertices.some(v=>!point(v.position)||Object.keys(v).some(k=>!['position','meta'].includes(k))||![undefined,0,1].includes(v.meta)))fail('vertex');
 if(Object.keys(network).some(k=>!['vertices','segments','regions'].includes(k)))fail('network-field');
 if(network.regions!==undefined && (!Array.isArray(network.regions)||network.regions.some(r=>
   !r||Object.keys(r).some(k=>!['loops','windingRule','meta'].includes(k))||
   !['nonzero','evenodd'].includes(r.windingRule)||![undefined,0,1].includes(r.meta)||
   !Array.isArray(r.loops)||r.loops.some(loop=>!Array.isArray(loop)||loop.some(i=>!Number.isInteger(i)||i<0||i>=segments.length)))))fail('region');
 const edges: number[][]=vertices.map(()=>[]);
 segments.forEach((s,i)=>{if(Object.keys(s).some(k=>!['start','end','startTangent','endTangent','meta'].includes(k))||![s.start,s.end].every(v=>Number.isInteger(v)&&v>=0&&v<vertices.length)||s.start===s.end||!point(s.startTangent)||!point(s.endTangent)||![undefined,0,1].includes(s.meta))fail('segment');edges[s.start]!.push(i);edges[s.end]!.push(i);});
 if(edges.some(es=>es.length===0||es.length>2))fail('branch-or-isolated');
 const used=new Set<number>(),commands:string[]=[],traversed:Array<{edge:number;forward:boolean}>=[];
 const xy=(p:Point)=>`${p.x} ${p.y}`;
 while(used.size<segments.length){
  let start=edges.findIndex(es=>es.length===1&&!used.has(es[0]!));
  if(start<0)start=edges.findIndex(es=>es.some(e=>!used.has(e)));
  let current=start;commands.push('M'+xy(vertices[current]!.position));
  do{
   const edge=edges[current]!.find(e=>!used.has(e));if(edge===undefined)break;
   const s=segments[edge]!,forward=s.start===current,next=forward?s.end:s.start,a=vertices[current]!.position,b=vertices[next]!.position,t1=forward?s.startTangent:s.endTangent,t2=forward?s.endTangent:s.startTangent;
   commands.push(t1.x===0&&t1.y===0&&t2.x===0&&t2.y===0?'L'+xy(b):'C'+xy({x:a.x+t1.x,y:a.y+t1.y})+' '+xy({x:b.x+t2.x,y:b.y+t2.y})+' '+xy(b));
   used.add(edge);traversed.push({edge,forward});current=next;
   if(current===start){commands.push('Z');break;}
  }while(used.size<segments.length);
 }
 return {data:commands.join(' '),traversed};
}

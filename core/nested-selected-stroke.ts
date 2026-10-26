import {type Contract,walkAnatomy} from '../scripts/contract-schema.js';
import type {DumpNode,DumpHostOverride} from '../extract/figma/types.js';
import {strokedPathNativeData} from './stroked-path-native.js';
type Witness=NonNullable<DumpHostOverride['instanceProperties']>;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const positive=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=1e6;
const size=(s:any):s is {width:number;height:number}=>s&&positive(s.width)&&positive(s.height);
const identity=(m:unknown):m is number[][]=>Array.isArray(m)&&m.length===2&&m.every(r=>Array.isArray(r)&&r.length===3&&r.every(v=>typeof v==='number'&&Number.isFinite(v)))&&m[0][0]===1&&m[0][1]===0&&m[1][0]===0&&m[1][1]===1;
/** Compare a straight centerline as an unordered collection of undirected
 * edges. Direction/order does not alter opaque ROUND-cap/ROUND-join ink. */
function lineEdges(data:string):number[][]|undefined{
 try{const t=strokedPathNativeData(data).split(/\s+/),edges:number[][]=[];let at=0,point:number[]|undefined;
  while(at<t.length){const command=t[at++];if(!['M','L'].includes(command)||at+1>=t.length)return;
   const next=[Number(t[at++]),Number(t[at++])];if(next.some(n=>!Number.isFinite(n)))return;
   if(command==='L'){if(!point)return;edges.push([...point,...next]);}point=next;
  }return edges.length?edges:undefined;
 }catch{return;}
}
const edgeKey=(edges:number[][])=>edges.map(e=>{const a=e.slice(0,2),b=e.slice(2);return JSON.stringify(a)<JSON.stringify(b)?[...a,...b]:[...b,...a];}).map(e=>JSON.stringify(e)).sort();

/** Fixed selected roots are a distinct qualification from FILL allocation.
 * A current source network, keyed main and compiled centerline all agree;
 * only then may size and literal ink cross this one captured slot boundary. */
export function qualifyNestedSelectedStroke(usage:DumpNode,w:Witness,property:string,ownerMain:DumpNode,targetMain:DumpNode,target:Contract):{size:number;color:string;strokeWidth:number}|undefined{
 const selected=w.properties[property],rows=selected?.observedInstances,row=rows?.[0],p=row?.selectedRoot,d=row?.strokeDrawing,g=w.layout;
 if(!selected?.selected||selected.value!==selected.selected.nodeId||!Array.isArray(rows)||rows.length!==1||!Object.hasOwn(rows,0)||!row||!p||!d||
   w.ownerId!==usage.nodeId||w.ownerComponentId!==usage.instanceGeometry?.componentId||w.ownerComponentKey!==usage.instanceKey||
   w.componentId!==ownerMain.nodeId||w.componentKey!==ownerMain.componentKey||!g||g.nodeId!==w.nodeId||g.componentId!==w.componentId||!size(g.localSize)||
   p.kind!=='selected-slot-root-v1'||p.hostId!==w.nodeId||p.hostMainId!==w.componentId||p.property!==property||p.parentId!==w.nodeId||
   p.componentKey!==selected.selected.componentKey||row.componentId!==selected.value||targetMain.nodeId!==selected.value||targetMain.componentKey!==selected.selected.componentKey||
   !size(targetMain.bbox)||!same(p.mainSize,targetMain.bbox)||!size(row.size)||row.size.width!==row.size.height||!same(row.parentSize,g.localSize)||!same(ownerMain.bbox,g.localSize)||
   !identity(row.relativeTransform)||p.sizing.horizontal!=='FIXED'||p.sizing.vertical!=='FIXED'||p.sizing.width!==row.size.width||p.sizing.height!==row.size.height||
   p.inFlow!==true||p.layoutGrow!==0||p.sizeBound!==true||!Array.isArray(p.fields)||p.fields.some(f=>f!=='boundVariables')||
   !Array.isArray(row.path)||row.path.length!==1||!Number.isSafeInteger(row.path[0])||row.path[0]<0)return;
 const sourceSlot=ownerMain.children?.[row.path[0]],anchor=target.bindings.figma.anchors;
 if(!sourceSlot||sourceSlot.type!=='INSTANCE'||!sourceSlot.nodeId||sourceSlot.propRefs?.mainComponent!==property.replace(/#[0-9]+:[0-9]+(?::[0-9]+)?$/,'')||
   row.nodeId!==w.nodeId+';'+sourceSlot.nodeId||anchor.nodeId!==targetMain.nodeId||anchor.componentSetKey!==selected.selected.componentKey||
   target.props.length>0||Object.keys(p.properties??{}).length>0||!['size','color','stroke-width'].every(c=>target.anatomy.root.overridable?.includes(c)))return;
 const layout=p.parentLayout;
 if(!layout||!['HORIZONTAL','VERTICAL'].includes(layout.mode)||layout.primary!=='CENTER'||layout.counter!=='CENTER'||layout.primarySizing!=='FIXED'||layout.counterSizing!=='FIXED'||
   row.relativeTransform[0][2]!==(g.localSize.width-row.size.width)/2||row.relativeTransform[1][2]!==(g.localSize.height-row.size.height)/2)return;
 const paths=walkAnatomy(target).filter(p=>p.part.shape);if(paths.length!==1)return;
 const shape=paths[0].part.shape!,sp=shape.kind==='stroked-path'?shape.strokePath:undefined,leaf=targetMain.children?.[0];
 if(!sp||!leaf?.nodeId||d.nodeId!==row.nodeId+';'+leaf.nodeId||d.parentId!==row.nodeId||!identity(d.relativeTransform)||!positive(d.width)||!positive(d.height)||
   sp.cap!==d.cap||sp.join!==d.join||d.cap!=='ROUND'||d.join!=='ROUND'||sp.viewport.width!==targetMain.bbox.width||sp.viewport.height!==targetMain.bbox.height||
   sp.constraints&&(!same(sp.constraints,{horizontal:'SCALE',vertical:'SCALE'}))||!positive(d.strokeWeight)||!/^#[0-9a-f]{6}$/.test(d.color))return;
 const expected=lineEdges(sp.data);if(!expected||!Array.isArray(d.edges)||d.edges.length!==expected.length||d.edges.some(e=>!Array.isArray(e)||e.length!==4||e.some(n=>typeof n!=='number'||!Number.isFinite(n)))||!same(edgeKey(expected),edgeKey(d.edges)))return;
 const scale=row.size.width/sp.viewport.width,exact=(a:number,b:number)=>a===b||a===Math.fround(b);
 if(!exact(d.width,shape.width*scale)||!exact(d.height,shape.height*scale)||!exact(d.relativeTransform[0][2],sp.viewport.x*scale)||!exact(d.relativeTransform[1][2],sp.viewport.y*scale))return;
 // ROUND caps/joins extend by one radius. Keep all ink inside the actual
 // selected box so a clipped source and the SVG's visible overflow agree.
 const radius=d.strokeWeight/2;
 if(d.edges.some(e=>[e.slice(0,2),e.slice(2)].some(point=>point.some((v,axis)=>{
  const position=v*scale+(axis===0?d.relativeTransform[0][2]:d.relativeTransform[1][2]);
  return position-radius<0||position+radius>(axis===0?row.size!.width:row.size!.height);
 }))))return;
 const matches=usage.hostOverrides?.filter(h=>h.solidStrokeTarget?.nodeId===d.nodeId)??[];
 if(matches.length!==1)return;const h=matches[0],ink=h.solidStrokeTarget!;
 if(ink.instanceId!==row.nodeId||ink.componentId!==row.componentId||!same(ink.instancePath,[...w.path,...row.path])||!same(ink.childPath,[0])||
   h.fields.some(f=>!['boundVariables','fills','strokes','strokeWeight'].includes(f))||!['strokes','strokeWeight'].every(f=>h.fields.includes(f))||
   !h.sourceEmptyFill||h.fill||h.sourceNormalFillComposition||!h.stroke?.hex||'#'+h.stroke.hex.toLowerCase()!==d.color||(h.stroke.alpha??1)!==1||h.strokeWeight!==d.strokeWeight)return;
 return {size:row.size.width,color:d.color,strokeWidth:d.strokeWeight};
}

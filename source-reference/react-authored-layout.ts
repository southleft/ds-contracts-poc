/** Preserve one observed block layout context without minting a component width
 * token or inferring percentages from equal-looking pixel ratios. */
import {flatten,type CapturedNode} from '../extract/computed/lib.js';
import {usedLayoutUnits} from './layout-unit.js';
import type {ReactStyleOrigin,ReactDescendantSizes,ReactSizeOrigin} from './react-style-origin.js';
import type {NodeSpec} from '../core/emit-figma-script.js';
import type {NativeObservedLayoutContext} from '../core/native-observed-layout.js';

function fail(reason:string):never{throw Error('react-authored-layout-'+reason);}
const px=(value:string|undefined)=>{const n=usedLayoutUnits(value??'');return n===undefined?undefined:n/64;};
const edges=['padding-left','padding-right','padding-top','padding-bottom','border-left-width','border-right-width','border-top-width','border-bottom-width'];
function simple(node:CapturedNode){
 const s=node.style;
 return s['writing-mode']==='horizontal-tb'&&['static','relative'].includes(s.position)&&s.float==='none'&&(s.zoom??'1')==='1'&&
  ['transform','translate','rotate','scale','perspective'].every(k=>!s[k]||s[k]==='none')&&edges.every(k=>px(s[k])===0);
}
export interface ObservedAuthoredLayout {
 host:{width:number;height:number};
 rows:Array<{path:string;width?:{kind:'percent';value:number};height?:{kind:'percent';value:number}}>;
}
export function readObservedAuthoredLayout(tree:CapturedNode,origin:ReactStyleOrigin,descendants?:ReactDescendantSizes,bounds?:{width:number;height:number}):ObservedAuthoredLayout|undefined{
 const root=origin.roots.find(r=>r.path===''&&r.tag===tree.tag),width=root?.sizes?.find(s=>s.channel==='width');
 if(width?.status!=='auto'||!['block','flex','grid','flow-root'].includes(tree.style.display))return undefined;
 // A preview host carries the measured extent of this case, never a reusable
 // source width declaration. Require an own vertical dimension for this lane.
 const height=root?.sizes?.find(s=>s.channel==='height'),w=px(tree.style.width),h=px(tree.style.height);
 if(!simple(tree)||height?.status!=='fixed'||!height.value||px(height.value)!==h||!(w&&w>0&&h&&h>0))fail('root-context-unqualified');
 if(!bounds||bounds.width!==w||bounds.height!==h)fail('host-bounds-unqualified');
 if(!descendants||descendants.version!==1||!Array.isArray(descendants.nodes))fail('descendant-evidence-required');
 const nodes=flatten(tree),byPath=new Map(nodes.map(n=>[n.path,n.node]));
 if(new Set(descendants.nodes.map(r=>r.path)).size!==descendants.nodes.length)fail('descendant-evidence-ambiguous');
 const rows:ObservedAuthoredLayout['rows']=[];
 for(const {path,node} of nodes){
  if(!path)continue;
  const evidence=descendants.nodes.find(r=>r.path===path&&r.tag===node.tag);if(!evidence)fail('descendant-evidence-missing');
  if(!Array.isArray(evidence.sizes)||new Set(evidence.sizes.map(s=>s.channel)).size!==evidence.sizes.length)fail('descendant-evidence-ambiguous');
  const parent=byPath.get(path.includes('.')?path.slice(0,path.lastIndexOf('.')):'');if(!parent)fail('parent-missing');
  const row:ObservedAuthoredLayout['rows'][number]={path};
  for(const channel of ['width','height'] as const){
   const size=evidence.sizes.find((s:ReactSizeOrigin)=>s.channel===channel),proof=size?.observedPercentage;
   const percentage=size?.authoredValue&&/^([0-9]+(?:\.[0-9]+)?)%$/.exec(size.authoredValue);
   if(!percentage){if(size?.status==='unresolved'&&size.authoredValue)fail('size-expression-unqualified:'+path+':'+channel);continue;}
   if(size!.status!=='fill'&&!(size!.status==='unresolved'&&['responsive-or-unsupported-size-expression','declared-fill-width-containing-block-indefinite','declared-fill-width-containing-block-viewport-only'].includes(size!.reason??'')))fail('percentage-origin-unqualified:'+path+':'+channel);
   const percent=Number(percentage[1]),used=px(node.style[channel]),parentSize=px(parent.style[channel]);
   if(!proof||Object.keys(proof).sort().join(',')!=='parentSize,percent,usedSize'||!Number.isFinite(proof.parentSize)||!Number.isFinite(proof.usedSize)||!simple(node)||!simple(parent)||!Number.isFinite(percent)||percent<=0||percent>100||channel==='height'&&percent!==100||
    proof.percent!==percent||used===undefined||parentSize===undefined||Math.abs(proof.usedSize-used)>1/64||Math.abs(proof.parentSize-parentSize)>1/64||
    used===undefined||parentSize===undefined||parentSize<=0||Math.abs(used-parentSize*percent/100)>1/64)fail('percentage-unqualified:'+path+':'+channel);
   row[channel]={kind:'percent',value:percent};
  }
  if(row.width||row.height)rows.push(row);
 }
 if(!rows.length)fail('percentage-evidence-required');
 return {host:{width:w,height:h},rows};
}
export function observedLayoutContext(layout:ObservedAuthoredLayout,contractId:string,treeSha256:string,root:NodeSpec,sourcePaths:Array<{sourcePath:string;partName:string;specPath:number[];type:string}>):NativeObservedLayoutContext{
 const specs:Array<{path:number[];node:NodeSpec}>=[];
 const walk=(node:NodeSpec,path:number[])=>{specs.push({path,node});node.children?.forEach((child,i)=>walk(child,[...path,i]));};walk(root,[]);
 const parts=layout.rows.map(row=>{
  const mappings=sourcePaths.filter(p=>p.sourcePath===row.path);if(mappings.length!==1)fail('part-correspondence-unavailable');
  const matches=specs.filter(s=>JSON.stringify(s.path)===JSON.stringify(mappings[0].specPath)&&s.node.name===mappings[0].partName&&s.node.type===mappings[0].type);if(matches.length!==1||!matches[0].path.length||matches[0].node.type!=='frame')fail('part-layout-unqualified');
  return {path:matches[0].path,...(row.width?{width:row.width}:{}),...(row.height?{height:row.height}:{})};
 });
 return {version:1,contractId,treeSha256,host:layout.host,parts};
}

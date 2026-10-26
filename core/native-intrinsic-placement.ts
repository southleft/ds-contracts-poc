import {resolveLayout,resolveLiterals,resolvePresence,resolveTokens,type ComponentRef,type Contract,type Part} from '../scripts/contract-schema.js';
import {scalarTextSizeInput} from '../packages/schema/src/scalar-text-size-input.js';
import {scalarTextSizeTarget} from './native-scalar-text-size.js';

export type NativeIntrinsicPlacement={right:number;textTarget:string};
export type NativeIntrinsicPlacements=Record<string,NativeIntrinsicPlacement>;
const entries=(c:Contract)=>{
 const rows:Array<{part:Part;path:string[]}>=[];
 const visit=(part:Part,path:string[])=>{rows.push({part,path});for(const[k,p]of Object.entries(part.parts??{}))visit(p,[...path,k]);};
 for(const[k,p]of Object.entries(c.anatomy))visit(p,[k]);return rows;
};
const visible=(p:Part,v:Record<string,string>)=>resolvePresence(p,v)&&(!p.visibleWhen||
 (p.visibleWhen.equals===undefined?v[p.visibleWhen.prop]==='true':(Array.isArray(p.visibleWhen.equals)?p.visibleWhen.equals:[p.visibleWhen.equals]).some(x=>String(x)===v[p.visibleWhen!.prop])))&&
 (!p.visibilityOverrideProp||(v[p.visibilityOverrideProp]??String(p.visibilityOverrideDefault??true))==='true');
export function intrinsicAbsoluteRight(p:Part,v:Record<string,string>):number|undefined {
 const l=resolveLiterals(p,v),t=resolveTokens(p,v),layout=resolveLayout(p,v);
 if(p.component||p.slot||p.shape||p.icon||p.mask||p.repeat||p.states||p.statesByProp||p.stylesWhen||p.absoluteGeometry||p.absoluteGeometryByCombination||p.absolutePlacement||p.absolutePlacementByCombination||
   p.declared?.position!=='absolute'||p.declared.translate!=='0px -50%'||l.width!=='fit-content'||l.height!=='fit-content'||l.top!=='50%'||l.left!==undefined||l.bottom!==undefined||
   p.declared.transform||p.declared.rotate||p.declared.scale||!layout||!['row','column'].includes(layout.direction??'row')||layout.wrap||layout.grow||layout.alignSelf||layout.display==='grid'||
   Object.keys(p.declared).some(k=>!['position','translate','overflow','overflow-x','overflow-y'].includes(k))||
   Object.keys(t).some(k=>/^(width|height|left|right|top|bottom|min-|max-|padding|margin|border)/.test(k))||
   Object.keys(l).some(k=>/^(min-|max-|padding|margin|border)/.test(k)))return;
 const right=typeof l.right==='string'&&/^-?\d+(?:\.\d+)?px$/.test(l.right)?Number(l.right.slice(0,-2)):NaN;
 return Number.isFinite(right)?right:undefined;
}
function selection(c:Contract,args:NonNullable<ComponentRef['props']>,outer:Record<string,string>):Record<string,string>|undefined{
 const out:Record<string,string>={};for(const p of c.props)if(p.default!==undefined)out[p.name]=String(p.default);
 for(const[name,raw]of Object.entries(args)){
  let value:unknown=typeof raw==='object'?raw.map[outer[raw.prop]??'']:raw;
  if(typeof raw==='string'&&/^\{[\w-]+\}$/.test(raw))value=outer[raw.slice(1,-1)];
  if(value===undefined)continue;if(typeof value!=='string'&&typeof value!=='boolean')return;out[name]=String(value);
 }return out;
}
function candidates(c:Contract,v:Record<string,string>,strict=false){
 const all=entries(c),out:Array<{part:Part;target:string;plan:NativeIntrinsicPlacement}>=[];
 for(const prop of c.props){const q=scalarTextSizeInput(c,prop.name);if(!q)continue;
  const parentPath=q.path.slice(0,-1),parent=all.find(r=>JSON.stringify(r.path)===JSON.stringify(parentPath))?.part;
  if(!parent||!visible(parent,v))continue;const right=intrinsicAbsoluteRight(parent,v);if(right===undefined)continue;
  const containingPath=parentPath.slice(0,-1),containing=all.find(r=>JSON.stringify(r.path)===JSON.stringify(containingPath))?.part;
  // A caller may override a dependency root's stroke. Keep this permission
  // inside an owned containing frame, with no conditional style escape.
  const borderless=containingPath.length>1&&containing&&!containing.component&&!containing.slot&&
    !containing.stylesWhen?.length&&!containing.states&&!containing.statesByProp&&
    [resolveTokens(containing,v),resolveLiterals(containing,v),containing.declared??{}].every(values=>!Object.keys(values).some(k=>k.startsWith('border')));
  if(!borderless){if(strict)throw Error('intrinsic-placement-native-parent-border-unqualified');continue;}
  const shown=Object.values(parent.parts??{}).filter(p=>visible(p,v));
  if(shown.length!==1||shown[0]!==q.part||q.part.textAutoResize!=='WIDTH_AND_HEIGHT'||q.part.declared?.position||q.part.layout?.grow||
    Object.keys(resolveTokens(q.part,v)).some(k=>/^(width|height|min-|max-)/.test(k))||Object.keys(resolveLiterals(q.part,v)).some(k=>/^(width|height|min-|max-)/.test(k)))continue;
  out.push({part:parent,target:c.id+':intrinsic-placement:'+JSON.stringify(parentPath),plan:{right,textTarget:scalarTextSizeTarget(c,q.path)}});
 }return out;
}
export function nativeIntrinsicPlacementTarget(c:Contract,p:Part,v:Record<string,string>):string|undefined{
 const values=selection(c,{},v);if(!values)return;Object.assign(values,v);
 return candidates(c,values).find(row=>row.part===p)?.target;
}
export function mapNativeIntrinsicPlacements(c:Contract,args:NonNullable<ComponentRef['props']>,outer:Record<string,string>):NativeIntrinsicPlacements|undefined{
 const values=selection(c,args,outer);if(!values)return;
 const out=Object.fromEntries(candidates(c,values,true).map(row=>[row.target,row.plan]));return Object.keys(out).length?out:undefined;
}

/** Both main and inherited frames must retain genuine, unconstrained HUG. */
export function nativeIntrinsicHugBoxMatches(n:Record<string,any>,t:Record<string,any>):boolean{
 const near=(a:number,b:number)=>Number.isFinite(a)&&Number.isFinite(b)&&(a===b||a===Math.fround(b));
 return n.type==='FRAME'&&t.type==='TEXT'&&
  n.values.layoutSizingHorizontal==='HUG'&&n.values.layoutSizingVertical==='HUG'&&n.values.layoutMode!=='NONE'&&n.values.layoutWrap==='NO_WRAP'&&
  [n.values.paddingTop,n.values.paddingRight,n.values.paddingBottom,n.values.paddingLeft].every(v=>v===0)&&
  ['width','height','minWidth','maxWidth','minHeight','maxHeight'].every(k=>n.values.boundVariables?.[k]===undefined)&&
  [n.values.minWidth,n.values.minHeight,n.values.maxWidth,n.values.maxHeight].every(v=>v===null||v===undefined)&&
  n.values.width>0&&n.values.height>0&&near(n.values.width,t.values.width)&&near(n.values.height,t.values.height);
}

/** Readback derives both HUG dimensions from the independently observed sole
 * TEXT child and checks the compiler's exact physical anchor. */
export function nativeIntrinsicPlacementMatches(key:string,plan:NativeIntrinsicPlacement,node:Record<string,any>,source:Record<string,any>,parent:Record<string,any>|undefined,nodes:ReadonlyMap<string,Record<string,any>>):boolean{
 const single=(n:Record<string,any>)=>{const rows=(n.childIds??[]).map((id:string)=>nodes.get(id));if(rows.some((r:unknown)=>!r))return;const visible=rows.filter((r:Record<string,any>)=>r.values.visible!==false);return visible.length===1?visible[0]:undefined;};
 const text=single(node),original=single(source),v=node.values,s=source.values,p=parent?.values;
 const near=(a:number,b:number)=>Number.isFinite(a)&&Number.isFinite(b)&&(a===b||a===Math.fround(b));
 return !!text&&!!original&&!!p&&Number.isFinite(plan.right)&&node.metadata.intrinsicPlacement===key&&source.metadata.intrinsicPlacement===key&&
  text.metadata.textSizeOverride===plan.textTarget&&original.metadata.textSizeOverride===plan.textTarget&&nativeIntrinsicHugBoxMatches(node,text)&&nativeIntrinsicHugBoxMatches(source,original)&&
  p.width>=0&&p.height>0&&near(v.x,p.width-plan.right-v.width)&&near(v.y,(p.height-v.height)/2)&&
  v.constraints?.horizontal==='MAX'&&v.constraints?.vertical==='CENTER'&&
  Array.isArray(v.relativeTransform)&&v.relativeTransform.length===2&&
  v.relativeTransform.every((row:any,i:number)=>Array.isArray(row)&&row.length===3&&row.every((x:number,j:number)=>near(x,[[1,0,v.x],[0,1,v.y]][i][j])));
}

/** Metadata locates the compiler-owned ancestor; it never supplies coordinates.
 * Reflow is restricted to the compiled one-TEXT HUG box and runs after the
 * complete text update, including the final post-append replay. */
export const NATIVE_INTRINSIC_PLACEMENT_RUNTIME=`
function reflowInstanceIntrinsicPlacements(instance,spec){
 if(!spec.instanceIntrinsicPlacements)return;
 const previous=figma.skipInvisibleInstanceChildren;figma.skipInvisibleInstanceChildren=false;
 try{for(const[key,plan]of Object.entries(spec.instanceIntrinsicPlacements)){
  let count=0;const found=[],visit=(n,depth=0)=>{if(++count>512||depth>32)throw Error('intrinsic-placement-native-tree-limit');if(n.type==='INSTANCE')return;if(n.getSharedPluginData('ds_contracts','intrinsicPlacement')===key)found.push(n);for(const c of n.children||[])visit(c,depth+1);};
  for(const c of instance.children||[])visit(c);
  if(found.length!==1)throw Error('intrinsic-placement-native-owner-unqualified:'+key);
  const node=found[0],parent=node.parent,shown=(node.children||[]).filter(n=>n.visible!==false),text=shown[0],bindings=node.boundVariables||{};
  if(node.type!=='FRAME'||!parent||shown.length!==1||text.type!=='TEXT'||text.getSharedPluginData('ds_contracts','textSizeOverride')!==plan.textTarget||
    node.layoutSizingHorizontal!=='HUG'||node.layoutSizingVertical!=='HUG'||node.constraints?.horizontal!=='MAX'||node.constraints?.vertical!=='CENTER'||
    ['width','height','minWidth','maxWidth','minHeight','maxHeight'].some(k=>bindings[k]!==undefined)||
    !Number.isFinite(plan.right)||![node.width,node.height,parent.height].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(parent.width)||parent.width<0||
    node.width!==text.width||node.height!==text.height)throw Error('intrinsic-placement-native-geometry-unqualified:'+key);
  const x=parent.width-plan.right-node.width,y=(parent.height-node.height)/2;
  node.x=x;node.y=y;
  if(node.x!==x&&node.x!==Math.fround(x)||node.y!==y&&node.y!==Math.fround(y))throw Error('intrinsic-placement-native-readback-mismatch:'+key);
 }}finally{figma.skipInvisibleInstanceChildren=previous;}
}
`;

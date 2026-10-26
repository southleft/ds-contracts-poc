import {walkAnatomy,resolveTokens,resolveLiterals,resolveLayout,resolvePresence,tokensByPropEntries,type Contract,type Part} from '../scripts/contract-schema.js';
import {flattenTokens} from './tokens.js';

/** Figma FILL divides outer sizes, even below a padding sum. CSS flex's
 * zero basis includes padding. For centered, nonshrinking path graphics,
 * symmetric main-axis padding cancels algebraically from their center:
 * p + (W - 2p - content)/2 = (W - content)/2.
 * Remove only that redundant code-side padding, retaining the source contract
 * for native generation. Conditional layouts require a complete finite proof. */
export type CenteredFixedPaddingProjection = {path:string[];props:string[];rows:Array<{values:string[];literals:Record<string,string>}>};

/** The same render proof consumed by the CSS projection and nested-use guards.
 * This reports no authority over source geometry or a selected component. */
export function centeredFixedPaddingProjections(input:Contract,tokenValues?:unknown):CenteredFixedPaddingProjection[] {
 const projections:CenteredFixedPaddingProjection[]=[];
 projectCenteredFillPadding(input,tokenValues,projections);
 return projections;
}
export function lowerCenteredFillPadding(input:Contract,tokenValues?:unknown):Contract {
 return projectCenteredFillPadding(input,tokenValues);
}
function projectCenteredFillPadding(input:Contract,tokenValues?:unknown,projections?:CenteredFixedPaddingProjection[]):Contract {
 const values=tokenValues as any;
 const trees=values?[values.primitives,values.semantic,values.light,values.dark,...Object.values(values.brands??{})].filter(Boolean):[];
 const maps=trees.map(t=>flattenTokens(t as Record<string,unknown>));
 const scalar=(value:unknown,seen=new Set<string>()):boolean=>{
  if(typeof value!=='string')return false;
  if(/^(?:\d+(?:\.\d+)?|\.\d+)px$/.test(value)||value==='0')return true;
  const match=/^\{([^{}]+)\}$/.exec(value);if(!match||seen.has(match[1]))return false;
  const found=maps.flatMap(m=>m.has(match[1])?[m.get(match[1])!.value]:[]);
  return found.length>0&&found.every(v=>scalar(v,new Set([...seen,match[1]])));
 };
 // Resolve all finite enum substitutions before admitting fixed geometry.
 // An unresolved token, percent, flex basis or content-sized axis is not proof.
 const numbers=(value:unknown,seen=new Set<string>(),dimension=false):number[]|undefined=>{
  if(typeof value==='number')return !dimension&&Number.isFinite(value)?[value]:undefined;
  if(typeof value!=='string')return;
  if((dimension?/^(?:\d+(?:\.\d+)?|\.\d+)px$/:/^(?:\d+(?:\.\d+)?|\.\d+)(?:px)?$/).test(value))return [parseFloat(value)];
  for(const prop of input.props){
   if(!value.includes(`{${prop.name}}`)||!prop.type||typeof prop.type!=='object'||!('enum' in prop.type))continue;
   const rows=prop.type.enum.map(v=>numbers(value.replaceAll(`{${prop.name}}`,v),seen,dimension));
   return rows.every(Boolean)?rows.flatMap(v=>v!):undefined;
  }
  const match=/^\{([^{}]+)\}$/.exec(value);if(!match||seen.has(match[1]))return;
  const found=maps.flatMap(m=>m.has(match[1])?[m.get(match[1])!.value]:[]);
  const rows=found.map(v=>numbers(v,new Set([...seen,match[1]]),dimension));
  return found.length&&rows.every(Boolean)?rows.flatMap(v=>v!):undefined;
 };
 const own=(p:Part,k:string)=>[p.tokens,p.literals,p.declared].flatMap(h=>h?.[k]!==undefined?[h[k]]:[]);
 const fixed=(p:Part,k:string)=>{const values=own(p,k);const nums=values.length===1?numbers(values[0],new Set(),true):undefined;return !!nums?.length&&nums.every(v=>Number.isFinite(v)&&v>0)};
 const dynamic=(p:Part)=>JSON.stringify([p.states,p.declaredStates,p.statesByProp,p.stylesWhen,p.tokensByProp,p.tokensByCombination,p.literalsByProp,p.literalsByCombination]);
 const fixedCentered=(p:Part,root:boolean)=>{
  // A real border participates in the CSS border-box floor. Only absent/zero
  // widths are admitted here; stroke-ring flags alone are not a CSS proof.
  const paintMaps=[p.tokens,p.literals,p.declared];
  // With zero borders, default padding-box positioning and border-box
  // painting retain the same outer boundary. These longhands do not depend
  // on the removed padding; shorthand, origin/clip and unknown channels do.
  if(paintMaps.some(map=>Object.keys(map??{}).some(key=>/^background(?:$|-(?!(?:color|image|position|size|repeat)$))/.test(key)||/^border(?:-(?:top|right|bottom|left))?$/.test(key))))return false;
  if(paintMaps.some(map=>Object.entries(map??{}).some(([key,value])=>/^border(?:-(?:top|right|bottom|left))?-width$/.test(key)&&!numbers(value)?.every(n=>n===0))))return false;
  if(paintMaps.some(map=>Object.entries(map??{}).some(([key,value])=>/^border(?:-(?:top|right|bottom|left))?-style$/.test(key)&&value!=='none'&&
    !own(p,'border-width').length&&!own(p,key.replace(/style$/,'width')).length)))return false;

  const l=p.layout;
  if((!root&&!l)||l&&(l.display==='grid'||l.align!=='center'||l.justify!=='center'||l.wrap||l.grow||l.growBasis)||
      p.layoutByProp||p.layoutByCombination||p.component||p.slot||p.shape||p.icon||p.text!==undefined||p.content||p.repeat||p.mask||p.meter||!p.parts||Object.keys(p.parts).length!==1)return false;
  if(!fixed(p,'width')||!fixed(p,'height')||/padding|width|height|display|align|justify|flex|position|background-(?!color)|background"|box-sizing|border"|border-style|border-width|border-(?:top|right|bottom|left)-width|border-(?:top|right|bottom|left)-style/.test(dynamic(p)))return false;
  const holders=[p.tokens,p.literals,p.declared];
  if(holders.some(h=>Object.keys(h??{}).some(k=>/^(?:padding(?:-(?!inline$|block$).*)?|min-width|min-height|max-width|max-height|box-sizing|background-clip|background-origin|writing-mode|position|display|flex.*|align.*|justify.*)$/.test(k))))return false;
  const child=Object.values(p.parts)[0];
  if(!fixed(child,'width')||!fixed(child,'height')||child.component||child.content||child.layout||child.layoutByProp||child.layoutByCombination||child.absolutePlacement||child.absolutePlacementByCombination||child.absoluteGeometry||child.absoluteGeometryByCombination||child.placement||child.overlay||child.repeat||child.mask||
      /width|height|flex|position|margin|align|padding|border|display|box-sizing/.test(dynamic(child)))return false;
  if([child.tokens,child.literals,child.declared].some(h=>Object.keys(h??{}).some(k=>/^(?:position|display|padding.*|border.*|box-sizing|margin.*|flex-(?:grow|basis)|align.*|min-width|min-height|max-width|max-height)$/.test(k))))return false;
  const shrink=own(child,'flex-shrink');if(shrink.length!==1||!numbers(shrink[0])?.every(n=>n===0))return false;
  return ['padding-inline','padding-block'].every(k=>{const a=own(p,k);return a.length===1&&!!numbers(a[0])?.every(n=>Number.isFinite(n)&&n>=0)});
 };
 // Only finite selectors that can affect this box or its direct children
 // enter the proof. Three axes and 256 complete tuples bound this projection;
 // unrelated text props never create a synthetic cartesian product.
 const conditionalFixed=(part:Part,root:boolean,path:string[]):CenteredFixedPaddingProjection|undefined=>{
  if(part.component||part.slot||part.shape||part.icon||part.text!==undefined||part.content||part.repeat||part.mask||part.meter||!part.parts)return;
  const names=new Set<string>(),domain=new Map<string,string[]>();
  const absent=input.bindings.figma.absentVariants??[];
  for(const p of input.props){
   if(p.type==='boolean'&&typeof p.default==='boolean')domain.set(p.name,['false','true']);
   else if(typeof p.type==='object'&&'enum'in p.type&&typeof p.default==='string'&&p.type.enum.includes(p.default))domain.set(p.name,p.type.enum);
  }
  const inspect=(p:Part,top=false):boolean=>{
   const add=(name:string)=>{if(!domain.has(name))return false;names.add(name);return names.size<=3;};
   for(const table of [p.layoutByCombination,...p.tokensByCombination??[],...p.literalsByCombination??[],p.presenceByCombination]){
    if(!table)continue;
    if(new Set(table.props).size!==table.props.length||table.props.some(n=>!add(n)))return false;
    const keys=new Set<string>();
    for(const row of table.rows){if(row.values.length!==table.props.length||row.values.some((v,i)=>typeof v!=='string'||!domain.get(table.props[i])!.includes(v))||keys.has(JSON.stringify(row.values)))return false;keys.add(JSON.stringify(row.values));}
    // Root and presence domains stay complete. Child paint/style rows may
    // omit a tuple only when the presence test below proves it absent.
    if(top||table===p.presenceByCombination){
     const omitted=top?new Set(absent.filter(row=>Object.keys(row).length===table.props.length&&table.props.every(name=>Object.hasOwn(row,name)&&domain.get(name)!.includes(String(row[name])))).map(row=>JSON.stringify(table.props.map(name=>String(row[name]))))):new Set<string>();
     if(keys.size!==table.props.reduce((n,k)=>n*domain.get(k)!.length,1)-omitted.size||[...keys].some(key=>omitted.has(key)))return false;
    }
   }
   for(const entry of [...tokensByPropEntries(p),...p.literalsByProp??[],...(p.layoutByProp?[p.layoutByProp]:[])]){
    if(!add(entry.prop)||Object.keys(entry.map).some(v=>!domain.get(entry.prop)!.includes(v))||top&&domain.get(entry.prop)!.some(v=>!Object.hasOwn(entry.map,v)))return false;
   }
   for(const rule of p.stylesWhen??[])if(!add(rule.prop)||!domain.get(rule.prop)!.includes(String(rule.equals))||Object.keys(rule.styles).some(key=>/padding|width|height|background-clip|background-origin/.test(key)))return false;
   if(p.visibleWhen&&!add(p.visibleWhen.prop))return false;
   const text=JSON.stringify([p.tokens,p.literals]);
   for(const prop of input.props)if(text.includes('{'+prop.name+'}')&&!add(prop.name))return false;
   return p.slot?true:Object.values(p.parts??{}).every(child=>inspect(child));
  };
  if(!inspect(part,true)||!names.size||names.size>3)return;
  const props=[...names].sort(),count=props.reduce((n,k)=>n*domain.get(k)!.length,1);
  if(count>256)return;
  const tuples:string[][]=[[]];
  for(const name of props){const prior=tuples.splice(0);for(const tuple of prior)for(const value of domain.get(name)!)tuples.push([...tuple,value]);}
  const rows:CenteredFixedPaddingProjection['rows']=[];
  for(const values of tuples){
   const subst=Object.fromEntries(props.map((name,i)=>[name,values[i]]));
   if(absent.some(row=>Object.entries(row).every(([name,value])=>subst[name]===String(value))))continue;
   const replace=(value:string)=>value.replace(/\{([^{}]+)\}/g,(all,key)=>Object.hasOwn(subst,key)?subst[key]:all);
   const visible=(p:Part)=>{
    const when=p.visibleWhen;
    return (!when||(when.equals===undefined?subst[when.prop]==='true':(Array.isArray(when.equals)?when.equals:[when.equals]).map(String).includes(subst[when.prop])))&&resolvePresence(p,subst);
   };
   const resolved=(p:Part):Part|undefined=>{
    // Sparse child style tables are valid only where exact presence excludes
    // the missing tuples. Every table on a visible child still needs a row.
    for(const table of [p.layoutByCombination,...p.tokensByCombination??[],...p.literalsByCombination??[]])
     if(table&&!table.rows.some(row=>table.props.every((name,i)=>subst[name]===row.values[i])))return;
    for(const entry of [...tokensByPropEntries(p),...p.literalsByProp??[],...(p.layoutByProp?[p.layoutByProp]:[])])
     if(!Object.hasOwn(entry.map,subst[entry.prop]))return;
    const layout=resolveLayout(p,subst),declared={...p.declared};
    for(const rule of p.stylesWhen??[])if(subst[rule.prop]===String(rule.equals))Object.assign(declared,rule.styles);
    const activeLayout=[p.layoutByProp?.map[subst[p.layoutByProp.prop]],...(p.layoutByCombination?.rows??[]).filter(row=>p.layoutByCombination!.props.every((name,i)=>subst[name]===row.values[i])).map(row=>row.layout)].filter(Boolean);
    // Refuse conflicting active selectors rather than relying on different
    // CSS specificity and inline-object merge orders to choose a winner.
    for(const key of new Set(activeLayout.flatMap(row=>Object.keys(row!))))if(new Set(activeLayout.filter(row=>Object.hasOwn(row!,key)).map(row=>JSON.stringify((row as any)[key]))).size>1)return;
    const activeTokens=[...tokensByPropEntries(p).flatMap(entry=>entry.map[subst[entry.prop]]?[entry.map[subst[entry.prop]]]:[]),...(p.tokensByCombination??[]).flatMap(table=>table.rows.filter(row=>table.props.every((name,i)=>subst[name]===row.values[i])).map(row=>row.tokens))];
    const activeLiterals=[...(p.literalsByProp??[]).flatMap(entry=>entry.map[subst[entry.prop]]?[entry.map[subst[entry.prop]]]:[]),...(p.literalsByCombination??[]).flatMap(table=>table.rows.filter(row=>table.props.every((name,i)=>subst[name]===row.values[i])).map(row=>row.literals))];
    for(const key of ['width','height','min-width','max-width','min-height','max-height','padding-inline','padding-block','flex-shrink']){
     const candidates=[...activeTokens,...activeLiterals].flatMap(map=>map[key]!==undefined?[numbers(replace(map[key]),new Set(),/(?:^|-)(?:width|height)$/.test(key))]:[]);
     if(candidates.some(row=>!row)||new Set(candidates.map(row=>JSON.stringify(row))).size>1)return;
    }
    const out:Part={...p,layout:layout?{...layout}:undefined,tokens:Object.fromEntries(Object.entries(resolveTokens(p,subst)).map(([k,v])=>[k,replace(v)])),literals:Object.fromEntries(Object.entries(resolveLiterals(p,subst)).map(([k,v])=>[k,replace(v)])),declared};
    for(const key of ['layoutByProp','layoutByCombination','tokensByProp','tokensByCombination','literalsByProp','literalsByCombination','stylesWhen','visibleWhen','presenceByCombination'] as const)delete out[key];
    // Matching fixed min/max bounds cannot change the chosen extent. Any
    // different, intrinsic or unresolved clamp remains a refusal below.
    for(const axis of ['width','height'])for(const prefix of ['min-','max-']){
     const extent=own(out,axis),bound=own(out,prefix+axis);
     if(bound.length&&extent.length===1&&bound.length===1){
      const a=numbers(extent[0],new Set(),true),b=numbers(bound[0],new Set(),true);
      if(a&&b&&JSON.stringify(a)===JSON.stringify(b))for(const map of [out.tokens,out.literals,out.declared])if(map)delete map[prefix+axis];
     }
    }

    const cssLayout={'display':'display','flex-direction':'direction','align-items':'align','justify-content':'justify'} as const;
    for(const [css,key]of Object.entries(cssLayout))if(declared[css]!==undefined){
     const value=declared[css];if(!['flex','inline-flex','row','column','center','start','end','stretch'].includes(value))return;
     out.layout={...out.layout,[key]:value};delete out.declared![css];
    }
    if(p.slot){delete out.parts;}else if(p.parts){out.parts={};for(const [name,child]of Object.entries(p.parts)){if(!visible(child))continue;const next=resolved(child);if(!next)return;out.parts[name]=next;}}
    return out;
   };
   if(!visible(part))continue;
   const selected=resolved(part);
   if(selected&&fixedCentered(selected,root))rows.push({values,literals:{'padding-inline':'0px','padding-block':'0px'}});
  }
  return rows.length?{path:[...path],props,rows}:undefined;
 };
 const clone=structuredClone(input);let changed=false;
 for(const {part,path} of walkAnatomy(clone)){
  // For one nonshrinking fixed child, symmetric padding cancels on both
  // centered axes. CSS alone must drop it so padding cannot inflate the box.
  if(fixedCentered(part,path.length===1)){
   projections?.push({path:[...path],props:[],rows:[{values:[],literals:{'padding-inline':'0px','padding-block':'0px'}}]});
   for(const holder of [part.tokens,part.literals,part.declared])if(holder){delete holder['padding-inline'];delete holder['padding-block'];}
   changed=true;continue;
  }
  const projection=conditionalFixed(part,path.length===1,path);
  if(projection){
   projections?.push(projection);
   part.literalsByCombination=[...(part.literalsByCombination??[]),{props:projection.props,rows:projection.rows}];
   changed=true;continue;
  }

  if(path.length<2||part.layout?.growBasis!=='zero'||part.layout.justify!=='center'||part.layout.wrap||part.layoutByProp||part.layoutByCombination||!part.parts||part.component||part.slot||part.text!==undefined||part.content||part.shape||part.icon||part.repeat||part.meter)continue;
  let parent:Part=clone.anatomy[path[0]];for(const key of path.slice(1,-1))parent=parent.parts![key];
  const direction=part.layout.direction??'row';
  // Complete container tables also carry alignment and paint order. These
  // do not change which padding lies on the parent's main axis; an axis
  // switch, growth table or any other layout channel still declines lowering.
  const jointAxisChanges=parent.layoutByCombination?.rows.some(({layout})=>
   Object.keys(layout).some(k=>!['direction','align','justify','reversePaint'].includes(k))||
   layout.direction!==direction&&layout.direction!==direction+'-reverse');
  if(!['row','column'].includes(direction)||!parent.layout||parent.layout.wrap||(parent.layout?.direction??'row')!==direction||jointAxisChanges||Object.values(parent.layoutByProp?.map??{}).some(o=>Object.keys(o).some(k=>k!=='direction')||o.direction!==undefined&&o.direction!==direction&&o.direction!==direction+'-reverse')||parent.layout?.display==='grid')continue;
  const children=Object.values(part.parts);if(!children.length||children.some(c=>c.shape?.kind!=='path'||c.shape.parentViewport||c.parts||c.layout?.grow||c.layoutByProp||c.layoutByCombination||c.absoluteGeometry||c.absoluteGeometryByCombination||c.overlay||c.absolutePlacement||c.placement||c.declared?.position==='absolute'||/"(?:flex(?:-shrink|-basis|-grow)?|position|writing-mode)":/.test(JSON.stringify([c.tokens,c.literals,c.declared,c.states,c.declaredStates,c.stylesWhen,c.tokensByProp,c.tokensByCombination,c.literalsByProp,c.literalsByCombination]))))continue;
  const channel=direction==='column'?'padding-block':'padding-inline';
  // Limit to static own style holders; conditional or competing padding can
  // change the symmetry and must retain its original interpretation.
  const forbidden=direction==='column'?['padding','padding-top','padding-bottom','padding-block-start','padding-block-end']:['padding','padding-left','padding-right','padding-inline-start','padding-inline-end'];
  const dynamic=[part.states,part.declaredStates,part.statesByProp,part.stylesWhen,part.tokensByProp,part.tokensByCombination,part.literalsByProp,part.literalsByCombination];
  if(dynamic.some(v=>v&&/padding|flex-wrap|justify-content/.test(JSON.stringify(v))))continue;
  const holders=[part.tokens,part.literals,part.declared];
  if(holders.some(h=>h&&Object.keys(h).some(k=>forbidden.includes(k)||['flex-wrap','flex-direction','justify-content','writing-mode'].includes(k))))continue;
  const pads=holders.flatMap(h=>h?.[channel]!==undefined?[h[channel]]:[]);if(pads.length!==1||!scalar(pads[0]))continue;
  for(const h of holders)if(h)delete h[channel];changed=true;
 }
 return changed?clone:input;
}

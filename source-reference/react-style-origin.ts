/** Read-only CSS provenance for the React source path. Refuse unresolved
 * cascade ties rather than choosing a variable by equal rendered values. */
import type {CDPSession, Page} from 'playwright-core';
import { authoredLengthIsUsed } from './layout-unit.js';
import type {ReactOwnership} from './react-ownership.js';

const matchedStyles = (cdp: CDPSession, nodeId: number) => cdp.send('CSS.getMatchedStylesForNode', {nodeId});
const layerTree = (cdp: CDPSession, nodeId: number) => cdp.send('CSS.getLayersForNode', {nodeId});
type Matched = Awaited<ReturnType<typeof matchedStyles>>;
type Layers = Awaited<ReturnType<typeof layerTree>>;
/** `fill` is an own `width:100%` whose used width IS a DEFINITE containing width. It is
 * neither a fixed nor an automatic size: a consumer must qualify its layout. */
export interface ReactSizeOrigin {
 channel:'width'|'height';status:'fixed'|'auto'|'fill'|'unresolved';value?:string;authoredValue?:string;selectors:string[];reason?:string;
}
export const sourceTokenChannels = ['background-color', 'color', 'font-weight'] as const;
export interface ReactStyleOrigin {
  version: 1;
  roots: Array<{path: string; tag: string; channels: Array<{
    channel: string; status: 'direct-variable' | 'unresolved';
    variable?: string; rawValue?: string; computedValue?: string;
    selectors: string[]; reason?: string;
  }>; sizes?:ReactSizeOrigin[]}>;
}
const compare = (a: number[], b: number[]) => {
  for (let i=0;i<a.length;i++) if(a[i]!==b[i]) return a[i]-b[i];
  return 0;
};

/** A bounded cascade: author rules/inline styles, media/supports and named
 * layers. Source-order ties, inheritance, scopes, containers, animation,
 * shorthand/fallback/arithmetic values and other origins are not inferred. */
export function resolveReactStyleDeclaration(matched: Matched, layers: Layers, channel: string, competing:string[] = []) {
  type Declaration = {rank: number[]; value: string; selector: string};
  const declarations: Declaration[] = [], problems: string[] = [];
  const orders = new Map<string, number>();
  const visit = (node: Layers['rootLayer'], parents: string[]) => {
    orders.set(parents.join('.'),node.order);
    for(const child of node.subLayers??[]) visit(child,[...parents,child.name]);
  };
  visit(layers.rootLayer,[]);
  const add = (style: NonNullable<Matched['inlineStyle']>, rank: (important:boolean)=>number[], selector:string) => {
    for(const prop of style.cssProperties) {
      if(prop.name!==channel || prop.disabled || prop.parsedOk===false) continue;
      declarations.push({rank:rank(!!prop.important),value:(prop.important?prop.value.replace(/\s*!important\s*$/i,''):prop.value).trim(),selector});
    }
  };
  if(matched.cssKeyframesRules?.length) problems.push('animated-source');
  for(const match of matched.matchedCSSRules??[]) {
    const rule=match.rule;
    if(!rule.style.cssProperties.some(p=>(p.name===channel||p.name==='all'||competing.includes(p.name))&&!p.disabled&&p.parsedOk!==false)) continue;
    if(rule.media?.some(m=>m.mediaList?.length && !m.mediaList.some(q=>q.active)) || rule.supports?.some(s=>!s.active)) continue;
    if(rule.media?.some(m=>!m.mediaList?.length)) {problems.push('media-condition-unknown');continue;}
    if(rule.containerQueries?.length || rule.scopes?.length || rule.startingStyles?.length || rule.navigations?.length) {
      problems.push('conditional-cascade-unsupported');continue;
    }
    if(rule.style.cssProperties.some(p=>p.name==='all'&&!p.disabled&&p.parsedOk!==false)) {problems.push('all-reset-unsupported');continue;}
    if(rule.origin==='user-agent') {
      if(rule.style.cssProperties.some(p=>p.name===channel&&p.important)) problems.push('important-user-agent-rule');
      continue;
    }
    if(rule.origin!=='regular') {problems.push('style-origin-unsupported');continue;}
    if(rule.style.cssProperties.some(p=>competing.includes(p.name)&&!p.disabled&&p.parsedOk!==false)){problems.push('logical-size-cascade-unsupported');continue;}
    const specificities=match.matchingSelectors.map(i=>rule.selectorList.selectors[i]?.specificity);
    if(!specificities.length||specificities.some(s=>!s)) {problems.push('selector-specificity-missing');continue;}
    const specificity=specificities.map(s=>[s!.a,s!.b,s!.c]).sort(compare).at(-1)!;
    const layer=(rule.layers??[]).map(l=>l.text).reverse().join('.');
    const order=orders.get(layer);
    if(order===undefined) {problems.push('layer-order-missing');continue;}
    add(rule.style,important=>[important?1:0,0,important?-order:order,...specificity],rule.selectorList.text);
  }
  if(matched.inlineStyle?.cssProperties.some(p=>p.name==='all'&&!p.disabled&&p.parsedOk!==false)) problems.push('all-reset-unsupported');
  if(matched.inlineStyle?.cssProperties.some(p=>competing.includes(p.name)&&!p.disabled&&p.parsedOk!==false)) problems.push('logical-size-cascade-unsupported');
  if(matched.inlineStyle) add(matched.inlineStyle,important=>[important?1:0,1,0,0,0,0],'<inline>');
  if(problems.length) return {channel,status:'unresolved' as const,selectors:[],reason:[...new Set(problems)].sort().join(',')};
  declarations.sort((a,b)=>compare(b.rank,a.rank));
  const winners=declarations.filter(d=>compare(d.rank,declarations[0].rank)===0);
  const values=[...new Set(winners.map(d=>d.value))];
  const selectors=[...new Set(winners.map(d=>d.selector))].sort();
  if(values.length!==1) return {channel,status:'unresolved' as const,selectors,reason:values.length?'cascade-order-tie':'no-own-declaration'};
  return {channel,status:'resolved' as const,value:values[0],selectors};
}
export function resolveReactStyleOrigin(matched:Matched,layers:Layers,channel:string):ReactStyleOrigin['roots'][number]['channels'][number]{
  const declaration=resolveReactStyleDeclaration(matched,layers,channel);
  if(declaration.status==='unresolved')return declaration;
  const {value,selectors}=declaration;
  const direct=/^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/.exec(value);
  return direct ? {channel,status:'direct-variable' as const,variable:direct[1],selectors}
    : {channel,status:'unresolved' as const,selectors,reason:'winning-value-not-direct-variable'};
}

/** Only absolute px and theme-relative rem arithmetic is admitted. Values
 * depending on a viewport, container, percentage, font metric or fallback
 * stay unresolved. The browser, not this grammar, evaluates the expression. */
export function fixedSizeExpression(value:string,variables:Record<string,string>,seen=new Set<string>()):boolean{
 const expanded=value.replace(/var\(\s*(--[A-Za-z0-9_-]+)\s*\)/g,(_whole,name:string)=>{
  if(seen.has(name)||!variables[name])return '!';
  const next=new Set(seen);next.add(name);
  return fixedSizeExpression(variables[name],variables,next)?'('+variables[name].replace(/var\(\s*(--[A-Za-z0-9_-]+)\s*\)/g,'1px')+')':'!';
 });
 return !/[A-Za-z_%!]/.test(expanded.replace(/(?:\d*\.)?\d+(?:px|rem)\b/g,'1').replace(/calc\(/g,'(')) && /^[\d.()+*/\s-]+$/.test(expanded.replace(/(?:\d*\.)?\d+(?:px|rem)\b/g,'1').replace(/calc\(/g,'('));
}

/** Same element-index path convention as the authenticated ownership census.
 * No source, styles, DOM or custom properties are modified by this read. */
export async function readReactStyleOrigin(page: Page, selector: string, ownership: ReactOwnership): Promise<ReactStyleOrigin> {
  const out: ReactStyleOrigin={version:1,roots:[]};
  const cdp=await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable');await cdp.send('CSS.enable');await cdp.send('DOM.getDocument');
    const paths=[...new Set(ownership.components.flatMap(c=>c.roots))].sort();
    for(const path of paths) {
      const expression=`(()=>{let node=document.querySelector(${JSON.stringify(selector)});for(const i of ${JSON.stringify(path===''?[]:path.split('.').map(Number))})node=node?.children[i];return node;})()`;
      const handle=await cdp.send('Runtime.evaluate',{expression});
      const objectId=handle.result.objectId;
      if(!objectId||handle.exceptionDetails) throw Error('react-style-origin-root-missing');
      try {
        const {nodeId}=await cdp.send('DOM.requestNode',{objectId});
        const [matched,layers]=await Promise.all([matchedStyles(cdp,nodeId),layerTree(cdp,nodeId)]);
        const channels=sourceTokenChannels.map(channel=>resolveReactStyleOrigin(matched,layers,channel));
        const sizeDeclarations=(['width','height'] as const).map(channel=>({channel,declaration:resolveReactStyleDeclaration(matched,layers,channel,['inline-size','block-size'])}));
        const variables=channels.flatMap(c=>c.variable?[c.variable]:[]);
        const read=await cdp.send('Runtime.callFunctionOn',{objectId,returnByValue:true,
          functionDeclaration:`function(){const style=getComputedStyle(this),typed=this.computedStyleMap?.(),parent=this.parentElement&&getComputedStyle(this.parentElement),edges=s=>['padding-left','padding-right','border-left-width','border-right-width'].reduce((n,k)=>n+parseFloat(s.getPropertyValue(k)),0);const block=d=>['block','flow-root','list-item'].includes(d),definite=()=>{for(let a=this.parentElement;a;a=a.parentElement){if(a===document.documentElement)return true;const s=getComputedStyle(a),w=a.computedStyleMap?.().get('width'),level=block(s.display)||['flex','grid'].includes(s.display);if(w instanceof CSSUnitValue&&w.unit==='px')return level||s.display==='inline-block';if(!(w instanceof CSSKeywordValue&&w.value==='auto'||w instanceof CSSUnitValue&&w.unit==='percent'||w instanceof CSSMathValue)||!level||s.float!=='none'||!['static','relative'].includes(s.position)||!a.parentElement||!block(getComputedStyle(a.parentElement).display))return false;}return false;};return {tag:this.localName,containingWidthDefinite:definite(),fillsContainingWidth:!!parent&&Math.abs(parseFloat(style.width)+(style.boxSizing==='border-box'?0:edges(style))-(parseFloat(parent.width)-(parent.boxSizing==='border-box'?edges(parent):0)))<=0.001,animated:this.getAnimations().length>0,variables:Object.fromEntries([...style].filter(p=>p.startsWith('--')).map(p=>[p,style.getPropertyValue(p).trim()])),sizes:Object.fromEntries(['width','height'].map(p=>{const v=typed?.get(p);return [p,v instanceof CSSUnitValue?{unit:v.unit,value:v.value}:v instanceof CSSKeywordValue?{keyword:v.value}:{}]})),values:Object.fromEntries(${JSON.stringify([...sourceTokenChannels,...variables,'width','height'])}.map(p=>[p,style.getPropertyValue(p).trim()]))};}`});
        if(read.exceptionDetails) throw Error('react-style-origin-read-failed');
        const value=read.result.value as {tag:string;fillsContainingWidth:boolean;containingWidthDefinite:boolean;animated:boolean;values:Record<string,string>;variables:Record<string,string>;sizes:Record<string,{unit?:string;value?:number;keyword?:string}>};
        if(value.tag!==ownership.nodes.find(n=>n.path===path)?.tag) throw Error('react-style-origin-path-mismatch');
        const sizes:ReactSizeOrigin[]=sizeDeclarations.map(({channel,declaration})=>{
          const typed=value.sizes[channel],base={channel,selectors:declaration.selectors,...(declaration.status==='resolved'?{authoredValue:declaration.value}:{})};
          if(value.animated)return {...base,status:'unresolved',reason:'animated-source'};
          if(declaration.status==='unresolved'&&declaration.reason!=='no-own-declaration')return {...base,status:'unresolved',reason:declaration.reason};
          if(typed.keyword==='auto')return declaration.status==='unresolved'||declaration.value==='auto'
            ? {...base,status:'auto',value:'auto'} : {...base,status:'unresolved',reason:'indirect-or-invalid-auto-size'};
          if(declaration.status!=='resolved')return {...base,status:'unresolved',reason:'no-own-fixed-size-declaration'};
          // Exactly `100%`, and only while the box really takes its containing
          // width: calc(), other percentages and an active clamp name nothing new.
          // (border box against the parent's content box, the file's px epsilon)
          // A shrink-to-fit ancestor sizes itself FROM this box: the percentage is
          // cyclic and the observed width proves no fill. Walk up to an own px
          // length or the viewport through in-flow block-level boxes only.
          if(channel==='width'&&declaration.value==='100%')return !(typed.unit==='percent'&&typed.value===100&&value.fillsContainingWidth)
            ? {...base,status:'unresolved',reason:'declared-fill-width-not-used'}
            : value.containingWidthDefinite ? {...base,status:'fill',value:'100%'}
            : {...base,status:'unresolved',reason:'declared-fill-width-containing-block-indefinite'};
          if(!fixedSizeExpression(declaration.value,value.variables))return {...base,status:'unresolved',reason:'responsive-or-unsupported-size-expression'};
          if(typed.unit!=='px'||!Number.isFinite(typed.value)||typed.value!<0)return {...base,status:'unresolved',reason:'fixed-size-not-pixels'};
          // The used length may be the declared one in 1/64 px layout units (18.4px reads 18.3906px).
          if(Math.abs(parseFloat(value.values[channel])-typed.value!)>0.001&&!authoredLengthIsUsed(typed.value+'px',value.values[channel]))return {...base,status:'unresolved',reason:'size-clamped-or-layout-dependent'};
          return {...base,status:'fixed',value:value.values[channel]};
        });
        out.roots.push({path,tag:value.tag,sizes,channels:channels.map(c=>value.animated
          ? {channel:c.channel,status:'unresolved',selectors:c.selectors,reason:'animated-source'}
          : c.variable && value.values[c.variable] ? {...c,rawValue:value.values[c.variable],computedValue:value.values[c.channel]}
          : {...c,status:'unresolved',reason:c.reason??'source-variable-empty'})});
      } finally {await cdp.send('Runtime.releaseObject',{objectId});}
    }
  } finally {await cdp.detach();}
  return out;
}

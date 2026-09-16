/** Read-only CSS provenance for the React source path. Refuse unresolved
 * cascade ties rather than choosing a variable by equal rendered values. */
import type {CDPSession, Page} from 'playwright-core';
import type {ReactOwnership} from './react-ownership.js';

const matchedStyles = (cdp: CDPSession, nodeId: number) => cdp.send('CSS.getMatchedStylesForNode', {nodeId});
const layerTree = (cdp: CDPSession, nodeId: number) => cdp.send('CSS.getLayersForNode', {nodeId});
type Matched = Awaited<ReturnType<typeof matchedStyles>>;
type Layers = Awaited<ReturnType<typeof layerTree>>;
export const sourceTokenChannels = ['background-color', 'color', 'font-weight'] as const;
export interface ReactStyleOrigin {
  version: 1;
  roots: Array<{path: string; tag: string; channels: Array<{
    channel: string; status: 'direct-variable' | 'unresolved';
    variable?: string; rawValue?: string; computedValue?: string;
    selectors: string[]; reason?: string;
  }>}>;
}
const compare = (a: number[], b: number[]) => {
  for (let i=0;i<a.length;i++) if(a[i]!==b[i]) return a[i]-b[i];
  return 0;
};

/** A bounded cascade: author rules/inline styles, media/supports and named
 * layers. Source-order ties, inheritance, scopes, containers, animation,
 * shorthand/fallback/arithmetic values and other origins are not inferred. */
export function resolveReactStyleOrigin(matched: Matched, layers: Layers, channel: string) {
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
    if(!rule.style.cssProperties.some(p=>(p.name===channel||p.name==='all')&&!p.disabled&&p.parsedOk!==false)) continue;
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
    const specificities=match.matchingSelectors.map(i=>rule.selectorList.selectors[i]?.specificity);
    if(!specificities.length||specificities.some(s=>!s)) {problems.push('selector-specificity-missing');continue;}
    const specificity=specificities.map(s=>[s!.a,s!.b,s!.c]).sort(compare).at(-1)!;
    const layer=(rule.layers??[]).map(l=>l.text).reverse().join('.');
    const order=orders.get(layer);
    if(order===undefined) {problems.push('layer-order-missing');continue;}
    add(rule.style,important=>[important?1:0,0,important?-order:order,...specificity],rule.selectorList.text);
  }
  if(matched.inlineStyle?.cssProperties.some(p=>p.name==='all'&&!p.disabled&&p.parsedOk!==false)) problems.push('all-reset-unsupported');
  if(matched.inlineStyle) add(matched.inlineStyle,important=>[important?1:0,1,0,0,0,0],'<inline>');
  if(problems.length) return {channel,status:'unresolved' as const,selectors:[],reason:[...new Set(problems)].sort().join(',')};
  declarations.sort((a,b)=>compare(b.rank,a.rank));
  const winners=declarations.filter(d=>compare(d.rank,declarations[0].rank)===0);
  const values=[...new Set(winners.map(d=>d.value))];
  const selectors=[...new Set(winners.map(d=>d.selector))].sort();
  if(values.length!==1) return {channel,status:'unresolved' as const,selectors,reason:values.length?'cascade-order-tie':'no-own-declaration'};
  const direct=/^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/.exec(values[0]);
  return direct ? {channel,status:'direct-variable' as const,variable:direct[1],selectors}
    : {channel,status:'unresolved' as const,selectors,reason:'winning-value-not-direct-variable'};
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
        const variables=channels.flatMap(c=>c.variable?[c.variable]:[]);
        const read=await cdp.send('Runtime.callFunctionOn',{objectId,returnByValue:true,
          functionDeclaration:`function(){const style=getComputedStyle(this);return {tag:this.localName,animated:this.getAnimations().length>0,values:Object.fromEntries(${JSON.stringify([...sourceTokenChannels,...variables])}.map(p=>[p,style.getPropertyValue(p).trim()]))};}`});
        if(read.exceptionDetails) throw Error('react-style-origin-read-failed');
        const value=read.result.value as {tag:string;animated:boolean;values:Record<string,string>};
        if(value.tag!==ownership.nodes.find(n=>n.path===path)?.tag) throw Error('react-style-origin-path-mismatch');
        out.roots.push({path,tag:value.tag,channels:channels.map(c=>value.animated
          ? {channel:c.channel,status:'unresolved',selectors:c.selectors,reason:'animated-source'}
          : c.variable && value.values[c.variable] ? {...c,rawValue:value.values[c.variable],computedValue:value.values[c.channel]}
          : {...c,status:'unresolved',reason:c.reason??'source-variable-empty'})});
      } finally {await cdp.send('Runtime.releaseObject',{objectId});}
    }
  } finally {await cdp.detach();}
  return out;
}

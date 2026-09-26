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
  }>; sizes?:ReactSizeOrigin[];
  /** Which ancestor's own px width made a `fill` width definite (1 = parent). */
  fillWidthContainer?:{depth:number}}>;
}
const compare = (a: number[], b: number[]) => {
  for (let i=0;i<a.length;i++) if(a[i]!==b[i]) return a[i]-b[i];
  return 0;
};

/** Is this complex selector carried by the element ITSELF? The subject compound
 * (after the last top-level combinator) must name a class, attribute or id
 * token: a compound that matched the element can only do so through a token
 * the element has. Ancestor or sibling parts are CONDITIONS on the author's
 * own rule (`.group[data-size] .thumb`), not its declarer. A universal or
 * tag-only subject (`#w > *`, `div > div`) reaches in from outside, and so
 * does anything hidden in a functional pseudo-class, which is judged by none
 * of its arguments. Nesting (`&`) is not resolved here and is not own. */
export function selectorSubjectIsOwn(selector: string): boolean {
  selector = selector.trim();
  let depth = 0, subject = 0;
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i];
    if (c === '\\') { // an escape hides one character, or 1-6 hex digits and ONE following space
      const hex = /^[0-9a-fA-F]{1,6}\s?/.exec(selector.slice(i + 1));
      i += hex ? hex[0].length : 1; continue;
    }
    if (c === '"' || c === "'") { const end = selector.indexOf(c, i + 1); if (end < 0) return false; i = end; continue; }
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (!depth && /[\s>+~]/.test(c)) subject = i + 1;
  }
  if (depth) return false;
  let compound = selector.slice(subject).trim(), stripped = '';
  if (!compound || compound.includes('&')) return false;
  for (let i = 0, open = 0; i < compound.length; i++) { // drop every functional pseudo-class with its arguments
    const c = compound[i];
    if (c === '\\') { if (!open) stripped += compound.slice(i, i + 2); i++; continue; }
    if (!open && c === ':' && /^:[a-zA-Z-]+\(/.test(compound.slice(i))) { i = compound.indexOf('(', i); open = 1; continue; }
    if (open) { if (c === '(') open++; else if (c === ')') open--; continue; }
    stripped += c;
  }
  compound = stripped;
  return /(?:^|[^\\])(?:\.|#)(?:[A-Za-z_-]|\\|[^\x00-\x7f])/.test(' ' + compound) || /(?:^|[^\\])\[/.test(' ' + compound);
}

/** A bounded cascade: author rules/inline styles, media/supports and named
 * layers. Separate, non-overlapping rule ranges in ONE stylesheet establish
 * source order after priority ties in one captured tree scope. Cross-sheet order, declaration order within
 * one rule, nesting, inheritance, scopes and other unsupported origins are not
 * inferred. CSS Cascade 5 section 6.1; CDP CSSStyle.range is sheet-relative. */
export function resolveReactStyleDeclaration(matched: Matched, layers: Layers, channel: string, competing:string[] = []) {
  type Style = NonNullable<Matched['inlineStyle']>;
  type SourceOrder = {sheet:string;scope:number;range:NonNullable<Style['range']>};
  type Declaration = {rank: number[]; value: string; selector: string; own: boolean; reset:boolean; order?:SourceOrder};
  const rangeKey=(r:SourceOrder['range'])=>`${r.startLine}:${r.startColumn}-${r.endLine}:${r.endColumn}`;
  const declarations: Declaration[] = [], problems: string[] = [];
  // `all` participates at its own cascade priority, as if expanded in place.
  // Its winning default/inheritance/rollback semantics remain unsupported.
  const resetsChannel=!channel.startsWith('--')&&!['direction','unicode-bidi'].includes(channel);
  const relevant=(p:Style['cssProperties'][number])=>!p.disabled&&p.parsedOk!==false&&
    (p.name===channel||(resetsChannel&&p.name==='all'));
  const scopes=new Set<number>();
  const orders = new Map<string, number>();
  const visit = (node: Layers['rootLayer'], parents: string[]) => {
    orders.set(parents.join('.'),node.order);
    for(const child of node.subLayers??[]) visit(child,[...parents,child.name]);
  };
  visit(layers.rootLayer,[]);
  const add = (style: Style, rank: (important:boolean)=>number[], selector:string, own=true, order?:SourceOrder) => {
    for(const prop of style.cssProperties) {
      if(!relevant(prop)) continue;
      // CDP also emits range-less CSSOM summaries; `all` can be empty there
      // after one longhand overrides it. The authored reset is still present
      // and must compete. Never use that empty summary as a second declaration.
      if(prop.name==='all'&&!prop.range&&prop.text===undefined&&
        style.cssProperties.some(p=>p.name==='all'&&relevant(p)&&p.range&&p.text!==undefined)) continue;
      declarations.push({rank:rank(!!prop.important),value:(prop.important?prop.value.replace(/\s*!important\s*$/i,''):prop.value).trim(),
        selector,own,reset:prop.name==='all',order});
    }
  };
  if(matched.cssKeyframesRules?.length) problems.push('animated-source');
  for(const match of matched.matchedCSSRules??[]) {
    const rule=match.rule;
    if(!rule.style.cssProperties.some(p=>relevant(p)||(competing.includes(p.name)&&!p.disabled&&p.parsedOk!==false))) continue;
    if(rule.media?.some(m=>m.mediaList?.length && !m.mediaList.some(q=>q.active)) || rule.supports?.some(s=>!s.active)) continue;
    if(rule.media?.some(m=>!m.mediaList?.length)) {problems.push('media-condition-unknown');continue;}
    if(rule.containerQueries?.length || rule.scopes?.length || rule.startingStyles?.length || rule.navigations?.length) {
      problems.push('conditional-cascade-unsupported');continue;
    }
    if(rule.origin==='user-agent') {
      if(rule.style.cssProperties.some(p=>relevant(p)&&p.important)) problems.push('important-user-agent-rule');
      continue;
    }
    if(rule.origin!=='regular') {problems.push('style-origin-unsupported');continue;}
    const scope=rule.originTreeScopeNodeId;
    const validScope=scope!==undefined&&Number.isInteger(scope)&&scope>0;
    if(validScope)scopes.add(scope);
    if(rule.style.cssProperties.some(p=>competing.includes(p.name)&&!p.disabled&&p.parsedOk!==false)){problems.push('logical-size-cascade-unsupported');continue;}
    const specificities=match.matchingSelectors.map(i=>rule.selectorList.selectors[i]?.specificity);
    if(!specificities.length||specificities.some(s=>!s)) {problems.push('selector-specificity-missing');continue;}
    const specificity=specificities.map(s=>[s!.a,s!.b,s!.c]).sort(compare).at(-1)!;
    const layer=(rule.layers??[]).map(l=>l.text).reverse().join('.');
    const order=orders.get(layer);
    if(order===undefined) {problems.push('layer-order-missing');continue;}
    const range=rule.style.range;
    const validRange=range&&[range.startLine,range.startColumn,range.endLine,range.endColumn].every(n=>Number.isInteger(n)&&n>=0)&&
      compare([range.startLine,range.startColumn],[range.endLine,range.endColumn])<0;
    const sourceOrder=validRange&&validScope&&rule.styleSheetId&&rule.styleSheetId===rule.style.styleSheetId&&!rule.nestingSelectors?.length
      ?{sheet:rule.styleSheetId,scope,range}:undefined;
    add(rule.style,important=>[important?1:0,0,important?-order:order,...specificity],rule.selectorList.text,
      match.matchingSelectors.every(i=>selectorSubjectIsOwn(rule.selectorList.selectors[i]?.text??'')),sourceOrder);
  }
  if(matched.inlineStyle?.cssProperties.some(p=>competing.includes(p.name)&&!p.disabled&&p.parsedOk!==false)) problems.push('logical-size-cascade-unsupported');
  if(matched.inlineStyle) add(matched.inlineStyle,important=>[important?1:0,1,0,0,0,0],'<inline>');
  // Encapsulation precedes specificity/source order. One constructed sheet can
  // be adopted by both the document and a shadow root, so sheet identity alone
  // cannot prove the winning context (nor can a selector spelling).
  if(scopes.size>1)problems.push('encapsulation-cascade-unsupported');
  if(problems.length) return {channel,status:'unresolved' as const,selectors:[],reason:[...new Set(problems)].sort().join(',')};
  declarations.sort((a,b)=>compare(b.rank,a.rank));
  let winners=declarations.filter(d=>compare(d.rank,declarations[0].rank)===0);
  // Do not use CDP array order or selector names as an ordering witness. The
  // same source rule can occur more than once; identical ranges are one rule.
  // Overlapping ranges may describe nesting, whose order is outside this proof.
  if(new Set(winners.map(d=>d.value)).size>1&&winners.every(d=>d.order)&&new Set(winners.map(d=>d.order!.sheet)).size===1){
    const ranges=[...new Map(winners.map(d=>[rangeKey(d.order!.range),d.order!.range])).values()]
      .sort((a,b)=>compare([a.startLine,a.startColumn],[b.startLine,b.startColumn]));
    if(ranges.every((r,i)=>!i||compare([ranges[i-1].endLine,ranges[i-1].endColumn],[r.startLine,r.startColumn])<=0)){
      const last=rangeKey(ranges.at(-1)!);winners=winners.filter(d=>rangeKey(d.order!.range)===last);
    }
  }
  const values=[...new Set(winners.map(d=>d.value))];
  const selectors=[...new Set(winners.map(d=>d.selector))].sort();
  // Width/height are non-inherited and have initial value auto. Only these
  // two defaulting keywords have a local size meaning we can prove here.
  // Inheritance and origin/layer rollback still require a different reader.
  if(winners.some(d=>d.reset)&&!(values.length===1&&['width','height'].includes(channel)&&['initial','unset'].includes(values[0])))
    return {channel,status:'unresolved' as const,selectors,reason:'all-reset-unsupported'};
  if(values.length!==1) return {channel,status:'unresolved' as const,selectors,reason:values.length?'cascade-order-tie':'no-own-declaration'};
  return {channel,status:'resolved' as const,value:values[0],selectors,own:winners.every(d=>d.own)};
}
export function resolveReactStyleOrigin(matched:Matched,layers:Layers,channel:string):ReactStyleOrigin['roots'][number]['channels'][number]{
  const declaration=resolveReactStyleDeclaration(matched,layers,channel);
  if(declaration.status==='unresolved')return declaration;
  const {value,selectors}=declaration;
  const direct=/^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/.exec(value);
  return direct ? {channel,status:'direct-variable' as const,variable:direct[1],selectors}
    : {channel,status:'unresolved' as const,selectors,reason:'winning-value-not-direct-variable'};
}

/** Displays whose (non-replaced) boxes take no width and/or height: a mismatch there is named for what it is. */
const boxless=new Set(['inline','contents','table-row','table-row-group','table-header-group','table-footer-group','table-column','table-column-group']);
/** Only absolute px and theme-relative rem arithmetic is admitted. Values
 * depending on a viewport, container, percentage or font metric stay
 * unresolved. Variables contain computed substitution values; missing keys
 * denote unavailable/guaranteed-invalid values, while an empty PRESENT value
 * must not take a fallback. The browser evaluates the selected expression. */
export function fixedSizeExpression(value:string,variables:Record<string,string>,seen=new Set<string>()):boolean{
 const expand=(input:string,visiting:Set<string>,depth:number):string|undefined=>{
  if(depth>64||input.length>65536)return undefined;
  let output='',cursor=0;const variable=/var\(/gi;
  for(let match=variable.exec(input);match;match=variable.exec(input)){
   output+=input.slice(cursor,match.index);
   let end=variable.lastIndex,level=1,comma=-1;
   for(;end<input.length;end++){
    const c=input[end];if(c==='(')level++;else if(c===')'&&!--level)break;
    else if(c===','&&level===1&&comma<0)comma=end;
   }
   if(level)return undefined;
   const name=input.slice(variable.lastIndex,comma<0?end:comma).trim();
   if(!/^--[A-Za-z0-9_-]+$/.test(name))return undefined;
   const present=Object.hasOwn(variables,name);
   if(present&&visiting.has(name)||!present&&comma<0)return undefined;
   const next=new Set(visiting);if(present)next.add(name);
   const replacement=expand(present?variables[name]:input.slice(comma+1,end),next,depth+1);
   if(replacement===undefined||!replacement.trim())return undefined;
   output+='('+replacement+')';if(output.length>65536)return undefined;
   cursor=end+1;variable.lastIndex=cursor;
  }
  return output+input.slice(cursor);
 };
 const expanded=expand(value,seen,0);if(expanded===undefined)return false;
 return !/[A-Za-z_%!]/.test(expanded.replace(/(?:\d*\.)?\d+(?:px|rem)\b/g,'1').replace(/calc\(/g,'(')) && /^[\d.()+*/\s-]+$/.test(expanded.replace(/(?:\d*\.)?\d+(?:px|rem)\b/g,'1').replace(/calc\(/g,'('));
}

/** Same element-index path convention as the authenticated ownership census.
 * No source, styles, DOM or custom properties are modified by this read. */
/** In-page, read-only witness for an own \`width:100%\`. It records a fill only
 * when ALL of this was seen: the box is in flow and its width is the used-width
 * source (no float, static/relative, not a grown or based flex item); its
 * border box equals the parent's content box (the file's px epsilon); no zoom
 * on the box or any ancestor; and the containing width is DEFINITE through
 * in-flow, horizontal, block-level ancestors down from one with an own px
 * width. The harness stage, body and viewport are never a caller's place: a
 * chain they alone bound is named, not used. \`depth\` says which ancestor
 * supplied the width (1 = parent), never a selector string. */
const fillWitness = (stage: string) => `const fill=()=>{
  const no=problem=>({problem}),parentEl=this.parentElement;if(!parentEl)return no('declared-fill-width-not-used');
  if(!['static','relative'].includes(style.position)||style.float!=='none')return no('declared-fill-width-out-of-flow');
  for(let a=this;a;a=a.parentElement)if(getComputedStyle(a).zoom!=='1')return no('declared-fill-width-zoomed-context');
  const parent=getComputedStyle(parentEl),edges=s=>['padding-left','padding-right','border-left-width','border-right-width'].reduce((n,k)=>n+parseFloat(s.getPropertyValue(k)),0);
  if(['flex','inline-flex'].includes(parent.display)&&(style.flexGrow!=='0'||style.flexBasis!=='auto'))return no('declared-fill-width-not-used');
  if(!(Math.abs(parseFloat(style.width)+(style.boxSizing==='border-box'?0:edges(style))-(parseFloat(parent.width)-(parent.boxSizing==='border-box'?edges(parent):0)))<=0.001))return no('declared-fill-width-not-used');
  const block=d=>['block','flow-root','list-item'].includes(d),indefinite='declared-fill-width-containing-block-indefinite';let depth=0;
  for(let a=parentEl;a;a=a.parentElement){depth++;
    if(a===document.body||a===document.documentElement||a.matches(${JSON.stringify(stage)}))return no('declared-fill-width-containing-block-viewport-only');
    const s=getComputedStyle(a),w=a.computedStyleMap?.().get('width'),level=block(s.display)||['flex','grid'].includes(s.display);
    if(s.writingMode!=='horizontal-tb')return no(indefinite);
    if(w instanceof CSSUnitValue&&w.unit==='px')return level||s.display==='inline-block'?{depth}:no(indefinite);
    if(!(w instanceof CSSKeywordValue&&w.value==='auto'||w instanceof CSSUnitValue&&w.unit==='percent'||w instanceof CSSMathValue)||!level||s.float!=='none'||!['static','relative'].includes(s.position)||!a.parentElement||!block(getComputedStyle(a.parentElement).display))return no(indefinite);
  }
  return no(indefinite);};`;

export async function readReactStyleOrigin(page: Page, selector: string, ownership: ReactOwnership, stage = '#root', ownedHostPaths: readonly string[] = []): Promise<ReactStyleOrigin> {
  if(ownedHostPaths.some(path=>!ownership.nodes.some(node=>node.path===path&&node.createdBy&&ownership.components.some(c=>c.id===node.createdBy))))
    throw Error('react-style-origin-owned-host-unqualified');
  return {version:1,roots:await readOrigins(page,selector,ownership,stage,[...new Set([...ownership.components.flatMap(c=>c.roots),...ownedHostPaths])].sort())};
}

/** The same own-size rule, read for the host elements BELOW the component
 * roots: a part's size may be declared by the component's own rule under an
 * ancestor condition (`.group[data-size=default] .thumb`). Only sizes are
 * read; SVG subtrees keep their separate viewport evidence. A consumer may
 * carry `fixed` alone: every other status names why the size is not the
 * element's own used declaration. */
export interface ReactDescendantSizes { version: 1; nodes: Array<{path: string; tag: string; sizes: ReactSizeOrigin[]}> }
export async function readReactDescendantSizes(page: Page, selector: string, ownership: ReactOwnership, stage = '#root'): Promise<ReactDescendantSizes> {
  const roots=new Set(ownership.components.flatMap(c=>c.roots)),svg=ownership.nodes.filter(n=>n.tag==='svg').map(n=>n.path);
  const paths=ownership.nodes.map(n=>n.path).filter(p=>!roots.has(p)&&!svg.some(s=>p===s||p.startsWith(s===''?'':s+'.'))).sort();
  return {version:1,nodes:(await readOrigins(page,selector,ownership,stage,paths)).map(({path,tag,sizes})=>({path,tag,sizes:sizes??[]}))};
}

async function readOrigins(page: Page, selector: string, ownership: ReactOwnership, stage: string, paths: string[]): Promise<ReactStyleOrigin['roots']> {
  const out: {roots: ReactStyleOrigin['roots']}={roots:[]};
  const cdp=await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable');await cdp.send('CSS.enable');await cdp.send('DOM.getDocument');
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
        // Typed OM distinguishes an explicitly empty custom value from a
        // guaranteed-invalid value; CSSOM serializes both as the empty string.
        const read=await cdp.send('Runtime.callFunctionOn',{objectId,returnByValue:true,
          functionDeclaration:`function(){const style=getComputedStyle(this),typed=this.computedStyleMap?.();${fillWitness(stage)}const rect=this.getBoundingClientRect(),edge=sides=>sides.reduce((n,k)=>n+Math.trunc(parseFloat(style.getPropertyValue('padding-'+k))*64)+Math.trunc(parseFloat(style.getPropertyValue('border-'+k+'-width'))*64),0);let zoomed=false;for(let a=this;a;a=a.parentElement)if(getComputedStyle(a).zoom!=='1')zoomed=true;return {tag:this.localName,box:{display:style.display,contentBox:style.boxSizing!=='border-box',zoomed,width:rect.width*64,height:rect.height*64,edges:{width:edge(['left','right']),height:edge(['top','bottom'])}},fill:fill(),animated:this.getAnimations().length>0,variables:Object.fromEntries([...style].filter(p=>p.startsWith('--')&&typed?.get(p)!==undefined).map(p=>[p,style.getPropertyValue(p).trim()])),sizes:Object.fromEntries(['width','height'].map(p=>{const v=typed?.get(p);return [p,v instanceof CSSUnitValue?{unit:v.unit,value:v.value}:v instanceof CSSKeywordValue?{keyword:v.value}:{}]})),values:Object.fromEntries(${JSON.stringify([...sourceTokenChannels,...variables,'width','height'])}.map(p=>[p,style.getPropertyValue(p).trim()]))};}`});
        if(read.exceptionDetails) throw Error('react-style-origin-read-failed');
        const value=read.result.value as {tag:string;box:{display:string;contentBox:boolean;zoomed:boolean;width:number;height:number;edges:{width:number;height:number}};fill:{depth?:number;problem?:string};animated:boolean;values:Record<string,string>;variables:Record<string,string>;sizes:Record<string,{unit?:string;value?:number;keyword?:string}>};
        if(value.tag!==ownership.nodes.find(n=>n.path===path)?.tag) throw Error('react-style-origin-path-mismatch');
        let fillDepth:number|undefined;
        const sizes:ReactSizeOrigin[]=sizeDeclarations.map(({channel,declaration})=>{
          const typed=value.sizes[channel],base={channel,selectors:declaration.selectors,...(declaration.status==='resolved'?{authoredValue:declaration.value}:{})};
          if(value.animated)return {...base,status:'unresolved',reason:'animated-source'};
          if(declaration.status==='unresolved'&&declaration.reason!=='no-own-declaration')return {...base,status:'unresolved',reason:declaration.reason};
          if(typed.keyword==='auto')return declaration.status==='unresolved'||['auto','initial','unset'].includes(declaration.value)
            ? {...base,status:'auto',value:'auto'} : {...base,status:'unresolved',reason:'indirect-or-invalid-auto-size'};
          if(declaration.status!=='resolved')return {...base,status:'unresolved',reason:'no-own-fixed-size-declaration'};
          // A rule reaching in from a wrapper (`#w > *`, `*:w-full`) is the
          // caller's, however the component is mounted: never its own size.
          if(!declaration.own)return {...base,status:'unresolved',reason:'size-declared-by-outer-selector'};
          // Registered lengths can compute viewport/font units to px before
          // substitution, including into unregistered aliases. Until those
          // dependency origins are read, do not call a sampled px value fixed.
          if(/var\(/i.test(declaration.value)&&(matched.cssPropertyRules?.length||matched.cssPropertyRegistrations?.length))
            return {...base,status:'unresolved',reason:'registered-size-variable-provenance-unqualified'};
          // Exactly `100%`, and only under the witness below: calc(), other
          // percentages and var() name nothing new.
          if(channel==='width'&&declaration.value==='100%'){
            if(typed.unit!=='percent'||typed.value!==100||value.fill.depth===undefined)return {...base,status:'unresolved',reason:value.fill.problem??'declared-fill-width-not-used'};
            fillDepth=value.fill.depth;return {...base,status:'fill',value:'100%'};
          }
          if(!fixedSizeExpression(declaration.value,value.variables))return {...base,status:'unresolved',reason:'responsive-or-unsupported-size-expression'};
          if(typed.unit!=='px'||!Number.isFinite(typed.value)||typed.value!<0)return {...base,status:'unresolved',reason:'fixed-size-not-pixels'};
          // Zoom scales the box but not the computed length: named first, whatever else it then disturbs.
          if(value.box.zoomed)return {...base,status:'unresolved',reason:'size-zoomed-context'};
          // The used length may be the declared one in 1/64 px layout units (18.4px reads 18.3906px).
          if(Math.abs(parseFloat(value.values[channel])-typed.value!)>0.001&&!authoredLengthIsUsed(typed.value+'px',value.values[channel]))return {...base,status:'unresolved',reason:'size-clamped-or-layout-dependent'};
          // The declaration must BE the box. getComputedStyle answers with the computed value wherever width/height do
          // not apply, so the check above passes vacuously there: compare the MEASURED border box, in whole layout units.
          const declared=Math.trunc(typed.value!*64),measured=value.box[channel];
          if(measured!==declared)return {...base,status:'unresolved',reason:boxless.has(value.box.display)?'size-declaration-does-not-apply'
            :value.box.contentBox&&measured===declared+value.box.edges[channel]?'size-is-content-box':'size-clamped-or-layout-dependent'};
          return {...base,status:'fixed',value:value.values[channel]};
        });
        out.roots.push({path,tag:value.tag,sizes,...(fillDepth!==undefined?{fillWidthContainer:{depth:fillDepth}}:{}),channels:channels.map(c=>value.animated
          ? {channel:c.channel,status:'unresolved',selectors:c.selectors,reason:'animated-source'}
          : c.variable && value.values[c.variable] ? {...c,rawValue:value.values[c.variable],computedValue:value.values[c.channel]}
          : {...c,status:'unresolved',reason:c.reason??'source-variable-empty'})});
      } finally {await cdp.send('Runtime.releaseObject',{objectId});}
    }
  } finally {await cdp.detach();}
  return out.roots;
}

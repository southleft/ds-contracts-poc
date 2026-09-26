/** One observed empty flex item. Never turns used dimensions into an authored
 * responsive rule, changes DOM addresses, or infers interaction behavior. */
import type {Part} from '../../scripts/contract-schema.js';
import type {CapturedNode,Combo,EnumAxisSpec} from './lib.js';

type Pseudo = '::before' | '::after';
type Result = {part:Part;window?:{axis:'x'|'y';start:number;end:number;edge:'first'|'last'}} | {problem:string};
const px=(value:string|undefined)=>value!==undefined&&/^\d+(?:\.\d+)?px$/.test(value)?Number.parseFloat(value):NaN;
const length=(value:string|undefined,basis:number)=>value?.endsWith('%')&&/^\d+(?:\.\d+)?%$/.test(value)?Number.parseFloat(value)*basis/100:px(value);
function color(value:string|undefined){
 const m=/^rgba?\((\d+(?:\.\d+)?), (\d+(?:\.\d+)?), (\d+(?:\.\d+)?)(?:, (\d+(?:\.\d+)?))?\)$/.exec(value??'');
 if(!m)return undefined;
 const rgb=m.slice(1,4).map(Number),alpha=m[4]===undefined?1:Number(m[4]);
 return rgb.every(n=>n>=0&&n<=255)&&alpha>=0&&alpha<=1?{value:value!,alpha}:undefined;
}

/** CSS gradient endpoint colors extend beyond their stops. Only admit a
 * completely covered window strictly inside one such constant-color region.
 * No interpolation, color-space conversion, alpha composition or rounding. */
function background(style:Record<string,string>,width:number,height:number):{fill:string;image?:string;window?:Extract<Result,{part:Part}>['window']}|{problem:string}{
 const base=color(style['background-color']);if(!base)return {problem:'background-color'};
 if(style['background-image']==='none')return {fill:base.value};
 if(style['background-repeat']!=='no-repeat'||style['background-attachment']!=='scroll'||style['background-blend-mode']!=='normal')return {problem:'background-layer'};
 const match=/^linear-gradient\((?:to (right|left|bottom|top), )?(.*)\)$/.exec(style['background-image']??'');
 if(!match)return {problem:'gradient-grammar'};
 const stops=[...match[2].matchAll(/(rgba?\([^)]*\)) (\d+(?:\.\d+)?)%(?:, |$)/g)];
 if(stops.length<2||stops.map(s=>s[0]).join('')!==match[2])return {problem:'gradient-stops'};
 const points=stops.map(s=>({color:color(s[1]),position:Number(s[2])/100}));
 if(points.some((p,i)=>!p.color||p.position<0||p.position>1||i>0&&p.position<=points[i-1].position))return {problem:'gradient-stops'};
 const sizes=(style['background-size']??'').split(' '),positions=(style['background-position']??'').split(' ');
 if(sizes.length!==2||positions.length!==2)return {problem:'background-geometry'};
 const iw=length(sizes[0],width),ih=length(sizes[1],height);
 const offset=(value:string,basis:number)=>/^\d+(?:\.\d+)?%$/.test(value)?Number.parseFloat(value)*basis/100:/^-?\d+(?:\.\d+)?px$/.test(value)?Number.parseFloat(value):NaN;
 const x=offset(positions[0],width-iw),y=offset(positions[1],height-ih);
 if(![iw,ih,x,y].every(Number.isFinite)||iw<=0||ih<=0||x>0||y>0||x+iw<width||y+ih<height)return {problem:'background-coverage'};
 const direction=match[1]??'bottom',axis=['right','left'].includes(direction)?'x':'y',reverse=['left','top'].includes(direction);
 const size=axis==='x'?iw:ih,visible=axis==='x'?width:height,origin=axis==='x'?x:y;
 const lo=-origin,hi=visible-origin,start=reverse?size-hi:lo,end=reverse?size-lo:hi;
 const edge=end<points[0].position*size?'first':start>points.at(-1)!.position*size?'last':undefined;
 if(!edge)return {problem:'gradient-window-interpolates'};
 const endpoint=(edge==='first'?points[0]:points.at(-1)!).color!;
 if(endpoint.alpha!==0&&endpoint.alpha!==1)return {problem:'gradient-endpoint-alpha'};
 // Keep the two paint layers: even an opaque endpoint shares an antialiased
 // curved edge with the underlying color. Replacing both with one fill is
 // visibly different there. A constant gradient retains the image layer.
 return {fill:base.value,image:`linear-gradient(to right, ${endpoint.value} 0%, ${endpoint.value} 100%)`,window:{axis,start,end,edge}};
}

export function observedFlowPseudo(node:CapturedNode,pseudo:Pseudo):Result{
 const h=node.style,s=node.pseudo[pseudo],fail=(problem:string):Result=>({problem:'flow-pseudo-'+problem});
 if(!s||s.content!=='""'||s.position!=='static'||s.display!=='block'||s.visibility!=='visible'||s.opacity!=='1'||s['box-sizing']!=='border-box')return fail('box');
 if(!['flex','inline-flex'].includes(h.display)||!['row','column'].includes(h['flex-direction'])||h['flex-wrap']!=='nowrap'||h['box-sizing']!=='border-box')return fail('host-layout');
 if(node.nodes.some(c=>c.t==='text'?c.v.trim()!=='':c.el.style.position!=='absolute'||c.el.style['z-index']!=='auto'||c.el.style.order!=='0')||
    Object.keys(node.pseudo).some(p=>p!==pseudo))return fail('siblings');
 const absent=['background-image','border-image-source','box-shadow','text-shadow','filter','backdrop-filter','mask-image','transform','translate','rotate','scale','animation-name'];
 for(const st of [h,s]){
  if(st['writing-mode']!=='horizontal-tb'||st.direction!=='ltr'||st.order!=='0'||st['z-index']!=='auto'||st['mix-blend-mode']!=='normal'||st['clip-path']!=='none'||st.clip!=='auto'||st['outline-style']!=='none'||st.contain!=='none'||st['content-visibility']!=='visible'||st.zoom!=='1'||st.perspective!=='none'||st['offset-path']!=='none')return fail('effects');
  for(const key of absent.filter(k=>k!=='background-image'&&k!=='box-shadow'))if(st[key]!=='none')return fail('effects');
  for(const side of ['top','right','bottom','left'])if(st['padding-'+side]!=='0px'||st['border-'+side+'-width']!=='0px')return fail('box-edges');
 }
 for(const side of ['top','right','bottom','left'])if(s['margin-'+side]!=='0px'||s[side]!=='auto')return fail('placement');
 if(s['flex-grow']!=='0'||!['0','1'].includes(s['flex-shrink'])||s['flex-basis']!=='auto'||!['auto','normal','stretch'].includes(s['align-self']))return fail('flex-item');
 const width=px(s.width),height=px(s.height);
 if(![width,height].every(n=>Number.isFinite(n)&&n>0&&n<=1e6&&Number.isInteger(n*64))||px(h.width)!==width||px(h.height)!==height)return fail('used-size');
 if(!['border-box','padding-box'].includes(s['background-clip'])||!['border-box','padding-box'].includes(s['background-origin']))return fail('background-box');
 const corners=['top-left','top-right','bottom-right','bottom-left'].map(c=>px(s['border-'+c+'-radius']));
 if(!corners.every(n=>Number.isFinite(n)&&n===corners[0]))return fail('radius');
 const paint=background(s,width,height);if('problem' in paint)return fail(paint.problem);
 if(typeof s['box-shadow']!=='string')return fail('shadow');
 return {part:{shape:{kind:'rect',width,height},literals:{'background-color':paint.fill,...(paint.image?{'background-image':paint.image}:{}),'border-radius':`${Math.min(corners[0],width/2,height/2)}px`,'box-shadow':s['box-shadow']},
  description:'Observed empty in-flow pseudo-element at fixed used size. Paint window and box edges are checked; responsive sizing and interaction remain unqualified.'},...(paint.window?{window:paint.window}:{})};
}

/** Same in-flow box throughout the observed domain. Paint may depend on one
 * declared finite axis, using the contract's existing literal override rules.
 * Omission is a base value, never an invented public enum value. */
export function observedFlowPseudoDomain(rows:Array<{combo:Combo;node:CapturedNode}>,pseudo:Pseudo,axes:EnumAxisSpec[]):Result{
 const results=rows.map(row=>observedFlowPseudo(row.node,pseudo));
 const failed=results.find(r=>'problem' in r);if(failed)return failed;
 const carried=results.filter((r):r is Extract<Result,{part:Part}>=>'part' in r);
 if(!carried.length)return {problem:'flow-pseudo-empty-domain'};
 if(carried.every(r=>JSON.stringify(r.part)===JSON.stringify(carried[0].part)))return structuredClone(carried[0]);
 const structure=({literals:_literals,...rest}:Part)=>JSON.stringify(rest);
 if(carried.some(r=>structure(r.part)!==structure(carried[0].part)))return {problem:'flow-pseudo-geometry-varies'};
 const paints=carried.map(r=>({...r.part.literals!,'background-image':r.part.literals!['background-image']??'none'}));
 for(const axis of axes){
  const byValue=new Map<string,typeof paints[number]>();let valid=true;
  for(let i=0;i<rows.length;i++){
   const value=rows[i].combo.axisValues[axis.prop],previous=byValue.get(value);
   if(!axis.values.includes(value)||previous&&JSON.stringify(previous)!==JSON.stringify(paints[i])){valid=false;break;}
   byValue.set(value,paints[i]);
  }
  if(!valid)continue;
  const part=structuredClone(carried[0].part);
  part.literals=structuredClone((axis.unset===undefined?undefined:byValue.get(axis.unset))??paints[0]);
  part.literalsByProp=[{prop:axis.prop,map:Object.fromEntries([...byValue].filter(([v])=>v!==axis.unset))}];
  return {part};
 }
 return {problem:'flow-pseudo-paint-multiaxis'};
}

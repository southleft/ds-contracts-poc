import {insideRootStrokeRuntime,hasInsideRootStroke} from './react-instance-inside-stroke.js';
import {insideStrokeContextPlan} from './react-fill-stack-context.js';
import {receivedFillContextProof,receivedFillContextGuard,fillStackUnqualifiedForeground,type FillContextBindings} from './react-fill-stack-context.js';
import {walkAnatomy,fillStackPaintCss,fillStackStyleRecords,fillStackBackdropDependent,type Contract,type Part,type FillStack} from '../scripts/contract-schema.js';

export const ownsFillStack=(part:Part|undefined)=>!!(part?.fillStack||part?.fillStackByCombination);
export function receivesFillStack(contract:Contract,contracts?:ReadonlyMap<string,Contract>):boolean {
 return [...(contracts?.values()??[])].some(c=>walkAnatomy(c).some(({part})=>part.component?.id===contract.id&&ownsFillStack(part)));
}
const paintHosts=new Set(['div','span','button','section','article','aside','header','footer','main','nav','label','summary','a','p','h1','h2','h3','h4','h5','h6']);
function validatePaintHost(part:Part,element=part.element??'div'){
 if(!paintHosts.has(element)||part.shape||part.layout?.overlap&&part.tokens?.gap)throw Error('fill-stack-react-native-host-unqualified');
}
function validateIsolation(part:Part,receive=false,contextProved=false){
 if(!contextProved&&Object.values(part.parts??{}).some(fillStackUnqualifiedForeground))throw Error('fill-stack-react-foreground-stacking-unqualified');
 if(fillStackStyleRecords(part).some(record=>Object.keys(record??{}).some(key=>['filter','mix-blend-mode','isolation','backdrop-filter'].includes(key))))throw Error('fill-stack-react-competing-composition');
 if(!contextProved&&(Object.values(part.parts??{}).some(fillStackBackdropDependent)||part.slot||part.repeat))throw Error('fill-stack-react-backdrop-dependent-child');
 if(receive&&(part.solidFillComposition||part.solidFillCompositionByCombination||part.solidFillCompositionToken||part.solidFillCompositionSourceBinding||part.solidFillCompositionObservedBinding))throw Error('fill-stack-react-received-paint-unqualified');
}
function needsPaintPosition(part:Part):boolean {
 const base=part.declared?.position??part.literals?.position;
 // A token can resolve to static, and any later state/prop rule can replace a
 // base containing block. Do not override those channels with invented CSS.
 const dynamic=[...Object.values(part.states??{}),...Object.values(part.declaredStates??{}),
  ...(Array.isArray(part.tokensByProp)?part.tokensByProp:part.tokensByProp?[part.tokensByProp]:[]).flatMap(t=>Object.values(t.map)),
  ...(part.statesByProp??[]).flatMap(t=>Object.values(t.map)),...(part.literalsByProp??[]).flatMap(t=>Object.values(t.map)),
  ...(part.stylesWhen??[]).map(r=>r.styles),...(part.tokensByCombination??[]).flatMap(t=>t.rows.map(r=>r.tokens)),
  ...(part.literalsByCombination??[]).flatMap(t=>t.rows.map(r=>r.literals))].some(r=>r.position!==undefined);
 if(part.tokens?.position!==undefined||dynamic||base!==undefined&&!['relative','absolute','fixed','sticky'].includes(base))throw Error('fill-stack-react-position-unqualified');
 return base===undefined&&!part.absoluteGeometry&&!part.absoluteGeometryByCombination&&!part.absolutePlacement&&!part.absolutePlacementByCombination&&!part.overlay;
}
function receivingContext(contract:Contract,contracts?:ReadonlyMap<string,Contract>,tokens?:unknown,mode:'inline'|'module'='inline') {
 try{return receivedFillContextProof(contract,contracts,tokens,mode);}catch(error){throw Error('fill-stack-react-backdrop-dependent-child: '+(error instanceof Error?error.message:String(error)));}
}
function validateReceivingRoot(contract:Contract,contracts?:ReadonlyMap<string,Contract>,tokens?:unknown):Part {
 const root=contract.anatomy.root;
 if(!root||Object.keys(contract.anatomy).length!==1||contract.semantics.elementByProp)throw Error('fill-stack-react-native-root-required');
 if((contract.a11y?.minHitArea??0)>0)throw Error('fill-stack-react-min-hit-area-unqualified');
 validatePaintHost(root,contract.semantics.element);validateIsolation(root,true,!!receivingContext(contract,contracts,tokens));needsPaintPosition(root);
 return root;
}
export function fillStackPositionParts(contract:Contract,contracts?:ReadonlyMap<string,Contract>,tokens?:unknown):string[]{
 const receive=receivesFillStack(contract,contracts),out:string[]=[];
 for(const {part,name,path}of walkAnatomy(contract)){
  if(ownsFillStack(part)&&part.component){
   const child=contracts?.get(part.component.id);if(!child)throw Error('fill-stack-react-reference-unqualified');
   validateReceivingRoot(child,contracts,tokens);
  }
  if(!((ownsFillStack(part)&&!part.component)||(path.length===1&&receive)))continue;
  if(path.length===1&&(contract.a11y?.minHitArea??0)>0)throw Error('fill-stack-react-min-hit-area-unqualified');
  validatePaintHost(part,path.length===1?contract.semantics.element:part.element);
  validateIsolation(part,receive&&path.length===1,receive&&path.length===1&&!!receivingContext(contract,contracts,tokens));
  if(needsPaintPosition(part))out.push(name);
 }
 return out;
}
function rootPaintGuard(part:Part,code:(name:string)=>string):string|undefined {
 const guards:string[]=[];
 if(part.visibleWhen){const {prop,equals}=part.visibleWhen,value=code(prop);guards.push(equals===undefined?value:Array.isArray(equals)?'('+equals.map(v=>value+' === '+JSON.stringify(v)).join(' || ')+')':`Object.is(${value},${JSON.stringify(equals)})`);}
 const table=part.presenceByCombination;
 if(table)guards.push(`((rows: {values:(string|null)[];present:boolean}[], values:(string|null)[])=>{const row=rows.find(r=>r.values.every((v,i)=>v===values[i]));if(!row)throw new Error('presence-combination-unavailable');return row.present;})(${JSON.stringify(table.rows)},[${table.props.map(p=>`(${code(p)} == null ? null : String(${code(p)}))`).join(',')}])`);
 return guards.length?guards.join(' && '):undefined;
}
/** There is no DOM wrapper. The helper clones the same host, or passes a private
 * whole-root input through the same referenced child. */
export function wrapReactFillStack(part:Part,jsx:string,code:(name:string)=>string,contract:Contract):string {
 if(!ownsFillStack(part))return jsx;
 validatePaintHost(part);
 const prop=contract.props.find(p=>p.name===part.shapeFillOverrideProp),colors=prop&&typeof prop.type==='object'&&'enum'in prop.type?prop.type.enum:[];
 return `<__DscFillHost stack={${fillStackExpression(part,code)}}${part.shapeFillOverrideProp?` color={${code(part.shapeFillOverrideProp)}} colors={${JSON.stringify(colors)}}`:''}>${jsx}</__DscFillHost>`;
}
export function fillStackExpression(part:Part,code:(name:string)=>string):string {
 const stack=(s:FillStack)=>JSON.stringify(s.paints.map(p=>({index:p.index,style:fillStackPaintCss(p)})));
 if(part.fillStack)return stack(part.fillStack);
 const table=part.fillStackByCombination;if(!table)return 'undefined';
 const lookup=JSON.stringify(Object.fromEntries(table.rows.map(row=>[JSON.stringify(row.values),JSON.parse(stack(row.stack))])));
 return `__dscFillSelect(${lookup},[${table.props.map(p=>`String(${code(p)})`).join(',')}])`;
}
const RUNTIME=`
import * as __DscPaintReact from 'react';
type __DscPaintLayers = Array<{index:number;style:__DscPaintReact.CSSProperties}>;
function __dscFillSelect(rows:Record<string,__DscPaintLayers>,values:string[]):__DscPaintLayers {
 const row=rows[JSON.stringify(values)];if(row===undefined)throw new Error('fill-stack-selected-row-missing');return row;
}
function __dscPaintRoot(child:__DscPaintReact.ReactElement<any>,stack:__DscPaintLayers|undefined,color?:string):__DscPaintReact.ReactElement<any> {
 if(stack===undefined&&color===undefined)return child;
 if(typeof child.type!=='string')throw new Error('fill-stack-native-react-host-required');
 const old=child.props.style||{};
 const content=__DscPaintReact.Children.toArray(child.props.children).filter(c=>!__DscPaintReact.isValidElement<any>(c)||!Object.prototype.hasOwnProperty.call(c.props,'data-dsc-paint-layer'));
 const paints=color===undefined?(stack||[]).map(p=>__DscPaintReact.createElement('span',{key:'dsc-paint-'+p.index,'data-dsc-paint-layer':'','data-dsc-paint-index':p.index,'aria-hidden':true,style:{...p.style,zIndex:-1}})):[];
 return __DscPaintReact.cloneElement(child,{'data-dsc-stack-active':'',style:{...old,isolation:'isolate',background:'none',backgroundImage:'none',backgroundColor:color===undefined?'transparent':color}},...paints,...content);
}
function __DscFillHost({children,stack,color,colors}:{children:__DscPaintReact.ReactElement<any>;stack:__DscPaintLayers;color?:string;colors?:string[]}) {
 if(color!==undefined&&!colors?.includes(color))throw new Error('shape-fill-override-value-unqualified');
 return typeof children.type==='string'?__dscPaintRoot(children,stack,color):__DscPaintReact.cloneElement(children,{__dscFillStack:stack,__dscFillColor:color});
}
`;
export function finalizeFillStackTsx(tsx:string,contract:Contract,contracts:ReadonlyMap<string,Contract>|undefined,code:(name:string)=>string,contextBindings:FillContextBindings={},tokens?:unknown):string {
 const own=walkAnatomy(contract).some(({part})=>ownsFillStack(part)),receive=receivesFillStack(contract,contracts),inside=hasInsideRootStroke(contract.anatomy.root);
 if(!own&&!receive&&!inside)return tsx;
 if(contract.props.some(p=>['__dscFillStack','__dscFillColor'].includes(p.bindings.code.prop)))throw Error('fill-stack-internal-input-collision');
 if(!contract.anatomy.root)throw Error('fill-stack-react-multiple-roots-unqualified');
 let out=tsx;
 const rootOwn=ownsFillStack(contract.anatomy.root),mode=contextBindings.mode??'inline';
 const insidePlan=inside?insideStrokeContextPlan(contract,contracts,tokens,mode,!!contextBindings.children):{guard:'',layer:1};
 if((receive||rootOwn||inside)&&(contract.semantics.elementByProp||contract.anatomy.root.layout?.overlap&&contract.anatomy.root.tokens?.gap))throw Error('fill-stack-react-native-root-required');
 fillStackPositionParts(contract,contracts,tokens);
 if(inside){validatePaintHost(contract.anatomy.root,contract.semantics.element);needsPaintPosition(contract.anatomy.root);}
 if(receive||rootOwn){
  const marker=`export interface ${contract.name}Props extends `,start=out.indexOf(marker),brace=out.indexOf('{',start);
  if(start<0||brace<0)throw Error('fill-stack-react-props-anchor');
  out=out.slice(0,brace+1)+'\n  /** Internal complete source-owned root paint input. */\n  __dscFillStack?: __DscPaintLayers;\n  __dscFillColor?: string;'+out.slice(brace+1);
  const fn=out.lastIndexOf('function ',out.lastIndexOf('  return ('));
  const rest=out.indexOf('...rest',fn);if(rest<0)throw Error('fill-stack-react-rest-anchor');
  out=out.slice(0,rest)+'__dscFillStack, __dscFillColor, '+out.slice(rest);
 }
 if(receive||rootOwn||inside){
  const ret=out.lastIndexOf('  return ('),end=out.indexOf('\n  );',ret);if(ret<0||end<0)throw Error('fill-stack-react-root-anchor');
  const expr=rootOwn?`(__dscFillStack === undefined ? ${fillStackExpression(contract.anatomy.root,code)} : __dscFillStack)`:'__dscFillStack';
  const guard=rootPaintGuard(contract.anatomy.root,code);
  const proof=receive?receivingContext(contract,contracts,tokens,mode):undefined;
  const contextGuard=proof?receivedFillContextGuard(proof,code,contract,contextBindings):'';
  const insideGuard=insidePlan.guard;
  let expression=out.slice(ret+'  return ('.length,end);
  if(inside)expression=`__dscInsideRootStroke((${expression}\n  ),${mode==='module'?'rest.style':'style'})`;
  if(receive||rootOwn)expression=`__dscPaintRoot((${expression}\n  ),${expr},__dscFillColor)`;
  out=out.slice(0,ret)+contextGuard+insideGuard+(guard?`  if (!(${guard})) return null;\n`:'')+'  return '+expression+';'+out.slice(end+'\n  );'.length);
 }
 // Data URLs are shared across every tuple, not copied per layer occurrence.
 const assets=[...new Set([...out.matchAll(/url\('data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*'\)/g)].map(m=>m[0]))];
 let constants='';for(const [i,asset]of assets.entries()){const ref='__DSC_PAINT_ASSET_'+i;out=out.split(JSON.stringify(asset)).join(ref);constants+=`const ${ref} = ${JSON.stringify(asset)};\n`;}
 return (own||receive?RUNTIME+'\n':'')+(inside?insideRootStrokeRuntime(contract,mode,contextBindings.hasRingRuntime,insidePlan.layer):'')+constants+out;
}

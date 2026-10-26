import {FillStackSchema,type FillStackPaint} from '../packages/schema/src/fill-stack.js';
import {planSolidFillBindingTokens} from './solid-fill-binding-tokens.js';

export type NativeFillStackColor={r:number;g:number;b:number;a?:number};
type Solid=Omit<Extract<FillStackPaint,{type:'SOLID'}>,'unresolvedBinding'|'observedBinding'>;
type Image=Omit<Extract<FillStackPaint,{type:'IMAGE'}>,'image'> & {base64:string;mimeType:string};
export type NativeFillStack={version:1;order:'bottom-to-top';paints:Array<Solid|Image>};
export type NativeFillStackBinding={id:string;color:NativeFillStackColor};
export interface NativeFillStackReadback {
  imageBase64ByHash?:Record<string,unknown>|ReadonlyMap<string,unknown>;
  bindingsByToken?:Record<string,NativeFillStackBinding|undefined>|ReadonlyMap<string,NativeFillStackBinding>;
}

/** Self-contained validation also embedded in the native writer. Source proof
 * identity and token graph validation belong to compileNativeFillStack below. */
function nativeFillStackPlanIssue(input:unknown):string|undefined {
  const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
  const unit=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1&&Math.fround(v)===v;
  if(!object(input)||!keys(input,['version','order','paints'])||input.version!==1||input.order!=='bottom-to-top'||!Array.isArray(input.paints)||input.paints.length>64)return 'plan';
  const assets=new Set<string>();let bytes=0;
  for(let i=0;i<input.paints.length;i++){
    const p=input.paints[i];
    if(!object(p)||p.index!==i||typeof p.visible!=='boolean'||!unit(p.opacity)||p.blendMode!=='NORMAL')return 'paint-common';
    if(p.type==='SOLID'){
      if(!keys(p,['index','type','visible','opacity','blendMode','color','token','sourceBinding'])||!object(p.color)||!keys(p.color,['r','g','b','a'])||!['r','g','b'].every(k=>unit(p.color[k]))||p.color.a!==undefined&&p.color.a!==1)return 'solid';
      if((p.token!==undefined)!==(p.sourceBinding!==undefined))return 'binding-proof';
      if(p.token!==undefined){
        const proof=p.sourceBinding?.binding;
        if(typeof p.token!=='string'||!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/i.test(p.token)||!object(proof)||typeof proof.variableId!=='string'||!proof.variableId||
          !object(proof.paint)||proof.paint.blendMode!=='NORMAL'||proof.paint.opacity!==p.opacity||!object(proof.paint.color)||!['r','g','b'].every(k=>proof.paint.color[k]===p.color[k]))return 'binding-proof';
      }
    }else if(p.type==='IMAGE'){
      if(!keys(p,['index','type','visible','opacity','blendMode','imageHash','base64','mimeType','scaleMode','imageTransform','rotation','scalingFactor','filters'])||typeof p.imageHash!=='string'||!p.imageHash||typeof p.base64!=='string'||!['FILL','FIT','CROP','STRETCH'].includes(p.scaleMode))return 'image';
      const prefixes:Record<string,string>={'image/png':'iVBORw0KGgo','image/jpeg':'/9j/','image/gif':'R0lGOD','image/webp':'UklGR'};
      const prefix=prefixes[p.mimeType],data=p.base64;
      if(!prefix||!data.startsWith(prefix)||data.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(data))return 'image-bytes';
      // Padding must be canonical, including zero unused bits.
      const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      if(data.endsWith('==')&&(alphabet.indexOf(data[data.length-3])&15)!==0||data.endsWith('=')&&!data.endsWith('==')&&(alphabet.indexOf(data[data.length-2])&3)!==0)return 'image-bytes';
      const size=data.length/4*3-(data.endsWith('==')?2:data.endsWith('=')?1:0);
      if(size<=0||size>8*1024*1024)return 'image-byte-budget';
      if(!assets.has(data)){assets.add(data);bytes+=size;if(bytes>32*1024*1024)return 'image-byte-budget';}
      if(p.rotation!==undefined&&p.rotation!==0||p.scalingFactor!==undefined&&p.scalingFactor!==1||p.filters!==undefined&&(!object(p.filters)||Object.values(p.filters).some(v=>v!==0)))return 'image-effects';
      if(p.scaleMode==='CROP'||p.scaleMode==='STRETCH'){
        const t=p.imageTransform;
        if(!Array.isArray(t)||t.length!==2||!t.every(r=>Array.isArray(r)&&r.length===3&&r.every((n:unknown)=>typeof n==='number'&&Number.isFinite(n)))||t[0][1]!==0||t[1][0]!==0||t[0][0]<=0||t[1][1]<=0||t[0][0]===1&&t[0][2]!==0||t[1][1]===1&&t[1][2]!==0)return 'image-transform';
      }else if(p.imageTransform!==undefined)return 'image-transform';
    }else return 'paint-type';
  }
}

/** Compile a whole ordered array, never a flattened color or appended image.
 * A source-bound token must be the token derived from that very source graph;
 * a same-colored foreign token cannot stand in for its proof. */
export function compileNativeFillStack(input:unknown,resolveToken?:(path:string)=>NativeFillStackColor|undefined):NativeFillStack {
  const fail=(reason:string):never=>{throw Error('native-fill-stack-unqualified:'+reason);};
  const parsed=FillStackSchema.safeParse(input);
  if(!parsed.success)return fail('schema:'+parsed.error.issues.map(v=>v.message).join(';'));
  if(parsed.data.paints.some(p=>p.type==='SOLID'&&(p.unresolvedBinding||p.observedBinding)))return fail('unresolved-binding');
  const paints=parsed.data.paints.map(p=>{
    if(p.type==='SOLID'){
      const {unresolvedBinding:_,observedBinding:__,...paint}=p;
      if(p.token){
        const expected=planSolidFillBindingTokens([p.sourceBinding!.binding]).requestedTokenPaths;
        if(expected.length!==1||expected[0]!==p.token)return fail('source-token-identity');
        const value=resolveToken?.(p.token);
        if(!value||!['r','g','b'].every(k=>Math.fround(value[k as 'r'|'g'|'b'])===p.color[k as 'r'|'g'|'b'])||Math.fround(value.a??1)!==p.opacity)return fail('token-value-disagreement');
      }
      return paint;
    }
    const {image,...paint}=p;
    const match=/^url\((['"]?)data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/]+={0,2})\1\)$/.exec(image);
    if(!match)return fail('original-data-url');
    return {...paint,mimeType:match[2],base64:match[3]};
  });
  const out:NativeFillStack={version:1,order:'bottom-to-top',paints};
  const issue=nativeFillStackPlanIssue(out);if(issue)return fail(issue);
  return out;
}

/** The matcher never derives observed assets or binding IDs from expected
 * paint data. Its two accessors must read independent native observations. */
function matchNativeFillStack(expected:unknown,observed:unknown,imageForHash:(hash:string)=>unknown,bindingForToken:(token:string)=>unknown,planIssue:(input:unknown)=>string|undefined):boolean {
  const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
  const numeric=(actual:unknown,wanted:number)=>typeof actual==='number'&&Number.isFinite(actual)&&(actual===wanted||actual===Math.fround(wanted));
  const empty=(v:unknown)=>v===undefined||object(v)&&Object.keys(v).length===0;
  if(planIssue(expected)||!Array.isArray(observed))return false;
  const plan=expected as NativeFillStack;
  if(observed.length!==plan.paints.length)return false;
  for(const [index,p]of plan.paints.entries()){
    const a=observed[index];
    if(!object(a)||a.type!==p.type||(a.visible===undefined?true:a.visible)!==p.visible||!numeric(a.opacity===undefined?1:a.opacity,p.opacity)||(a.blendMode===undefined?'NORMAL':a.blendMode)!=='NORMAL')return false;
    if(p.type==='SOLID'){
      if(!keys(a,['type','color','visible','opacity','blendMode','boundVariables'])||!object(a.color)||!keys(a.color,['r','g','b','a'])||!['r','g','b'].every(k=>numeric(a.color[k],p.color[k as 'r'|'g'|'b']))||a.color.a!==undefined&&a.color.a!==1)return false;
      if(p.token){
        const b=bindingForToken(p.token);
        if(!object(b)||typeof b.id!=='string'||!b.id||!object(b.color)||!['r','g','b'].every(k=>numeric(b.color[k],p.color[k as 'r'|'g'|'b']))||!numeric(b.color.a===undefined?1:b.color.a,p.opacity)||!object(a.boundVariables)||!keys(a.boundVariables,['color'])||!object(a.boundVariables.color)||!keys(a.boundVariables.color,['type','id'])||a.boundVariables.color.type!=='VARIABLE_ALIAS'||a.boundVariables.color.id!==b.id)return false;
      }else if(!empty(a.boundVariables))return false;
    }else{
      if(!keys(a,['type','imageHash','scaleMode','imageTransform','rotation','scalingFactor','filters','visible','opacity','blendMode','boundVariables'])||typeof a.imageHash!=='string'||!a.imageHash||imageForHash(a.imageHash)!==p.base64||a.scaleMode!==(p.scaleMode==='STRETCH'?'CROP':p.scaleMode)||!empty(a.boundVariables))return false;
      if(!numeric(a.rotation===undefined?0:a.rotation,p.rotation??0)||!numeric(a.scalingFactor===undefined?1:a.scalingFactor,p.scalingFactor??1)||a.filters!==undefined&&(!object(a.filters)||Object.values(a.filters).some(v=>v!==0)))return false;
      if(p.filters&&(!object(a.filters)||!Object.keys(p.filters).every(k=>a.filters[k]===0)))return false;
      if(p.imageTransform){
        if(!Array.isArray(a.imageTransform)||a.imageTransform.length!==2||!p.imageTransform.every((row,i)=>Array.isArray(a.imageTransform[i])&&a.imageTransform[i].length===3&&row.every((v,j)=>numeric(a.imageTransform[i][j],v))))return false;
      }else if(a.imageTransform!==undefined)return false;
    }
  }
  return true;
}

export function nativeFillStackMatches(expected:NativeFillStack,observed:unknown,readback:NativeFillStackReadback={}):boolean {
  const get=(values:Record<string,unknown>|ReadonlyMap<string,unknown>|undefined,key:string)=>values instanceof Map?values.get(key):(values as Record<string,unknown>|undefined)?.[key];
  try{
    for(const p of expected.paints)if(p.type==='SOLID'&&p.token&&planSolidFillBindingTokens([p.sourceBinding!.binding]).requestedTokenPaths[0]!==p.token)return false;
    return matchNativeFillStack(expected,observed,hash=>get(readback.imageBase64ByHash,hash),token=>get(readback.bindingsByToken,token),nativeFillStackPlanIssue);
  }catch{return false;}
}

/** No node creation. Images are memoized by original bytes, not a source label.
 * The optional resolver belongs to the already verified native token context. */
export const NATIVE_FILL_STACK_RUNTIME=`
const {nativeFillStackPlanIssue,matchNativeFillStack}=(()=>{
  // TSX/esbuild can add name annotations to nested functions. Keep that
  // annotation helper lexical to these serialized functions so standalone
  // native execution never depends on a helper from the compiling host.
  const __name=(target,_name)=>target;
  return {
    nativeFillStackPlanIssue:${nativeFillStackPlanIssue.toString()},
    matchNativeFillStack:${matchNativeFillStack.toString()}
  };
})();
const nativeFillStackImages=new Map();
function applyFillStack(node,spec,resolveVariable){
  if(spec.fillStack===undefined)return;
  const stack=spec.fillStack,issue=nativeFillStackPlanIssue(stack);
  if(issue)throw Error('native-fill-stack-unqualified:'+issue);
  if(!node||!('fills'in node)||!Array.isArray(node.fills))throw Error('native-fill-stack-unqualified:host');
  const bindings=new Map(),assets=new Map();
  // Resolve every binding before allocating assets or editing the node.
  for(const p of stack.paints)if(p.type==='SOLID'&&p.token){
    const variable=typeof resolveVariable==='function'?resolveVariable(p.token):undefined;
    if(!variable||typeof variable.id!=='string'||!variable.id||variable.resolvedType!=='COLOR'||typeof variable.resolveForConsumer!=='function')throw Error('native-fill-stack-unqualified:variable');
    const resolved=variable.resolveForConsumer(node),color=resolved&&resolved.value;
    if(!resolved||resolved.resolvedType!=='COLOR'||!color||!['r','g','b'].every(k=>Math.fround(color[k])===p.color[k])||Math.fround(color.a===undefined?1:color.a)!==p.opacity)throw Error('native-fill-stack-unqualified:variable-value-disagreement');
    bindings.set(p.token,{variable,id:variable.id,color});
  }
  const paints=stack.paints.map(p=>{
    const common={type:p.type,visible:p.visible,opacity:p.opacity,blendMode:'NORMAL'};
    if(p.type==='SOLID'){
      const color={r:p.color.r,g:p.color.g,b:p.color.b};
      if(!p.token)return {...common,color};
      const variable=bindings.get(p.token).variable;
      // The variable already carries the observed alpha; applying it twice
      // would square the layer opacity on native Figma.
      return figma.variables.setBoundVariableForPaint({...common,color,opacity:1},'color',variable);
    }
    let hash=nativeFillStackImages.get(p.base64);
    if(!hash){
      const bytes=figma.base64Decode(p.base64),image=figma.createImage(bytes);
      if(!image||typeof image.hash!=='string'||!image.hash)throw Error('native-fill-stack-unqualified:image-create');
      hash=image.hash;nativeFillStackImages.set(p.base64,hash);
    }
    assets.set(hash,p.base64);
    return {...common,imageHash:hash,scaleMode:p.scaleMode==='STRETCH'?'CROP':p.scaleMode,
      ...(p.imageTransform?{imageTransform:p.imageTransform.map(row=>row.slice())}:{}),
      ...(p.rotation!==undefined?{rotation:p.rotation}:{}),...(p.scalingFactor!==undefined?{scalingFactor:p.scalingFactor}:{}),
      ...(p.filters?{filters:{...p.filters}}:{})};
  });
  const previous=node.fills;
  try{
    node.fills=paints;
    if(!matchNativeFillStack(stack,node.fills,hash=>assets.get(hash),token=>bindings.get(token),nativeFillStackPlanIssue))throw Error('native-fill-stack-unqualified:written-paint-disagreement');
  }catch(error){try{node.fills=previous;}catch(_){}throw error;}
}
`;

import {instanceIntrinsicSizePlan} from './instance-intrinsic-size.js';
import {walkAnatomy,type Contract} from '@ds-contracts/schema';
import {flattenTokens,makeResolveLiteral,type TokenTreeInput} from './tokens.js';
/** A reference name is not dimension evidence. Check every supplied scope,
 * so changing mode/brand cannot invalidate the fixed allocation silently. */
export function instanceAffineTokenErrors(contract:Contract,byId:Map<string,Contract>,values:unknown):string[]{
 const errors:string[]=[];
 for(const {part,name} of walkAnatomy(contract)){
  if(part.instanceAffineLayout&&part.component){
   const table=part.instanceAffineLayout,child=byId.get(part.component.id),root=child?.anatomy.root;
   let valid=!!root&&!!values&&typeof values==='object';
   try{
    const input=values as TokenTreeInput,brands=Object.keys(input?.brands??{});if(!brands.length)brands.push('default');
    for(const brand of brands)for(const mode of ['light','dark'] as const){
     const resolve=makeResolveLiteral(new Map([...flattenTokens(input.primitives??{}),...flattenTokens(input.brands?.default??{}),...flattenTokens(input.brands?.[brand]??{}),...flattenTokens(input.semantic??{}),...flattenTokens(input[mode]??{})]));
     for(const row of table.rows)for(const axis of ['width','height'] as const){
      const index=axis==='width'?0:1,m=row.geometry.transform;
      const filled=(Math.abs(m[0][index])>0.5&&row.fill.width)||(Math.abs(m[1][index])>0.5&&row.fill.height);
      if(filled)continue; // Parent FILL owns this local extent; native and CSS resize it without paint scaling.
      const ref=part.component.rootOverrides?.[axis]??root?.tokens?.[axis];
      const path=ref?.slice(1,-1).replace(/\{([^}]+)\}/g,(_,name:string)=>row.values[table.props.indexOf(name)]??`{${name}}`);
      const value=path?resolve(path):root?.literals?.[axis];
      const px=typeof value==='number'?value:typeof value==='string'&&/^\d+(?:\.\d+)?px$/.test(value)?parseFloat(value):NaN;
      if(px!==row.geometry.localSize[axis])valid=false;
     }
    }
    const holders=[root?.tokens,root?.literals,root?.declared,...Object.values(root?.states??{}),...Object.values(root?.declaredStates??{})];
    if(holders.some(h=>Object.keys(h??{}).some(k=>/^(min-|max-)(width|height|inline-size|block-size)$|^(transform|rotate|scale)/.test(k))))valid=false;
    if([root?.states,root?.declaredStates].some(states=>Object.values(states??{}).some(h=>Object.keys(h).some(k=>['width','height','inline-size','block-size'].includes(k)))))valid=false;
    if(root?.tokensByProp||root?.tokensByCombination||root?.literalsByProp||root?.literalsByCombination||root?.stylesWhen||root?.layoutByProp||root?.layoutByCombination)valid=false;
   }catch{valid=false;}
   if(!valid)errors.push(`${contract.id}: part "${name}" instance-affine-layout-size-unproven`);
   continue;
  }
  const observation=part.instanceAffine ?? Object.values(part.instanceAffineByProp?.map??{})[0];
  if(!observation||!part.component)continue;
  const child=byId.get(part.component.id),root=child?.anatomy.root;if(!child||!root)continue;
  const intrinsic=instanceIntrinsicSizePlan(child,part);
  if(intrinsic){
   let valid=!!values&&typeof values==='object';
   try{
    const input=values as TokenTreeInput,brands=Object.keys(input?.brands??{});if(!brands.length)brands.push('default');
    for(const brand of brands)for(const mode of ['light','dark'] as const){
     const resolve=makeResolveLiteral(new Map([...flattenTokens(input.primitives??{}),...flattenTokens(input.brands?.default??{}),...flattenTokens(input.brands?.[brand]??{}),...flattenTokens(input.semantic??{}),...flattenTokens(input[mode]??{})]));
     const size=intrinsic(resolve);if(!size||size.width!==observation.localSize.width||size.height!==observation.localSize.height)valid=false;
    }
   }catch{valid=false;}
   if(!valid)errors.push(`${contract.id}: part "${name}" instance-affine-intrinsic-size-unproven`);
   continue;
  }
  for(const axis of ['width','height'] as const){
   const ref=root.tokens?.[axis];if(!ref)continue;
   const fail=()=>errors.push(`${contract.id}: part "${name}" instance-affine-token-dimension-unproven:${axis}`);
   if(!values||typeof values!=='object'||!/^\{[^{}]+\}$/.test(ref)){fail();continue;}
   const input=values as TokenTreeInput;
   try{
    const brands=Object.keys(input.brands??{});if(!brands.length)brands.push('default');
    for(const brand of brands)for(const mode of ['light','dark'] as const){
     const resolve=makeResolveLiteral(new Map([...flattenTokens(input.primitives??{}),...flattenTokens(input.brands?.default??{}),...flattenTokens(input.brands?.[brand]??{}),...flattenTokens(input.semantic??{}),...flattenTokens(input[mode]??{})]));
     const value=resolve(ref.slice(1,-1));
     const px=typeof value==='number'?value:typeof value==='string'&&/^\d+(?:\.\d+)?px$/.test(value)?parseFloat(value):NaN;
     if(px!==observation.localSize[axis]){fail();break;}
    }
   }catch{fail();}
  }
 }
 return [...new Set(errors)];
}

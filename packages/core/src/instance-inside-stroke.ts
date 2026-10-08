import {walkAnatomy,type Contract,type ComponentRef} from '@ds-contracts/schema';
import {flattenTokens,makeResolveLiteral,type TokenTreeInput} from './tokens.js';
export function instanceInsideStrokeChildIssue(ref:ComponentRef,child:Contract|undefined):string|undefined {
 if(!ref.sameInkInsideStroke)return;
 const parts=Object.values(child?.anatomy.root.parts??{}),path=parts[0];
 if(!child||parts.length!==1||child.props.some(p=>p.bindings.figma.kind==='VARIANT')||
    !child.anatomy.root.overridable?.includes('color')||path?.shape?.kind!=='path'||!path.shape.parentViewport||
    Object.keys(path).some(k=>!['shape','literals','declared','tokens'].includes(k))||
    Object.entries(path.declared??{}).some(([k,v])=>k!=='position'||v!=='absolute')||path.shape.pathsByProp||path.shape.rotation||
    path.literals?.['background-color']!=='currentColor'||Object.keys(path.literals??{}).some(k=>k!=='background-color')||
    Object.keys(path.tokens??{}).length||path.states||path.stylesWhen||path.literalsByCombination||path.mask||path.parts||path.component||path.slot)
  return 'inside-stroke-child-drawing-unqualified';
}
export function resolvedInstanceInsideStroke(ref:ComponentRef,subst:Record<string,string>){
 const table=ref.sameInkInsideStroke;if(!table)return undefined;
 const tuple=table.props.map(p=>subst[p]??null),row=table.rows.find(r=>JSON.stringify(r.values)===JSON.stringify(tuple));
 if(!row)throw Error('inside-stroke-combination-unqualified');
 return row.stroke??undefined;
}
/** Same ink is a semantic constraint, not a comparison of rounded RGB.
 * Every supplied mode/brand must keep the bound color opaque. */
export function instanceInsideStrokeTokenErrors(contract:Contract,byId:Map<string,Contract>,values:unknown):string[]{
 const errors:string[]=[];
 for(const {part,name} of walkAnatomy(contract)){
  const ref=part.component,table=ref?.sameInkInsideStroke;if(!ref||!table)continue;
  const fail=(reason:string)=>errors.push(`${contract.id}:${name}:${reason}`);
  const issue=instanceInsideStrokeChildIssue(ref,byId.get(ref.id));if(issue){fail(issue);continue;}
  try{
   if(!values||typeof values!=='object'||!ref.overrides?.color)throw Error();
   const input=values as TokenTreeInput,brands=Object.keys(input.brands??{});if(!brands.length)brands.push('default');
   for(const brand of brands)for(const mode of ['light','dark'] as const){
    const resolve=makeResolveLiteral(new Map([...flattenTokens(input.primitives??{}),...flattenTokens(input.brands?.default??{}),...flattenTokens(input.brands?.[brand]??{}),...flattenTokens(input.semantic??{}),...flattenTokens(input[mode]??{})]));
    for(const row of table.rows){if(!row.stroke)continue;const subst=Object.fromEntries(table.props.map((p,i)=>[p,row.values[i]]));
     const path=ref.overrides.color.slice(1,-1).replace(/\{([^}]+)\}/g,(_,p)=>subst[p]??`{${p}}`);
     // Imported opaque colors use canonical hex. Other paint syntax needs its
     // own proof; never silently accept alpha, unresolved refs or CSS globals.
     const value=resolve(path);if(typeof value!=='string'||!/^#(?:[0-9a-f]{6}|[0-9a-f]{6}ff)$/i.test(value))throw Error();
    }
   }
  }catch{fail('inside-stroke-opaque-token-unproven');}
 }
 return [...new Set(errors)];
}

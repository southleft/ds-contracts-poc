import {qualifySolidFillColorBinding, SolidFillSourceBindingsSchema, type Part} from '@ds-contracts/schema';
import {flattenTokens,type TokenTreeInput} from './tokens.js';
import {canonicalJson, revisionOf} from './contract-provenance.js';

type Binding = ReturnType<typeof qualifySolidFillColorBinding>;
type Variable = Omit<Binding['consumer'],'aliasChain'> & {id:string};

/** One observed consuming context, not an invented complete theme library.
 * The host can plan other observed contexts separately, then use the existing
 * explicit-mode token writer. Source IDs remain provenance; new native IDs
 * must come from scoped creation and independent readback. */
export function planSolidFillBindingTokens(bindings: readonly Binding[]) {
  if (!bindings.length) throw Error('solid-fill-binding-tokens-empty');
  const variables = new Map<string, Variable>();
  const selections = new Map<string, {modeId:string;modeName:string}>();
  const names = new Map<string,string>();
  const roots = new Set<string>();
  for (const input of bindings) {
    const binding = qualifySolidFillColorBinding(
      {paint:input.paint,variableId:input.variableId}, {[input.variableId]:input.consumer});
    roots.add(binding.variableId);
    for (const entry of [{id:binding.variableId,...binding.consumer},...(binding.consumer.aliasChain??[])]) {
      const row:Variable = {id:entry.id,name:entry.name,collectionId:entry.collectionId,
        modeId:entry.modeId,modeName:entry.modeName,resolvedType:entry.resolvedType,
        value:entry.value,selectedValue:entry.selectedValue};
      const previous = variables.get(row.id);
      if (previous && canonicalJson(previous)!==canonicalJson(row))
        throw Error('solid-fill-binding-tokens-variable-conflict:'+row.id);
      const selected = {modeId:row.modeId,modeName:row.modeName};
      if (selections.has(row.collectionId) && canonicalJson(selections.get(row.collectionId))!==canonicalJson(selected))
        throw Error('solid-fill-binding-tokens-context-conflict:'+row.collectionId);
      const nameKey = canonicalJson([row.collectionId,row.name]);
      if (names.has(nameKey) && names.get(nameKey)!==row.id)
        throw Error('solid-fill-binding-tokens-name-conflict:'+row.name);
      names.set(nameKey,row.id);selections.set(row.collectionId,selected);variables.set(row.id,row);
    }
  }
  const pathFor = (id:string) => 'sourcePaint.v'+revisionOf({variableId:id}).slice(7);
  const leaves: Record<string, {$type:'color';$value:string}> = {};
  const provenance = [...variables.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([id,row])=>{
    const selected = row.selectedValue as {type?:string;id?:string;r?:number;g?:number;b?:number;a?:number};
    let value:string;
    if (selected.type==='VARIABLE_ALIAS') {
      if (!selected.id || !variables.has(selected.id)) throw Error('solid-fill-binding-tokens-alias-missing');
      value = '{'+pathFor(selected.id)+'}';
    } else {
      // Keep native float32 precision. Hex serialization would round to 8 bits.
      value = `rgba(${selected.r!*255},${selected.g!*255},${selected.b!*255},${selected.a??1})`;
    }
    const tokenPath=pathFor(id);
    leaves[tokenPath.slice('sourcePaint.'.length)]={$type:'color',$value:value};
    return {variableId:id,tokenPath,...row};
  });
  return {
    tokens:{sourcePaint:leaves},
    requestedTokenPaths:[...roots].map(pathFor).sort(),
    variables:provenance,
    selections:[...selections.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([collectionId,selection])=>({collectionId,...selection})),
  };
}

/** Validate public provenance against the uniform paint and selected token path. */
export function solidFillPartBindingPlan(part:Part) {
 const cells=part.solidFillCompositionByCombination?.rows.filter(row=>row.token!==undefined || row.sourceBinding!==undefined);
 if(cells?.length){
  if(part.solidFillComposition || part.solidFillCompositionToken || part.solidFillCompositionSourceBinding)throw Error('bound-paint-owner-unqualified');
  const bindings=cells.map(cell=>{
   const proof=SolidFillSourceBindingsSchema.parse([cell.sourceBinding])[0].binding;
   const plan=planSolidFillBindingTokens([proof]);
   if(cell.empty || canonicalJson(proof.paint)!==canonicalJson(cell.paint) || plan.requestedTokenPaths[0]!==cell.token)throw Error('bound-paint-cell-source-disagreement');
   return proof;
  });
  return planSolidFillBindingTokens(bindings);
 }
 if(part.solidFillCompositionSourceBinding===undefined && part.solidFillCompositionToken===undefined)return;
 if(!part.solidFillComposition || part.solidFillCompositionByCombination)
  throw Error('bound-paint-owner-unqualified');
 const rows=SolidFillSourceBindingsSchema.parse(part.solidFillCompositionSourceBinding);
 if(rows.some(row=>canonicalJson(row.binding.paint)!==canonicalJson(part.solidFillComposition)))
  throw Error('bound-paint-source-paint-disagreement');
 const plan=planSolidFillBindingTokens(rows.map(row=>row.binding));
 if(plan.requestedTokenPaths.length!==1 || plan.requestedTokenPaths[0]!==part.solidFillCompositionToken)
  throw Error('bound-paint-source-token-identity');
 return plan;
}
/** Verify aliases as well as values. An equal-looking override is not the captured graph. */
export function solidFillPartTokenError(part:Part,values:unknown):string|undefined {
 try {
  const plan=solidFillPartBindingPlan(part);if(!plan)return;
  const input=values as TokenTreeInput;
  if(!input || typeof input!=='object')throw Error('bound-paint-token-input-missing');
  const base=[input.primitives,input.semantic,input.brands?.default].map(t=>flattenTokens(t??{}));
  const overlays=[input.light,input.dark,...Object.entries(input.brands??{}).filter(([name])=>name!=='default').map(([,tree])=>tree)].map(t=>flattenTokens(t??{}));
  for(const [path,leaf] of flattenTokens(plan.tokens)){
   const definitions=base.filter(tree=>tree.has(path));
   if(definitions.length!==1 || canonicalJson(definitions[0].get(path))!==canonicalJson(leaf) || overlays.some(tree=>tree.has(path)))
    throw Error('bound-paint-source-token-graph-disagreement');
  }
 } catch(error){return String(error);}
}

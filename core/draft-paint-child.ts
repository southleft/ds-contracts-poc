import {ContractSchema, walkAnatomy, type Contract} from '../scripts/contract-schema.js';
import {qualifySolidFillColorBinding} from '../extract/figma/solid-fill-binding.js';
import {canonicalJson} from './contract-provenance.js';

/** Internal inspection context only. Validate the ordinary contract and recheck
 * every captured binding, retaining the evidence on the returned draft. This
 * does not produce a public contract or grant source-variable recreation. */
export function inspectDraftPaintChild(input: unknown): Contract | undefined {
 const ordinary=ContractSchema.safeParse(input);
 if(ordinary.success)return ordinary.data;
 if(!input || typeof input!=='object' || !('anatomy' in input))return undefined;
 try {
  const draft=structuredClone(input) as Contract, validation=structuredClone(draft);
  let proofs=0;
  for(const {part} of walkAnatomy(validation)) {
   const rows=part.solidFillCompositionSourceBinding;
   if(rows===undefined)continue;
   if(!Array.isArray(rows) || !rows.length)throw Error('empty-binding-evidence');
   const paints=part.solidFillComposition?[part.solidFillComposition]:part.solidFillCompositionByCombination?.rows.map(row=>row.paint)??[];
   const expected=new Set(paints.map(paint=>canonicalJson(paint))),seen=new Set<string>();
   for(const row of rows) {
    if(!row || typeof row!=='object' || Object.keys(row).some(key=>!['owner','nodeName','variantName','binding'].includes(key)) ||
       ['owner','nodeName','variantName'].some(key=>typeof row[key]!=='string' || !row[key]))throw Error('binding-occurrence');
    const b=row.binding;
    if(!b || typeof b!=='object' || Object.keys(b).some(key=>!['variableId','paint','consumer'].includes(key)))throw Error('binding-shape');
    const checked=qualifySolidFillColorBinding({paint:b.paint,variableId:b.variableId},{[b.variableId]:b.consumer});
    const paint=canonicalJson(checked.paint);
    if(!expected.has(paint))throw Error('binding-paint-disagreement');
    seen.add(paint);proofs++;
   }
   if([...expected].some(paint=>!seen.has(paint)))throw Error('binding-paint-coverage');
   delete part.solidFillCompositionSourceBinding;
  }
  if(!proofs || !ContractSchema.safeParse(validation).success)return undefined;
  return draft;
 } catch {return undefined;}
}

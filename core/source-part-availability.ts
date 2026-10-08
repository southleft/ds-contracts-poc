import type {DumpSet, DumpNode} from '../extract/figma/types.js';
import type {Part} from '../scripts/contract-schema.js';
import {inferPresenceByCombination} from './infer-presence.js';

const dense = (value: unknown): value is unknown[] => Array.isArray(value) &&
  Array.from({length:value.length},(_,i)=>Object.hasOwn(value,i)).every(Boolean);

/** First bounded structural door: a unique direct, childless source node.
 * Membership is read from original captured mains, never from hidden inversion,
 * sanitized names, a caller response, or a synthetic merged wrapper. The caller
 * arms qualifiedDomain only after the independent exact drawn-domain check. */
export function qualifyDirectPartAvailability(source: DumpSet,
  occurrences: readonly {variant:string;node:DumpNode}[],
  axes: readonly {property:string;prop:string;values:string[];map:Record<string,string>}[],
  declaredDomain: readonly (readonly (string|null)[])[] | undefined,
  qualifiedDomain: boolean): Part['availabilityByCombination'] {
  if(source.type!=='COMPONENT_SET' || !source.key || !source.nodeId || !qualifiedDomain || !declaredDomain || !dense(declaredDomain) || !dense(axes) ||
      !axes.length || axes.length>8 || new Set(axes.map(a=>a.property)).size!==axes.length ||
      new Set(axes.map(a=>a.prop)).size!==axes.length || !dense(source.variants) || !dense(occurrences) ||
      !occurrences.length || occurrences.length>=source.variants.length ||
      axes.some(a=>!dense(a.values) || !a.values.length || a.values.some(v=>
        !Object.hasOwn(a.map,v) || typeof a.map[v]!=='string'))) return;
  const name=occurrences[0].node.name,type=occurrences[0].node.type;
  if(!name || !type || ['INSTANCE','COMPONENT','COMPONENT_SET'].includes(type) ||
      occurrences.some(o=>!o.node.nodeId || o.node.name!==name || o.node.type!==type ||
        (o.node.hidden!==undefined && o.node.hidden!==false) || o.node.propRefs?.visible ||
        (o.node.children!==undefined && (!dense(o.node.children) || o.node.children.length!==0)))) return;
  const seenMains=new Set<string>(),seenNames=new Set<string>(),seenNodes=new Set<string>();
  const observed=[] as Array<{values:string[];present:boolean}>;
  const joined=new Set<string>();
  for(const main of source.variants){
    if(!main.nodeId || main.type!=='COMPONENT' || seenMains.has(main.nodeId) ||
        seenNames.has(main.name) || !dense(main.children??[]) || !main.variantProperties ||
        Object.keys(main.variantProperties).length!==axes.length) return;
    seenMains.add(main.nodeId);seenNames.add(main.name);
    const values=axes.map(a=>a.map[main.variantProperties![a.property]]);
    if(values.some(v=>typeof v!=='string'))return;
    const matches=(main.children??[]).filter(n=>n.name===name);
    if(matches.length>1)return;
    const occurrence=occurrences.filter(o=>o.variant===main.name);
    if(matches.length===0){if(occurrence.length)return;observed.push({values,present:false});continue;}
    const node=matches[0];
    if(occurrence.length!==1 || node.type!==type || !node.nodeId || seenNodes.has(node.nodeId) ||
        node.nodeId!==occurrence[0].node.nodeId || (node.hidden!==undefined && node.hidden!==false) || node.propRefs?.visible ||
        (node.children!==undefined && (!dense(node.children) || node.children.length!==0))) return;
    seenNodes.add(node.nodeId);joined.add(main.name);observed.push({values,present:true});
  }
  if(joined.size!==occurrences.length || declaredDomain.some(row=>!dense(row) ||
      row.length!==axes.length || row.some(v=>typeof v!=='string')))return;
  return inferPresenceByCombination(axes.map(a=>({prop:a.prop,values:a.values.map(v=>a.map[v])})),
    observed,1,declaredDomain);
}

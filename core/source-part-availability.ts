import type {DumpSet, DumpNode} from '../extract/figma/types.js';
import type {Part} from '../scripts/contract-schema.js';
import {inferPresenceByCombination} from './infer-presence.js';
import {canonicalJson} from './contract-provenance.js';

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

type Segment = {name:string;type:string};

/** Observe an owned INSTANCE plane without granting authority over its internals.
 * Membership and caller visibility remain independent. Original paths are never
 * resolved through an instance owner or through sanitized display names. */
export function qualifyOwnedComponentAvailability(source: DumpSet,
  occurrences: readonly {variant:string;node:DumpNode}[],
  axes: readonly {property:string;prop:string;values:string[];map:Record<string,string>}[],
  declaredDomain: readonly (readonly (string|null)[])[] | undefined,
  qualifiedDomain: boolean): Part['availabilityByCombination'] {
  if(source.type!=='COMPONENT_SET'||!source.key||!source.nodeId||source.contractId||!qualifiedDomain||
      !declaredDomain||!dense(declaredDomain)||!dense(axes)||!axes.length||axes.length>8||
      new Set(axes.map(a=>a.property)).size!==axes.length||new Set(axes.map(a=>a.prop)).size!==axes.length||
      !dense(source.variants)||!dense(occurrences)||!occurrences.length||occurrences.length>=source.variants.length||
      axes.some(a=>!dense(a.values)||!a.values.length||new Set(a.values).size!==a.values.length||a.values.some(v=>!Object.hasOwn(a.map,v)||typeof a.map[v]!=='string')||new Set(a.values.map(v=>a.map[v])).size!==a.values.length)||
      occurrences.some(o=>!o.node.nodeId||o.node.type!=='INSTANCE'||!o.node.name||
        (o.node.children!==undefined&&(!dense(o.node.children)||o.node.children.length!==0)))) return;
  const targetKey=occurrences[0].node.instanceSetKey??occurrences[0].node.instanceKey;
  if(!targetKey||occurrences.some(o=>(o.node.instanceSetKey??o.node.instanceKey)!==targetKey)) return;
  const safe=(n:DumpNode)=>(n.hidden===undefined||n.hidden===false)&&n.propRefs?.visible===undefined&&n.bound?.visible===undefined&&n.propRefs?.mainComponent===undefined;
  const allIds=new Set<string>([source.nodeId]),mainNames=new Set<string>();
  const indexed=new Map<string,Map<string,{node:DumpNode;path:Segment[]}>>();
  for(const main of source.variants){
    if(main.type!=='COMPONENT'||!main.nodeId||mainNames.has(main.name)||!main.variantProperties||
        Object.keys(main.variantProperties).length!==axes.length) return;
    mainNames.add(main.name);
    const nodes=new Map<string,{node:DumpNode;path:Segment[]}>();let count=0;
    const visit=(node:DumpNode,path:Segment[],depth:number):boolean=>{
      if(++count>4096||depth>32||!node.nodeId||allIds.has(node.nodeId)||(node.children!==undefined&&!dense(node.children))) return false;
      allIds.add(node.nodeId);nodes.set(node.nodeId,{node,path});
      if(node.type==='INSTANCE') return (node.children?.length??0)===0;
      return (node.children??[]).every(child=>visit(child,[...path,{name:child.name,type:child.type}],depth+1));
    };
    if(!visit(main,[],0)) return;
    indexed.set(main.name,nodes);
  }
  let ownedPath:Segment[]|undefined;
  const byMain=new Map<string,DumpNode>();
  for(const occurrence of occurrences){
    if(byMain.has(occurrence.variant)) return;
    const hit=indexed.get(occurrence.variant)?.get(occurrence.node.nodeId!);
    if(!hit||!hit.path.length||canonicalJson(hit.node)!==canonicalJson(occurrence.node)||
        hit.path.some((s,i)=>!s.name||i<hit.path.length-1&&!['FRAME','GROUP'].includes(s.type))) return;
    if(ownedPath&&canonicalJson(ownedPath)!==canonicalJson(hit.path)) return;
    ownedPath=hit.path;byMain.set(occurrence.variant,occurrence.node);
  }
  const observed:Array<{values:string[];present:boolean}>=[];
  const tuples=new Set<string>();
  for(const main of source.variants){
    if(!safe(main)) return;
    if(axes.some(a=>!a.values.includes(main.variantProperties![a.property]))) return;
    const values=axes.map(a=>a.map[main.variantProperties![a.property]]);
    const tuple=JSON.stringify(values);
    if(values.some(v=>typeof v!=='string')||tuples.has(tuple)) return;
    tuples.add(tuple);
    let node:DumpNode|undefined=main;
    for(const segment of ownedPath!){
      if(!node) break;
      if(node.type==='INSTANCE'||!safe(node)) return;
      const matches:DumpNode[]=(node.children??[]).filter(n=>n.name===segment.name);
      if(matches.length>1||matches.length===1&&matches[0].type!==segment.type) return;
      node=matches[0];
    }
    const occurrence=byMain.get(main.name);
    if(node){
      if(!occurrence||!safe(node)||node.type!=='INSTANCE'||node.nodeId!==occurrence.nodeId||
          canonicalJson(node)!==canonicalJson(occurrence)||(node.instanceSetKey??node.instanceKey)!==targetKey) return;
    }else if(occurrence) return;
    observed.push({values,present:node!==undefined});
  }
  if(declaredDomain.some(row=>!dense(row)||row.length!==axes.length||row.some(v=>typeof v!=='string'))) return;
  return inferPresenceByCombination(axes.map(a=>({prop:a.prop,values:a.values.map(v=>a.map[v])})),observed,1,declaredDomain);
}

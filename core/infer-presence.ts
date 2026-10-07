import type {Part} from '../scripts/contract-schema.js';
type Value=string|null;
/** Exact truth tables only: every projected tuple must have an observation,
 * and all observations sharing it must agree. A separately verified positive
 * domain limits the obligation to its reachable tuples; observations cannot
 * silently define their own domain. Existing single-axis rules win. */
export function inferPresenceByCombination(axes:ReadonlyArray<{prop:string;values:Value[]}>,
  observed:ReadonlyArray<{values:Value[];present:boolean}>, minimumAxes=2,
  declaredDomain?:ReadonlyArray<readonly Value[]>):Part['presenceByCombination'] {
  if(axes.length>8 && !declaredDomain || axes.length<minimumAxes || !observed.length)return;
  if(observed.some(o=>o.values.length!==axes.length || o.values.some((v,i)=>!axes[i].values.includes(v))))
    throw Error('presence-observation-axis-unqualified');
  if(declaredDomain){
    const keys=new Set(declaredDomain.map(values=>JSON.stringify(values)));
    const observedKeys=new Set(observed.map(row=>JSON.stringify(row.values)));
    if(!declaredDomain.length || keys.size!==declaredDomain.length ||
        declaredDomain.some(values=>values.length!==axes.length || values.some((v,i)=>!axes[i].values.includes(v))) ||
        keys.size!==observedKeys.size || [...keys].some(key=>!observedKeys.has(key)))
      throw Error('presence-declared-domain-observations-incomplete');
  }
  if(axes.length>8){
    // A sparse API can have many axes but only a few reachable tuples. Remove
    // a column only when every captured row sharing the remaining values has
    // identical presence. No claim is made about an undeclared combination.
    // This avoids exponential subset search and keeps the schema's eight-axis
    // output limit; full-domain completeness was checked before projection.
    let selected=axes.map((_,i)=>i);
    for(const axis of [...selected]){
      if(selected.length<=minimumAxes)break;
      const rest=selected.filter(i=>i!==axis),table=new Map<string,boolean>();
      let conflict=false;
      for(const row of observed){const key=JSON.stringify(rest.map(i=>row.values[i]));
        if(table.has(key)&&table.get(key)!==row.present){conflict=true;break;}
        table.set(key,row.present);
      }
      if(!conflict)selected=rest;
    }
    if(selected.length>8)return;
    const rows=new Map<string,{values:Value[];present:boolean}>();
    for(const row of observed){const values=selected.map(i=>row.values[i]);rows.set(JSON.stringify(values),{values,present:row.present});}
    const projected=[...rows.values()];
    return inferPresenceByCombination(selected.map(i=>axes[i]),projected,minimumAxes,projected.map(row=>row.values));
  }
  function choices(n:number,start=0,prefix:number[]=[]):number[][] {
    if(!n)return [prefix];return axes.flatMap((_,i)=>i<start?[]:choices(n-1,i+1,[...prefix,i]));
  }
  for(let n=minimumAxes;n<=axes.length;n++)for(const selected of choices(n)){
    const required=declaredDomain && new Set(declaredDomain.map(values=>JSON.stringify(selected.map(i=>values[i]))));
    const count=required?.size ?? selected.reduce((size,i)=>size*axes[i].values.length,1);if(count>4096)continue;
    const table=new Map<string,boolean>();let conflict=false;
    for(const o of observed){const key=JSON.stringify(selected.map(i=>o.values[i]));
      if(table.has(key)&&table.get(key)!==o.present){conflict=true;break;}table.set(key,o.present);}
    if(conflict || table.size!==count || required && [...table.keys()].some(key=>!required.has(key)))continue;
    return {props:selected.map(i=>axes[i].prop),rows:[...table].sort(([a],[b])=>a<b?-1:a>b?1:0)
      .map(([key,present])=>({values:JSON.parse(key),present}))};
  }
}

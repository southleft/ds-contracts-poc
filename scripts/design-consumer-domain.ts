type Row=Record<string,string|boolean|null>;
type Cell={key:string;props:Record<string,unknown>};
export function domainTransitionGroups(domain:readonly Row[],cases:readonly Cell[],axes:readonly {name:string;values:readonly unknown[]}[]){
 if(!domain.length)throw Error('declared-transition-empty-domain');
 const keys=Object.keys(domain[0]).sort();
 const tuple=(row:Record<string,unknown>)=>{if(keys.some(k=>!Object.hasOwn(row,k)||!['string','boolean'].includes(typeof row[k])&&row[k]!==null))throw Error('declared-transition-incomplete-tuple');return JSON.stringify(keys.map(k=>row[k]));};
 const declared=new Set<string>();for(const row of domain){if(JSON.stringify(Object.keys(row).sort())!==JSON.stringify(keys))throw Error('declared-transition-inconsistent-domain');const k=tuple(row);if(declared.has(k))throw Error('declared-transition-duplicate-domain');declared.add(k);}
 const observed=new Map<string,Cell>();const cellKeys=new Set<string>();for(const cell of cases){const k=tuple(cell.props);if(!declared.has(k)||observed.has(k)||cellKeys.has(cell.key))throw Error('declared-transition-invalid-source-inventory');observed.set(k,cell);cellKeys.add(cell.key);}
 if(observed.size!==declared.size)throw Error('declared-transition-source-missing');
 const axisNames=new Set<string>();
 for(const axis of axes){
  if(axisNames.has(axis.name)||!keys.includes(axis.name)||!axis.values.length||new Set(axis.values).size!==axis.values.length||axis.values.some(v=>v!==null&&!['string','boolean'].includes(typeof v)))throw Error('declared-transition-invalid-axis');
  axisNames.add(axis.name);
  if(domain.some(row=>!axis.values.includes(row[axis.name])))throw Error('declared-transition-axis-value-missing');
 }
 if(keys.some(key=>new Set(domain.map(row=>row[key])).size>1&&!axisNames.has(key)))throw Error('declared-transition-axis-missing');
 const groups=[];for(const axis of axes){if(!keys.includes(axis.name)||new Set(axis.values).size!==axis.values.length)throw Error('declared-transition-invalid-axis');
 for(const target of axis.values){const legal:string[]=[],outside:string[]=[],pairs:{from:string;to:string}[]=[];
 for(const cell of cases){if(cell.props[axis.name]===target)continue;const next=tuple({...cell.props,[axis.name]:target});if(!declared.has(next)){outside.push(cell.key);continue;}const to=observed.get(next);if(!to)throw Error('declared-transition-source-missing');legal.push(cell.key);pairs.push({from:cell.key,to:to.key});}
 groups.push({prop:axis.name,target,legal,outside,pairs});}}
 return groups;
}

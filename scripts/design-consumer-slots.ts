import type {Page} from 'playwright-core';

/** Public slot names come from anatomy slots, not arbitrary nested metadata. */
export function consumerSlotNames(anatomy:any):string[] {
  const names=new Set<string>();
  const visit=(part:any)=>{
    if(!part||typeof part!=='object')return;
    if(typeof part.slot?.name==='string')names.add(part.slot.name);
    for(const child of Object.values(part.parts??{}))visit(child);
  };
  visit(anatomy?.root);return [...names];
}

/** Exercise the installed public prop and retain each cell's outcome. */
export async function probeConsumerSlot(page:Page,keys:string[],name:string){
  const marker=`Consumer slot content: ${name}`;
  const set=async(value:unknown)=>{
    await page.evaluate(({name,value})=>(window as any).__consumer.setVariantOverride({[name]:value}),{name,value});
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  };
  try {
    await set(marker);
    const renderedAtRuntime=await Promise.all(keys.map(async key=>({key,rendered:(await page.locator(`[data-cell="${key}"]`).innerText()).includes(marker)})));
    const cleared=[];
    for(const value of [null,false,'']){
      await set(value);
      const retained=await Promise.all(keys.map(async key=>(await page.locator(`[data-cell="${key}"]`).innerText()).includes(marker)));
      cleared.push({value,cleared:retained.every(v=>!v)});
    }
    return {name,renderedAtRuntime,cleared,passed:keys.length>0&&renderedAtRuntime.every(r=>r.rendered)&&cleared.every(r=>r.cleared)};
  } finally {
    await page.evaluate(()=>(window as any).__consumer.setVariantOverride(null));
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  }
}

/** Evaluate authored visibility in canonical prop space. A hidden slot is not
 * required to render; a slot with no exercised visible case remains unqualified. */
export function visibleSlotCases(contract:any,cases:Array<{key:string;props:Record<string,unknown>;state?:string}>,name:string){
  const paths:any[][]=[];
  const visit=(part:any,ancestors:any[])=>{
    if(!part||typeof part!=='object')return;
    const path=[...ancestors,part];
    if(part.slot?.name===name)paths.push(path);
    for(const child of Object.values(part.parts??{}))visit(child,path);
  };
  visit(contract.anatomy?.root,[]);
  const defaults=Object.fromEntries(contract.props.map((p:any)=>[p.name,p.default]));
  const keys:string[]=[],hidden:string[]=[],unsupported:string[]=[];
  for(const cell of cases){
    const props={...defaults,...cell.props};let unknown=false;
    const visible=paths.some(path=>path.every(part=>{
      if(part.statePresence||part.repeat){unknown=true;return false;}
      const table=part.presenceByCombination;
      if(table){
        const row=table.rows.find((row:any)=>table.props.every((prop:string,i:number)=>row.values[i]===(props[prop]===undefined?null:String(props[prop]))));
        if(!row){unknown=true;return false;}if(!row.present)return false;
      }
      const when=part.visibleWhen;if(!when)return true;
      return when.equals===undefined?!!props[when.prop]:Array.isArray(when.equals)?when.equals.includes(props[when.prop]):props[when.prop]===when.equals;
    }));
    if(unknown)unsupported.push(cell.key);else if(visible)keys.push(cell.key);else hidden.push(cell.key);
  }
  return {keys,hidden,unsupported};
}

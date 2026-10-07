import {walkAnatomy,resolveLayout,type Contract,type Part} from '@ds-contracts/schema';

const hasAuthoredRank=(part:Part)=>{
 const tbp=part.tokensByProp?(Array.isArray(part.tokensByProp)?part.tokensByProp:[part.tokensByProp]):[];
 const maps=[part.declared,part.tokens,part.literals,...Object.values(part.states??{}),...Object.values(part.declaredStates??{}),
  ...tbp.flatMap(t=>Object.values(t.map)),...(part.literalsByProp??[]).flatMap(t=>Object.values(t.map)),
  ...(part.tokensByCombination??[]).flatMap(t=>t.rows.map(r=>r.tokens)),...(part.literalsByCombination??[]).flatMap(t=>t.rows.map(r=>r.literals)),
  ...(part.statesByProp??[]).flatMap(t=>Object.values(t.map)),...(part.stylesWhen??[]).map(r=>r.styles)];
 return maps.some(map=>map&&('z-index'in map || 'order'in map));
};

/** Content order stays unchanged. Both renderers consume this same rank plan. */
export function childPaintOrderPlans(contract:Contract,contracts?:ReadonlyMap<string,Contract>) {
 return walkAnatomy(contract).flatMap(({part,name,path})=>{
  const layouts=[part.layout,...Object.values(part.layoutByProp?.map??{}),...(part.layoutByCombination?.rows??[]).map(row=>row.layout)];
  if(!layouts.some(layout=>layout?.reversePaint!==undefined || layout?.childOrder!==undefined))return [];
  if(part.component || part.repeat || part.slot || part.content || part.text || part.shape || part.icon || part.mask || part.meter || part.layout?.display==='grid')throw Error('child-paint-order-container-unqualified:'+name);
  const children=Object.entries(part.parts??{});
  // Both React surfaces give slots a div host by default; caller nodes stay inside it.
  // Malformed slots, non-div hosts and repeats have no qualified single host.
  if(children.some(([,child])=>child.repeat || (child.slot && (typeof child.slot!=='object' || child.element!==undefined && child.element!=='div'))))throw Error('child-paint-order-expanding-child:'+name);
  if(children.some(([,child])=>hasAuthoredRank(child)))throw Error('child-paint-order-authored-rank:'+name);
  for(const [,child] of children)if(child.component){const known=contracts?.get(child.component.id);if(!known || known.bindings.code.runtime || Object.keys(known.anatomy).length!==1 || !known.anatomy.root || hasAuthoredRank(known.anatomy.root))throw Error('child-paint-order-reference-unqualified:'+name);}
  const axes=[...new Set([...(part.layoutByProp?[part.layoutByProp.prop]:[]),...(part.layoutByCombination?.props??[])])];
  const domains=axes.map(axis=>{const p=contract.props.find(p=>p.name===axis);if(!p)throw Error('child-paint-order-axis:'+axis);if(p.type==='boolean'&&p.default===undefined)throw Error('child-paint-order-optional-boolean-unqualified:'+axis);return p.type==='boolean'?['false','true']:typeof p.type==='object'&&'enum'in p.type?p.type.enum:[];});
  if(domains.some(d=>!d.length))throw Error('child-paint-order-domain:'+name);
  let selections:Record<string,string>[]=[{}];
  axes.forEach((axis,i)=>{selections=selections.flatMap(s=>domains[i].map(v=>({...s,[axis]:v})));});
  const ranks=(layout:ReturnType<typeof resolveLayout>)=>{
   const order=layout?.childOrder??children.map(([child])=>child);
   if(order.length!==children.length || new Set(order).size!==order.length || order.some(key=>!children.some(([child])=>child===key)))
    throw Error('child-paint-order-permutation-invalid:'+name);
   return children.map(([child])=>{const i=order.indexOf(child);return {name:child,zIndex:layout?.reversePaint===true?children.length-i:i+1,...(layout?.childOrder?{order:i}: {})};});
  };
  for(const layout of layouts)if(layout?.childOrder)ranks(layout);
  return [{name,path,isolate:!(part.solidFillComposition || part.solidFillCompositionByCombination),base:ranks(part.layout),rows:selections.map(selection=>({selection,ranks:ranks(resolveLayout(part,selection))}))}];
 });
}

import {walkAnatomy,tokensByPropEntries,type Contract} from '../scripts/contract-schema.js';
import {inferPresenceByCombination} from './infer-presence.js';

/** A captured, permanently absent usage is not a declaration on its child.
 * Run after linked paint construction, which can turn structural owners into refs. */
export function normalizeHiddenComponentPresence(contract:Contract,
 axes:ReadonlyArray<{prop:string;values:string[]}>,observations:ReadonlyArray<{values:string[];present:boolean}>):string[] {
 const changed:string[]=[];
 for(const {part,path} of walkAnatomy(contract)){
  if(!part.component||part.declared?.display!=='none'||part.visibilityOverrideProp||part.layoutByProp)continue;
  const maps=[...Object.values(part.declaredStates??{}),...(part.stylesWhen??[]).map(row=>row.styles),part.literals,part.tokens,
   ...Object.values(part.states??{}),...(part.statesByProp??[]).flatMap(row=>Object.values(row.map)),
   ...tokensByPropEntries(part).flatMap(row=>Object.values(row.map)),...(part.literalsByCombination??[]).flatMap(table=>table.rows.map(row=>row.literals)),...(part.literalsByProp??[]).flatMap(row=>Object.values(row.map)),...(part.tokensByCombination??[]).flatMap(table=>table.rows.map(row=>row.tokens))];
  if(maps.some(map=>map?.display!==undefined))continue;
  const matrix=inferPresenceByCombination(axes,observations.map(row=>({...row,present:false})),1);
  if(!matrix)throw Error('hidden-component-presence-domain-unqualified:'+path.join('/'));
  part.presenceByCombination=matrix;
  delete part.declared.display;if(!Object.keys(part.declared).length)delete part.declared;
  // The schema requires geometry tables to cover exactly the drawable domain.
  // This usage has none; the original capture retains its hidden geometry.
  delete part.absoluteGeometryByCombination;
  changed.push(path.join('/'));
 }
 return changed;
}

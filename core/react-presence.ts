import type {Part} from '../scripts/contract-schema.js';
/** Both React emitters use the same exact table and public prop aliases. */
export function wrapReactPresence(part:Part,jsx:string,codePropOf:(name:string)=>string):string {
  const t=part.presenceByCombination;if(!t)return jsx;
  const values=t.props.map(p=>`(${codePropOf(p)} == null ? null : String(${codePropOf(p)}))`);
  const condition=`((table: {values: (string | null)[]; present: boolean}[], values: (string | null)[]) => { const row = table.find(r => r.values.every((v,i) => v === values[i])); if (!row) throw new globalThis.Error('presence-combination-unavailable'); return row.present; })(${JSON.stringify(t.rows)}, [${values.join(', ')}])`;
  return `{${condition} ? (<>${jsx}</>) : null}`;
}

/** A child declares its own optional visibility control. Omission retains its
 * source variant's default; an explicit false is distinct from omission. */
export function wrapReactVisibilityOverride(part:Part,shown:string,fallback:string,codePropOf:(name:string)=>string):string {
  if(!part.visibilityOverrideProp)return fallback;
  const prop=codePropOf(part.visibilityOverrideProp);
  if(part.visibilityOverrideDefault!==undefined)fallback=part.visibilityOverrideDefault?shown:"";
  return `{${prop} === undefined ? (<>${fallback}</>) : ${prop} ? (<>${shown}</>) : null}`;
}

import type {Part} from '../scripts/contract-schema.js';

/** The emitted lookup shares canonical string/null tuples with native
 * resolution and has no first-row fallback outside the observed domain. */
export function reactLiteralTextExpression(part:Part,codePropOf:(name:string)=>string,textValueOf:(name:string,value:string)=>string|boolean=(_name,value)=>value):string {
 const table=part.textByCombination;
 if(table)return `((rows:{values:(string|null)[];text:string}[],values:(string|null)[])=>{const matches=rows.filter(row=>row.values.length===values.length&&row.values.every((value,i)=>value===values[i]));if(matches.length!==1)throw new globalThis.Error('literal-text-combination-unavailable');return matches[0].text;})(${JSON.stringify(table.rows)},[${table.props.map(name=>`(${codePropOf(name)} == null ? null : globalThis.String(${codePropOf(name)}))`).join(',')}])`;
 const tb=part.textByProp;
 return tb?Object.entries(tb.map).map(([v,t])=>`${codePropOf(tb.prop)} === ${JSON.stringify(textValueOf(tb.prop,v))} ? ${JSON.stringify(t)} : `).join('')+JSON.stringify(part.text):JSON.stringify(part.text);
}

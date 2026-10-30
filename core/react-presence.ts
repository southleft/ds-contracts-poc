import {walkAnatomy,type Contract,type Part} from '../scripts/contract-schema.js';

/** Enum values already proven by an ancestor `visibleWhen`. */
export type StringVisibilityKnown = ReadonlyMap<string, ReadonlySet<string>>;

function stringVisibilityAuthored(part: Part): string[] | undefined {
  const equals = part.visibleWhen?.equals;
  if (equals === undefined || typeof equals === 'boolean') return;
  return Array.isArray(equals) ? equals : [equals];
}

/** Tighten the ancestor set by this part's string `visibleWhen`. */
export function stringVisibilityKnown(part: Part, known: StringVisibilityKnown): StringVisibilityKnown {
  const authored = stringVisibilityAuthored(part);
  if (!authored || !part.visibleWhen) return known;
  const prior = known.get(part.visibleWhen.prop);
  const next = new Map(known);
  next.set(part.visibleWhen.prop, prior ? new Set(authored.filter(value => prior.has(value))) : new Set(authored));
  return next;
}

/** A descendant comparison TypeScript would reject after an ancestor narrowed
 * the same enum. `undefined` means the authored condition is already safe. */
export function stringVisibilityEquals(part: Part, known: StringVisibilityKnown): string | string[] | 'impossible' | undefined {
  const authored = stringVisibilityAuthored(part);
  if (!authored || !part.visibleWhen) return;
  const prior = known.get(part.visibleWhen.prop);
  if (!prior) return;
  const kept = authored.filter(value => prior.has(value));
  if (kept.length === 0) return 'impossible';
  if (kept.length === authored.length) return;
  return kept.length === 1 ? kept[0] : kept;
}
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

/** Evaluate physical membership before the visibility override, including
 * explicit false: neither Boolean argument targets a source-absent node. */
export function wrapReactAvailability(part:Part,jsx:string,codePropOf:(name:string)=>string):string {
  if(!part.availabilityByCombination)return jsx;
  return `{${reactAvailabilityCondition(part,codePropOf)} ? (<>${jsx}</>) : null}`;
}

function reactAvailabilityCondition(part:Part,codePropOf:(name:string)=>string):string {
  const table=part.availabilityByCombination!;
  const values=table.props.map(p=>`(${codePropOf(p)} == null ? null : String(${codePropOf(p)}))`);
  const control=codePropOf(part.visibilityOverrideProp!);
  return `((table: {values: (string | null)[]; present: boolean}[], values: (string | null)[], control: unknown) => { const row = table.find(r => r.values.every((v,i) => v === values[i])); if (!row) throw new globalThis.Error('structural-availability-combination-unavailable'); if (control !== undefined && !row.present) throw new globalThis.Error('structural-availability-target-unavailable'); if (control !== undefined && typeof control !== 'boolean') throw new globalThis.Error('visibility-override-value-not-boolean'); return row.present; })(${JSON.stringify(table.rows)}, [${values.join(', ')}], ${control})`;
}

/** An ancestor may skip a leaf's JSX. Explicit inputs must still address a
 * structurally present target; omission retains the existing rendering path. */
export function reactAvailabilityGuards(contract:Contract,codePropOf:(name:string)=>string):string[] {
  return walkAnatomy(contract).flatMap(({part})=>part.availabilityByCombination && part.visibilityOverrideProp
    ? [`  if (${codePropOf(part.visibilityOverrideProp)} !== undefined) { ${reactAvailabilityCondition(part,codePropOf)}; }`]
    : []);
}

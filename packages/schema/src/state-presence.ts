/** Exact observed presence over interaction states and a finite prop domain.
 * Shared by schema validation and rendering. */
export const PRESENCE_STATES = ['default', 'hover', 'focus-visible', 'active', 'disabled'] as const;
export type PresenceState = typeof PRESENCE_STATES[number];
export type StatePresenceTable = {
  props: string[];
  states: PresenceState[];
  rows: {values: (string | null)[]; state: PresenceState; present: boolean}[];
};
export function validateStatePresence(table: StatePresenceTable, domains: Readonly<Record<string, readonly (string | null)[]>>): void {
  if (!table.states.includes('default') || new Set(table.states).size !== table.states.length ||
      table.states.some(s => !PRESENCE_STATES.includes(s))) throw Error('state-presence-state-domain');
  if (new Set(table.props).size !== table.props.length || table.props.length > 8) throw Error('state-presence-prop-domain');
  let combinations = 1;
  for (const prop of table.props) {
    const values = domains[prop];
    if (!values?.length || new Set(values).size !== values.length) throw Error('state-presence-prop-domain');
    combinations *= values.length;
  }
  if (combinations * table.states.length > 4096) throw Error('state-presence-domain-too-large');
  const seen = new Set<string>();
  for (const row of table.rows) {
    if (!table.states.includes(row.state) || typeof row.present !== 'boolean' || row.values.length !== table.props.length ||
        row.values.some((v, i) => !domains[table.props[i]].includes(v))) throw Error('state-presence-row-domain');
    const key = JSON.stringify([row.state, row.values]);
    if (seen.has(key)) throw Error('state-presence-row-duplicate');
    seen.add(key);
  }
  if (seen.size !== combinations * table.states.length) throw Error('state-presence-domain-incomplete');
}
export function statePresenceRows(table: StatePresenceTable, subst: Record<string, unknown>): Map<PresenceState, boolean> {
  const values = table.props.map(p => subst[p] == null ? null : String(subst[p]));
  const result = new Map<PresenceState, boolean>();
  for (const row of table.rows) if (row.values.every((v, i) => v === values[i])) {
    if (result.has(row.state)) throw Error('state-presence-row-duplicate');
    result.set(row.state, row.present);
  }
  if (result.size !== table.states.length || table.states.some(s => !result.has(s))) throw Error('state-presence-unavailable');
  return result;
}
/** Hide only inactive cases; visible cases keep the component's existing
 * display declarations. No cascade layer or additional DOM wrapper is needed.
 * State precedence matches the generated interaction styling order. */
export function statePresenceCss(rows: ReadonlyMap<PresenceState, boolean>, root: string, part: string): string {
  if (!rows.has('default')) throw Error('state-presence-unavailable');
  const rules: string[] = [];
  const add = (selector: string, present: boolean) => {
    if (!present) rules.push(`${selector} ${part} { display: none !important; }`);
  };
  const enabled = PRESENCE_STATES.filter(s => s !== 'default' && s !== 'disabled' && rows.has(s));
  // A forced preview excludes all actual pseudo-state branches. Disabled
  // outranks previews and falls back to rest only if no disabled row is drawn.
  add(`${root}:disabled`, rows.get('disabled') ?? rows.get('default')!);
  const live = `${root}:not(:disabled):not([data-state-preview])`;
  add(live + enabled.map(s => `:not(:${s})`).join(''), rows.get('default')!);
  enabled.forEach((state, i) => add(live + `:${state}` + enabled.slice(i + 1).map(s => `:not(:${s})`).join(''), rows.get(state)!));
  for (const state of ['default', ...enabled])
    add(`${root}:not(:disabled)[data-state-preview='${state}']`, rows.get(state as PresenceState)!);
  return rules.join('\n');
}

/** Build only from a complete observed domain. Missing or conflicting source
 * tuples are errors, never a default-visible or default-hidden assumption. */
export function observedStatePresence(
  props: readonly string[], states: readonly PresenceState[],
  domains: Readonly<Record<string, readonly (string | null)[]>>,
  observations: readonly {props: Readonly<Record<string, string | null>>; state: PresenceState; present: boolean}[],
): StatePresenceTable | undefined {
  const table: StatePresenceTable = {props:[...props], states:[...states], rows:observations.map(o=>({
    values:props.map(p=>{if(!(p in o.props))throw Error('state-presence-observation-prop-missing');return o.props[p];}),
    state:o.state, present:o.present,
  }))};
  validateStatePresence(table,domains);
  const rest=new Map(table.rows.filter(r=>r.state==='default').map(r=>[JSON.stringify(r.values),r.present]));
  return table.rows.some(r=>rest.get(JSON.stringify(r.values))!==r.present)?table:undefined;
}

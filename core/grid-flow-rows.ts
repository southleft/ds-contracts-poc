/** CSS has implicit row sizing; Figma requires explicit tracks. Managed
 * content writes materialize the rule before inserting children. The recipe
 * survives separately from those tracks so extraction does not freeze a
 * particular sample's child count into the reusable contract. */
export interface FlowTrack { type: 'FIXED' | 'FLEX' | 'HUG'; value: number }
export interface GridFlowRows { version: 1; rows: FlowTrack[]; autoRows: FlowTrack }

export function materializeFlowRows(recipe: GridFlowRows, columns: number, children: number): FlowTrack[] {
  if (!Number.isInteger(columns) || columns < 1 || !Number.isInteger(children) || children < 0)
    throw Error('grid-flow-rows-invalid-count');
  const count = Math.max(1, recipe.rows.length, Math.ceil(children / columns));
  return Array.from({ length: count }, (_, i) => ({ ...(recipe.rows[i] ?? recipe.autoRows) }));
}

/** Metadata alone never authorizes inversion: validate its exact shape and
 * compare every materialized track against independent native readback. */
export function readGridFlowRows(raw: unknown, columns: number, children: number,
  observed: Array<FlowTrack & { resolved?: true }>,
  /** Items actually drawn in the observed frame (a caller slot can hold none). */
  drawn = children): GridFlowRows {
  const track = (v: any): v is FlowTrack => v && typeof v === 'object' && !Array.isArray(v) &&
    Object.keys(v).sort().join('|') === 'type|value' && ['FIXED', 'FLEX', 'HUG'].includes(v.type) &&
    Number.isFinite(v.value) && v.value > 0 && (v.type !== 'HUG' || v.value === 1);
  const v = raw as GridFlowRows;
  if (!v || typeof v !== 'object' || Array.isArray(v) ||
      Object.keys(v).sort().join('|') !== 'autoRows|rows|version' || v.version !== 1 ||
      !Array.isArray(v.rows) || !v.rows.every(track) || !track(v.autoRows))
    throw Error('grid-flow-rows-invalid-recipe');
  const expected = materializeFlowRows(v, columns, children);
  // A REST readback prints an unoccupied HUG row as its resolved size, the
  // same spelling as a fractional FIXED row (docs/23 §D.166). Only a row that
  // no drawn item occupies may corroborate a recorded HUG that way.
  if (!Number.isInteger(drawn) || drawn < 0) throw Error('grid-flow-rows-invalid-count');
  const occupied = Math.ceil(drawn / columns);
  const emptyHug = (t: FlowTrack & { resolved?: true }, i: number) =>
    t.resolved === true && t.type === 'FIXED' && expected[i].type === 'HUG' && i >= occupied;
  if (observed.length !== expected.length || observed.some((t, i) => {
    if (emptyHug(t, i)) return !(Number.isFinite(t.value) && t.value > 0);
    const { resolved: _resolved, ...plain } = t;
    return !track(plain) || plain.type !== expected[i].type ||
      (plain.value !== expected[i].value && plain.value !== Math.fround(expected[i].value));
  }))
    throw Error('grid-flow-rows-readback-mismatch');
  return structuredClone(v);
}

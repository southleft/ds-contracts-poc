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
  observed: FlowTrack[]): GridFlowRows {
  const track = (v: any): v is FlowTrack => v && typeof v === 'object' && !Array.isArray(v) &&
    Object.keys(v).sort().join('|') === 'type|value' && ['FIXED', 'FLEX', 'HUG'].includes(v.type) &&
    Number.isFinite(v.value) && v.value > 0 && (v.type !== 'HUG' || v.value === 1);
  const v = raw as GridFlowRows;
  if (!v || typeof v !== 'object' || Array.isArray(v) ||
      Object.keys(v).sort().join('|') !== 'autoRows|rows|version' || v.version !== 1 ||
      !Array.isArray(v.rows) || !v.rows.every(track) || !track(v.autoRows))
    throw Error('grid-flow-rows-invalid-recipe');
  const expected = materializeFlowRows(v, columns, children);
  if (observed.length !== expected.length || observed.some((t, i) =>
    !track(t) || t.type !== expected[i].type ||
    (t.value !== expected[i].value && t.value !== Math.fround(expected[i].value))))
    throw Error('grid-flow-rows-readback-mismatch');
  return structuredClone(v);
}

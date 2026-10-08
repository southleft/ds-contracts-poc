/** Project a complete, source-authorized finite paint table onto exact
 * dependencies. This does not authorize any additional parent tuple. */
export interface FinitePaintAxis { prop: string; values: readonly (string | null)[] }
export interface FinitePaintRow { values: (string | null)[]; value: string | null }
export interface FinitePaintTable { props: string[]; rows: FinitePaintRow[] }

const MAX_AXES = 8;
const MAX_WORK = 1_000_000;
const key = (values: readonly (string | null)[]): string => JSON.stringify(values);
const denseArray = (value: unknown): value is unknown[] => {
  if (!Array.isArray(value)) return false;
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) return false;
  return true;
};

export function finitePaintArguments(
  axes: readonly FinitePaintAxis[],
  sourceTuples: readonly (readonly (string | null)[])[],
  table: FinitePaintTable,
  /** Only set after independent source-domain validation, with that full
   * domain retained on the resulting contract and enforced by its consumer. */
  guardedDrawnDomain = false,
): FinitePaintTable {
  const refuse = (reason: string): never => { throw Error('finite-paint-arguments-source-unqualified:' + reason); };
  const scalar = (value: unknown): value is string | null => value === null || typeof value === 'string' && value.length > 0;
  if (typeof guardedDrawnDomain !== 'boolean') refuse('domain-guard');
  if (!denseArray(axes) || !axes.length || axes.length > 64 || axes.some(a => !a || typeof a.prop !== 'string' || !a.prop.length || !denseArray(a.values) || !a.values.length || a.values.some((v: unknown) => !scalar(v)) || new Set(a.values).size !== a.values.length)) refuse('axes');
  if (!table || new Set(axes.map(a => a.prop)).size !== axes.length || !denseArray(table.props) || table.props.length !== axes.length || table.props.some((p, i) => p !== axes[i].prop)) refuse('axis-identity');
  const tupleValid = (tuple: unknown): tuple is (string | null)[] => denseArray(tuple) && tuple.length === axes.length && tuple.every((v, i) => scalar(v) && axes[i].values.includes(v));
  if (!denseArray(sourceTuples) || !sourceTuples.length || sourceTuples.length > 4096 || sourceTuples.some(t => !tupleValid(t))) refuse('source-tuples');
  const sourceKeys = new Set(sourceTuples.map(key));
  if (sourceKeys.size !== sourceTuples.length) refuse('source-tuple-collision');
  if (!denseArray(table.rows) || table.rows.length !== sourceTuples.length) refuse('source-coverage');
  const observed = new Map<string, string | null>();
  for (const row of table.rows) {
    if (!row || !tupleValid(row.values) || !scalar(row.value)) refuse('observation');
    const rowKey = key(row.values);
    if (!sourceKeys.has(rowKey)) refuse('unknown-source-tuple');
    if (observed.has(rowKey)) refuse('observation-collision');
    observed.set(rowKey, row.value);
  }
  if (observed.size !== sourceKeys.size || [...sourceKeys].some(k => !observed.has(k))) refuse('source-coverage');
  // Existing in-ceiling tables retain their exact rows and spelling.
  if (axes.length <= MAX_AXES) return table;
  if (!guardedDrawnDomain) refuse('unclosed-source-domain');

  // Distinct output values must remain separated, including explicit omission.
  // Each distinguishing-axis set is a hitting-set constraint. Search the
  // smallest exact subset, bounded by the unchanged receiver ceiling.
  let work = 0;
  const spend = (): void => { if (++work > MAX_WORK) throw Error('finite-paint-arguments-search-unqualified:work-limit'); };
  const constraints = new Set<bigint>();
  const constant = new Set(table.rows.map(row => row.value)).size === 1;
  for (let i = 0; !constant && i < table.rows.length; i++) for (let j = i + 1; j < table.rows.length; j++) {
    spend();
    if (table.rows[i].value === table.rows[j].value) continue;
    let mask = 0n;
    for (let axis = 0; axis < axes.length; axis++) if (table.rows[i].values[axis] !== table.rows[j].values[axis]) mask |= 1n << BigInt(axis);
    if (!mask) refuse('paint-value-collision');
    constraints.add(mask);
  }
  const count = (mask: bigint): number => { let n = 0; for (; mask; mask &= mask - 1n) n++; return n; };
  const ordered = [...constraints].sort((a, b) => count(a) - count(b) || (a < b ? -1 : a > b ? 1 : 0));
  let forced = 0n;
  for (const mask of ordered) if ((mask & (mask - 1n)) === 0n) forced |= mask;
  if (count(forced) > MAX_AXES) throw Error('finite-paint-arguments-dependency-ceiling-exceeded');
  let selected: bigint | undefined;
  for (let limit = Math.max(1, count(forced)); limit <= MAX_AXES && selected === undefined; limit++) {
    const visited = new Set<bigint>();
    const search = (mask: bigint): bigint | undefined => {
      if (visited.has(mask)) return undefined;
      visited.add(mask);
      let unmet: bigint | undefined;
      for (const constraint of ordered) { spend(); if (!(constraint & mask)) { unmet = constraint; break; } }
      if (unmet === undefined) return mask || 1n;
      if (count(mask) >= limit) return undefined;
      for (let axis = 0; axis < axes.length; axis++) if (unmet & (1n << BigInt(axis))) {
        const found = search(mask | (1n << BigInt(axis)));
        if (found !== undefined) return found;
      }
      return undefined;
    };
    selected = search(forced);
  }
  if (selected === undefined) throw Error('finite-paint-arguments-dependency-ceiling-exceeded');
  const indexes = axes.flatMap((_, i) => selected! & (1n << BigInt(i)) ? [i] : []);
  const projected = new Map<string, FinitePaintRow>();
  for (const tuple of sourceTuples) {
    const values = indexes.map(i => tuple[i]), tupleKey = key(values), value = observed.get(key(tuple))!;
    const previous = projected.get(tupleKey);
    if (previous && previous.value !== value) refuse('projection-collision');
    if (!previous) projected.set(tupleKey, { values, value });
  }
  return { props: indexes.map(i => axes[i].prop), rows: [...projected.values()] };
}

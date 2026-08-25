/*  THE GRAMMAR COVERAGE OBSERVER — what the committed capture configs
 *  ACTUALLY use, derived from the configs rather than from the type.
 *
 *  The denominator problem this exists to solve: every other gate in this tree
 *  learned the same lesson the hard way — a coverage number computed from the
 *  filter that decides carriage is not a measurement. So the supported half of
 *  spec/grammar-coverage.json is checked against the CONFIGS ON DISK, not
 *  against `ComponentConfig`. A field the type declares and nothing uses is
 *  an unexercised claim; a field a config uses and the spec omits is a
 *  construct nobody wrote down.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const CONFIG_DIR = 'extract/computed/configs';

/*  Containers whose KEYS are the LIBRARY's vocabulary rather than the
 *  grammar's — one more level collapses to `*`, and below that only markers
 *  are grammar. Without this the "surface" would grow a row for every prop
 *  name in every library and measure nothing. */
const FREE = new Set([
  'components[].fixedProps',
  'components[].axisValueMap',
  'components[].axisValueMap.*',
  'components[].childrenSpec[].props',
  'components[].openDriver',
  'components[].triage[].when',
]);

/*  Positions that ARE a free value rather than a map of free keys. */
const TERMINAL = new Set(['components[].presenceProps[].value']);

/*  A childrenSpec is a RECURSIVE TREE, and its depth is a property of the
 *  library's composition, not a different construct: `<Modal><div><div><div>`
 *  is the same grammar as `<Tabs><Tab/>`. Every `.children[]` hop folds back
 *  onto the node path, so the tree contributes four rows however deep it goes. */
const CHILD_HOP = '.children[]';
const CHILD_NODE = 'components[].childrenSpec[]';
const fold = (p: string): string => (p.startsWith(CHILD_NODE) ? p.split(CHILD_HOP).join('') : p);

/** `__note`, `_coverageNote`, `__stopped-components` … — commentary and parked
 *  lists the loader never reads. They are not grammar and must not be
 *  censused as grammar. */
export const isAnnotation = (key: string): boolean => key.startsWith('_');

export interface Observation {
  /** normalized construct path → the library configs that use it */
  paths: Map<string, Set<string>>;
  /** config stems observed (the denominator) */
  libraries: string[];
}

export function observeConfigs(repoRoot: string): Observation {
  const dir = path.join(repoRoot, CONFIG_DIR);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const paths = new Map<string, Set<string>>();
  const add = (p: string, lib: string): void => {
    const key = fold(p);
    (paths.get(key) ?? paths.set(key, new Set()).get(key)!).add(lib);
  };
  const walk = (v: unknown, p: string, lib: string, term: boolean): void => {
    if (Array.isArray(v)) { for (const x of v) walk(x, term ? p : p + '[]', lib, term); return; }
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (isAnnotation(k)) continue;
      if (k.startsWith('$')) { add(`marker:${k}`, lib); walk(x, p, lib, true); continue; }
      if (term) { walk(x, p, lib, true); continue; }
      const free = FREE.has(fold(p));
      const child = free ? `${p}.*` : `${p}.${k}`;
      add(child, lib);
      walk(x, child, lib, free || TERMINAL.has(fold(child)));
    }
  };
  for (const f of files) {
    const lib = f.replace(/\.json$/, '');
    const cfg = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as Record<string, unknown>;
    for (const [k, x] of Object.entries(cfg)) {
      if (isAnnotation(k)) continue;
      if (k === 'components') {
        add('components[]', lib);
        for (const c of x as unknown[]) walk(c, 'components[]', lib, false);
        continue;
      }
      add(k, lib);
      walk(x, k, lib, TERMINAL.has(k));
    }
  }
  return { paths, libraries: files.map((f) => f.replace(/\.json$/, '')) };
}

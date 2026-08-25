/*  THE GRAMMAR COVERAGE GATE — spec/grammar-coverage.json vs the configs and
 *  the code it describes.
 *
 *  WHY THIS GATE EXISTS. Three holes in the capture-config grammar were found
 *  by AUTHORING three held-out subjects, with no capture run: `importName`
 *  could not name a compound export, two class-token axes could not both be
 *  expressed (and the loser vanished SILENTLY), and there was no way to spell
 *  a `Date`. None of them was an engine bug. Each was a place the language
 *  could not say what a real library IS, and each would have produced a
 *  first-pass failure that taught us nothing about the engine.
 *
 *  A list of such holes is only worth keeping if it cannot quietly go stale.
 *  So this gate holds the spec against two independent sources of truth:
 *
 *    - THE CONFIGS ON DISK. A construct a committed config uses and the spec
 *      omits is a construct nobody wrote down. The supported half is measured
 *      from `extract/computed/configs/*.json`, NEVER from `ComponentConfig`:
 *      a coverage number computed from the type that declares the surface is
 *      the same self-attestation this tree has been burned by before.
 *
 *    - THE EXERCISERS. A supported row must name something that actually
 *      exercises it (a config that uses it, or a test/eval that does). A row
 *      claiming support that nothing exercises is a claim, not a capability.
 *
 *  Run: npm run grammar-coverage:check [-- --self-test]
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { observeConfigs, CONFIG_DIR, type Observation } from './grammar-coverage-lib.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_JSON = 'spec/grammar-coverage.json';
const SPEC_MD = 'spec/GRAMMAR-COVERAGE.md';

export interface Construct {
  id: string;
  status: 'supported' | 'unsupported';
  kind: string;
  spelling: string;
  since?: string;
  summary: string;
  instances?: string;
  provenBy: string;
  consequence: string;
  paths?: string[];
  probe?: string;
  exercisedBy?: string[];
  note?: string;
  workaround?: string;
  filedAs?: string;
}

export interface Spec {
  $comment: string;
  version: number;
  grammar: { file: string; loader: string; configs: string };
  totals: { supported: number; unsupported: number; constructs: number; observedPaths: number; libraries: number };
  constructs: Construct[];
}

export interface Finding {
  ok: boolean;
  label: string;
}
type Read = (rel: string) => string | null;

/*  PROBES — constructs whose presence is a property of a VALUE rather than of
 *  a config path. `components[].importName` is one path whether or not the
 *  name is dotted, so "compound export names" cannot be observed by path
 *  alone. Each probe answers: which committed libraries use this spelling? */
const PROBES: Record<string, (repoRoot: string) => string[]> = {
  dottedImportName: (repoRoot) => {
    const dir = path.join(repoRoot, CONFIG_DIR);
    const hits: string[] = [];
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      const cfg = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as { components?: Array<{ importName?: string }> };
      if ((cfg.components ?? []).some((c) => typeof c.importName === 'string' && c.importName.includes('.'))) {
        hits.push(f.replace(/\.json$/, ''));
      }
    }
    return hits;
  },
  baseComboKey: (repoRoot) => {
    const dir = path.join(repoRoot, CONFIG_DIR);
    const hits: string[] = [];
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      const cfg = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as { components?: Array<{ baseCombo?: unknown }> };
      if ((cfg.components ?? []).some((c) => c.baseCombo !== undefined)) hits.push(f.replace(/\.json$/, ''));
    }
    return hits;
  },
};

export function auditSpec(spec: Spec, obs: Observation, read: Read, repoRoot: string): Finding[] {
  const f: Finding[] = [];
  const ok = (cond: boolean, label: string): void => {
    f.push({ ok: cond, label });
  };
  const rows = spec.constructs;
  const supported = rows.filter((r) => r.status === 'supported');
  const unsupported = rows.filter((r) => r.status === 'unsupported');

  // ---- 0. an empty denominator is not a pass ----
  if (obs.libraries.length === 0 || obs.paths.size === 0) {
    ok(false, `no capture config found under ${CONFIG_DIR}/ - the coverage half of this gate cannot run, and a gate that cannot observe must refuse`);
    return f;
  }
  ok(rows.length > 0, `the spec names ${rows.length} construct(s)`);

  // ---- 1. shape: sorted, unique, complete ----
  const ids = rows.map((r) => r.id);
  ok(ids.join(' ') === [...ids].sort().join(' '), 'constructs are sorted by id');
  ok(new Set(ids).size === ids.length, 'construct ids are unique');
  for (const r of rows) {
    for (const field of ['kind', 'spelling', 'summary', 'provenBy', 'consequence'] as const) {
      if (!r[field] || String(r[field]).trim() === '') {
        ok(false, `${r.id}: "${field}" is empty - every row must say what it is and what breaks without it`);
      }
    }
    if (r.status === 'unsupported') {
      if (!r.filedAs) ok(false, `${r.id}: an unsupported construct must name where it is filed`);
      if (r.paths || r.exercisedBy) ok(false, `${r.id}: an unsupported construct must not claim paths or exercisers`);
    }
  }

  // ---- 2. THE COVERAGE DIRECTION THAT MATTERS: every construct a committed
  //         config uses must be claimed by exactly one supported row ----
  const claimed = new Map<string, string>();
  for (const r of supported) {
    for (const p of r.paths ?? []) {
      const prev = claimed.get(p);
      if (prev) ok(false, `config path "${p}" is claimed by BOTH ${prev} and ${r.id} - one construct per path, or the totals mean nothing`);
      claimed.set(p, r.id);
    }
  }
  const unclaimed = [...obs.paths.keys()].filter((p) => !claimed.has(p)).sort();
  for (const p of unclaimed) {
    ok(false, `${[...obs.paths.get(p)!].sort().join(', ')} uses the construct "${p}", which NO row in ${SPEC_JSON} claims - the grammar grew and the spec did not`);
  }
  if (unclaimed.length === 0) {
    ok(true, `all ${obs.paths.size} construct path(s) used by ${obs.libraries.length} committed config(s) are claimed`);
  }

  // ---- 3. and no supported row claims a path nothing uses ----
  for (const r of supported) {
    for (const p of r.paths ?? []) {
      if (!obs.paths.has(p)) ok(false, `${r.id} claims the path "${p}", which no committed config uses - a supported claim nothing exercises`);
    }
  }

  // ---- 4. EVERY SUPPORTED ROW IS EXERCISED, by a config or by a test ----
  for (const r of supported) {
    const ex = r.exercisedBy ?? [];
    if (ex.length === 0) {
      ok(false, `${r.id}: claims support and names NOTHING that exercises it`);
      continue;
    }
    const bad: string[] = [];
    for (const e of ex) {
      if (e.startsWith('config:')) {
        const lib = e.slice('config:'.length);
        const usesIt =
          (r.paths ?? []).some((p) => obs.paths.get(p)?.has(lib)) ||
          (r.probe ? (PROBES[r.probe]?.(repoRoot) ?? []).includes(lib) : false);
        if (!usesIt) bad.push(`${e} does not use it`);
        continue;
      }
      const [file, token] = e.split('#');
      const text = read(file);
      if (text === null) {
        bad.push(`${e} - no such file`);
        continue;
      }
      if (token && !text.includes(token)) bad.push(`${e} - "${token}" is not in ${file}`);
    }
    if (bad.length > 0) ok(false, `${r.id}: claims support that nothing exercises (${bad.join('; ')})`);
  }
  ok(supported.every((r) => (r.exercisedBy ?? []).length > 0), `all ${supported.length} supported construct(s) name an exerciser`);

  // ---- 5. a probe-borne row must have a WORKING probe ----
  for (const r of supported) {
    if (r.probe && !PROBES[r.probe]) ok(false, `${r.id}: names probe "${r.probe}", which this gate cannot run`);
  }

  // ---- 6. the MARKERS the spec names must exist in the grammar itself ----
  const grammar = read(spec.grammar.file);
  if (grammar === null) {
    ok(false, `${spec.grammar.file} is unreadable - the spec describes code that is not there`);
  } else {
    for (const r of rows.filter((x) => x.kind === 'marker' && x.status === 'supported')) {
      const marker = /\$[A-Za-z]+/.exec(r.spelling)?.[0];
      if (marker && !grammar.includes(marker)) {
        ok(false, `${r.id}: the spec claims ${marker} is supported, but ${spec.grammar.file} never mentions it`);
      }
    }
    ok(true, `every supported marker is spelled in ${spec.grammar.file}`);
  }

  // ---- 7. totals are RECOMPUTED, never trusted ----
  const real = {
    supported: supported.length,
    unsupported: unsupported.length,
    constructs: rows.length,
    observedPaths: obs.paths.size,
    libraries: obs.libraries.length,
  };
  for (const [k, v] of Object.entries(real) as Array<[keyof typeof real, number]>) {
    ok(spec.totals[k] === v, `totals.${k} = ${spec.totals[k]} (recomputed ${v})`);
  }

  // ---- 8. the prose names every construct and quotes the real numbers ----
  const md = read(SPEC_MD);
  if (md === null) {
    ok(false, `${SPEC_MD} is missing - the machine-readable half must have a human half`);
  } else {
    const absent = rows.filter((r) => !md.includes(r.id)).map((r) => r.id);
    ok(absent.length === 0, absent.length === 0 ? `${SPEC_MD} names all ${rows.length} constructs` : `${SPEC_MD} does not name: ${absent.join(', ')}`);
    for (const claim of [`**${real.supported}** supported`, `**${real.unsupported}** unsupported`]) {
      ok(md.includes(claim), `${SPEC_MD} states "${claim}"`);
    }
  }

  // ---- 9. byte-stable canonical JSON ----
  const raw = read(SPEC_JSON);
  ok(raw === JSON.stringify(spec, null, 2) + '\n', `${SPEC_JSON} is canonical (JSON.stringify with 2-space indent, trailing newline)`);
  return f;
}

/** Deliberately broken specs, so the gate is proved able to go red. */
function selfTest(spec: Spec, obs: Observation, read: Read): number {
  const clone = (): Spec => JSON.parse(JSON.stringify(spec)) as Spec;
  const cases: Array<{ name: string; build: () => { s: Spec; r: Read; o: Observation }; expect: RegExp }> = [
    {
      name: 'a construct a committed config uses but the spec drops is REFUSED',
      build: () => {
        const s = clone();
        s.constructs = s.constructs.filter((c) => c.id !== 'component.childrenSpec');
        s.totals.supported--;
        s.totals.constructs--;
        return { s, r: read, o: obs };
      },
      expect: /uses the construct "components\[\]\.childrenSpec", which NO row/,
    },
    {
      name: 'a supported row whose exerciser does not exercise it is REFUSED',
      build: () => {
        const s = clone();
        s.constructs.find((c) => c.id === 'marker.date')!.exercisedBy = ['config:mui'];
        return { s, r: read, o: obs };
      },
      expect: /marker\.date: claims support that nothing exercises/,
    },
    {
      name: 'a supported row naming a ghost test file is REFUSED',
      build: () => {
        const s = clone();
        s.constructs.find((c) => c.id === 'component.importName.compound')!.exercisedBy = ['evals/ghost.ts#nope'];
        return { s, r: read, o: obs };
      },
      expect: /no such file/,
    },
    {
      name: 'a marker the grammar does not implement is REFUSED',
      build: () => {
        const s = clone();
        const r: Read = (fl) => (fl === s.grammar.file ? (read(fl) ?? '').split('$date').join('$NOPE') : read(fl));
        return { s, r, o: obs };
      },
      expect: /claims \$date is supported, but .* never mentions it/,
    },
    {
      name: 'an unsupported row with no consequence is REFUSED',
      build: () => {
        const s = clone();
        s.constructs.find((c) => c.id === 'no-steady-state')!.consequence = '';
        return { s, r: read, o: obs };
      },
      expect: /no-steady-state: "consequence" is empty/,
    },
    {
      name: 'a duplicate / unsorted construct id is REFUSED',
      build: () => {
        const s = clone();
        s.constructs = [s.constructs[3], ...s.constructs];
        s.totals.constructs++;
        s.totals.supported++;
        return { s, r: read, o: obs };
      },
      expect: /sorted by id|unique/,
    },
    {
      name: 'a hand-tweaked byte in the JSON is REFUSED (canonical form)',
      build: () => {
        const s = clone();
        const r: Read = (fl) => (fl === SPEC_JSON ? (read(fl) ?? '') + '\n' : read(fl));
        return { s, r, o: obs };
      },
      expect: /is canonical/,
    },
    {
      name: 'stale totals are REFUSED (recomputed, never trusted)',
      build: () => {
        const s = clone();
        s.totals.supported += 1;
        return { s, r: read, o: obs };
      },
      expect: /totals\.supported/,
    },
    {
      name: 'a construct the prose does not name is REFUSED',
      build: () => {
        const s = clone();
        const r: Read = (fl) => (fl === SPEC_MD ? (read(fl) ?? '').split('boolean-variant-axis').join('xx') : read(fl));
        return { s, r, o: obs };
      },
      expect: /does not name: boolean-variant-axis/,
    },
    {
      name: 'an empty config corpus REFUSES rather than passing vacuously',
      build: () => ({ s: clone(), r: read, o: { paths: new Map(), libraries: [] } }),
      expect: /a gate that cannot observe must refuse/,
    },
  ];

  console.log('\nSELF-TEST - the gate is proved able to go red');
  let failures = 0;
  for (const c of cases) {
    const { s, r, o } = c.build();
    const reds = auditSpec(s, o, r, REPO)
      .filter((x) => !x.ok)
      .map((x) => x.label);
    const hit = reds.some((l) => c.expect.test(l));
    console.log(`  ${hit ? 'ok  ' : 'FAIL'} ${c.name}`);
    if (!hit) {
      failures++;
      console.log(`      expected a red matching ${c.expect}; got: ${reds.length === 0 ? '(all green - the gate did NOT refuse)' : reds.slice(0, 3).join(' | ')}`);
    }
  }
  const clean = auditSpec(spec, obs, read, REPO).filter((x) => !x.ok);
  if (clean.length > 0) {
    failures++;
    console.log(`  FAIL the committed spec itself is red, so the red cases above prove nothing:\n      ${clean.map((x) => x.label).join('\n      ')}`);
  } else {
    console.log('  ok   the committed spec is green (so the red cases above are the gate, not noise)');
  }
  return failures;
}

function main(): void {
  const selfTestFlag = process.argv.includes('--self-test');
  const read: Read = (rel) => {
    const p = path.join(REPO, rel);
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
  };
  const raw = read(SPEC_JSON);
  if (raw === null) {
    console.error(`REFUSED: ${SPEC_JSON} is missing`);
    process.exit(1);
  }
  const spec = JSON.parse(raw) as Spec;
  const obs = observeConfigs(REPO);

  console.log(`THE GRAMMAR COVERAGE SPEC - ${SPEC_JSON} vs ${obs.libraries.length} committed capture config(s)`);
  const findings = auditSpec(spec, obs, read, REPO);
  let failures = 0;
  for (const x of findings) {
    if (!x.ok) {
      failures++;
      console.log(`  FAIL ${x.label}`);
    }
  }
  if (failures === 0) for (const x of findings) console.log(`  ok   ${x.label}`);

  if (selfTestFlag) failures += selfTest(spec, obs, read);

  if (failures > 0) {
    console.error(`\nREFUSED: grammar coverage, ${failures} failure(s)`);
    process.exit(1);
  }
  console.log(
    `\nOK grammar coverage: ${spec.totals.supported} supported and ${spec.totals.unsupported} unsupported construct(s); ` +
      `${obs.paths.size} construct path(s) across ${obs.libraries.length} committed config(s) are all claimed and exercised`,
  );
}

main();

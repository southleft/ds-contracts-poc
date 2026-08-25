/**
 * THE DOOR REGISTER GATE — `npm run door-register:check`
 *
 * A DOOR is any rule in this pipeline that decides a computed fact is NOT a
 * fact of this component (subtractive) or that a fact IS admitted (admitting).
 * Doors are the only judgement calls the conversion makes, and until this round
 * a large share of them made those calls SILENTLY: a bare `if`, a `continue`, a
 * `return undefined`, with no array, no counter and no line anywhere. The two
 * worst defects found on the corpus — shadcn's invisible Input border and
 * Polaris' inkless text — were both a door subtracting a real fact because a
 * library's global CSS violated the door's premise, and in both cases the
 * pipeline said nothing at all.
 *
 * This check holds the register to the code in four directions:
 *
 *   1. DISCOVERY — every `// @door <id>` marker in the source files the
 *      register covers must name a door the register carries. A new door added
 *      to the code without a register entry fails here, which is the whole
 *      point: a judgement call that is not written down is not reviewable.
 *   2. COMPLETENESS — every registered door must have its marker present, on
 *      the line the register records. A door that was deleted or moved without
 *      the register following fails here.
 *   3. RECEIPT PATHS — a door that CLAIMS to leave a receipt must have a
 *      receipt path in its own file: the literal `receipt.marker` string must
 *      appear there. A register that claims honesty it does not have is worse
 *      than one that admits silence.
 *   4. SHAPE — ids are lowercase-kebab and stage-prefixed, unique, sorted; the
 *      JSON is byte-stable (re-serializing produces the same bytes); the
 *      stage prefix agrees with the file; `kind` is one of the three values.
 *
 * It also RE-MEASURES the subtraction census over the committed corpus and
 * refuses when the pinned numbers move — the honest size of the "missing ink"
 * surface is a number this repo has to keep re-earning, not a claim it made
 * once. See scripts/door-census.ts.
 *
 *   npx tsx scripts/door-register-check.ts
 *   npx tsx scripts/door-register-check.ts --self-test   # red cases
 *
 * WHAT THIS CHECK MUST NOT DO: change which facts are dropped. Naming, not
 * carrying — the same discipline as core/code-only-facts-check.ts.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCensus, censusTable, type Census } from './door-census.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTER = path.join(REPO, 'spec/door-register.json');
const DOC = path.join(REPO, 'spec/DOOR-REGISTER.md');

export interface Door {
  id: string;
  stage: string;
  path: 'capture' | 'propose';
  file: string;
  line: number;
  ruleLine?: number;
  markerOutsideRule?: string;
  kind: 'subtractive' | 'admitting' | 'both';
  premise: string;
  effect: string;
  counterExample: string;
  receipt: { channel: string; marker?: string };
  closedIn?: string;
  closedNote?: string;
}
export interface Register {
  $comment: string;
  version: number;
  markerConvention: string;
  doors: Door[];
}

/** The stage prefix an id must carry, and the one file that stage lives in.
 *  A stage is a place a judgement call can be made; adding one is a decision,
 *  so the map is explicit rather than derived from whatever files exist. */
export const STAGE_FILES: Record<string, string> = {
  capture: 'extract/computed/capture.ts',
  anatomy: 'extract/computed/anatomy.ts',
  fuse: 'extract/computed/fuse.ts',
  mint: 'core/mint-tokens.ts',
  libcss: 'extract/computed/lib-css.ts',
  regate: 'extract/computed/regate.ts',
  gate: 'extract/computed/gate.ts',
  decisions: 'extract/computed/decisions.ts',
  resolve: 'extract/computed/resolve.ts',
  propose: 'core/propose-figma.ts',
};

const MARKER_RE = /^\s*\/\/ @door ([^\s]+)\s*$/;
const ID_RE = /^[a-z0-9]+\.[a-z0-9-]+$/;
const KINDS = new Set(['subtractive', 'admitting', 'both']);

/** THE PINNED CENSUS — re-measured 2026-08-24 by re-fusing all 116 committed
 *  components through this tree's engine (`npx tsx scripts/door-census.ts`).
 *
 *  `authored` is the honest size of the "missing ink" surface: the control-equal
 *  drops the LIBRARY'S OWN STYLESHEET declares on the element, where the
 *  control-element delta door's premise is provably false. A count moving in
 *  either direction is a human's decision — "fewer" is not automatically
 *  progress (see extract/figma/dagger-census.ts for why). */
export const PINNED_CENSUS: Record<string, { components: number; drops: number; authored: number; fallback: number }> = {
  altitude: { components: 8, drops: 4830, authored: 8, fallback: 5 },
  antd: { components: 12, drops: 25048, authored: 19, fallback: 20 },
  astryx: { components: 10, drops: 24272, authored: 0, fallback: 16 },
  carbon: { components: 10, drops: 38009, authored: 13, fallback: 32 },
  fluent: { components: 11, drops: 21282, authored: 14, fallback: 19 },
  mui: { components: 31, drops: 70187, authored: 0, fallback: 93 },
  polaris: { components: 12, drops: 46134, authored: 78, fallback: 43 },
  shadcn: { components: 11, drops: 12700, authored: 103, fallback: 7 },
  tailwind: { components: 11, drops: 8274, authored: 9, fallback: 7 },
};

export interface Finding {
  ok: boolean;
  label: string;
}

/** Every check except the corpus census — pure over (register, file texts), so
 *  the self-test can feed it deliberately broken inputs. */
export function auditRegister(reg: Register, read: (file: string) => string | null): Finding[] {
  const out: Finding[] = [];
  const bad = (label: string) => out.push({ ok: false, label });
  const ok = (label: string) => out.push({ ok: true, label });

  // ---- 4. SHAPE ----
  const ids = reg.doors.map((d) => d.id);
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dupes.length > 0) bad(`duplicate door id(s): ${[...new Set(dupes)].join(', ')}`);
  else ok(`${ids.length} door ids are unique`);

  const sorted = [...ids].sort();
  if (JSON.stringify(ids) !== JSON.stringify(sorted)) {
    const at = ids.findIndex((v, i) => v !== sorted[i]);
    bad(`the register is not sorted by id — first divergence at index ${at}: ${ids[at]} where ${sorted[at]} was expected`);
  } else ok('the register is sorted by id (byte-stable diffs)');

  const shapeBad = reg.doors.filter((d) => !ID_RE.test(d.id));
  if (shapeBad.length > 0) bad(`${shapeBad.length} id(s) are not lowercase-kebab with a stage prefix: ${shapeBad.slice(0, 4).map((d) => d.id).join(', ')}`);
  else ok('every id is lowercase-kebab with a stage prefix');

  const kindBad = reg.doors.filter((d) => !KINDS.has(d.kind));
  if (kindBad.length > 0) bad(`${kindBad.length} door(s) carry a kind outside subtractive/admitting/both`);
  else ok('every door is classified subtractive, admitting or both');

  const stageBad = reg.doors.filter((d) => STAGE_FILES[d.id.split('.')[0]] !== d.file);
  if (stageBad.length > 0) {
    bad(`${stageBad.length} door(s) name a file their stage prefix does not own: ${stageBad.slice(0, 4).map((d) => `${d.id} -> ${d.file}`).join('; ')}`);
  } else ok(`every id's stage prefix agrees with its file (${Object.keys(STAGE_FILES).length} stages)`);

  const proseBad = reg.doors.filter((d) => !d.premise || !d.effect || !d.counterExample);
  if (proseBad.length > 0) bad(`${proseBad.length} door(s) are missing a premise, an effect or a counter-example — a door with no stated premise cannot be reviewed`);
  else ok('every door states a premise, what it subtracts or admits, and a counter-example');

  // ---- 1 + 2. DISCOVERY and COMPLETENESS ----
  const registered = new Map(reg.doors.map((d) => [d.id, d]));
  const foundInCode = new Map<string, Array<{ file: string; line: number }>>();
  let unreadable = 0;
  for (const file of new Set(Object.values(STAGE_FILES))) {
    const text = read(file);
    if (text === null) { unreadable++; continue; }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = MARKER_RE.exec(lines[i]);
      if (!m) continue;
      if (!foundInCode.has(m[1])) foundInCode.set(m[1], []);
      foundInCode.get(m[1])!.push({ file, line: i + 1 });
    }
  }
  if (unreadable > 0) bad(`${unreadable} registered door file(s) could not be read — the discovery sweep is not a denominator`);

  const undeclared = [...foundInCode.keys()].filter((id) => !registered.has(id));
  if (undeclared.length > 0) {
    bad(`${undeclared.length} door marker(s) exist in code but NOT in spec/door-register.json: ${undeclared.slice(0, 6).join(', ')} — a judgement call that is not written down is not reviewable`);
  } else ok(`every one of the ${foundInCode.size} @door markers in code is registered`);

  const unmarked = reg.doors.filter((d) => !foundInCode.has(d.id));
  if (unmarked.length > 0) {
    bad(`${unmarked.length} registered door(s) have NO @door marker in code: ${unmarked.slice(0, 6).map((d) => d.id).join(', ')} — the register has drifted off the rule it describes`);
  } else ok(`every one of the ${reg.doors.length} registered doors is marked at its rule`);

  const misplaced = reg.doors.filter((d) => {
    const hits = foundInCode.get(d.id);
    if (!hits) return false;
    return !hits.some((h) => h.file === d.file && h.line === d.line);
  });
  if (misplaced.length > 0) {
    bad(`${misplaced.length} door(s) record a line the marker is not on: ${misplaced.slice(0, 5).map((d) => `${d.id} (register says ${d.file}:${d.line}, marker at ${foundInCode.get(d.id)!.map((h) => h.line).join('/')})`).join('; ')}`);
  } else ok('every registered line matches where its marker actually sits');

  // ---- 3. RECEIPT PATHS ----
  const claimsReceipt = reg.doors.filter((d) => d.receipt.channel !== 'none');
  const noMarker = claimsReceipt.filter((d) => !d.receipt.marker);
  if (noMarker.length > 0) bad(`${noMarker.length} door(s) claim a receipt channel but name no receipt marker to prove it`);
  else ok(`${claimsReceipt.length} door(s) claiming a receipt name the literal that proves the path`);

  const brokenPath: string[] = [];
  for (const d of claimsReceipt) {
    if (!d.receipt.marker) continue;
    const text = read(d.file);
    if (text === null) continue;
    if (!text.includes(d.receipt.marker)) brokenPath.push(`${d.id} (claims \`${d.receipt.marker}\` in ${d.file})`);
  }
  if (brokenPath.length > 0) {
    bad(`${brokenPath.length} door(s) claim to receipt but no receipt path exists in their file: ${brokenPath.slice(0, 5).join('; ')} — a register that claims honesty it does not have is worse than one that admits silence`);
  } else ok('every claimed receipt path exists in the door\'s own file');

  const silent = reg.doors.filter((d) => d.receipt.channel === 'none');
  if (silent.length === 0) {
    bad('ZERO doors are recorded as silent — either every door now receipts (then say so deliberately) or the register stopped being honest about the ones that do not');
  } else ok(`${silent.length} of ${reg.doors.length} doors are recorded as still firing silently — named, not hidden`);

  return out;
}

/** The census half — refuses when the measured subtraction table moves. */
export function auditCensus(c: Census): Finding[] {
  const out: Finding[] = [];
  const bad = (label: string) => out.push({ ok: false, label });
  const ok = (label: string) => out.push({ ok: true, label });

  // A config that has never been captured (held-out exam material, by design)
  // is a NAMED skip, not a failure: there is nothing to census, and saying so
  // out loud is the anti-silent property. A component that HAS captures and
  // still would not re-fuse is a real red — the census would not be a
  // denominator. Keep the two apart.
  const neverCaptured = c.skipped.filter((s) => s.includes('no committed captures'));
  const refuseFailures = c.skipped.filter((s) => !s.includes('no committed captures'));
  if (refuseFailures.length > 0) {
    bad(`${refuseFailures.length} component(s) failed to re-fuse — the census below is NOT a denominator:\n      ${refuseFailures.slice(0, 5).join('\n      ')}`);
  } else ok(`all ${c.components} committed components re-fused offline, 0 failed`);
  if (neverCaptured.length > 0) {
    ok(`${neverCaptured.length} config(s) never captured, named and excluded from the denominator:\n      ${neverCaptured.join('\n      ')}`);
  }
  if (c.components < 50) {
    bad(`only ${c.components} components re-fused — a check that passes because it measured almost nothing is the defect this repo keeps finding`);
  }

  const seen = new Set<string>();
  for (const l of c.libraries) {
    seen.add(l.library);
    const p = PINNED_CENSUS[l.library];
    if (!p) { bad(`library "${l.library}" has committed captures but no pinned census row — add it, or the totals are measured over the wrong population`); continue; }
    const moved: string[] = [];
    if (l.components !== p.components) moved.push(`components ${p.components} -> ${l.components}`);
    if (l.controlEqualDrops !== p.drops) moved.push(`control-equal drops ${p.drops} -> ${l.controlEqualDrops}`);
    if (l.controlEqualAuthored !== p.authored) moved.push(`LIBRARY-AUTHORED drops ${p.authored} -> ${l.controlEqualAuthored}`);
    if (l.controlFallbackParts !== p.fallback) moved.push(`span-fallback parts ${p.fallback} -> ${l.controlFallbackParts}`);
    if (moved.length > 0) bad(`${l.library}: ${moved.join(', ')} — a moved count is a human's decision, in either direction`);
  }
  for (const k of Object.keys(PINNED_CENSUS)) {
    if (!seen.has(k)) bad(`pinned library "${k}" produced no census row — its captures went missing`);
  }
  if (!out.some((f) => !f.ok)) ok(`the subtraction census matches the pinned table across ${c.libraries.length} libraries`);

  const totalAuthored = c.libraries.reduce((n, l) => n + l.controlEqualAuthored, 0);
  if (totalAuthored === 0) {
    bad('ZERO library-authored control-equal drops measured — either the split is broken or the corpus lost its var() evidence; the whole point of the census is that this number is not zero');
  } else {
    ok(`${totalAuthored} library-authored control-equal drops named — the measured size of the "missing ink" surface`);
  }
  return out;
}

/** Deliberately broken registers, so the gate is proved to be able to go red. */
function selfTest(): number {
  const real = JSON.parse(readFileSync(REGISTER, 'utf8')) as Register;
  const files = new Map<string, string>();
  for (const f of new Set(Object.values(STAGE_FILES))) files.set(f, readFileSync(path.join(REPO, f), 'utf8'));
  const read = (f: string) => files.get(f) ?? null;
  const clone = (): Register => JSON.parse(JSON.stringify(real)) as Register;

  const cases: Array<{ name: string; build: () => { reg: Register; read: (f: string) => string | null }; expect: RegExp }> = [
    {
      name: 'a door marker in code with no register entry is REFUSED',
      build: () => {
        const reg = clone();
        reg.doors = reg.doors.filter((d) => d.id !== 'fuse.control-element-delta');
        return { reg, read };
      },
      expect: /exist in code but NOT in spec\/door-register\.json/,
    },
    {
      name: 'a registered door with no marker in code is REFUSED',
      build: () => {
        const reg = clone();
        reg.doors.push({ ...reg.doors[0], id: 'fuse.a-door-that-is-not-in-the-code' });
        reg.doors.sort((a, b) => (a.id < b.id ? -1 : 1));
        return { reg, read };
      },
      expect: /have NO @door marker in code/,
    },
    {
      name: 'a door claiming a receipt whose receipt path does not exist is REFUSED',
      build: () => {
        const reg = clone();
        const d = reg.doors.find((x) => x.id === 'fuse.control-element-delta')!;
        d.receipt = { channel: 'styled-channel-receipts', marker: 'a-receipt-prefix-nothing-emits:' };
        return { reg, read };
      },
      expect: /claim to receipt but no receipt path exists/,
    },
    {
      name: 'a door claiming a receipt channel but naming no marker is REFUSED',
      build: () => {
        const reg = clone();
        reg.doors.find((x) => x.id === 'fuse.control-element-delta')!.receipt = { channel: 'styled-channel-receipts' };
        return { reg, read };
      },
      expect: /name no receipt marker/,
    },
    {
      name: 'an unsorted register is REFUSED',
      build: () => {
        const reg = clone();
        [reg.doors[0], reg.doors[1]] = [reg.doors[1], reg.doors[0]];
        return { reg, read };
      },
      expect: /is not sorted by id/,
    },
    {
      name: 'a duplicate door id is REFUSED',
      build: () => {
        const reg = clone();
        reg.doors.splice(1, 0, { ...reg.doors[0] });
        return { reg, read };
      },
      expect: /duplicate door id/,
    },
    {
      name: 'an id whose stage prefix does not own its file is REFUSED',
      build: () => {
        const reg = clone();
        reg.doors.find((x) => x.id === 'fuse.control-element-delta')!.file = 'core/mint-tokens.ts';
        return { reg, read };
      },
      expect: /name a file their stage prefix does not own/,
    },
    {
      name: 'a register line that is not where the marker sits is REFUSED',
      build: () => {
        const reg = clone();
        reg.doors.find((x) => x.id === 'fuse.control-element-delta')!.line = 1;
        return { reg, read };
      },
      expect: /record a line the marker is not on/,
    },
    {
      name: 'a door with no stated premise is REFUSED',
      build: () => {
        const reg = clone();
        reg.doors.find((x) => x.id === 'fuse.control-element-delta')!.premise = '';
        return { reg, read };
      },
      expect: /missing a premise/,
    },
    {
      name: 'a register that claims every door receipts is REFUSED',
      build: () => {
        const reg = clone();
        for (const d of reg.doors) if (d.receipt.channel === 'none') d.receipt = { channel: 'notes', marker: 'ctx.notes.push' };
        return { reg, read };
      },
      expect: /ZERO doors are recorded as silent/,
    },
    {
      name: 'an unreadable door file is REFUSED (the sweep is not a denominator)',
      build: () => ({ reg: clone(), read: (f: string) => (f === 'extract/computed/fuse.ts' ? null : (files.get(f) ?? null)) }),
      expect: /could not be read/,
    },
  ];

  console.log('\nSELF-TEST — the gate is proved able to go red');
  let failures = 0;
  for (const c of cases) {
    const { reg, read: r } = c.build();
    const findings = auditRegister(reg, r);
    const reds = findings.filter((f) => !f.ok).map((f) => f.label);
    const hit = reds.some((l) => c.expect.test(l));
    console.log(`  ${hit ? '✔' : '✖'} ${c.name}`);
    if (!hit) {
      failures++;
      console.log(`      expected a red matching ${c.expect}; got: ${reds.length === 0 ? '(all green — the gate did NOT refuse)' : reds.slice(0, 3).join(' | ')}`);
    }
  }
  // …and the honest register must be GREEN, or the red cases prove nothing.
  const clean = auditRegister(real, read).filter((f) => !f.ok);
  if (clean.length > 0) {
    failures++;
    console.log(`  ✖ the committed register itself is red, so the red cases above prove nothing:\n      ${clean.map((f) => f.label).join('\n      ')}`);
  } else console.log('  ✔ the committed register is green (so the red cases above are the gate, not noise)');
  return failures;
}

// ---------------------------------------------------------------------------

const selfTestOnly = process.argv.includes('--self-test');
let failures = 0;

console.log('THE DOOR REGISTER — spec/door-register.json vs the code it describes');

if (!existsSync(REGISTER)) {
  console.error(`  ✖ ${REGISTER} does not exist`);
  process.exit(1);
}
const raw = readFileSync(REGISTER, 'utf8');
const reg = JSON.parse(raw) as Register;

console.log('\n1. the register is byte-stable');
{
  const round = JSON.stringify(reg, null, 2) + '\n';
  if (round !== raw) {
    console.log('  ✖ spec/door-register.json is not byte-stable — re-serializing produces different bytes (key order, indentation or trailing newline). A register whose diffs are noise does not get read.');
    failures++;
  } else console.log(`  ✔ ${raw.length.toLocaleString('en-US')} bytes round-trip exactly`);
}

console.log('\n2. the register and the code agree');
for (const f of auditRegister(reg, (file) => {
  const abs = path.join(REPO, file);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
})) {
  console.log(`  ${f.ok ? '✔' : '✖'} ${f.label}`);
  if (!f.ok) failures++;
}

console.log('\n3. the doc names the same doors as the register');
{
  if (!existsSync(DOC)) {
    console.log('  ✖ spec/DOOR-REGISTER.md does not exist');
    failures++;
  } else {
    const doc = readFileSync(DOC, 'utf8');
    const missing = reg.doors.filter((d) => !doc.includes(d.id));
    if (missing.length > 0) {
      console.log(`  ✖ ${missing.length} registered door(s) are absent from spec/DOOR-REGISTER.md: ${missing.slice(0, 5).map((d) => d.id).join(', ')}`);
      failures++;
    } else console.log(`  ✔ all ${reg.doors.length} doors appear in spec/DOOR-REGISTER.md`);
    const claimed = /\*\*(\d+)\*\* doors/.exec(doc);
    if (!claimed) {
      console.log('  ✖ spec/DOOR-REGISTER.md does not state a door count in the pinned form (**N** doors)');
      failures++;
    } else if (Number(claimed[1]) !== reg.doors.length) {
      console.log(`  ✖ spec/DOOR-REGISTER.md claims ${claimed[1]} doors; the register carries ${reg.doors.length}`);
      failures++;
    } else console.log(`  ✔ the doc's stated count (${claimed[1]}) matches the register`);
  }
}

console.log('\n4. the subtraction census, re-measured over the committed corpus');
{
  const c = runCensus();
  for (const f of auditCensus(c)) {
    console.log(`  ${f.ok ? '✔' : '✖'} ${f.label}`);
    if (!f.ok) failures++;
  }
  console.log('');
  for (const line of censusTable(c)) console.log(`    ${line}`);
}

if (selfTestOnly || process.env.DOOR_REGISTER_SELF_TEST === '1') failures += selfTest();

console.log('');
if (failures > 0) {
  console.error(`✖ door register: ${failures} failure(s)`);
  process.exit(1);
}
console.log(`✔ door register: ${reg.doors.length} doors named and premised, ${reg.doors.filter((d) => d.receipt.channel === 'none').length} still silent (named as such), every claimed receipt path present, census matches the pinned table.`);

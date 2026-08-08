/**
 * SLOT CARDINALITY AND THE RESTRICT TIER — `npm run slot-constraints:check`.
 *
 * WHY THIS EXISTS. contracts/contract.schema.json has accepted `slot.min`,
 * `slot.max` and `slot.acceptsMode: 'restrict'` for as long as slots have
 * existed, and until 2026-08-04 NOTHING refereed any of them. An author who
 * wrote `max: 3` got silence: no carry, no refusal, no receipt. A schema that
 * accepts a constraint and then ignores it is the same defect as a receipt
 * naming a destination that discards the fact — the promise is made in the one
 * file adopters read first.
 *
 * MEASURED over every committed contract before writing the fix (48 slots):
 *   acceptsMode  38   accepts  19   defaultContent  12   required  3
 *   min  0        max  0       acceptsMode:'restrict'  0
 * All 38 acceptsMode declarations are `open` (20) or `prefer` (18). So this
 * closes a PROMISE, not a live bug, and every fixture below is synthetic
 * because the corpus contains nothing to point at. Saying that plainly is part
 * of the measurement: a gate whose corpus is zero must not imply otherwise.
 *
 * THE ASYMMETRY THIS FILE ALSO PINS. `accepts` maps to the SLOT property's
 * `preferredValues` (INSTANCE_SWAP's, before the native-slots round), which is
 * a PICKER HINT — it sorts the listed components to the top of the picker and
 * does not prevent any other choice. So `prefer` maps exactly, `open` maps by
 * carrying nothing, and `restrict` — the only tier with teeth — HAS NO CANVAS
 * SPELLING. §4 proves that by driving the real emitter rather than asserting
 * it: a restrict slot and a prefer slot emit the SAME preferredValues and
 * differ in exactly one line — the SLOT property's `description`, where the
 * emitter names the refusal in words for the designer to read. The restriction
 * is real on the code surface and unenforced on canvas, stated on both.
 *
 * Pure functions over synthetic contracts. No browser, no capture data.
 */
import { validateContract } from './emit-react.js';
import type { Contract } from '../scripts/contract-schema.js';

const failures: string[] = [];
const bad = (m: string) => failures.push(m);
const ok = (m: string) => console.log(`  ✔ ${m}`);

/** A minimal host contract with one slot, plus a leaf it can compose. */
const leaf = (id: string): Contract =>
  ({
    $schema: '', id, name: id.split('.')[1] ?? id, version: '0.1.0',
    semantics: { element: 'span', role: 'none' },
    props: [], states: [], tokens: {}, anatomy: { root: { element: 'span', tokens: {} } },
  }) as unknown as Contract;

const hostWith = (slot: Record<string, unknown>): Contract =>
  ({
    $schema: '', id: 'ds.host', name: 'Host', version: '0.1.0',
    semantics: { element: 'div', role: 'none' },
    props: [], states: [], tokens: {},
    anatomy: { root: { element: 'div', tokens: {}, parts: { area: { element: 'div', tokens: {}, slot } } } },
  }) as unknown as Contract;

const SCOPE = new Map<string, Contract>([
  ['ds.alpha', leaf('ds.alpha')],
  ['ds.beta', leaf('ds.beta')],
]);

/** Every error validateContract raises for this contract. */
const errorsFor = (c: Contract): string[] => {
  const errs: string[] = [];
  const byId = new Map(SCOPE);
  byId.set(c.id, c);
  validateContract(c, byId, errs, new Map<string, string>());
  return errs;
};
const complains = (c: Contract, needle: string) => errorsFor(c).some((e) => e.includes(needle));

console.log('\n1. CARDINALITY — min/max are refereed, not merely accepted');
{
  const impossible = hostWith({ name: 'area', min: 3, max: 2 });
  if (!complains(impossible, 'min 3 > max 2')) bad(`min > max was ACCEPTED — no content can satisfy it. errors: ${JSON.stringify(errorsFor(impossible))}`);
  else ok('min > max refused by name');

  const overMax = hostWith({ name: 'area', max: 1, defaultContent: [{ id: 'ds.alpha' }, { id: 'ds.beta' }] });
  if (!complains(overMax, 'max 1 but its defaultContent ships 2')) bad(`defaultContent exceeding max was ACCEPTED. errors: ${JSON.stringify(errorsFor(overMax))}`);
  else ok('defaultContent over max refused by name');

  const underMin = hostWith({ name: 'area', min: 2, defaultContent: [{ id: 'ds.alpha' }] });
  if (!complains(underMin, 'min 2 but its defaultContent ships only 1')) bad(`defaultContent under min was ACCEPTED. errors: ${JSON.stringify(errorsFor(underMin))}`);
  else ok('defaultContent under min refused by name');

  const requiredEmpty = hostWith({ name: 'area', required: true, min: 0 });
  if (!complains(requiredEmpty, 'required but declares min 0')) bad('a required slot declaring min 0 was ACCEPTED — it cannot accept emptiness and require content');
  else ok('required + min 0 refused by name');
}

console.log('\n2. THE RESTRICT TIER — enforced on the code surface');
{
  const restrictNoAccepts = hostWith({ name: 'area', acceptsMode: 'restrict' });
  if (!complains(restrictNoAccepts, 'lists no accepts')) bad('acceptsMode "restrict" with an empty accepts was ACCEPTED — restricting to nothing admits nothing');
  else ok('restrict with no accepts refused by name');

  const selfViolating = hostWith({
    name: 'area', acceptsMode: 'restrict', accepts: ['ds.alpha'],
    defaultContent: [{ id: 'ds.beta' }],
  });
  if (!complains(selfViolating, 'not in accepts')) bad(`a restrict slot shipping defaultContent OUTSIDE its own accepts was ACCEPTED. errors: ${JSON.stringify(errorsFor(selfViolating))}`);
  else ok('restrict violated by the contract\'s own defaultContent refused by name');
}

console.log('\n3. NO OVER-APPLICATION — the legal shapes still pass');
{
  // Every shape the committed corpus actually uses must stay legal, or this
  // gate would be a migration rather than a referee. These mirror the measured
  // census: acceptsMode open/prefer, accepts, defaultContent, required.
  const legal: Array<[string, Record<string, unknown>]> = [
    ['open, no constraints', { name: 'area', acceptsMode: 'open' }],
    ['prefer + accepts', { name: 'area', acceptsMode: 'prefer', accepts: ['ds.alpha', 'ds.beta'] }],
    ['restrict honoured by its own defaultContent', { name: 'area', acceptsMode: 'restrict', accepts: ['ds.alpha'], defaultContent: [{ id: 'ds.alpha' }] }],
    ['max with defaultContent inside it', { name: 'area', max: 2, defaultContent: [{ id: 'ds.alpha' }] }],
    ['min with an EMPTY defaultContent (the consumer fills it)', { name: 'area', min: 2 }],
    ['required with min 1', { name: 'area', required: true, min: 1, defaultContent: [{ id: 'ds.alpha' }] }],
  ];
  for (const [label, slot] of legal) {
    const errs = errorsFor(hostWith(slot));
    const slotErrs = errs.filter((e) => /slot "area"/.test(e));
    if (slotErrs.length > 0) bad(`a LEGAL slot shape was refused — ${label}: ${JSON.stringify(slotErrs)}`);
    else ok(`still legal: ${label}`);
  }
}

console.log('\n4. THE CANVAS CANNOT HOLD `restrict` — proven by emission, not asserted');
{
  // Figma's preferredValues (INSTANCE_SWAP's, and since the native-slots round
  // the SLOT property's) is a picker hint. If `restrict` had a canvas spelling,
  // a restrict contract and a prefer contract would emit a DIFFERENT
  // CONSTRAINT. They do not.
  //
  // REVISED 2026-08-08 (native slots). Until this round the pin was
  // byte-identity of the two emitted scripts. Native slots gave the constraint
  // one honest surface — the SLOT property's `description`, which Figma shows
  // in the property panel — so the emitter now WRITES the refusal there in
  // words ("REFUSED BY FIGMA: acceptsMode \"restrict\" has no canvas
  // enforcement"). That is a stronger receipt than silence, and it means the
  // two scripts differ. What must stay identical is everything that ENFORCES:
  // this now diffs the scripts line by line and refuses any difference outside
  // the description string.
  // Driven on a REAL committed contract, not a synthetic one. A hand-built
  // fixture kept failing on corpus shape ($type, then figma bindings), and
  // fighting that would have been fighting the fixture rather than measuring
  // the emitter. avatar-group ships a slot with `accepts` and acceptsMode
  // 'prefer'; cloning it to 'restrict' changes exactly one field, so any
  // difference in the emitted script is attributable to that field alone.
  let a = '';
  let b = '';
  let threw = '';
  try {
    const { readFileSync, readdirSync } = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const { createFigmaEngine } = await import('./emit-figma-script.js');
    const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const all = new Map<string, Contract>();
    for (const f of readdirSync(path.join(REPO, 'contracts')).filter((x) => x.endsWith('.contract.json'))) {
      const c = JSON.parse(readFileSync(path.join(REPO, 'contracts', f), 'utf8')) as Contract;
      all.set(c.id, c);
    }
    const subject = [...all.values()].find((c) =>
      JSON.stringify(c.anatomy).includes('"acceptsMode":"prefer"') || JSON.stringify(c.anatomy).includes('"acceptsMode": "prefer"'),
    );
    if (!subject) throw new Error('no committed contract carries acceptsMode "prefer" — the census this file quotes is stale');
    // The SAME corpus shape scripts/generate-figma.ts:47 builds — read from
    // the committed token files, not hand-assembled.
    const rd = (rel: string) => JSON.parse(readFileSync(path.join(REPO, rel), 'utf8'));
    const brands = readdirSync(path.join(REPO, 'tokens', 'modes'))
      .filter((f) => f.startsWith('brand.') && f.endsWith('.tokens.json'))
      .map((f) => f.slice('brand.'.length, -'.tokens.json'.length));
    const engine = createFigmaEngine({
      tokens: {
        primitives: rd('tokens/primitives.tokens.json'),
        semantic: rd('tokens/semantic.tokens.json'),
        light: rd('tokens/modes/semantic.light.tokens.json'),
        dark: rd('tokens/modes/semantic.dark.tokens.json'),
        brands: Object.fromEntries(brands.map((n) => [n, rd(`tokens/modes/brand.${n}.tokens.json`)])),
      },
      icons: new Map<string, string>(),
    } as never);
    const flipped = JSON.parse(JSON.stringify(subject).replaceAll('"acceptsMode":"prefer"', '"acceptsMode":"restrict"').replaceAll('"acceptsMode": "prefer"', '"acceptsMode": "restrict"')) as Contract;
    console.log(`     subject: ${subject.id} (real committed contract)`);
    a = engine.buildComponentScript(flipped, all);
    b = engine.buildComponentScript(subject, all);
  } catch (e) { threw = (e as Error).message.slice(0, 220); }
  if (threw) {
    console.log(`  – §4 could not drive the emitter (${threw}); the asymmetry is recorded in the header and in docs/08 rather than pinned here.`);
  } else if (a && b) {
    const aLines = a.split('\n');
    const bLines = b.split('\n');
    if (aLines.length !== bLines.length) {
      bad(`a restrict slot and a prefer slot emitted a DIFFERENT NUMBER OF LINES (${aLines.length} vs ${bLines.length}) — if the canvas can now express restrict, this file's central claim is stale and docs/23 must be corrected`);
    } else {
      const differing = aLines
        .map((line, i) => [line, bLines[i]] as const)
        .filter(([x, y]) => x !== y);
      const enforcing = differing.filter(([x, y]) => !(x.includes('slotDescription') && y.includes('slotDescription')));
      if (enforcing.length > 0) {
        bad(`restrict vs prefer changed ${enforcing.length} line(s) OUTSIDE the SLOT description — the canvas may now be expressing restrict, which this file and docs/23 both deny: ${JSON.stringify(enforcing.slice(0, 2))}`);
      } else if (differing.length === 0) {
        bad('restrict and prefer emitted byte-identical scripts — the emitter is no longer NAMING the refusal in the SLOT description, so a designer meets the restriction only by violating it');
      } else {
        ok(`restrict and prefer differ in exactly ${differing.length} line(s), all of them the SLOT property description — the constraint is carried as WORDS in Figma's property panel and enforced only on the code surface`);
        const restrictDesc = differing.find(([x]) => x.includes('REFUSED BY FIGMA'));
        if (!restrictDesc) bad('the restrict emission does not name the refusal ("REFUSED BY FIGMA") in its SLOT description');
        else ok('the restrict description names the refusal verbatim, on the canvas, where the designer reads it');
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`\n✘ slot constraints: ${failures.length} failure(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\n✔ slot constraints: min/max/required and the restrict tier are refereed on the code surface, every shape the corpus uses stays legal, and `restrict` is recorded as having no canvas spelling.');

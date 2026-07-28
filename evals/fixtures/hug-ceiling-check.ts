/**
 * hug-ceiling eval body (task #37) — the ROOT max-width lowering.
 *
 * THE DEFECT. Carbon's Button is `inline-size: max-content;
 * max-inline-size: 20rem`: the box HUGS its label under a 320px ceiling. The
 * Figma emitter baked a ROOT's `max-width` as a FIXED width — parts had bound
 * the real `maxWidth` field since the molecule round, but roots were EXEMPTED
 * by name ("golden pins those design widths") — so every Button variant drew
 * 320px wide with its label stranded at the left by the root's own
 * `justify: space-between`. The CONTROL was in the same live paste: the SAME
 * Carbon button nested in Modal's footer rendered at 125px and 111px, correct,
 * because a nested PART got the ceiling treatment.
 *
 * WHAT THIS PINS — all four halves of the discriminator, on ONE synthetic
 * contract so the eval cannot rot with any library's artifacts:
 *   1. NO EVIDENCE ⇒ the design-width lowering SURVIVES. This is the half the
 *      21 hand-authored `{size.card.width}` roots in contracts/ depend on;
 *      break it and every golden moves.
 *   2. MEASURED EVIDENCE ⇒ a `maxWidth` BINDING and no fixedWidth, and the
 *      built cell renders STRICTLY NARROWER than the cap.
 *   3. The flag is REFUSED on a part with no max-width channel to qualify.
 *   4. The shipped corpus actually carries it — Carbon's Button, the component
 *      the owner reported, is measured hugging and compiles to a ceiling.
 *
 * Exits non-zero with a named failure on any violated expectation.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import { emitFigmaScript } from '../../core/emit-figma-script.js';
import { validateContract } from '../../core/emit-react.js';
import { createFigmaMock } from '../../scripts/plugin-engine-mock-figma.mjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);

const fail = (msg: string): never => {
  console.error(`✘ hug-ceiling: ${msg}`);
  process.exit(1);
};

const CAP = 320;
const TOKENS = {
  primitives: { size: { cap: { $value: `${CAP}px`, $type: 'dimension' } } },
  semantic: {},
  light: {},
  dark: {},
  brands: { default: {} },
};

const contractWith = (hugs: boolean): Contract =>
  ContractSchema.parse({
    id: 'ds.eval-hug',
    name: 'EvalHug',
    version: '0.1.0',
    status: 'draft',
    description: 'hug-ceiling fixture',
    semantics: { element: 'button' },
    props: [
      {
        name: 'children',
        type: 'text',
        default: 'Button',
        bindings: { figma: { kind: 'TEXT', property: 'Content' }, code: { prop: 'children' } },
      },
    ],
    states: [],
    anatomy: {
      root: {
        // The exact shape that produced the defect: a hugging box whose own
        // justify:space-between strands the label once the box is oversized.
        layout: { display: 'flex', justify: 'space-between' },
        content: { prop: 'children' },
        tokens: { 'max-width': '{size.cap}' },
        ...(hugs ? { hugsBelowMaxWidth: true } : {}),
      },
    },
    anchors: { figma: { fileKey: null, componentSetKey: null }, code: { importPath: 'x', export: 'EvalHug' } },
  }) as Contract;

const emit = (c: Contract): string =>
  emitFigmaScript(c, { tokens: TOKENS, icons: new Map(), contracts: new Map([[c.id, c]]) });

const specsOf = (script: string): Array<Record<string, any>> => {
  const m = /const COMPONENTS = (\[[\s\S]*?\n\]);/.exec(script);
  if (!m) return fail('emitted script has no COMPONENTS payload');
  const payload = JSON.parse(m[1]);
  return payload.flatMap((c: any) => (c.variants ?? [{ spec: c.spec }]).map((v: any) => v.spec)).filter(Boolean);
};

const buildWidths = async (script: string): Promise<number[]> => {
  const mock = createFigmaMock();
  const ctx = vm.createContext({ figma: mock.figma, console: { log() {}, warn() {}, error() {} } });
  // The fixture's one token, seeded the way a token sync would.
  const coll = mock.figma.variables.createVariableCollection('Eval');
  const v = mock.figma.variables.createVariable('size/cap', coll, 'FLOAT');
  v.setValueForMode(coll.modes[0].modeId, CAP);
  await vm.runInContext(`(async () => {\n${script}\n})()`, ctx, { timeout: 120_000 });
  const sets = mock.root.findAll((n: any) => n.type === 'COMPONENT');
  return sets.map((n: any) => Math.round(n.width * 100) / 100);
};

// ---- 1. NO EVIDENCE ⇒ the design-width lowering survives -------------------
const plain = specsOf(emit(contractWith(false)));
if (!plain.every((s) => s.fixedWidth?.px === CAP)) {
  fail(
    `a root with NO measured evidence must keep the design-width lowering (fixedWidth ${CAP}px) — ` +
      `got ${JSON.stringify(plain.map((s) => s.fixedWidth ?? s.bindings?.maxWidth))}. ` +
      `This is what every hand-authored {size.card.width} root in contracts/ depends on.`,
  );
}
if (plain.some((s) => s.bindings?.maxWidth)) fail('evidence-free root bound a maxWidth ceiling it was never measured to need');

// ---- 2. MEASURED EVIDENCE ⇒ a ceiling, and a narrower box ------------------
const hugged = specsOf(emit(contractWith(true)));
if (hugged.some((s) => s.fixedWidth)) {
  fail(`a root MEASURED hugging beneath its max-width still baked a fixedWidth — the 320-wide Button, exactly`);
}
if (!hugged.every((s) => s.bindings?.maxWidth === 'size/cap')) {
  fail(`a root MEASURED hugging must bind Figma's maxWidth field — got ${JSON.stringify(hugged.map((s) => s.bindings))}`);
}

const plainW = await buildWidths(emit(contractWith(false)));
const hugW = await buildWidths(emit(contractWith(true)));
if (!plainW.every((w) => Math.abs(w - CAP) < 0.01)) {
  fail(`without evidence the built cell must be the design width ${CAP} — got ${plainW.join(', ')}`);
}
if (!hugW.every((w) => w < CAP - 0.01)) {
  fail(`with the measured hug fact the built cell must be STRICTLY narrower than its ${CAP}px ceiling — got ${hugW.join(', ')}`);
}

// ---- 3. the flag is refused where it qualifies nothing ---------------------
{
  const stray = contractWith(true);
  delete (stray.anatomy.root as any).tokens;
  const errors: string[] = [];
  validateContract(stray, new Map([[stray.id, stray]]), errors, new Map());
  if (!errors.some((e) => e.includes('hugsBelowMaxWidth') && e.includes('no "max-width" channel'))) {
    fail(`hugsBelowMaxWidth on a part with no max-width channel must refuse BY NAME — got ${JSON.stringify(errors)}`);
  }
}

// ---- 4. the shipped corpus carries it -------------------------------------
{
  // The eval harness runs fixtures with cwd = evals/.scratch, and examples/ is
  // deliberately NOT copied there. The eval body passes the REAL repo path.
  const i = process.argv.indexOf('--carbon');
  const p = i > -1 ? process.argv[i + 1] : path.join(ROOT, 'examples/carbon/contracts/button.contract.json');
  if (!existsSync(p)) fail(`shipped Carbon Button contract missing at ${p}`);
  const carbon = JSON.parse(readFileSync(p, 'utf8'));
  if (carbon.anatomy?.root?.hugsBelowMaxWidth !== true) {
    fail(
      'the shipped Carbon Button root does NOT carry hugsBelowMaxWidth — the capture measured its used width ' +
        '(123.5px) strictly below its max-inline-size (320px), so the fact must be promoted; without it the ' +
        'canvas draws the 320px box the owner reported',
    );
  }
  if (!carbon.anatomy.root.tokens?.['max-width']) fail('shipped Carbon Button root lost its max-width channel');
}

console.log(
  `hug-ceiling ok: evidence-free root keeps the ${CAP}px design width (${plainW[0]}px built); ` +
    `MEASURED-hugging root binds the ceiling and builds ${hugW[0]}px; stray flag refused by name; ` +
    'shipped Carbon Button carries the measured fact',
);

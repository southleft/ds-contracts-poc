/**
 * THE FLEX `align-items` DEFAULT, ON BOTH SURFACES — `npm run stretch:check`.
 *
 * WHY THIS EXISTS. On 2026-07-03 (c6e909e) a HUMAN found this by looking at a
 * screenshot. chat-message's body was a column with `align` UNSET. CSS's
 * initial value for `align-items` is `stretch`, so the browser drew a bubble
 * spanning the body; Figma auto-layout's counter-axis default is the
 * equivalent of MIN, so the canvas drew the same bubble at its hug width —
 * 71px. A cross-surface divergence produced by NOTHING IN THE CONTRACT: the
 * two emitters simply disagreed about what silence means. The commit patched
 * the CONTRACT (it wrote `align: stretch` by hand into chat-message) and the
 * commit message says the quiet part out loud — "a cross-surface mismatch the
 * differ cannot see because anatomy internals are outside its scope".
 *
 * The MECHANISM was closed later, in core/emit-figma-script.ts `layoutSpec`:
 *
 *     stretchChildren: (l?.align === 'stretch' || (l !== undefined && l.align === undefined)) || undefined
 *
 * — an align-UNSET flex container now stretches on the canvas too, so the hand
 * edit to chat-message is no longer load-bearing. That one boolean expression
 * is the whole fix, and until this file existed NOTHING asserted it. Measured
 * on the corpus at the time of writing: 31 of 130 layout holders across 13
 * contracts leave `align` unset, 9 of them on a column — every one of those is
 * drawn by this default. A regression in it would be caught by evals/golden.json
 * only as "bytes moved in figma-sync/13-chatmessage.js", a message that names a
 * file rather than a rule and that `npm run golden:update` makes green again.
 *
 * THE INVARIANT, stated once:
 *
 *     ON A FLEX CONTAINER, `align` UNSET AND `align: 'stretch'` DESCRIBE THE
 *     SAME BOX ON EVERY SURFACE. `align: 'start'` DESCRIBES A DIFFERENT ONE.
 *
 * Canvas side: the two compile to a byte-identical variant spec (asserted as
 * whole-spec deep equality, not a field peek — a field peek would miss the
 * lowered `fillW` annotations that are what actually resize the child).
 * CSS side: the two differ by exactly one declaration, `align-items: stretch`,
 * whose value IS the CSS initial — so dropping it changes no computed style.
 *
 * OVER-APPLICATION IS ALSO REFUSED, by two cases that go red if someone
 * "strengthens" the default:
 *   · `align: 'start'` must NOT stretch — an explicit value is not silence.
 *   · a ROW with `align` unset stretches on the CROSS axis, which is VERTICAL;
 *     it must NOT lower horizontal FILL. (Round 6, MUI Tabs: three tabs each
 *     FILLed to the strip width and stacked on top of each other.)
 *
 * Everything runs through the REAL compile path — createFigmaEngine ->
 * buildComponentScript, then the emitted script's own `COMPONENTS` spec is
 * parsed back out. Reading the switch instead of running it is how this defect
 * class survives. Synthetic probe contracts plus the committed chat-message,
 * over the repo's own token and contract corpora; no browser, no capture data,
 * ~0.3s.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createFigmaEngine } from './emit-figma-script.js';
import { generateCss } from './emit-react.js';
import { emitHtml } from './emit-html.js';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';

const failures: string[] = [];
const bad = (m: string) => failures.push(m);
const ok = (m: string) => console.log(`  ✔ ${m}`);

// ---------------------------------------------------------------------------
// The probe contract: a row root holding one growing COLUMN body whose two
// text children are the nodes the counter-axis default resizes. This is
// chat-message's shape, reduced to the parts the rule touches.
// ---------------------------------------------------------------------------
type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
interface BodyLayout {
  display: 'flex';
  direction: 'row' | 'column';
  grow?: boolean;
  align?: Align;
}

const probe = (body: BodyLayout): Contract =>
  ContractSchema.parse({
    id: 'ds.stretchprobe',
    name: 'StretchProbe',
    version: '0.1.0',
    description: 'align-items default probe (core/stretch-default-check.ts)',
    semantics: { element: 'div' },
    props: [],
    anatomy: {
      root: {
        element: 'div',
        layout: { display: 'flex', direction: 'row', align: 'start' },
        parts: {
          // chat-message's avatar, reduced: an intrinsic-width sibling. The
          // fill lowering is gated on the parent's width being ESTABLISHED
          // (annotateFillW's readiness rule — a hug parent whose every child
          // fills collapses to ~3px in real Figma), so without a sibling that
          // contributes an intrinsic width NOTHING here would fill and this
          // probe would assert the readiness gate instead of the stretch rule.
          avatarStub: { element: 'span', text: '@' },
          body: {
            element: 'div',
            layout: body,
            parts: {
              lineA: { element: 'span', text: 'A' },
              lineB: { element: 'span', text: 'B' },
              // The July defect's ACTUAL subject: the bubble was a BOX (a div
              // with a background), and boxes are what the stretch default
              // must keep lowering to `fillW`. Text is asserted separately —
              // see case 1 and FC-TEXT-FILL-ALIGNMENT below.
              bubble: { element: 'div', parts: { inner: { element: 'span', text: 'B' } } },
            },
          },
        },
      },
    },
    anchors: {
      figma: { fileKey: null, componentSetKey: null },
      code: { importPath: './StretchProbe', export: 'StretchProbe' },
    },
  });

// ---------------------------------------------------------------------------
// The real canvas compile path — the repo's own token corpus and contract
// corpus, built exactly the way scripts/generate-figma.ts builds them. The
// probe binds no tokens; the corpus is here so case 6 can compile a REAL
// contract (chat-message resolves `size.banner.width` and friends, and its
// avatar/metadata slots refuse to compile without their referents in scope).
// ---------------------------------------------------------------------------
const ROOT = new URL('../', import.meta.url).pathname;
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));
const brandNames = readdirSync(path.join(ROOT, 'tokens', 'modes'))
  .filter((f) => /^brand\.[a-z][a-z0-9-]*\.tokens\.json$/.test(f))
  .map((f) => f.replace(/^brand\.|\.tokens\.json$/g, ''));
const engine = createFigmaEngine({
  tokens: {
    primitives: read('tokens/primitives.tokens.json'),
    semantic: read('tokens/semantic.tokens.json'),
    light: read('tokens/modes/semantic.light.tokens.json'),
    dark: read('tokens/modes/semantic.dark.tokens.json'),
    brands: Object.fromEntries(brandNames.map((n) => [n, read(`tokens/modes/brand.${n}.tokens.json`)])),
  },
  icons: new Map<string, string>(
    readdirSync(path.join(ROOT, 'assets', 'icons'))
      .filter((f) => f.endsWith('.svg'))
      .map((f) => [f.replace(/\.svg$/, ''), readFileSync(path.join(ROOT, 'assets', 'icons', f), 'utf8').trim()]),
  ),
});
const CORPUS = new Map<string, Contract>(
  readdirSync(path.join(ROOT, 'contracts'))
    .filter((f) => f.endsWith('.contract.json'))
    .map((f) => {
      const c = ContractSchema.parse(read(path.join('contracts', f)));
      return [c.id, c] as [string, Contract];
    }),
);

interface Spec {
  name: string;
  type: string;
  layout?: { mode: string; primary: string; counter: string; stretchChildren?: boolean };
  fillW?: boolean;
  children?: Spec[];
}

/** Compile through the shipped engine and read the spec the SCRIPT carries —
 *  not an internal call, the same `const COMPONENTS = [...]` the plugin runs. */
function canvasComponents(contract: Contract, scope?: Map<string, Contract>): { variants: { spec: Spec }[] }[] {
  const text = engine.buildComponentScript(
    contract,
    scope ?? new Map([[contract.id, contract]]),
    undefined,
    undefined,
  );
  const at = text.indexOf('const COMPONENTS = ');
  if (at < 0) throw new Error('emitted script has no COMPONENTS array');
  const start = text.indexOf('[', at);
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = start; j < text.length; j++) {
    const ch = text[j];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '[' || ch === '{') depth += 1;
    else if (ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(text.slice(start, j + 1)) as { variants: { spec: Spec }[] }[];
    }
  }
  throw new Error('unbalanced COMPONENTS array');
}

/** The probe's single variant — the 1/1 shape is asserted, because a probe that
 *  silently grew a variant axis would compare the wrong two things. */
function canvasSpec(contract: Contract): Spec {
  const comps = canvasComponents(contract);
  if (comps.length !== 1 || comps[0].variants.length !== 1) {
    throw new Error(
      `probe compiled to ${comps.length} component(s) / ${comps[0]?.variants.length} variant(s), expected 1/1`,
    );
  }
  return comps[0].variants[0].spec;
}

const find = (s: Spec, name: string): Spec | null => {
  if (s.name === name) return s;
  for (const k of s.children ?? []) {
    const r = find(k, name);
    if (r) return r;
  }
  return null;
};
const body = (c: Contract): Spec => {
  const b = find(canvasSpec(c), 'body');
  if (!b) throw new Error('probe spec has no "body" node');
  return b;
};

// ---------------------------------------------------------------------------
// The real CSS compile paths (BOTH of them — a rule stated in one emitter and
// not the other is not a rule; core/emit-html.ts is what the computed gate
// renders through, core/emit-react.ts is what ships to consumers).
// ---------------------------------------------------------------------------
const INV = { has: () => true, get: () => '0' } as never;
const ALIGN_RE = /^align-items\s*:/;
const pick = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim().replace(/;$/, ''))
    .filter((l) => ALIGN_RE.test(l));
const reactAligns = (c: Contract) => pick(String(generateCss(c as never, INV, [] as never)));
const htmlAligns = (c: Contract) => {
  const out = emitHtml(c as never, { contracts: new Map(), icons: {}, tokens: INV } as never) as unknown as Record<
    string,
    unknown
  >;
  // The showcase harness string carries its own align-items; only the
  // component's own rules are the subject here.
  return pick(
    Object.values(out)
      .filter((v): v is string => typeof v === 'string')
      .join('\n'),
  ).filter((l) => !l.includes('showcase'));
};

// ---------------------------------------------------------------------------
// CASES
// ---------------------------------------------------------------------------
const COL_UNSET: BodyLayout = { display: 'flex', direction: 'column', grow: true };
const COL_STRETCH: BodyLayout = { display: 'flex', direction: 'column', grow: true, align: 'stretch' };
const COL_START: BodyLayout = { display: 'flex', direction: 'column', grow: true, align: 'start' };
const ROW_UNSET: BodyLayout = { display: 'flex', direction: 'row', grow: true };

// 1. CANVAS — silence stretches. This is the July defect's mechanism.
//
// WHAT "LOWERS" CHANGED IN THE EXACT-CONVERSION WAVE (c924c9c,
// FC-TEXT-FILL-ALIGNMENT), AND WHY THIS CASE CHANGED WITH IT. The original
// assertion demanded `fillW` on the TEXT children too. The wave refined
// annotateFillW: non-truncating TEXT hugs whenever hugging is
// ALIGNMENT-SAFE — the box's horizontal packing agrees with the glyphs' own
// textAlignH (here: a MIN-packed column holding LEFT text), so hug and fill
// paint the glyphs at identical pixels on every surface. That hug is the fix
// for a MEASURED live defect (Carbon Tabs: FILL in a snug box truncates
// glyph overhang under font substitution), and text that hugging WOULD
// displace (MUI accordion title: LEFT text in a CENTER-packed row) still
// fills and carries `fillText` as the runtime's proof. The invariant this
// file states is untouched: silence ≡ `align: stretch` (cases 2 and 6 assert
// whole-spec equality), and the stretch still LOWERS onto every BOX child —
// the July bubble was a box, and a box that hugs here redraws it at 71px.
{
  const b = body(probe(COL_UNSET));
  if (b.layout?.stretchChildren !== true) {
    bad(
      `CANVAS: a column with \`align\` UNSET did not stretch — body.layout = ${JSON.stringify(b.layout)}. ` +
        `CSS's initial \`align-items\` IS \`stretch\`; a canvas that hugs here redraws chat-message's 71px bubble.`,
    );
  } else ok('canvas: column, align unset → stretchChildren true');
  const kids = b.children ?? [];
  const texts = kids.filter((k) => k.type === 'text');
  const boxes = kids.filter((k) => k.type !== 'text');
  const boxesNotFilled = boxes.filter((k) => k.fillW !== true).map((k) => k.name);
  if (kids.length !== 3 || boxes.length !== 1 || boxesNotFilled.length) {
    bad(
      `CANVAS: the stretch did not LOWER onto the BOX child — children ${JSON.stringify(kids.map((k) => `${k.name}:${k.type}:fillW=${k.fillW}`))}. ` +
        `\`stretchChildren\` that never reaches \`fillW\` on a box resizes nothing on the canvas — this is the July bubble collapse.`,
    );
  } else ok('canvas: column, align unset → box child lowered to fillW (the bubble class)');
  const textFilled = texts.filter((k) => k.fillW === true).map((k) => k.name);
  if (texts.length !== 2 || textFilled.length) {
    bad(
      `CANVAS: alignment-safe LEFT text in a MIN-packed column took FILL — ${JSON.stringify(texts.map((k) => `${k.name}:fillW=${k.fillW}`))}. ` +
        `FC-TEXT-FILL-ALIGNMENT: hug and fill paint these glyphs identically, and FILL here re-opens the Carbon Tabs truncation defect.`,
    );
  } else ok('canvas: column, align unset → alignment-safe text hugs (FC-TEXT-FILL-ALIGNMENT)');
}

// 2. CANVAS — silence and `stretch` are the SAME BOX. Whole-spec equality.
{
  const u = JSON.stringify(canvasSpec(probe(COL_UNSET)), null, 1);
  const s = JSON.stringify(canvasSpec(probe(COL_STRETCH)), null, 1);
  if (u !== s) {
    const uL = u.split('\n');
    const sL = s.split('\n');
    const diff = uL
      .map((l, i) => (l === sL[i] ? null : `    line ${i + 1}: unset ${l.trim()} | stretch ${(sL[i] ?? '<end>').trim()}`))
      .filter(Boolean)
      .slice(0, 6);
    bad(`CANVAS: \`align\` unset and \`align: stretch\` compiled to DIFFERENT specs:\n${diff.join('\n')}`);
  } else ok('canvas: align unset ≡ align stretch (whole variant spec identical)');
}

// 3. CANVAS — an explicit value is not silence (the over-application guard).
{
  const b = body(probe(COL_START));
  if (b.layout?.stretchChildren !== undefined) {
    bad(
      `CANVAS: \`align: start\` produced stretchChildren=${b.layout?.stretchChildren} — an explicit align is a ` +
        `stated fact, and stretching it overrides the designer.`,
    );
  } else if (b.layout?.counter !== 'MIN') {
    bad(`CANVAS: \`align: start\` produced counter ${b.layout?.counter}, expected MIN`);
  } else if ((b.children ?? []).some((k) => k.fillW === true)) {
    bad(`CANVAS: \`align: start\` still lowered fillW onto ${(b.children ?? []).filter((k) => k.fillW).map((k) => k.name).join(', ')}`);
  } else ok('canvas: column, align start → counter MIN, no stretch, no fillW');
}

// 4. CANVAS — the cross axis of a ROW is VERTICAL, so no horizontal FILL.
{
  const b = body(probe(ROW_UNSET));
  const filled = (b.children ?? []).filter((k) => k.fillW === true).map((k) => k.name);
  if (filled.length) {
    bad(
      `CANVAS: a ROW with \`align\` unset lowered HORIZONTAL fill onto ${filled.join(', ')} — ` +
        `align-items is a CROSS-axis fact and a row's cross axis is vertical. This is the MUI Tabs failure: ` +
        `every tab as wide as the strip, stacked on top of each other.`,
    );
  } else ok('canvas: row, align unset → no horizontal fillW (cross axis is vertical)');
}

// 5. CSS — silence and `stretch` differ by exactly the initial value.
{
  for (const [emitter, run] of [
    ['emit-html', htmlAligns],
    ['emit-react', reactAligns],
  ] as [string, (c: Contract) => string[]][]) {
    const u = run(probe(COL_UNSET));
    const s = run(probe(COL_STRETCH));
    const st = run(probe(COL_START));
    const removed = s.filter((d, i) => u[i] !== d);
    if (u.length + 1 !== s.length || !s.includes('align-items: stretch')) {
      bad(`CSS/${emitter}: expected \`align: stretch\` to add exactly one \`align-items: stretch\`; unset=${JSON.stringify(u)} stretch=${JSON.stringify(s)}`);
    } else if (removed.some((d) => d !== 'align-items: stretch')) {
      bad(`CSS/${emitter}: the only declaration between unset and stretch must be the CSS initial, got ${JSON.stringify(removed)}`);
    } else ok(`CSS/${emitter}: align unset ≡ align stretch (differ only by the initial \`align-items: stretch\`)`);

    if (!st.includes('align-items: flex-start')) {
      bad(`CSS/${emitter}: \`align: start\` did not emit \`align-items: flex-start\` — got ${JSON.stringify(st)}`);
    } else ok(`CSS/${emitter}: align start → align-items: flex-start (not the initial)`);
  }
}

// 6. THE NAMED REGRESSION — chat-message itself, immune to what its committed
//    `align` currently says: the contract with `align` DELETED and the contract
//    with `align: stretch` must compile to the same canvas. If this is red, the
//    hand edit in c6e909e is load-bearing again.
{
  const raw = read('contracts/chat-message.contract.json');
  const variant = (mut: (c: Record<string, never>) => void): string => {
    const c = JSON.parse(JSON.stringify(raw));
    mut(c);
    const parsed = ContractSchema.parse(c);
    return JSON.stringify(canvasComponents(parsed, new Map(CORPUS).set(parsed.id, parsed)));
  };
  const deleted = variant((c) => {
    delete (c as never as { anatomy: { root: { parts: { body: { layout: { align?: string } } } } } }).anatomy.root.parts
      .body.layout.align;
  });
  const stretched = variant((c) => {
    (c as never as { anatomy: { root: { parts: { body: { layout: { align?: string } } } } } }).anatomy.root.parts.body.layout.align =
      'stretch';
  });
  if (deleted !== stretched) {
    bad(
      'CHAT-MESSAGE: deleting `align` from anatomy.root.parts.body.layout changes the canvas. That hand edit ' +
        '(c6e909e) is load-bearing again and the July bubble collapse is one contract edit away.',
    );
  } else ok('chat-message: body with `align` deleted ≡ body with `align: stretch` on the canvas');
}

// ---------------------------------------------------------------------------
if (failures.length) {
  console.error(`\n✖ ${failures.length} align-items default defect(s):`);
  for (const f of failures) console.error(`    ${f}`);
  process.exit(1);
}
console.log(
  `\n✔ silence and \`align: stretch\` describe the same box on canvas, emit-html and emit-react; ` +
    `an explicit align and a row's cross axis are both left alone.`,
);

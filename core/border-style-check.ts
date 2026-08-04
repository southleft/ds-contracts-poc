/**
 * THE BORDER STYLE KEYWORD, ON BOTH CSS SURFACES — `npm run border-style:check`.
 *
 * WHY THIS EXISTS. `border-style` is not carried by the Figma direction: a
 * Figma stroke has no style axis, so the emitters SYNTHESISE the keyword from a
 * border WIDTH. Gap-closing round 9 established the rule that synthesis obeys,
 * from a measured failure:
 *
 *   A REFUSED CHANNEL WHOSE CSS SIBLING IS STILL EMITTED MUST EITHER WITHHOLD
 *   BOTH OR CARRY BOTH. A half-declaration is not a partial truth — the user
 *   agent completes it into a whole falsehood.
 *
 * The test used to read `border-width OR border-color`, so a contract carrying
 * only a COLOUR emitted `border-style: solid` with no width and CSS finished
 * the claim with the UA's `medium` = 3px. UUI's ButtonGroupBase rendered 5-6px
 * too wide across all 32 variants, scoring 80.15 against a 98.91 ceiling. The
 * keyword now rides the WIDTH alone.
 *
 * WHAT THIS GATE ADDS (round 12). Round 9 fixed core/emit-react.ts and LEFT
 * core/emit-html.ts reading `border-width OR border-color` — so the two CSS
 * emitters disagreed for four months, and core/emit-html.ts is the one the
 * computed gate renders through (scorecard.method: "enriched contract ->
 * core/emit-html"). The instrument kept scoring a surface the shipped emitter
 * no longer produced. Every case below runs through BOTH emitters and they must
 * agree; that cross-check is the point of the file, because a rule stated in
 * one emitter and not the other is not a rule.
 *
 * WHAT THIS GATE DELIBERATELY DOES NOT ASSERT. It does not require a keyword
 * for a per-side longhand width. That looks like the obvious next step and it
 * is WRONG, measured: `getComputedStyle` reports `border-*-width` on every
 * element whether or not a border is drawn, and in the CSS direction
 * `border-style: none` with a non-zero width is ordinary authoring. altitude
 * Chip and altitude Button both carry all four `border-*-width` and are
 * observed at `border-*-style: none, border-*-width: 0px` — synthesising for
 * them drew borders neither library has (Chip 94.309 -> 89.431, Button
 * 81.484 -> 78.984 on an offline regate). The Figma-direction premise "a
 * border-width means draw a border" does not transfer. See task #24: the real
 * fix is to CARRY the observed `border-*-style`, which the capture already
 * reads, not to synthesise from a width whose value the emitter cannot see.
 *
 * Pure functions over synthetic contracts. No browser, no capture data, ~0.3s.
 */
import { generateCss } from './emit-react.js';
import { emitHtml } from './emit-html.js';

const failures: string[] = [];
const bad = (m: string) => failures.push(m);
const ok = (m: string) => console.log(`  ✔ ${m}`);

const INV = { has: () => true, get: () => '0' } as never;
const contractWith = (rootTokens: Record<string, string>, partTokens?: Record<string, string>) => ({
  $schema: '', id: 'ds.probe', name: 'Probe', version: '0.1.0',
  semantics: { element: 'button', role: 'button' },
  props: [], states: [], tokens: {},
  anatomy: {
    root: {
      tokens: rootTokens,
      ...(partTokens ? { parts: { label: { element: 'span', tokens: partTokens } } } : {}),
    },
  },
});

const STYLE_RE = /^border(-(top|right|bottom|left))?-style\s*:/;
const pick = (text: string) => text.split('\n').map((l) => l.trim()).filter((l) => STYLE_RE.test(l)).sort();

const reactStyles = (c: unknown) => pick(String(generateCss(c as never, INV, [] as never)));
const htmlStyles = (c: unknown) => {
  const out = emitHtml(c as never, { contracts: new Map(), icons: {}, tokens: INV } as never) as unknown as Record<string, unknown>;
  return pick(Object.values(out).filter((v): v is string => typeof v === 'string').join('\n'));
};

/** Every case runs through BOTH emitters and asserts the same expectation on
 *  each, plus that they agree with one another. */
const both = (label: string, c: unknown, expect: string[]) => {
  let r: string[];
  let h: string[];
  try { r = reactStyles(c); } catch (e) { bad(`emit-react threw on "${label}": ${(e as Error).message.slice(0, 140)}`); return; }
  try { h = htmlStyles(c); } catch (e) { bad(`emit-html threw on "${label}": ${(e as Error).message.slice(0, 140)}`); return; }
  const want = expect.slice().sort();
  if (JSON.stringify(r) !== JSON.stringify(want)) bad(`emit-react on "${label}": expected ${JSON.stringify(want)}, got ${JSON.stringify(r)}`);
  if (JSON.stringify(h) !== JSON.stringify(want)) bad(`emit-html on "${label}": expected ${JSON.stringify(want)}, got ${JSON.stringify(h)}. This is the emitter the COMPUTED GATE renders through, so a wrong answer here is scored as if it were the product.`);
  if (JSON.stringify(r) !== JSON.stringify(h)) bad(`THE TWO CSS EMITTERS DISAGREE on "${label}" — emit-react ${JSON.stringify(r)} vs emit-html ${JSON.stringify(h)}. A rule stated in one emitter and not the other is not a rule; this exact drift (round 9 fixed emit-react only) is why this gate exists.`);
  if (!failures.length || (JSON.stringify(r) === JSON.stringify(want) && JSON.stringify(h) === JSON.stringify(want))) ok(`${label} → ${r.length ? r.join(' ') : '(no keyword)'}  [both emitters]`);
};

console.log('\n1. THE KEYWORD RIDES A WIDTH, NEVER A COLOUR (round 9 — UUI ButtonGroupBase, 80.15 vs 98.91)');
both('four border-*-color longhands, NO width', contractWith({
  'border-top-color': '{a}', 'border-right-color': '{a}', 'border-bottom-color': '{a}', 'border-left-color': '{a}',
}), []);
both('border-color SHORTHAND, no width', contractWith({ 'border-color': '{a}' }), []);
both('nested part: border-*-color, no width', contractWith({}, { 'border-top-color': '{a}', 'border-left-color': '{a}' }), []);

console.log('\n2. A WIDTH EARNS IT');
both('border-width shorthand', contractWith({ 'border-width': '{w}' }), ['border-style: solid;']);
both('nested part: border-width shorthand', contractWith({}, { 'border-width': '{w}' }), ['border-style: solid;']);

console.log('\n3. A DECLARED STYLE RIDES ALONG — and it is a DECLARED fact, never a token');
{
  // `border-style` is not in TOKEN_CHANNELS: both emitters REFUSE it as a
  // token binding (`"border-style" is not a token channel`) and carry it only
  // through `declared`. That refusal is itself worth pinning — it is the reason
  // a captured `border-*-style: none` cannot simply be minted, which is the
  // shape task #24 has to solve.
  const asToken = contractWith({ 'border-width': '{w}', 'border-style': 'dashed' });
  // emitHtml is the surface that runs validateContract; generateCss is the raw
  // CSS builder and does not referee, so the refusal is asserted where it lives.
  let refused = false;
  try { htmlStyles(asToken); } catch (e) { refused = /not a token channel/.test((e as Error).message); }
  if (!refused) bad('`border-style` as a TOKEN binding was accepted — it is not in TOKEN_CHANNELS and both emitters are expected to refuse it by name');
  else ok('border-style as a token → refused by name (it is a declared fact, not a token)');

  const declared = {
    ...contractWith({ 'border-width': '{w}' }),
    anatomy: { root: { tokens: { 'border-width': '{w}' }, declared: { 'border-style': 'dashed' } } },
  };
  both('declared border-style alongside a width', declared, ['border-style: solid;', 'border-style: dashed;']);
}

if (failures.length > 0) {
  console.error(`\n✘ border-style synthesis: ${failures.length} failure(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\n✔ border-style synthesis: the keyword rides a WIDTH and never a colour, and core/emit-react.ts and core/emit-html.ts give the same answer on every case.');

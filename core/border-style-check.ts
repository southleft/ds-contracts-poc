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
 * WHAT THIS GATE ADDS (FC-BORDER-STYLE-NOT-SYNTHESISED, 2026-08-08). The
 * shorthand test above is the ONLY spelling round 9 taught the emitters, and a
 * contract can carry its width three other ways. polaris TextField's backdrop
 * carries its whole border as PER-VARIANT LONGHAND LITERALS
 * (`border-top-width: 1px` under `.text-field--variant-inherit`) with no
 * shorthand anywhere — so no keyword was emitted, and CSS painted NO BORDER AT
 * ALL while the canvas stroked correctly. carbon Checkbox's ✓ glyph (a
 * 0/0/1px/1px white corner) and carbon Tag `type=outline` were invisible for
 * the same reason. The rule now covers per-prop maps and per-side widths, and
 * lives in ONE function — `borderStyleDecls` in the schema package — which all
 * THREE CSS surfaces call.
 *
 * WHERE THE NEW RULE STOPS, AND WHY — THE ALTITUDE SCAR. A per-side LONGHAND
 * width earns the keyword only when it is a LITERAL. A TOKEN longhand earns
 * NOTHING, and that refusal is asserted below, because the naive version of
 * this extension was measured and it lost: `getComputedStyle` reports
 * `border-*-width` on every element whether or not a border is drawn, and in
 * the CSS direction `border-style: none` with a non-zero width is ordinary
 * authoring. altitude Chip and altitude Button both carry all four
 * `border-*-width` as TOKEN refs and are observed at `border-*-style: none` —
 * synthesising for them drew borders neither library has (Chip 94.309 ->
 * 89.431, Button 81.484 -> 78.984 on an offline regate). This file's own
 * conclusion named the boundary and the new rule sits exactly on it: do not
 * "synthesise from a width whose value the emitter cannot see". `tokenInventory`
 * is a Set of PATHS, so a token width's value is invisible to the emitter and a
 * drawn 1px is indistinguishable from an extractor's inert readout. A LITERAL
 * is precisely the width whose value it CAN see. Carrying the observed
 * `border-*-style` for the token case remains task #24.
 *
 * THREE SURFACES, NOT TWO. core/emit-react-inline.ts is the third CSS-emitting
 * surface and was never in this gate — which is the same hole that let round 9
 * ship to one emitter and not the other for four months. Every case below now
 * runs through all three.
 *
 * Pure functions over synthetic contracts. No browser, no capture data, ~0.5s.
 */
import { generateCss } from './emit-react.js';
import { emitHtml } from './emit-html.js';
import { emitReactInline } from './emit-react-inline.js';

const failures: string[] = [];
const bad = (m: string) => failures.push(m);
const ok = (m: string) => console.log(`  ✔ ${m}`);

const INV = { has: () => true, get: () => '0' } as never;
/** A probe contract. `rootTokens`/`partTokens` are the round-9 shape; the rest
 *  reach the scopes FC-BORDER-STYLE-NOT-SYNTHESISED added — literals, per-side
 *  longhands, and the per-enum-value maps. A `variant` enum prop is declared
 *  whenever a per-prop map needs one (validateContract refuses a map driven by
 *  an undeclared prop, which would mask the case as a throw). */
const probe = (o: {
  rootTokens?: Record<string, string>;
  rootLiterals?: Record<string, string>;
  rootDeclared?: Record<string, string>;
  rootTokensByProp?: Record<string, Record<string, string>>;
  rootLiteralsByProp?: Record<string, Record<string, string>>;
  partTokens?: Record<string, string>;
  partLiterals?: Record<string, string>;
  partDeclared?: Record<string, string>;
  partTokensByProp?: Record<string, Record<string, string>>;
  partLiteralsByProp?: Record<string, Record<string, string>>;
}) => {
  const values = new Set<string>();
  for (const m of [o.rootTokensByProp, o.rootLiteralsByProp, o.partTokensByProp, o.partLiteralsByProp]) {
    for (const k of Object.keys(m ?? {})) values.add(k);
  }
  const byProp = (m?: Record<string, Record<string, string>>) =>
    m ? [{ prop: 'variant', map: m }] : undefined;
  const part =
    o.partTokens || o.partLiterals || o.partDeclared || o.partTokensByProp || o.partLiteralsByProp
      ? {
          label: {
            element: 'span',
            ...(o.partTokens ? { tokens: o.partTokens } : {}),
            ...(o.partLiterals ? { literals: o.partLiterals } : {}),
            ...(o.partDeclared ? { declared: o.partDeclared } : {}),
            ...(o.partTokensByProp ? { tokensByProp: byProp(o.partTokensByProp) } : {}),
            ...(o.partLiteralsByProp ? { literalsByProp: byProp(o.partLiteralsByProp) } : {}),
          },
        }
      : undefined;
  return {
    $schema: '', id: 'ds.probe', name: 'Probe', version: '0.1.0',
    semantics: { element: 'button', role: 'button' },
    props: values.size
      ? [{
          name: 'variant',
          type: { enum: [...values] },
          default: [...values][0],
          bindings: {
            figma: { kind: 'VARIANT', property: 'Variant', values: Object.fromEntries([...values].map((v) => [v, v])) },
            code: { prop: 'variant' },
          },
        }]
      : [],
    states: [], tokens: {},
    anatomy: {
      root: {
        tokens: o.rootTokens ?? {},
        ...(o.rootLiterals ? { literals: o.rootLiterals } : {}),
        ...(o.rootDeclared ? { declared: o.rootDeclared } : {}),
        ...(o.rootTokensByProp ? { tokensByProp: byProp(o.rootTokensByProp) } : {}),
        ...(o.rootLiteralsByProp ? { literalsByProp: byProp(o.rootLiteralsByProp) } : {}),
        ...(part ? { parts: part } : {}),
      },
    },
  };
};
/** The round-9 signature, kept verbatim so those cases read unchanged. */
const contractWith = (rootTokens: Record<string, string>, partTokens?: Record<string, string>) =>
  probe({ rootTokens, ...(partTokens ? { partTokens } : {}) });

const STYLE_RE = /^border(-(top|right|bottom|left))?-style\s*:/;
const pick = (text: string) => text.split('\n').map((l) => l.trim()).filter((l) => STYLE_RE.test(l)).sort();

const reactStyles = (c: unknown) => pick(String(generateCss(c as never, INV, [] as never)));
const htmlStyles = (c: unknown) => {
  const out = emitHtml(c as never, { contracts: new Map(), icons: {}, tokens: INV } as never) as unknown as Record<string, unknown>;
  return pick(Object.values(out).filter((v): v is string => typeof v === 'string').join('\n'));
};
/** The inline surface writes a JSX style OBJECT (`borderTopStyle: 'solid'`), so
 *  its answers are normalised back to the CSS spelling the other two emit. */
const INLINE_RE = /"?\bborder(Top|Right|Bottom|Left)?Style"?:\s*["']([^"']+)["']/g;
/** The inline surface RESOLVES token refs to literals, so it needs a real DTCG
 *  tree — the two refs every probe uses, and nothing else. */
const INLINE_TOKENS = {
  primitives: {
    a: { $type: 'color', $value: '#000000' },
    w: { $type: 'dimension', $value: '1px' },
  },
  semantic: {}, light: {}, dark: {}, brands: { default: {} },
};
const inlineStyles = (c: unknown) => {
  const { tsx } = emitReactInline(c as never, { contracts: new Map(), icons: new Map(), tokens: INLINE_TOKENS } as never);
  const out: string[] = [];
  for (const m of tsx.matchAll(INLINE_RE)) {
    out.push(`border${m[1] ? '-' + m[1].toLowerCase() : ''}-style: ${m[2]};`);
  }
  return out.sort();
};

/** Every case runs through BOTH emitters and asserts the same expectation on
 *  each, plus that they agree with one another. */
/** @param expect       the DECLARATIONS the two stylesheet surfaces write, in
 *                       sorted order. They must agree with each other exactly.
 *  @param expectInline  what core/emit-react-inline.ts writes, when that
 *                       legitimately differs. A stylesheet can carry a channel
 *                       TWICE and let the cascade pick the winner; an inline
 *                       style OBJECT has one slot per property, so a
 *                       synthesised `solid` followed by a declared `dashed`
 *                       collapses to `dashed` — the same RESOLVED answer, one
 *                       declaration instead of two. Defaults to `expect`, so a
 *                       surface that silently drops the keyword still fails. */
const both = (label: string, c: unknown, expect: string[], expectInline?: string[]) => {
  let r: string[];
  let h: string[];
  let i: string[];
  try { r = reactStyles(c); } catch (e) { bad(`emit-react threw on "${label}": ${(e as Error).message.slice(0, 140)}`); return; }
  try { h = htmlStyles(c); } catch (e) { bad(`emit-html threw on "${label}": ${(e as Error).message.slice(0, 140)}`); return; }
  try { i = inlineStyles(c); } catch (e) { bad(`emit-react-inline threw on "${label}": ${(e as Error).message.slice(0, 140)}`); return; }
  const want = expect.slice().sort();
  const j = JSON.stringify;
  if (j(r) !== j(want)) bad(`emit-react on "${label}": expected ${j(want)}, got ${j(r)}`);
  if (j(h) !== j(want)) bad(`emit-html on "${label}": expected ${j(want)}, got ${j(h)}. This is the emitter the COMPUTED GATE renders through, so a wrong answer here is scored as if it were the product.`);
  const wantInline = (expectInline ?? expect).slice().sort();
  if (j(i) !== j(wantInline)) bad(`emit-react-inline on "${label}": expected ${j(wantInline)}, got ${j(i)}. This surface ships the JSON-only bundles, so a border missing here is missing from every embedded preview.`);
  if (j(r) !== j(h)) bad(`THE TWO STYLESHEET EMITTERS DISAGREE on "${label}" — emit-react ${j(r)} vs emit-html ${j(h)}. A rule stated in one emitter and not the other is not a rule; this exact drift (round 9 fixed emit-react only) is why this gate exists.`);
  if (j(r) === j(want) && j(h) === j(want) && j(i) === j(wantInline)) ok(`${label} → ${r.length ? r.join(' ') : '(no keyword)'}  [all three surfaces]`);
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
  both('declared border-style alongside a width', declared, ['border-style: solid;', 'border-style: dashed;'], ['border-style: dashed;']);
}

const W4 = (v: string) => ({
  'border-top-width': v, 'border-right-width': v, 'border-bottom-width': v, 'border-left-width': v,
});
const S4 = ['border-top-style: solid;', 'border-right-style: solid;', 'border-bottom-style: solid;', 'border-left-style: solid;'];

console.log('\n4. A PER-SIDE LITERAL WIDTH EARNS THE PER-SIDE KEYWORD (FC-BORDER-STYLE-NOT-SYNTHESISED)');
both('root: four literal longhand widths', probe({ rootLiterals: W4('1px') }), S4);
both('nested part: four literal longhand widths', probe({ partLiterals: W4('1px') }), S4);
both(
  'nested part: TWO literal longhand widths (carbon Checkbox ✓ glyph — 0/0/1px/1px)',
  probe({ partLiterals: { 'border-top-width': '0px', 'border-right-width': '0px', 'border-bottom-width': '1px', 'border-left-width': '1px' } }),
  ['border-bottom-style: solid;', 'border-left-style: solid;'],
);
both('ZERO literal widths earn nothing — zero width paints nothing either way', probe({ partLiterals: W4('0px') }), []);
both('a literal COLOUR still earns nothing (round 9 holds at the new scope)', probe({
  partLiterals: { 'border-top-color': 'red', 'border-left-color': 'red' },
}), []);

console.log('\n5. A DECLARED PER-SIDE STYLE IS AN OBSERVED FACT — THE GUESS YIELDS TO IT');
both(
  'declared border-top-style: none suppresses the synthesis for THAT SIDE only',
  probe({ partLiterals: W4('1px'), partDeclared: { 'border-top-style': 'none' } }),
  ['border-top-style: none;', 'border-right-style: solid;', 'border-bottom-style: solid;', 'border-left-style: solid;'],
);
both(
  'declared border-*-style: solid on all four sides (polaris Checkbox) keeps EXACTLY the bytes it had',
  probe({ partLiterals: W4('1px'), partDeclared: {
    'border-top-style': 'solid', 'border-right-style': 'solid', 'border-bottom-style': 'solid', 'border-left-style': 'solid',
  } }),
  S4,
);

console.log('\n6. THE PER-ENUM-VALUE MAPS REACH THE SAME RULE (polaris TextField backdrop)');
both(
  'root literalsByProp: per-variant longhand widths',
  probe({ rootLiteralsByProp: { inherit: W4('1px'), borderless: W4('0px') } }),
  S4,
);
both(
  'nested part literalsByProp: per-variant longhand widths — THE POLARIS TEXTFIELD SHAPE',
  probe({ partLiteralsByProp: { inherit: W4('1px'), borderless: W4('0px') } }),
  S4,
);
both(
  'root tokensByProp: per-variant SHORTHAND width',
  probe({ rootTokensByProp: { outlined: { 'border-width': '{w}' }, plain: { 'border-color': '{a}' } } }),
  ['border-style: solid;'],
);
both(
  'nested part tokensByProp: per-variant SHORTHAND width',
  probe({ partTokensByProp: { outlined: { 'border-width': '{w}' }, plain: { 'border-color': '{a}' } } }),
  ['border-style: solid;'],
);

console.log('\n7. A PER-SIDE *TOKEN* WIDTH EARNS NOTHING — THE ALTITUDE SCAR, PINNED');
// altitude Chip/Button carry all four border-*-width as TOKEN refs and are
// observed at border-*-style: none. `tokenInventory` is a Set of PATHS, so the
// emitter cannot see the value and cannot tell a drawn 1px from an inert
// readout. Synthesising here was measured: Chip 94.309 -> 89.431, Button
// 81.484 -> 78.984. If this case ever goes GREEN with keywords, that regression
// has been reintroduced.
both('root: four TOKEN longhand widths (altitude Button/Chip)', probe({
  rootTokens: { ...Object.fromEntries(Object.keys(W4('')).map((k) => [k, '{w}'])) },
}), []);
both('nested part: four TOKEN longhand widths', probe({
  partTokens: { ...Object.fromEntries(Object.keys(W4('')).map((k) => [k, '{w}'])) },
}), []);
both('root tokensByProp: per-variant TOKEN longhand widths', probe({
  rootTokensByProp: { tertiary: Object.fromEntries(Object.keys(W4('')).map((k) => [k, '{w}'])) },
}), []);

if (failures.length > 0) {
  console.error(`\n✘ border-style synthesis: ${failures.length} failure(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  '\n✔ border-style synthesis: the keyword rides a WIDTH and never a colour; a per-side LITERAL width earns the per-side keyword and a per-side TOKEN width earns nothing; and core/emit-react.ts, core/emit-html.ts and core/emit-react-inline.ts give the same answer on every case.',
);

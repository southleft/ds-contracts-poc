/**
 * THE COLOUR PARSER'S FALSIFICATION — `npm run extract:computed:color:check`.
 *
 * WHAT BROKE. A falsifiable experiment ran flowbite-react's Modal through the
 * default capture recipe. The scrim came back:
 *
 *   { part:'part-0', channel:'background-color',
 *     ours:'rgba(0, 0, 0, 0)',
 *     theirs:'oklab(0.210081 -0.00294439 -0.0316202 / 0.5)' }
 *   namedLoss: code-only: part-0.background-color — value shape outside
 *              mintable kinds (color/px/number/shadow/gradient)
 *
 * The overlay was DROPPED ENTIRELY. Cause: Tailwind v4 compiles every
 * ALPHA-MODIFIED colour utility (`bg-gray-900/50`) to `color-mix(in oklab, …)`
 * and Chromium computes that to the CARTESIAN spelling `oklab()`. The parser
 * accepted only the polar spelling `oklch()`, so a real painted fact became a
 * named refusal.
 *
 * WHY THIS FILE IS NOT A TAUTOLOGY. Checking our converter against our
 * converter proves nothing. Everything below is pinned against a SECOND,
 * INDEPENDENT implementation written here from Björn Ottosson's published
 * FORWARD constants (the two matrices M1: linear-sRGB→LMS and M2: LMS'→OKLab,
 * reproduced in CSS Color 4 §10.1). The reverse direction is obtained by
 * INVERTING those matrices numerically in this file — so not one coefficient
 * from core/token-set.ts appears here, and the fused inverse matrix the engine
 * uses is never assumed correct. Agreement between two implementations that
 * share no constants is real evidence; agreement with ourselves is not.
 *
 * WHAT IT REFUSES TO LET PASS:
 *   1. conversion drift, BOTH WAYS — 4,096 sRGB triples make the round trip
 *      hex → (reference) oklab → (engine) hex and must come back IDENTICAL;
 *   2. alpha loss — `/ 0.5` and `/ 50%` must survive as rgba alpha. A scrim
 *      minted OPAQUE is a WORSE wrong answer than a named refusal, so an
 *      alpha that silently became 1 fails here;
 *   3. GUESSING — an unknown colour function (lab/lch/color()/color-mix/hwb)
 *      must still return null and make kindOf() refuse BY NAME. Silently
 *      becoming black is the failure this whole file exists to prevent;
 *   4. the refusal path going dead — kindOf() returning null is the precondition
 *      of the `value shape outside mintable kinds` receipt (extract/computed/
 *      fuse.ts:1362-1363 → :1410), and genuinely unparseable values must still
 *      reach it.
 *
 * FALSIFICATION: revert the oklab arm of core/token-set.ts and §3, §5, §6 and
 * §7 below fail immediately (the scrim goes back to `null` → refused).
 */
import { kindOf } from './lib.js';
import { okColorToRgba, oklabToRgba, oklchToRgba } from '../../core/token-set.js';

const failures: string[] = [];
const check = (label: string, cond: boolean, detail = '') => {
  if (!cond) failures.push(label + (detail ? ` — ${detail}` : ''));
  console.log(`  ${cond ? '✔' : '✖'} ${label}${cond || !detail ? '' : ` — ${detail}`}`);
};

// ---------------------------------------------------------------------------
// THE INDEPENDENT IMPLEMENTATION (Ottosson / CSS Color 4 §10.1 forward
// constants only; the reverse is a numeric matrix inversion done here)
// ---------------------------------------------------------------------------
type M3 = [number, number, number, number, number, number, number, number, number];

/** linear sRGB → LMS (M1, forward, as published). */
const M1: M3 = [
  0.4122214708, 0.5363325363, 0.0514459929,
  0.2119034982, 0.6806995451, 0.1073969566,
  0.0883024619, 0.2817188376, 0.6299787005,
];
/** LMS' (cube-rooted LMS) → OKLab (M2, forward, as published). */
const M2: M3 = [
  0.2104542553, 0.7936177850, -0.0040720468,
  1.9779984951, -2.4285922050, 0.4505937099,
  0.0259040371, 0.7827717662, -0.8086757660,
];

const apply = (m: M3, v: [number, number, number]): [number, number, number] => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

/** Cofactor inverse of a 3×3 — so the reverse direction borrows NOTHING from
 *  the engine's precomputed inverse matrices. */
function invert(m: M3): M3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) throw new Error('singular matrix — the published constants were mistyped');
  return [
    (e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det,
    (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det,
    (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det,
  ];
}
const M1inv = invert(M1);
const M2inv = invert(M2);

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => {
  const x = Math.min(1, Math.max(0, c));
  return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
};
const cbrt = (x: number) => Math.cbrt(x);

/** reference: sRGB 0–255 → OKLab (L, a, b). */
function refToOklab(r: number, g: number, b: number): [number, number, number] {
  const lms = apply(M1, [toLinear(r / 255), toLinear(g / 255), toLinear(b / 255)]);
  return apply(M2, [cbrt(lms[0]), cbrt(lms[1]), cbrt(lms[2])]);
}
/** reference: OKLab (L, a, b) → sRGB 0–255, via the INVERTED published matrices. */
function refFromOklab(L: number, a: number, b: number): [number, number, number] {
  const lmsP = apply(M2inv, [L, a, b]);
  const lin = apply(M1inv, [lmsP[0] ** 3, lmsP[1] ** 3, lmsP[2] ** 3]);
  return [Math.round(toGamma(lin[0]) * 255), Math.round(toGamma(lin[1]) * 255), Math.round(toGamma(lin[2]) * 255)];
}

const hex2 = (x: number) => x.toString(16).padStart(2, '0');
const hexOf = (r: number, g: number, b: number) => `${hex2(r)}${hex2(g)}${hex2(b)}`;

console.log('\nCOLOUR PARSER — oklab/oklch against an independent implementation\n');

// ---------------------------------------------------------------------------
// §1 BOTH WAYS: 4,096 sRGB triples round-trip hex → reference oklab → engine
// ---------------------------------------------------------------------------
{
  let worst = 0, worstCase = '', n = 0;
  for (let r = 0; r < 256; r += 17) for (let g = 0; g < 256; g += 17) for (let bl = 0; bl < 256; bl += 17) {
    const [L, A, B] = refToOklab(r, g, bl);
    const parsed = oklabToRgba(`oklab(${L} ${A} ${B})`);
    n++;
    if (!parsed) { worst = 999; worstCase = `oklab(${L} ${A} ${B}) → null`; continue; }
    const d = Math.max(Math.abs(parsed.r - r), Math.abs(parsed.g - g), Math.abs(parsed.b - bl));
    if (d > worst) { worst = d; worstCase = `#${hexOf(r, g, bl)} → oklab(${L} ${A} ${B}) → #${hexOf(parsed.r, parsed.g, parsed.b)}`; }
  }
  check(`§1 ${n} sRGB triples round-trip through the reference OKLab forward transform with ZERO channel drift`, worst === 0, `max channel delta ${worst}${worst ? ` (${worstCase})` : ''}`);
}

// ---------------------------------------------------------------------------
// §2 REVERSE, INDEPENDENTLY: engine oklab() vs the inverted published matrices
// ---------------------------------------------------------------------------
{
  const cases: Array<[number, number, number]> = [
    [0.210081, -0.00294439, -0.0316202], // the Flowbite scrim's colour
    [0.62796, 0.22486, 0.12585],          // sRGB red
    [1, 0, 0], [0, 0, 0], [0.5, 0, 0],
    [0.86644, -0.23389, 0.1795],          // sRGB green
    [0.45201, -0.03246, -0.31153],        // sRGB blue
    [0.7, 0.12, -0.09], [0.3, -0.08, 0.11], [0.95, 0.02, 0.02],
    [1.2, 0.4, 0.4],                      // deliberately OUT OF GAMUT (must clamp, not wrap)
  ];
  let worst = 0, worstCase = '';
  for (const [L, a, b] of cases) {
    const ours = oklabToRgba(`oklab(${L} ${a} ${b})`);
    const ref = refFromOklab(L, a, b);
    if (!ours) { worst = 999; worstCase = `oklab(${L} ${a} ${b}) → null (the parser REFUSED a value it must accept)`; continue; }
    const d = Math.max(Math.abs(ours.r - ref[0]), Math.abs(ours.g - ref[1]), Math.abs(ours.b - ref[2]));
    if (d > worst) { worst = d; worstCase = `oklab(${L} ${a} ${b}) ours=#${hexOf(ours.r, ours.g, ours.b)} ref=#${hexOf(...ref)}`; }
  }
  check(`§2 ${cases.length} oklab() literals (incl. one out-of-gamut) match the inverted published matrices exactly`, worst === 0, `max channel delta ${worst}${worst ? ` (${worstCase})` : ''}`);
}

// ---------------------------------------------------------------------------
// §3 THE SCRIM — the exact value the Flowbite run refused, end to end
// ---------------------------------------------------------------------------
{
  const SCRIM = 'oklab(0.210081 -0.00294439 -0.0316202 / 0.5)';
  const parsed = okColorToRgba(SCRIM);
  check('§3 the Flowbite scrim value parses at all (it returned null before this round)', parsed !== null);
  if (parsed) {
    const ref = refFromOklab(0.210081, -0.00294439, -0.0316202);
    check('§3 the scrim converts to the reference implementation\'s sRGB', `${parsed.r},${parsed.g},${parsed.b}` === ref.join(','), `ours ${parsed.r},${parsed.g},${parsed.b} vs ref ${ref.join(',')}`);
    check('§3 the scrim is NOT black — a dropped-then-guessed colour is the failure mode this round exists to remove', !(parsed.r === 0 && parsed.g === 0 && parsed.b === 0));
    check('§3 the scrim keeps its HALF alpha (opaque would repaint the whole dialog)', parsed.a === 0.5, `alpha=${parsed.a}`);
  }
  const k = kindOf('background-color', SCRIM);
  check('§3 kindOf() now MINTS the scrim as a colour (it returned null → `value shape outside mintable kinds`)', k !== null && k.kind === 'color', JSON.stringify(k));
  check('§3 the minted value is 8-digit hex ending in the alpha byte 80 (=0.5), not a 6-digit opaque hex', typeof k?.value === 'string' && (k.value as string).length === 8 && (k.value as string).endsWith('80'), String(k?.value));
}

// ---------------------------------------------------------------------------
// §4 KNOWN VALUES, published — independent of BOTH implementations
// ---------------------------------------------------------------------------
{
  // sRGB white/black are the fixed points of the space; sRGB red's OKLab and
  // OKLCh coordinates are the values Ottosson publishes for #ff0000.
  const pins: Array<[string, string]> = [
    ['oklab(1 0 0)', 'ffffff'],
    ['oklab(0 0 0)', '000000'],
    ['oklab(0.62796 0.22486 0.12585)', 'ff0000'],
    ['oklch(0.62796 0.25768 29.234)', 'ff0000'],
    ['oklch(1 0 0)', 'ffffff'],
    ['oklch(0% 0 0)', '000000'],
  ];
  for (const [v, want] of pins) {
    const p = okColorToRgba(v);
    check(`§4 ${v} → #${want}`, p !== null && hexOf(p.r, p.g, p.b) === want, p ? `#${hexOf(p.r, p.g, p.b)}` : 'null');
  }
  // polar and cartesian spellings of the SAME colour must land on the same pixel.
  const polar = okColorToRgba('oklch(0.62796 0.25768 29.234)');
  const cart = okColorToRgba('oklab(0.62796 0.22486 0.12585)');
  check('§4 oklch and oklab spellings of one colour agree (the shared step is genuinely shared)',
    polar !== null && cart !== null && hexOf(polar.r, polar.g, polar.b) === hexOf(cart.r, cart.g, cart.b),
    `${polar ? hexOf(polar.r, polar.g, polar.b) : 'null'} vs ${cart ? hexOf(cart.r, cart.g, cart.b) : 'null'}`);
}

// ---------------------------------------------------------------------------
// §5 ALPHA SURVIVES — in both spellings, decimal and percent
// ---------------------------------------------------------------------------
{
  const alphaPins: Array<[string, number, string]> = [
    ['oklab(0.5 0.1 0.1 / 0.5)', 0.5, '80'],
    ['oklab(0.5 0.1 0.1 / 50%)', 0.5, '80'],
    ['oklab(0.5 0.1 0.1 / 0)', 0, '00'],
    ['oklab(0.5 0.1 0.1)', 1, ''],
    ['oklch(0.5 0.1 30 / 0.24)', 0.24, '3d'],
    ['oklch(0.5 0.1 30 / 24%)', 0.24, '3d'],
  ];
  for (const [v, wantA, wantByte] of alphaPins) {
    const p = okColorToRgba(v);
    check(`§5 ${v} keeps alpha ${wantA}`, p !== null && Math.abs(p.a - wantA) < 1e-9, p ? String(p.a) : 'null');
    const k = kindOf('background-color', v);
    const val = String(k?.value ?? '');
    check(`§5 ${v} mints as ${wantByte ? `8-digit hex …${wantByte}` : '6-digit opaque hex'}`, wantByte ? val.length === 8 && val.endsWith(wantByte) : val.length === 6, val);
  }
}

// ---------------------------------------------------------------------------
// §6 NO GUESSING — unknown colour functions still REFUSE BY NAME
// ---------------------------------------------------------------------------
{
  // Every one of these is a REAL spelling a browser can serialize. None is
  // supported today. Each must return null so fuse.ts records
  // `value shape outside mintable kinds` — NOT a plausible wrong colour.
  const unknown = [
    'color(srgb 0.0310458 0.0589869 0.0714052 / 0.24)', // MEASURED: astryx/switch captured-truth
    'lab(52.2% 40.1 59.9)',
    'lch(52.2% 72.2 56.2)',
    'color-mix(in oklab, #101828 50%, transparent)',
    'hwb(194 0% 0%)',
    'oklab(0.5 0.1)',              // too few components
    'oklab(0.5 0.1 0.1 0.2)',      // alpha without the slash
    'oklab(0.5, 0.1, 0.1)',        // comma syntax is not CSS Color 4 for oklab
    'oklab(none 0.1 0.1)',         // `none` components — unsupported, must not become 0
    'oklabish(0.5 0.1 0.1)',
    'var(--scrim)',
    'not-a-colour',
    '',
  ];
  for (const v of unknown) {
    const p = okColorToRgba(v);
    check(`§6 REFUSES ${JSON.stringify(v)} (returns null rather than guessing)`, p === null, JSON.stringify(p));
  }
  // …and specifically: none of them silently becomes black.
  const blackened = unknown.filter((v) => { const p = okColorToRgba(v); return p !== null && p.r === 0 && p.g === 0 && p.b === 0; });
  check('§6 not one unknown spelling silently becomes black', blackened.length === 0, blackened.join(', '));
}

// ---------------------------------------------------------------------------
// §7 THE REFUSAL PATH IS STILL ALIVE
// ---------------------------------------------------------------------------
{
  // kindOf() === null is the precondition of the named refusal: fuse.ts:1362
  // takes `const k = kindOf(channel, v)`, :1363 routes !k to `unk`, and :1410
  // writes `value shape outside mintable kinds (color/px/number/shadow/
  // gradient) …`. If widening the colour parser had made kindOf answer for
  // everything, that receipt would go dead and losses would stop being named.
  const stillUnmintable: Array<[string, string]> = [
    ['background-color', 'color(srgb 0.03 0.06 0.07 / 0.24)'],
    ['background-color', 'lab(52.2% 40.1 59.9)'],
    ['background-color', 'currentcolor'],
    ['align-items', 'center'],
    ['grid-template-columns', 'repeat(2, minmax(0, 1fr))'],
    ['width', '50%'],
    ['font-family', 'Inter, sans-serif'],
    ['anchor-name', '--astryx-layer-_r_13_'],
  ];
  for (const [prop, v] of stillUnmintable) {
    check(`§7 kindOf(${prop}, ${JSON.stringify(v)}) still returns null → the named refusal still fires`, kindOf(prop, v) === null, JSON.stringify(kindOf(prop, v)));
  }
  // and the kinds that DID mint before still do (no collateral).
  const stillMintable: Array<[string, string, string]> = [
    ['background-color', 'rgba(16, 24, 40, 0.5)', 'color'],
    ['background-color', 'oklch(0.21 0.034 264.665)', 'color'],
    ['padding-top', '12px', 'px'],
    ['opacity', '0.5', 'number'],
    ['box-shadow', 'none', 'shadow'],
    ['background-image', 'linear-gradient(to right, #fff, #000)', 'gradient'],
  ];
  for (const [prop, v, kind] of stillMintable) {
    check(`§7 kindOf(${prop}, ${JSON.stringify(v)}) still mints as ${kind}`, kindOf(prop, v)?.kind === kind, JSON.stringify(kindOf(prop, v)));
  }
}

// ---------------------------------------------------------------------------
// §8 THE oklch ARM DID NOT MOVE — the refactor factored the shared step out;
//    these are the committed corpora's own values, pinned to the reference.
// ---------------------------------------------------------------------------
{
  // Every value below appears verbatim in a committed capture artifact under
  // extract/computed/out/tailwind/**. The expectation is the INDEPENDENT
  // implementation's answer, not the engine's previous output.
  const committed = ['oklch(0.21 0.034 264.665)', 'oklch(0.928 0.006 264.531)', 'oklch(0.623 0.214 259.815)', 'oklch(0.985 0.002 247.839)', 'oklch(0.446 0.03 256.802)'];
  let bad = '';
  for (const v of committed) {
    const m = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(v)!;
    const [L, C, H] = [Number(m[1]), Number(m[2]), (Number(m[3]) * Math.PI) / 180];
    const ref = refFromOklab(L, C * Math.cos(H), C * Math.sin(H));
    const ours = oklchToRgba(v);
    if (!ours) { bad += ` ${v}(REFUSED)`; continue; }
    if (hexOf(ours.r, ours.g, ours.b) !== hexOf(...ref)) bad += ` ${v}(ours #${hexOf(ours.r, ours.g, ours.b)} ref #${hexOf(...ref)})`;
  }
  check(`§8 ${committed.length} oklch values taken from committed Tailwind captures still convert to the reference answer`, bad === '', bad);
}

console.log('');
if (failures.length > 0) {
  console.error(`✖ colour-parse check FAILED — ${failures.length} assertion(s):`);
  for (const f of failures) console.error(`   - ${f}`);
  process.exit(1);
}
console.log('✔ colour-parse check: every assertion green.\n');

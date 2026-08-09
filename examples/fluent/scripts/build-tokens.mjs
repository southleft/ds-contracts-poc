/**
 * Fluent 2 token wrap — `node examples/fluent/scripts/build-tokens.mjs`
 *
 * Source: `@fluentui/tokens@1.0.0-alpha.23` in the round's sandbox. The package
 * exports the theme as a plain JS object whose KEYS ARE THE CSS CUSTOM-PROPERTY
 * NAMES VERBATIM (`colorNeutralForeground1` is emitted as `--colorNeutralForeground1`
 * by FluentProvider), so there is nothing to parse and nothing to guess — this is
 * the cleanest wrap in the corpus (RECON §4.3).
 *
 * WHY THE JS PACKAGE AND NOT A STYLESHEET (the inverse of the Carbon call):
 * Carbon's JS package spells `layer01` where the components reference
 * `--cds-layer-01`, so the compiled CSS was the only non-guessing source. Fluent
 * has NO such skew: `makeStyles` writes `var(--colorNeutralForeground1)` at the
 * point of use and `FluentProvider` writes `--colorNeutralForeground1: …` on its
 * own element, both straight off these keys. There is also no shipped stylesheet
 * to parse — Griffel injects at runtime (RECON §2.6).
 *
 * THE ONE TRANSFORM (RECON §2.4). The CSS-vars reader turns a captured var name
 * into a DTCG leaf path at `extract/computed/run.ts:563`:
 *     groupPrefix + varName.slice(vp.length).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
 * `leafOf` below is that expression COPIED, not re-derived from the prose, and it
 * is fed the same `--`-prefixed string the reader is fed. If the names drifted
 * apart the reader would look up leaves this file never wrote and every alias
 * would silently degrade to a literal — so the wrap and the reader must share
 * one line of code, not one paragraph of intent.
 *     --colorNeutralForeground1      -> color-neutral-foreground1
 *     --colorNeutralForeground1Hover -> color-neutral-foreground1-hover
 *     --fontSizeBase300              -> font-size-base300   (trailing digit CARRIED)
 *     --spacingHorizontalM           -> spacing-horizontal-m
 *     --shadow4Brand                 -> shadow4-brand
 * The transform never emits a `.`, so the tree is FLAT — every leaf at the file's
 * top level, no `tokenGroup` (§4.1). Zero collisions across all 459, re-asserted.
 *
 * WHAT IS RE-ASSERTED, CARBON-STYLE (refuse on drift, never shrink silently):
 *   · webLightTheme 459 keys · webDarkTheme 459 keys · IDENTICAL key set
 *   · 315 keys whose light and dark values differ (the mode pair is real)
 *   · value types 455 string + 4 number (`fontWeight*`) — the wrap must not
 *     assume strings; `typed()` branches on `typeof` FIRST
 *   · the nine name families (color 366 · spacing 22 · font 17 · shadow 12 ·
 *     border 11 · line-height 10 · curve 9 · duration 8 · stroke 4 = 459)
 *   · zero leaf collisions
 *   · the $type split this wrap itself produces (a receipt: a Fluent bump that
 *     changes a value's SHAPE moves these before it moves anything visible)
 * Every one of these is a RECON §4.3 measurement. A Fluent bump that moves any
 * of them REFUSES here rather than quietly re-pinning the round's arithmetic.
 *
 * Value policy (deterministic, precedent = carbon/shadcn/mui):
 *   typeof number                → number      (the 4 fontWeight* keys)
 *   #hex / rgb() / rgba()        → color, verbatim
 *   `transparent`                → color, verbatim (core/mint-code.ts:237 treats
 *                                  it as a colour literal; calling it a string
 *                                  would hide 10 real colour tokens)
 *   px/rem/em                    → dimension
 *   unitless `0`                 → dimension (the 3 *None length tokens, pinned
 *                                  BY NAME below — a unitless zero is legal CSS
 *                                  only as a LENGTH, so typing it `number` would
 *                                  file a zero padding next to a font weight)
 *   ms/s                         → duration
 *   cubic-bezier(...)            → cubicBezier
 *   key `fontFamily*`            → fontFamily  (mui precedent)
 *   key `shadow*`                → shadow      (mui precedent; the value is a
 *                                  box-shadow list, not a colour)
 *   anything else                → string (named; there are none today, and the
 *                                  count is asserted so a new shape shows up)
 *
 * Emits:
 *   tokens/fluent.dtcg.json             base = webLightTheme (the capture-time
 *                                       tree; capture stays single-mode light)
 *   tokens/fluent.vars.css              the same 459 as one flat `:root` block
 *   tokens/modes/fluent.light.dtcg.json COMPLETE inventory (Carbon mode-gap lesson)
 *   tokens/modes/fluent.dark.dtcg.json  COMPLETE inventory, webDarkTheme values
 *
 * ON THE SPELLING IN fluent.vars.css — deliberate, and NOT Fluent's own:
 * the file carries the DTCG leaf spelling (`--color-neutral-foreground1`), not
 * the theme's camelCase custom property (`--colorNeutralForeground1`), because
 * its consumer is the gate page (`extract/computed/gate.ts`, `tokens.css`), which
 * renders THIS repo's emitted CSS — and the emitters write `var(--<dtcg-path>)`
 * (`core/emit-react.ts:68`). A camelCase file here would resolve nothing.
 * Fluent's own camelCase properties are what Griffel references INSIDE a live
 * FluentProvider; that is what the bind probe (RECON §6 step 2) tests against the
 * sandbox, not against this file. Each leaf's originating custom property is
 * recorded in `$extensions` so the mapping is checkable without re-running.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.join(HERE, '..');
const REPO = path.join(EX, '..', '..');

const REFUSE = (msg) => {
  throw new Error(`fluent wrap REFUSED: ${msg}`);
};

// ---------------------------------------------------------------------------
// SOURCE. The package has no "type": "module", so its `lib/index.js` (ESM
// syntax) is only importable where Node's syntax detection is on. `lib-commonjs`
// is CJS by construction and is what the package's own `exports.require`/`node`
// conditions point at — createRequire against it is the version-independent
// door and keeps this script bare-`node` runnable (no tsx, unlike shadcn's).
// ---------------------------------------------------------------------------
const PKG = path.join(EX, '.fluent-sandbox', 'node_modules', '@fluentui', 'tokens');
if (!existsSync(PKG)) REFUSE(`@fluentui/tokens is not installed at ${path.relative(REPO, PKG)} — recreate the sandbox (RECON §1)`);
const require_ = createRequire(import.meta.url);
const PKG_VERSION = JSON.parse(readFileSync(path.join(PKG, 'package.json'), 'utf8')).version;
const PINNED_VERSION = '1.0.0-alpha.23';
if (PKG_VERSION !== PINNED_VERSION) {
  REFUSE(`@fluentui/tokens is ${PKG_VERSION}, the round pinned ${PINNED_VERSION} — every count below was measured against the pin (RECON §4.3); re-measure before re-pinning`);
}
const entry = path.join(PKG, 'lib-commonjs', 'index.js');
if (!existsSync(entry)) REFUSE(`${path.relative(REPO, entry)} missing — the package layout moved; check its exports field before guessing`);
const { webLightTheme, webDarkTheme } = require_(entry);
if (!webLightTheme || !webDarkTheme) REFUSE('the package no longer exports webLightTheme/webDarkTheme');

// ---------------------------------------------------------------------------
// PINNED MEASUREMENTS (RECON §4.3) — assert, do not compute-then-believe.
// ---------------------------------------------------------------------------
const EXPECT_KEYS = 459;
const EXPECT_DIFFERING = 315;
const EXPECT_VALUE_TYPES = { string: 455, number: 4 };
const EXPECT_FAMILIES = { color: 366, spacing: 22, font: 17, shadow: 12, border: 11, 'line-height': 10, curve: 9, duration: 8, stroke: 4 };
// The $type split this wrap produces. Not a RECON number — a receipt of THIS
// file's value policy, pinned so a shape change (a colour becoming oklch, a
// duration becoming unitless) refuses instead of re-typing itself in silence.
// (measured: 366+57+12+9+8+4+3 = 459, and the dimensions reconcile against the
// families — border 11 + spacing 22 + stroke 4 + line-height 10 + fontSize 10.)
const EXPECT_TYPES = { color: 366, dimension: 57, shadow: 12, cubicBezier: 9, duration: 8, number: 4, fontFamily: 3, string: 0 };
// The only unitless-zero lengths, pinned BY NAME (see the value policy above).
const ZERO_LENGTHS = new Set(['borderRadiusNone', 'spacingHorizontalNone', 'spacingVerticalNone']);

const lightKeys = Object.keys(webLightTheme);
const darkKeys = Object.keys(webDarkTheme);
if (lightKeys.length !== EXPECT_KEYS) REFUSE(`webLightTheme has ${lightKeys.length} keys, the pinned recon says ${EXPECT_KEYS}`);
if (darkKeys.length !== EXPECT_KEYS) REFUSE(`webDarkTheme has ${darkKeys.length} keys, the pinned recon says ${EXPECT_KEYS}`);
// IDENTICAL key SET (not merely equal size, and never assuming equal ORDER —
// the two objects are built by different factories and do not enumerate alike).
const onlyLight = lightKeys.filter((k) => !(k in webDarkTheme));
const onlyDark = darkKeys.filter((k) => !(k in webLightTheme));
if (onlyLight.length || onlyDark.length) {
  REFUSE(
    `the light/dark key sets diverge — light-only: [${onlyLight.join(', ')}] dark-only: [${onlyDark.join(', ')}]. ` +
      'A ragged mode pair silently falls back to the light value per missing name (the Carbon mode-gap lesson)',
  );
}
const differing = lightKeys.filter((k) => String(webLightTheme[k]) !== String(webDarkTheme[k]));
if (differing.length !== EXPECT_DIFFERING) {
  REFUSE(`${differing.length} keys differ between light and dark, the pinned recon says ${EXPECT_DIFFERING} — the mode pair changed shape`);
}

const valueTypes = {};
for (const k of lightKeys) valueTypes[typeof webLightTheme[k]] = (valueTypes[typeof webLightTheme[k]] ?? 0) + 1;
for (const [t, n] of Object.entries(EXPECT_VALUE_TYPES)) {
  if ((valueTypes[t] ?? 0) !== n) REFUSE(`webLightTheme has ${valueTypes[t] ?? 0} ${t} values, the pinned recon says ${n}`);
}
const unexpectedValueType = Object.keys(valueTypes).find((t) => !(t in EXPECT_VALUE_TYPES));
if (unexpectedValueType) REFUSE(`webLightTheme carries a ${unexpectedValueType} value, which the wrap has no policy for`);

// ---------------------------------------------------------------------------
// THE ONE TRANSFORM — copied from extract/computed/run.ts:563 (the CSS-vars
// reader's `tokenName`). Fed the SAME `--`-prefixed string the reader is fed.
// ---------------------------------------------------------------------------
const VAR_PREFIX = '--'; // cfg.library.varPrefix for fluent — no vendor prefix (RECON §2.4)
const TOKEN_GROUP = ''; // cfg.library.tokenGroup — absent, so the tree is FLAT (RECON §4.1)
const leafOf = (varName) => TOKEN_GROUP + varName.slice(VAR_PREFIX.length).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

// If the reviewed capture config has landed, its varPrefix/tokenGroup ARE the
// reader's inputs — a disagreement here is the exact silent-degradation this
// whole comment block exists to prevent, so read it rather than assume it.
const CFG = path.join(REPO, 'extract', 'computed', 'configs', 'fluent.json');
if (existsSync(CFG)) {
  const lib = (JSON.parse(readFileSync(CFG, 'utf8')).library ?? {});
  if ((lib.varPrefix ?? '') !== VAR_PREFIX) REFUSE(`configs/fluent.json declares varPrefix ${JSON.stringify(lib.varPrefix)}, this wrap builds names with ${JSON.stringify(VAR_PREFIX)} — the reader would look up leaves this file never wrote`);
  if ((lib.tokenGroup ?? '') !== TOKEN_GROUP.replace(/\.$/, '')) REFUSE(`configs/fluent.json declares tokenGroup ${JSON.stringify(lib.tokenGroup)}, this wrap emits a FLAT tree — the reader would look up leaves this file never wrote`);
}

// Collisions: two theme keys mapping to one leaf would make the later one
// overwrite the earlier with NO error anywhere downstream.
const byLeaf = new Map();
const collisions = [];
for (const k of lightKeys) {
  const leaf = leafOf(VAR_PREFIX + k);
  if (byLeaf.has(leaf)) collisions.push(`${byLeaf.get(leaf)} + ${k} -> ${leaf}`);
  else byLeaf.set(leaf, k);
  if (leaf.includes('.')) REFUSE(`${k} maps to "${leaf}", which contains a "." — that is a NESTED path and this tree is flat`);
}
if (collisions.length) REFUSE(`${collisions.length} leaf collision(s) — the recon measured zero: ${collisions.join('; ')}`);

// Families: the leading lowercase run of the camelCase key (RECON §4.3's table).
const familyOf = (key) => {
  const head = /^[a-z]+/.exec(key)?.[0];
  if (!head) REFUSE(`theme key ${JSON.stringify(key)} does not begin with a lowercase run — the family split cannot be derived`);
  // `line*` is `lineHeight*` in full; assert rather than rename by hand.
  if (head === 'line') {
    if (!key.startsWith('lineHeight')) REFUSE(`${key} is in the "line" family but is not a lineHeight token`);
    return 'line-height';
  }
  return head;
};
const families = {};
for (const k of lightKeys) families[familyOf(k)] = (families[familyOf(k)] ?? 0) + 1;
for (const [f, n] of Object.entries(EXPECT_FAMILIES)) {
  if ((families[f] ?? 0) !== n) REFUSE(`family "${f}" has ${families[f] ?? 0} tokens, the pinned recon says ${n}`);
}
const strayFamily = Object.keys(families).find((f) => !(f in EXPECT_FAMILIES));
if (strayFamily) REFUSE(`unpinned token family "${strayFamily}" (${families[strayFamily]} tokens) — RECON §4.3 measured exactly nine`);

// ---------------------------------------------------------------------------
// VALUE POLICY.
// ---------------------------------------------------------------------------
const isColor = (v) => /^#[0-9a-fA-F]{3,8}$/.test(v) || /^rgba?\(/.test(v) || v === 'transparent';
const isDim = (v) => /^-?[\d.]+(px|rem|em)$/.test(v);
const isDuration = (v) => /^-?[\d.]+m?s$/.test(v);
const isBezier = (v) => /^cubic-bezier\(/.test(v);

function typeOfToken(key, value) {
  if (typeof value === 'number') return 'number'; // the 4 fontWeight* keys — branch on typeof FIRST
  if (key.startsWith('fontFamily')) return 'fontFamily';
  if (key.startsWith('shadow')) return 'shadow';
  if (isColor(value)) return 'color';
  if (isDim(value)) return 'dimension';
  if (ZERO_LENGTHS.has(key)) {
    if (value !== '0') REFUSE(`${key} is pinned as a unitless-zero length but its value is ${JSON.stringify(value)}`);
    return 'dimension';
  }
  if (isDuration(value)) return 'duration';
  if (isBezier(value)) return 'cubicBezier';
  return 'string';
}

/** One DTCG leaf. `extra` carries the originating custom property (base tree only). */
const typed = (key, value, counts, extra) => {
  const $type = typeOfToken(key, value);
  counts[$type] = (counts[$type] ?? 0) + 1;
  return { $type, $value: String(value), ...(extra ? { $extensions: { 'dev.ds-contracts.source': extra } } : {}) };
};

/** codepoint sort — locale-independent, so the bytes do not move with ICU. */
const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function wrap(theme, { withSource }) {
  const counts = {};
  const out = {};
  for (const key of [...lightKeys].sort((a, b) => byName(leafOf(VAR_PREFIX + a), leafOf(VAR_PREFIX + b)))) {
    out[leafOf(VAR_PREFIX + key)] = typed(key, theme[key], counts, withSource ? { var: VAR_PREFIX + key } : undefined);
  }
  return { out, counts };
}

// base = LIGHT (the capture harness's pinned scheme; the modes are a bundle-time
// pair, never a second capture — docs/22 §3).
const base = wrap(webLightTheme, { withSource: true });
const light = wrap(webLightTheme, { withSource: false });
const dark = wrap(webDarkTheme, { withSource: false });

for (const [t, n] of Object.entries(EXPECT_TYPES)) {
  if ((base.counts[t] ?? 0) !== n) {
    REFUSE(`$type "${t}" came out ${base.counts[t] ?? 0}, this wrap's pinned split says ${n} — a value's SHAPE changed; re-read the value policy before re-pinning`);
  }
}
const strayType = Object.keys(base.counts).find((t) => !(t in EXPECT_TYPES));
if (strayType) REFUSE(`unpinned $type "${strayType}" (${base.counts[strayType]} tokens)`);
if (Object.keys(base.out).length !== EXPECT_KEYS) REFUSE(`the wrapped tree has ${Object.keys(base.out).length} leaves, expected ${EXPECT_KEYS}`);

// ---------------------------------------------------------------------------
// EMIT.
// ---------------------------------------------------------------------------
mkdirSync(path.join(EX, 'tokens', 'modes'), { recursive: true });
writeFileSync(path.join(EX, 'tokens', 'fluent.dtcg.json'), JSON.stringify(base.out, null, 2) + '\n');
writeFileSync(path.join(EX, 'tokens', 'modes', 'fluent.light.dtcg.json'), JSON.stringify(light.out, null, 2) + '\n');
writeFileSync(path.join(EX, 'tokens', 'modes', 'fluent.dark.dtcg.json'), JSON.stringify(dark.out, null, 2) + '\n');
const flat = Object.keys(base.out).sort(byName).map((k) => `  --${k}: ${base.out[k].$value};`);
writeFileSync(path.join(EX, 'tokens', 'fluent.vars.css'), `:root {\n${flat.join('\n')}\n}\n`);

const split = Object.entries(base.counts).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${n} ${t}`).join(', ');
console.log(`✔ ${EXPECT_KEYS} Fluent tokens wrapped from @fluentui/tokens@${PKG_VERSION} webLightTheme (${split}) → examples/fluent/tokens/`);
console.log(`  families: ${Object.entries(EXPECT_FAMILIES).map(([f, n]) => `${f} ${n}`).join(' · ')}`);
console.log(`  modes: light=${Object.keys(light.out).length} dark=${Object.keys(dark.out).length} · ${differing.length} of ${EXPECT_KEYS} values differ · key sets identical · 0 leaf collisions`);
console.log(`  spot: color-neutral-foreground1=${base.out['color-neutral-foreground1'].$value} (dark ${dark.out['color-neutral-foreground1'].$value}) · font-size-base300=${base.out['font-size-base300'].$value} · spacing-horizontal-m=${base.out['spacing-horizontal-m'].$value} · font-weight-semibold=${base.out['font-weight-semibold'].$value} · shadow4-brand=${base.out['shadow4-brand'].$value}`);

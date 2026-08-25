/**
 * antd token wrap — `node examples/antd/scripts/build-tokens.mjs` (P2 exam, 2026-08-23; drafted in the recon, RECON.md §2.5)
 *
 * Builds the DTCG wrap + flat vars css from antd's OWN default theme via
 * `theme.getDesignToken()` (light) and the darkAlgorithm (dark), naming every
 * leaf exactly as @ant-design/cssinjs names the custom property in cssVar mode
 * (`token2CSSVar(key, 'ant')` → `--ant-color-primary` → leaf `color-primary`).
 * Component tokens come from each exam component's `prepareComponentToken`,
 * prefixed the way antd's genStyleHooks prefixes them (`--ant-button-*`).
 * VERIFIED (RECON §2.5): 371 global names generated, 350 declared live on `.antd`,
 * 0 live-not-generated; the 21 extra are antd's own cssVar IGNORE list and are
 * skipped below so every leaf is a real custom property.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.join(HERE, '..');
const req = createRequire(path.join(EX, '.antd-sandbox', 'package.json'));
const { theme } = req('antd');
const { token2CSSVar } = req('@ant-design/cssinjs');

// antd's OWN cssVar serialisation tables (antd/lib/theme/useToken.js): `ignore` keys are never emitted,
// `unitless` keys stay bare numbers, every other number gets `px` — exactly what cssinjs writes on `.antd`.
const { ignore: IGNORE_MAP, unitless: UNITLESS_MAP } = req('antd/lib/theme/useToken.js');
const IGNORE = new Set(Object.keys(IGNORE_MAP));
// Per-component unitless keys are declared INSIDE each component's genStyleHooks call (not exported);
// this list is MEASURED from the live `.antd.ant-<comp>` rules (RECON §2.5) and the wrap refuses on drift below.
const COMPONENT_UNITLESS = { button: ['fontWeight', 'contentLineHeight', 'contentLineHeightSM', 'contentLineHeightLG'], radio: ['radioSize', 'dotSize'], tooltip: ['zIndexPopup'] };
const isUnitless = (k, comp) => Boolean(UNITLESS_MAP[k]) || Boolean(comp && COMPONENT_UNITLESS[comp]?.includes(k));
const isScreen = (k) => /^screen(XS|SM|MD|LG|XL|XXL)(Min|Max)?$/.test(k);

const light = theme.getDesignToken();
const dark = theme.getDesignToken({ algorithm: theme.darkAlgorithm });

// exam set: component → style module exporting prepareComponentToken
const COMPONENTS = {
  button: 'antd/lib/button/style/token.js', tag: 'antd/lib/tag/style/index.js', badge: 'antd/lib/badge/style/index.js',
  switch: 'antd/lib/switch/style/index.js', checkbox: 'antd/lib/checkbox/style/index.js', radio: 'antd/lib/radio/style/index.js',
  input: 'antd/lib/input/style/token.js', alert: 'antd/lib/alert/style/index.js', avatar: 'antd/lib/avatar/style/index.js',
  progress: 'antd/lib/progress/style/index.js', card: 'antd/lib/card/style/index.js', tooltip: 'antd/lib/tooltip/style/index.js',
};

const typeOf = (v) => (/^-?\d+(\.\d+)?$/.test(String(v)) ? 'number' : /^(#|rgb|hsl)/.test(String(v)) ? 'color' : /^-?\d+(\.\d+)?px$/.test(String(v)) ? 'dimension' : 'string');
const base = {}, modeLight = {}, modeDark = {}, cssLines = [];
const serialize = (k, v, comp) => (typeof v === 'number' && !isUnitless(k, comp) ? `${v}px` : String(v));
const put = (name, lv, dv) => {
  if (name in base) return; // antd carries legacy alias keys (blue1 AND blue-1 → the same --ant-blue-1); first spelling wins, measured 130 collisions
  const l = String(lv), d = String(dv ?? lv);
  base[name] = { $type: typeOf(lv), $value: l };
  if (l !== d) { modeLight[name] = { $value: l }; modeDark[name] = { $value: d }; }
  cssLines.push(`  --${name}: ${l};`);
};
for (const k of Object.keys(light)) {
  if (IGNORE.has(k) || isScreen(k)) continue;
  if (typeof light[k] === 'object' || typeof light[k] === 'function' || typeof light[k] === 'boolean') continue; // motion/wireframe are booleans, never declared
  put(token2CSSVar(k, 'ant').slice('--ant-'.length), serialize(k, light[k]), serialize(k, dark[k]));
}
const globalCount = cssLines.length;
for (const [comp, mod] of Object.entries(COMPONENTS)) {
  const m = req(mod);
  // Input spells its component tokens as `initComponentToken` (shared with InputNumber/Mentions); Checkbox declares none (measured: no .antd.ant-checkbox var rule live)
  const prep = m.prepareComponentToken ?? m.initComponentToken;
  if (typeof prep !== 'function') { console.log(`note: ${comp} declares NO component tokens (${mod} exports neither prepareComponentToken nor initComponentToken — measured: no .antd.ant-${comp} var rule live either)`); continue; }
  const l = prep(light), d = prep(dark);
  for (const k of Object.keys(l)) {
    if (typeof l[k] === 'object' || typeof l[k] === 'function' || typeof l[k] === 'boolean') continue;
    put(token2CSSVar(k, `ant-${comp}`).slice('--ant-'.length), serialize(k, l[k], comp), serialize(k, d[k], comp));
  }
}
// DRIFT REFUSAL: if a live cssVar dump is committed (tokens/live-cssvar-dump.json — the probe's `.antd*` rule
// declarations, RECON §2.5), every declared name must exist in the wrap with the SAME value, else refuse by name.
import { existsSync, readFileSync } from 'node:fs';
const dumpPath = path.join(EX, 'tokens', 'live-cssvar-dump.json');
if (existsSync(dumpPath)) {
  const dump = JSON.parse(readFileSync(dumpPath, 'utf8'));
  const norm = (v) => String(v).replace(/\s+/g, '').toLowerCase();
  const drift = [];
  for (const [sel, decls] of Object.entries(dump.defs)) {
    if (!/^\.antd(\.ant-(btn|tag|badge|switch|radio-css-var|input|alert|avatar-css-var|progress|card|tooltip))?$/.test(sel)) continue;
    for (const [n, v] of Object.entries(decls)) {
      const leaf = n.slice('--ant-'.length);
      if (!(leaf in base)) drift.push(`${sel} ${n}: declared live, ABSENT from wrap`);
      else if (norm(base[leaf].$value) !== norm(v) && !dump.pinned?.includes(n)) drift.push(`${sel} ${n}: wrap=${base[leaf].$value} live=${v}`);
    }
  }
  if (drift.length) { console.error(`REFUSED: ${drift.length} drift(s) between the wrap and the live cssVar dump:\n  ${drift.join('\n  ')}`); process.exit(1); }
  console.log(`drift check vs ${path.relative(EX, dumpPath)}: 0`);
}
const out = path.join(EX, 'tokens');
mkdirSync(path.join(out, 'modes'), { recursive: true });
writeFileSync(path.join(out, 'antd.dtcg.json'), JSON.stringify(base, null, 2) + '\n');
writeFileSync(path.join(out, 'modes', 'antd.light.dtcg.json'), JSON.stringify(modeLight, null, 2) + '\n');
writeFileSync(path.join(out, 'modes', 'antd.dark.dtcg.json'), JSON.stringify(modeDark, null, 2) + '\n');
writeFileSync(path.join(out, 'antd.vars.css'), `:root {\n${cssLines.join('\n')}\n}\n`);
console.log(`antd tokens: ${globalCount} global + ${cssLines.length - globalCount} component leaves = ${cssLines.length}; ${Object.keys(modeDark).length} differ in dark`);

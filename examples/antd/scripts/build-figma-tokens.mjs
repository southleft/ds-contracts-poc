/**
 * Ant Design genesis token sync — `node examples/antd/scripts/build-figma-tokens.mjs`
 *
 * Emits `examples/antd/figma/00-tokens.figma.js`: a deterministic Figma
 * Plugin-API script that UPSERTS the antd default-theme token set as local
 * variables — one "Ant Design" collection, Light/Dark modes — plus the minted
 * `imported.*` layer (slash spelling, the emitters' Figma naming).
 *
 * THE MODES ARE THEME OBJECTS, NOT A CSS SCOPE. antd ships no stylesheet at
 * all (@ant-design/cssinjs injects every rule at runtime); Light/Dark here are
 * antd's own `theme.getDesignToken()` and `getDesignToken({ algorithm:
 * darkAlgorithm })`, built by examples/antd/scripts/build-tokens.mjs into
 * `tokens/modes/antd.{light,dark}.dtcg.json` (290 of 502 leaves differ). The
 * base file `tokens/antd.dtcg.json` is the light theme flattened (502 leaves,
 * no nesting — the reader's var→leaf transform never emits a "."), and each
 * leaf's key is the cssVar-mode custom-property name minus `--ant-`
 * (`color-primary`, `button-padding-inline`), exactly as cssinjs declares it
 * on the `.antd` key class (RECON §2.5).
 *
 * SOURCE-ALIASED minted leaves ({color-primary}, written by promote-floor.mjs
 * from the library's own CSS-variable references — cssVar mode spells every
 * point-of-use rule as var(--ant-*)) become REAL Figma variable aliases
 * (VARIABLE_ALIAS), not baked literals — so they inherit the target's
 * Light/Dark values and the variables panel shows the semantic link antd's
 * own theme declares.
 *
 * Value policy (deterministic, named skips — never guessed):
 *   color hex/#rgba/rgb() → COLOR (per-mode when mode-varying)
 *   dimension px → FLOAT px; rem → FLOAT px (×16)
 *   number → FLOAT               (antd's unitless leaves — line-height, z-index, font-weight — are numbers)
 *   {alias} (minted layer) → VARIABLE_ALIAS to the named base variable
 *   everything else (font stacks, shadow strings, durations, curves) → STRING
 *
 * Run BEFORE the component scripts — they bind these variables by name.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.join(HERE, '..');
const read = (rel) => JSON.parse(readFileSync(path.join(EX, rel), 'utf8'));

const base = read('tokens/antd.dtcg.json');
let light = {}, dark = {};
try { light = read('tokens/modes/antd.light.dtcg.json'); dark = read('tokens/modes/antd.dark.dtcg.json'); } catch { /* single-mode theme */ }

// minted layer → flat slash-paths (the emitters' Figma variable spelling)
const mintedFlat = {};
try {
  const walk = (node, prefix) => {
    for (const [k, v] of Object.entries(node)) {
      if (v && typeof v === 'object' && '$value' in v) mintedFlat[[...prefix, k].join('/')] = v;
      else if (v && typeof v === 'object') walk(v, [...prefix, k]);
    }
  };
  walk(read('tokens/antd-minted.dtcg.json'), []);
} catch { /* no minted layer yet */ }

function color(v) {
  let s = String(v).trim();
  const h3 = /^#([0-9a-f]{3,4})$/i.exec(s);
  if (h3) s = '#' + [...h3[1]].map((c) => c + c).join('');
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x.trim()));
    return { r: (p[0] || 0) / 255, g: (p[1] || 0) / 255, b: (p[2] || 0) / 255, a: p[3] === undefined ? 1 : p[3] };
  }
  return null;
}
function float(v) {
  let m = /^(-?[\d.]+)px$/.exec(String(v));
  if (m) return parseFloat(m[1]);
  m = /^(-?[\d.]+)rem$/.exec(String(v));
  if (m) return parseFloat(m[1]) * 16;
  m = /^(-?[\d.]+)$/.exec(String(v));
  if (m) return parseFloat(m[1]);
  return null;
}

const out = [];
// base first (alias targets must exist before minted alias rows are applied —
// the script does two passes, but ordering keeps the receipt readable)
for (const name of Object.keys(base).sort()) {
  const entry = base[name];
  const lv = String(light[name]?.$value ?? entry.$value);
  const dv = String(dark[name]?.$value ?? entry.$value);
  const lc = color(lv);
  const dc = color(dv);
  if (entry.$type === 'color' && lc && dc) { out.push({ name, type: 'COLOR', light: lc, dark: dc }); continue; }
  const lf = float(lv);
  const df = float(dv);
  if (entry.$type !== 'color' && lf !== null && df !== null) { out.push({ name, type: 'FLOAT', light: lf, dark: df }); continue; }
  out.push({ name, type: 'STRING', light: lv, dark: dv });
}
let aliasCount = 0;
for (const name of Object.keys(mintedFlat).sort()) {
  const v = String(mintedFlat[name].$value);
  const am = /^\{(.+)\}$/.exec(v);
  if (am) { out.push({ name, type: 'ALIAS', target: am[1] }); aliasCount++; continue; }
  const c = color(v);
  if (c) { out.push({ name, type: 'COLOR', light: c, dark: c }); continue; }
  const f = float(v);
  if (f !== null) { out.push({ name, type: 'FLOAT', light: f, dark: f }); continue; }
  out.push({ name, type: 'STRING', light: v, dark: v });
}

const script = `// Ant Design genesis token sync — GENERATED by examples/antd/scripts/build-figma-tokens.mjs
// Deterministic variable UPSERT (re-run safe): one "Ant Design" collection,
// Light/Dark modes, ${out.length} variables (${aliasCount} Figma-native aliases from
// the library's own CSS-variable references). Run BEFORE the component scripts.
const TOKENS = ${JSON.stringify(out)};
const collections = await figma.variables.getLocalVariableCollectionsAsync();
let col = collections.find((c) => c.name === 'Ant Design');
if (!col) col = figma.variables.createVariableCollection('Ant Design');
let lightId = col.modes[0].modeId;
col.renameMode(lightId, 'Light');
let darkMode = col.modes.find((m) => m.name === 'Dark');
const darkId = darkMode ? darkMode.modeId : col.addMode('Dark');
const existing = new Map();
for (const v of await figma.variables.getLocalVariablesAsync()) {
  if (v.variableCollectionId === col.id) existing.set(v.name, v);
}
let created = 0, updated = 0;
// pass 1: create/refresh every variable with concrete values
for (const t of TOKENS) {
  if (t.type === 'ALIAS') continue;
  let v = existing.get(t.name);
  if (!v) { v = figma.variables.createVariable(t.name, col, t.type); existing.set(t.name, v); created++; } else { updated++; }
  v.setValueForMode(lightId, t.light);
  v.setValueForMode(darkId, t.dark);
}
// pass 2: minted aliases — REAL variable aliases to the base tokens the
// library's own CSS named (they inherit the target's Light/Dark values)
let aliased = 0;
for (const t of TOKENS) {
  if (t.type !== 'ALIAS') continue;
  const target = existing.get(t.target);
  if (!target) throw new Error('token sync: alias target missing: ' + t.target + ' (for ' + t.name + ')');
  let v = existing.get(t.name);
  const resolvedType = target.resolvedType;
  if (!v) { v = figma.variables.createVariable(t.name, col, resolvedType); existing.set(t.name, v); created++; } else { updated++; }
  const alias = figma.variables.createVariableAlias(target);
  v.setValueForMode(lightId, alias);
  v.setValueForMode(darkId, alias);
  aliased++;
}
figma.notify('Ant Design tokens: ' + created + ' created, ' + updated + ' updated (' + TOKENS.length + ' total, ' + aliased + ' aliases, Light/Dark)');
return { created, updated, aliased, total: TOKENS.length };
`;

mkdirSync(path.join(EX, 'figma'), { recursive: true });
writeFileSync(path.join(EX, 'figma', '00-tokens.figma.js'), script);
const counts = out.reduce((a, o) => ((a[o.type] = (a[o.type] ?? 0) + 1), a), {});
console.log(`✔ 00-tokens.figma.js: ${out.length} variables (${Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(', ')}), Light/Dark modes`);

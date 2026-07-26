/**
 * Astryx genesis token sync — `npx tsx examples/astryx/scripts/build-figma-tokens.ts`
 *
 * Emits `examples/astryx/figma/00-tokens.figma.js`: a deterministic Figma
 * Plugin-API script that UPSERTS the Astryx token set as local variables —
 * one "Astryx" collection, Light/Dark modes, literal values per mode. This
 * CLOSES the compile receipt's named limitation ("the repo engine's
 * alias-based buildTokensScript does not model literal token sets"): Astryx's
 * StyleX tokens are literal light-dark() values with no primitive layer, so
 * the genesis sync is a literal-variable upsert, emitted here from the SAME
 * DTCG wrap the extraction referees against.
 *
 * Value policy (deterministic, named skips — never guessed):
 *   color   hex/#rgba/rgb()/black/white → COLOR (per-mode when mode-varying)
 *   dimension px → FLOAT px; rem → FLOAT px (×16, the root font size)
 *   number  → FLOAT
 *   duration Nms → FLOAT (milliseconds)
 *   aliases {x} → resolved through the tree first (the DTCG alias pass
 *           guarantees targets exist)
 *   everything else (font stacks, cubic-bezier easings, box-shadow strings)
 *           → STRING — bindable identity; consumers that need parsed values
 *           resolve them at COMPILE time from the DTCG, not at runtime.
 *
 * Run it BEFORE the component scripts (the plugin's "Paste a script" tab, or
 * the Local runner) — the component scripts bind these variables by name.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.join(HERE, '..');
const read = (rel: string) => JSON.parse(readFileSync(path.join(EX, rel), 'utf8'));

const base = read('tokens/astryx.dtcg.json') as Record<string, { $type?: string; $value: unknown }>;
// Phase A-2: the MINTED layer (imported.* — computed-floor leaves the DTCG
// wrap cannot name) joins the upsert under the emitters' slash spelling
// (imported/button/label/color/primary). Values are browser-computed px/hex
// literals; same converters apply.
let mintedFlat: Record<string, { $type?: string; $value: unknown }> = {};
try {
  const mintedTree = read('tokens/astryx-minted.dtcg.json') as Record<string, unknown>;
  const walk = (node: Record<string, unknown>, prefix: string[]) => {
    for (const [k, v] of Object.entries(node)) {
      if (v && typeof v === 'object' && '$value' in (v as object)) {
        mintedFlat[[...prefix, k].join('/')] = v as { $type?: string; $value: unknown };
      } else if (v && typeof v === 'object') {
        walk(v as Record<string, unknown>, [...prefix, k]);
      }
    }
  };
  walk(mintedTree, []);
} catch { /* no minted layer yet */ }
const light = read('tokens/modes/astryx.light.dtcg.json') as Record<string, { $value: unknown }>;
const dark = read('tokens/modes/astryx.dark.dtcg.json') as Record<string, { $value: unknown }>;

const resolveAlias = (v: string, depth = 0): string => {
  const m = v.match(/^\{([a-z0-9-]+)\}$/i);
  if (!m || depth > 8) return v;
  const target = base[m[1]];
  return target ? resolveAlias(String(target.$value), depth + 1) : v;
};

type Out =
  | { name: string; type: 'COLOR'; light: { r: number; g: number; b: number; a: number }; dark: { r: number; g: number; b: number; a: number } }
  | { name: string; type: 'FLOAT'; light: number; dark: number }
  | { name: string; type: 'STRING'; light: string; dark: string }
  // RE-ANCHORING ROUND: a minted leaf may now be an ALIAS onto a base token
  // (examples/astryx/scripts/reanchor-minted.ts). It must become a Figma-NATIVE
  // variable alias so it INHERITS the target's Light/Dark values — which is the
  // whole point: minted literals are mode-frozen, semantic tokens are not.
  // Mirrors core/token-set.ts compileTokenSetRows/emitTokenSetScript so the
  // script path and the bundle path land the same variables.
  | { name: string; type: 'ALIAS'; target: string };

const NAMED_COLORS: Record<string, string> = { black: '#000000', white: '#FFFFFF', transparent: '#00000000' };

function color(v: string): { r: number; g: number; b: number; a: number } | null {
  const s = NAMED_COLORS[v.trim().toLowerCase()] ?? v.trim();
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

function float(v: string): number | null {
  let m = /^(-?[\d.]+)px$/.exec(v);
  if (m) return parseFloat(m[1]);
  m = /^(-?[\d.]+)rem$/.exec(v);
  if (m) return parseFloat(m[1]) * 16;
  m = /^(-?[\d.]+)ms$/.exec(v);
  if (m) return parseFloat(m[1]);
  m = /^(-?[\d.]+)$/.exec(v);
  if (m) return parseFloat(m[1]);
  return null;
}

const out: Out[] = [];
const skips: string[] = [];
for (const name of Object.keys(mintedFlat).sort()) {
  const entry = mintedFlat[name];
  const v = String(entry.$value);
  const am = /^\{(.+)\}$/.exec(v);
  if (am) {
    // The alias target is a BASE token name (dot-less in the astryx wrap); it
    // must exist or the emitted script would throw at runtime in Figma.
    if (!base[am[1]]) {
      console.error(`REFUSED: minted leaf ${name} aliases {${am[1]}}, which is not in tokens/astryx.dtcg.json`);
      process.exit(1);
    }
    out.push({ name, type: 'ALIAS', target: am[1] });
    continue;
  }
  const c = color(v);
  if (c) { out.push({ name, type: 'COLOR', light: c, dark: c }); continue; }
  const f = float(v);
  if (f !== null) { out.push({ name, type: 'FLOAT', light: f, dark: f }); continue; }
  out.push({ name, type: 'STRING', light: v, dark: v });
}
for (const name of Object.keys(base).sort()) {
  const entry = base[name];
  if (!entry || typeof entry !== 'object' || !('$value' in entry)) continue;
  const lv = resolveAlias(String(light[name]?.$value ?? entry.$value));
  const dv = resolveAlias(String(dark[name]?.$value ?? entry.$value));
  const lc = color(lv);
  const dc = color(dv);
  if (entry.$type === 'color' || (lc && dc)) {
    if (lc && dc) out.push({ name, type: 'COLOR', light: lc, dark: dc });
    else skips.push(`${name}: color value not parseable (${lv.slice(0, 40)}) — kept as STRING`);
    if (!lc || !dc) out.push({ name, type: 'STRING', light: lv, dark: dv });
    continue;
  }
  const lf = float(lv);
  const df = float(dv);
  if (lf !== null && df !== null) {
    out.push({ name, type: 'FLOAT', light: lf, dark: df });
    continue;
  }
  out.push({ name, type: 'STRING', light: lv, dark: dv });
}

const aliasRows = out.filter((o) => o.type === 'ALIAS');
const script = `// Astryx genesis token sync — GENERATED by examples/astryx/scripts/build-figma-tokens.ts
// Deterministic literal-variable UPSERT (re-run safe): one "Astryx" collection,
// Light/Dark modes, ${out.length} variables (${aliasRows.length} Figma-native aliases
// from re-anchored minted leaves — they INHERIT the target's Light/Dark values).
// TWO PASSES: concrete values first, then aliases (targets must exist).
// Run BEFORE the component scripts.
const TOKENS = ${JSON.stringify(out)};
const collections = await figma.variables.getLocalVariableCollectionsAsync();
let col = collections.find((c) => c.name === 'Astryx');
if (!col) col = figma.variables.createVariableCollection('Astryx');
let lightId = col.modes[0].modeId;
col.renameMode(lightId, 'Light');
let darkMode = col.modes.find((m) => m.name === 'Dark');
const darkId = darkMode ? darkMode.modeId : col.addMode('Dark');
const existing = new Map();
for (const v of await figma.variables.getLocalVariablesAsync()) {
  if (v.variableCollectionId === col.id) existing.set(v.name, v);
}
let created = 0, updated = 0;
// pass 1 — concrete values
for (const t of TOKENS) {
  if (t.type === 'ALIAS') continue;
  let v = existing.get(t.name);
  if (!v) { v = figma.variables.createVariable(t.name, col, t.type); existing.set(t.name, v); created++; } else { updated++; }
  v.setValueForMode(lightId, t.light);
  v.setValueForMode(darkId, t.dark);
}
// pass 2 — re-anchored minted leaves become REAL variable aliases
let aliased = 0;
for (const t of TOKENS) {
  if (t.type !== 'ALIAS') continue;
  const target = existing.get(t.target);
  if (!target) throw new Error('token sync: alias target missing: ' + t.target + ' (for ' + t.name + ')');
  let v = existing.get(t.name);
  if (!v) { v = figma.variables.createVariable(t.name, col, target.resolvedType); existing.set(t.name, v); created++; } else { updated++; }
  const alias = figma.variables.createVariableAlias(target);
  v.setValueForMode(lightId, alias);
  v.setValueForMode(darkId, alias);
  aliased++;
}
figma.notify('Astryx tokens: ' + created + ' created, ' + updated + ' updated (' + TOKENS.length + ' total, ' + aliased + ' aliases, Light/Dark)');
return { created, updated, aliased, total: TOKENS.length };
`;

mkdirSync(path.join(EX, 'figma'), { recursive: true });
writeFileSync(path.join(EX, 'figma', '00-tokens.figma.js'), script);
console.log(
  `✔ 00-tokens.figma.js: ${out.length} variables (${out.filter((o) => o.type === 'COLOR').length} COLOR, ` +
    `${out.filter((o) => o.type === 'FLOAT').length} FLOAT, ${out.filter((o) => o.type === 'STRING').length} STRING, ` +
    `${aliasRows.length} ALIAS), Light/Dark modes`,
);
if (aliasRows.length > 0) {
  console.log(`  re-anchored minted leaves → Figma-native aliases (mode-following, no longer frozen):`);
  for (const a of aliasRows) console.log(`    ${a.name} → ${(a as { target: string }).target}`);
}
if (skips.length > 0) console.log(skips.map((s) => `  - ${s}`).join('\n'));

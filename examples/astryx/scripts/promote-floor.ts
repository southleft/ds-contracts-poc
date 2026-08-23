/**
 * ASTRYX FLOOR PROMOTION — `npx tsx examples/astryx/scripts/promote-floor.ts`
 *
 * The computed-floor artifacts REPLACE the floor-fidelity promoted contracts
 * (the polaris promote-floor pattern, examples/polaris/scripts/): for each
 * component whose capture ran to a committed artifact set, promote
 *
 *   · resolved.contract.json (decisions-ledger-applied computed truth; falls
 *     back to enriched.contract.json when no ledger exists) — version bumped
 *     to 0.3.0, provenance appended;
 *   · the extension block as contracts/<name>.extension.json (everything the
 *     vocabulary cannot carry, BY NAME);
 *   · every component's minted token tree merged into
 *     tokens/astryx-minted.dtcg.json (namespace `imported.*`), collision-
 *     checked — the emitters resolve these alongside the DTCG wrap.
 *
 * bindings.figma.statePreviews stays OPTED OUT this round (default-state fidelity is
 * the current gate; state cells are the named next class). Deterministic by
 * construction; re-running is byte-stable.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyDecisions, contractRefs, loadDecisions, resolutionGuard } from './reanchor-minted.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.join(HERE, '..');
const REPO = path.join(EX, '..', '..');
const OUT = path.join(REPO, 'extract', 'computed', 'out', 'astryx');

// Switch is EXCLUDED by name (unchanged): the union carried BOTH labelPosition
// orders as unconditioned sibling branches (order-sensitive signature
// matching — the anatomy join's named limitation); promoting it would double
// the rendered content per variant. Its v0.2.0 curated contract ships until
// the union-order round.
//
// Banner is RE-ADMITTED (it was excluded at capture for a determinism refusal
// on an unsettled expand/collapse transition; the toggle only exists when the
// component receives `children`, and the capture mount passes none — the
// double-run byte-identity self-check now passes).
//
// The out-directory name is the component NAME lowercased with no separator
// (`checkboxinput`), while the contract/lane stem is hyphenated
// (`checkbox-input`) — they are different strings and must both be named.
const COMPONENTS: Array<{ out: string; stem: string }> = [
  { out: 'button', stem: 'button' },
  { out: 'badge', stem: 'badge' },
  { out: 'card', stem: 'card' },
  { out: 'slider', stem: 'slider' },
  { out: 'banner', stem: 'banner' },
  { out: 'checkboxinput', stem: 'checkbox-input' },
  { out: 'progressbar', stem: 'progress-bar' },
  { out: 'textinput', stem: 'text-input' },
  { out: 'token', stem: 'token' },
];
// The minted tree unions over ALL captured components — imported.shared.*
// leaves can be minted during ANY component's fusion (Switch minted shared
// sizes other contracts reference); contract promotion and mint sourcing
// are independent decisions.
const MINT_SOURCES = [
  'button', 'badge', 'card', 'slider', 'switch',
  'banner', 'checkboxinput', 'progressbar', 'textinput', 'token',
];

const mintedMerged: Record<string, unknown> = {};
function mergeInto(target: Record<string, unknown>, src: Record<string, unknown>, prefix = '') {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object' && !('$value' in (v as object))) {
      if (!(k in target)) target[k] = {};
      mergeInto(target[k] as Record<string, unknown>, v as Record<string, unknown>, `${prefix}${k}.`);
    } else if (k in target && JSON.stringify(target[k]) !== JSON.stringify(v)) {
      throw new Error(`minted-token collision at "${prefix}${k}" — two components minted different values under one path`);
    } else {
      target[k] = v;
    }
  }
}

const promoted: string[] = [];
const copiedAssets: string[] = [];
for (const { out: name, stem } of COMPONENTS) {
  const dir = path.join(OUT, name);
  const resolvedPath = path.join(dir, 'resolved.contract.json');
  const enrichedPath = path.join(dir, 'enriched.contract.json');
  const src = existsSync(resolvedPath) ? resolvedPath : enrichedPath;
  if (!existsSync(src)) throw new Error(`${name}: no computed artifact (${src})`);
  const contract = JSON.parse(readFileSync(src, 'utf8'));
  const extension = JSON.parse(readFileSync(path.join(dir, 'enriched.extension.json'), 'utf8'));

  contract.version = '0.3.0';
  contract.description =
    `${contract.description} FLOOR-PROMOTED (examples/astryx/scripts/promote-floor.ts): ` +
    `${path.basename(src)} — computed-capture truth with the decisions ledger applied ` +
    `(extract/computed/out/astryx/${name}/decisions.md); extension sidecar carries the named overflow.`;

  writeFileSync(path.join(EX, 'contracts', `${stem}.contract.json`), JSON.stringify(contract, null, 2) + '\n');
  writeFileSync(path.join(EX, 'contracts', `${stem}.extension.json`), JSON.stringify(extension, null, 2) + '\n');
  promoted.push(`${stem} (${path.basename(src)})`);

  // ICON ASSETS TRAVEL WITH THE CONTRACT. The svg-content promotion writes the
  // per-value glyphs it carried into <out>/assets/ and names them in the
  // contract (`icon.asset`); the emitter REFUSES a contract naming an asset it
  // cannot find. Leaving the copy to a human made the promotion of any
  // glyph-bearing component a two-step with a silent second step — measured:
  // the first extended run promoted banner naming `banner-icon-info` while
  // examples/astryx/assets/icons held the older hand-named `banner-info.svg`,
  // and the whole emit refused on four contract violations.
  const assetDir = path.join(dir, 'assets');
  if (existsSync(assetDir)) {
    const iconsDir = path.join(EX, 'assets', 'icons');
    mkdirSync(iconsDir, { recursive: true });
    for (const f of readdirSync(assetDir).filter((x) => x.endsWith('.svg'))) {
      copyFileSync(path.join(assetDir, f), path.join(iconsDir, f));
      copiedAssets.push(`${stem}/${f}`);
    }
  }
}
for (const name of MINT_SOURCES) {
  const extPath = path.join(OUT, name, 'enriched.extension.json');
  if (!existsSync(extPath)) continue;
  const extension = JSON.parse(readFileSync(extPath, 'utf8'));
  mergeInto(mintedMerged, (extension.mintedTokens ?? {}) as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// RE-ANCHORING RE-APPLY — the trap this round would otherwise have set.
//
// The minted tree above is regenerated from the computed-floor capture, which
// only ever holds LITERALS. Without this step, running promote-floor.ts after
// examples/astryx/scripts/reanchor-minted.ts would SILENTLY REVERT every
// acked alias — a pipeline that quietly undoes a human decision is worse than
// one that breaks loudly. So the committed ledger is re-applied here, and the
// MUI resolution guard (promote-floor.mjs:260-303) runs over the result:
// every alias must resolve in the neutral DTCG base, and every contract
// {imported.*} ref (axis-expanded) must still resolve in the tree.
//
// applyDecisions is idempotent and refuses on drift (stale ledger vs drifted
// DTCG), so this is the same code path `--apply` takes — one implementation.
// ---------------------------------------------------------------------------
const decisions = loadDecisions();
const base = JSON.parse(readFileSync(path.join(EX, 'tokens', 'astryx.dtcg.json'), 'utf8')) as Record<string, { $value: unknown; $type?: string }>;
const refs = contractRefs(path.join(EX, 'contracts'));

// ---------------------------------------------------------------------------
// FC-THEME-BASE — the ledger is PARTITIONED, never force-fitted.
//
// `applyDecisions` refuses (process.exit) on the FIRST row whose acked literal
// no longer equals the leaf, which is correct for a drift of one or two rows
// and useless as a report when the whole plane moved. It moved:
//
//   the capture mount renders under `<Theme theme={neutralTheme}>` — the
//   library's documented Quick Start, and the only mount where the base font
//   resolves — while `tokens/astryx.dtcg.json` is wrapped from
//   @astryxdesign/core/src/theme/tokens.stylex.ts, the CORE DEFAULT palette.
//   Two different themes. Measured: core `--color-accent: #0064E0`,
//   theme-neutral `--color-accent: #262626`; core `--color-text-primary:
//   #0A1317`, theme-neutral `#171717`; core `--color-background-blue:
//   #0171E333`, theme-neutral `#c4ddfb`.
//
// So every colour the ledger was acked against belongs to the OTHER plane.
// Force-writing new literals into the acked rows would be exactly the "silent
// no-op dressed as the fix" that reanchor-minted.ts:assertNeutralAnchor
// refuses. Dropping the rows silently would quietly undo a human decision.
//
// This does the third thing: a leaf whose acked literal no longer matches
// keeps THE VALUE THE CAPTURE MEASURED (a literal — never wrong, only less
// good: it stops following light/dark mode), and every such row is named in
// tokens/REANCHOR-STALE.md and on stdout. `applyDecisions` still runs over the
// surviving subset and remains the only thing that writes an alias, so a
// mistake in this partition can only ever make it refuse — never let a
// value nobody reviewed through.
// ---------------------------------------------------------------------------
type Leaf = { $value: unknown; $type?: string };
const leafAt = (tree: Record<string, unknown>, dot: string): Leaf | undefined => {
  let n: unknown = tree;
  for (const seg of dot.split('.')) {
    if (!n || typeof n !== 'object') return undefined;
    n = (n as Record<string, unknown>)[seg];
  }
  return n && typeof n === 'object' && '$value' in (n as object) ? (n as Leaf) : undefined;
};
const tuple = (v: string): string | null => {
  let s = String(v).trim();
  const h3 = /^#([0-9a-f]{3,4})$/i.exec(s);
  if (h3) s = '#' + [...h3[1]].map((c) => c + c).join('');
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${m[2] ? Math.round((parseInt(m[2], 16) / 255) * 10000) / 10000 : 1}`;
  }
  m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(s);
  if (m) return `${m[1]},${m[2]},${m[3]},${Number(m[4] ?? 1)}`;
  return null;
};
const valueEq = (a: unknown, b: unknown): boolean => {
  if (String(a) === String(b)) return true;
  const ta = tuple(String(a));
  return ta !== null && ta === tuple(String(b));
};
const resolveBase = (name: string, seen = new Set<string>()): string | undefined => {
  const t = base[name];
  if (!t) return undefined;
  const v = String(t.$value);
  const m = /^\{(.+)\}$/.exec(v);
  if (!m) return v;
  if (seen.has(m[1])) return undefined;
  seen.add(m[1]);
  return resolveBase(m[1], seen);
};

const applicable: typeof decisions = [];
const staleRows: Array<{ ids: string; to: string; acked: string; reason: string; leaves: string[] }> = [];
for (const d of decisions) {
  const cur = resolveBase(d.to);
  const bad: string[] = [];
  if (cur === undefined) bad.push(`{${d.to}} does not resolve in tokens/astryx.dtcg.json`);
  else if (!valueEq(cur, d.value)) bad.push(`{${d.to}} is now ${cur}, ledger acked ${d.value}`);
  const keptLeaves: string[] = [];
  if (bad.length === 0) {
    for (const lp of d.leaves) {
      const leaf = leafAt(mintedMerged, lp);
      if (!leaf) { bad.push(`leaf ${lp} is absent from the freshly minted tree`); continue; }
      const v = String(leaf.$value);
      if (v === `{${d.to}}`) { keptLeaves.push(lp); continue; }
      if (/^\{.+\}$/.test(v)) { bad.push(`leaf ${lp} already aliases ${v}`); continue; }
      if (!valueEq(v, d.value)) { bad.push(`leaf ${lp} measured ${v}, ledger acked ${d.value}`); continue; }
      keptLeaves.push(lp);
    }
  }
  if (bad.length === 0) applicable.push(d);
  else staleRows.push({ ids: d.ids.join(','), to: d.to, acked: String(d.value), reason: bad.join('; '), leaves: d.leaves });
}

const reanchor = applyDecisions(mintedMerged, applicable, base, null);
resolutionGuard(mintedMerged, base, refs);

const staleLeafCount = staleRows.reduce((n, r) => n + r.leaves.length, 0);
writeFileSync(
  path.join(EX, 'tokens', 'REANCHOR-STALE.md'),
  [
    '# Re-anchoring rows that could NOT be re-applied — FC-THEME-BASE',
    '',
    'Regenerate: `npx tsx examples/astryx/scripts/promote-floor.ts`.',
    '',
    `${staleRows.length} of ${decisions.length} acked row(s) (${staleLeafCount} leaf/leaves) did not re-apply against the`,
    'freshly captured minted tree. Each of those leaves ships as the LITERAL the capture',
    'measured. Nothing here is wrong — the values are the measured truth — but those leaves',
    'no longer follow light/dark mode, which is exactly what the re-anchoring bought.',
    '',
    '## Why (measured, not inferred)',
    '',
    'The capture mount renders under `<Theme theme={neutralTheme}>` (`@astryxdesign/theme-neutral`,',
    "the library's documented Quick Start and the only mount where the base font resolves).",
    '`tokens/astryx.dtcg.json` is wrapped from `@astryxdesign/core/src/theme/tokens.stylex.ts` —',
    'the CORE DEFAULT palette. They are different themes:',
    '',
    '| token | core default (the DTCG base) | @astryxdesign/theme-neutral (what the capture renders) |',
    '|---|---|---|',
    '| `--color-accent` | `#0064E0` | `#262626` |',
    '| `--color-text-primary` | `#0A1317` | `#171717` |',
    '| `--color-background-blue` | `#0171E333` | `#c4ddfb` |',
    '| `--color-error` | `#E3193B` | `#a50c25` (button label) |',
    '',
    'A value-identity join cannot bridge two palettes, so these rows have no target to',
    'alias onto. Re-writing their acked literals in place would be the "silent no-op',
    'dressed as the fix" `reanchor-minted.ts:assertNeutralAnchor` exists to refuse.',
    'THE DECISION THIS NEEDS IS A HUMAN ONE: either re-base the astryx token layer onto',
    '`@astryxdesign/theme-neutral` (and re-run `--propose` so the role choices re-join),',
    'or mount the capture under the core default plane (and lose the base font again).',
    '',
    '## The rows',
    '',
    '| ids | acked target | acked literal | why it did not apply |',
    '|---|---|---|---|',
    ...staleRows.map((r) => `| \`${r.ids}\` | \`${r.to}\` | \`${r.acked}\` | ${r.reason.replace(/\|/g, '\\|')} |`),
    '',
  ].join('\n'),
);

writeFileSync(path.join(EX, 'tokens', 'astryx-minted.dtcg.json'), JSON.stringify(mintedMerged, null, 2) + '\n');
console.log(`✔ floor-promoted ${promoted.length} contract(s) → examples/astryx/contracts (v0.3.0): ${promoted.join(', ')}`);
console.log(`✔ minted tree → examples/astryx/tokens/astryx-minted.dtcg.json`);
console.log(
  `✔ re-anchoring ledger re-applied: ${reanchor.applied} leaf/leaves aliased from ` +
    `tokens/reanchor-decisions.json (${applicable.length} of ${decisions.length} acked row(s) still applicable); resolution guard green`,
);
if (staleRows.length > 0) {
  console.warn(
    `⚠ FC-THEME-BASE: ${staleRows.length} acked row(s) / ${staleLeafCount} leaf/leaves did NOT re-apply — the capture plane ` +
      `(@astryxdesign/theme-neutral) and the DTCG base plane (@astryxdesign/core default) are different themes. ` +
      `Those leaves ship as measured literals and stop following light/dark mode. Named row-by-row in ` +
      `examples/astryx/tokens/REANCHOR-STALE.md — a HUMAN decision is required to close it.`,
  );
}

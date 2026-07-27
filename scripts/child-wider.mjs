/**
 * CHILD-WIDER-THAN-PARENT — the shared measurement, and the repo-wide ratchet.
 *
 *   node scripts/child-wider.mjs             # check every library against the baseline
 *   node scripts/child-wider.mjs --write     # re-record the baseline (say what moved)
 *   node scripts/child-wider.mjs --library carbon
 *
 * WHAT IT MEASURES. A container whose in-flow child is WIDER than the
 * container is never right — the child overlaps its siblings or hangs off the
 * cell. The Carbon live-defect round found two of them by hand on a real
 * canvas (`accordion__wrapper` 472px inside a 328px `accordion__item`;
 * `toggle__label` stacking the label on top of the track) and built this
 * measurement in response, as an inline block inside Carbon's own compile
 * receipt. It published a corpus-wide baseline in prose — altitude 0,
 * tailwind 0, carbon 8 (all text-caused), astryx 11, mui 12, polaris 42 — and
 * deliberately did NOT turn it on repo-wide, because four libraries would go
 * red immediately and each of those numbers is its own investigation.
 *
 * THE POSTURE THIS FILE IMPLEMENTS. A number published in prose rots. A number
 * that fails the build is a stop-work order the round cannot pay for. The
 * repo already has the third option and uses it in four places (see
 * extract/computed/drift-check.ts, parity/baseline.json): a COMMITTED
 * per-library baseline that may only DECREASE. The defect stays visible, it
 * can never silently grow, and each library's investigation can land on its
 * own schedule — each landing ratcheting the number down.
 *
 * The ratchet is TWO-SIDED, exactly like the regate drift baseline: an
 * INCREASE fails ("a new overflow"), and a DECREASE also fails ("you fixed
 * something — re-record it"). A one-sided ratchet leaves a stale high
 * baseline sitting there, and a stale high baseline is room to regrow in
 * silence, which is the thing this round exists to remove.
 *
 * ONE EXEMPTION, COUNTED NOT HIDDEN: an overflow whose CAUSE is a hugging TEXT
 * descendant already wider than the parent is the corpus-wide TEXT WRAPPING
 * gap (docs/22 §"Text wrapping is not implemented"). Figma text nodes here
 * auto-size on one line, so the box hugs an unwrapped run. That is a
 * different round. It is counted, baselined and ratcheted separately — never
 * folded into the number it would flatter.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createFigmaMock } from './plugin-engine-mock-figma.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
export const BASELINE_PATH = path.join(HERE, 'child-wider-baseline.json');

const descend = (n, out = []) => { out.push(n); for (const c of n.children ?? []) descend(c, out); return out; };

/**
 * THE measurement. Pure over a built mock file — one implementation, shared by
 * this checker and by Carbon's per-library compile receipt (which keeps its
 * own HARD zero, because Carbon's investigation is the one that already
 * landed).
 */
export function countChildWider(mockRoot) {
  const allCells = mockRoot.findAll((n) => n.type === 'COMPONENT' && n.parent?.type === 'COMPONENT_SET');
  const cells = allCells.length > 0 ? allCells : mockRoot.findAll((n) => n.type === 'COMPONENT');
  const over = [];
  let textCaused = 0;
  let marginBox = 0;
  for (const cell of cells) {
    for (const n of descend(cell)) {
      for (const c of n.children ?? []) {
        if (c.layoutPositioning === 'ABSOLUTE' || !c.visible) continue;
        if (c.width <= n.width + 0.6) continue;
        // SECOND EXEMPTION, ALSO COUNTED — the CSS MARGIN BOX. A part with a
        // NEGATIVE margin is lowered to a fixed wrapper frame named
        // "<part> (margin box)" that reserves LESS layout space than the
        // child paints; that is the entire meaning of a negative margin, not
        // an overflow. Found the first time this instrument ran repo-wide:
        // MUI's Autocomplete indicators (margin-right -2) reported 4 "new"
        // overflows the moment the D6b fix gave them a real 28px control box.
        // Reading them as a Round-A regression would have been wrong.
        if (n.name === `${c.name} (margin box)`) { marginBox++; continue; }
        if (descend(c).some((d) => d.type === 'TEXT' && d.width > n.width + 0.6)) { textCaused++; continue; }
        over.push(`"${c.name}" ${Math.round(c.width)} > parent "${n.name}" ${Math.round(n.width)} (${cell.name})`);
      }
    }
  }
  return { overflows: over.length, textCaused, marginBox, detail: [...new Set(over)] };
}

/** Libraries are DERIVED from the tree, not listed here — "there is a figma
 *  script directory" and "there is a baseline row" must be the same fact, or a
 *  new library ships with no pin and nothing says so. */
export function discoverLibraries() {
  const exDir = path.join(ROOT, 'examples');
  return readdirSync(exDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, dir: path.join(exDir, e.name, 'figma') }))
    .filter((l) => existsSync(l.dir) && readdirSync(l.dir).some((f) => f.endsWith('.figma.js') && f !== '00-tokens.figma.js' && f !== 'GENESIS-BATCH.figma.js'))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const silent = { log() {}, warn() {}, error() {} };
const runIn = (mock, code) =>
  vm.runInContext(`(async () => {\n${code}\n})()`, vm.createContext({ figma: mock.figma, console: silent }), { timeout: 300_000 });

export async function measureLibrary(lib) {
  const scripts = readdirSync(lib.dir)
    .filter((f) => f.endsWith('.figma.js') && f !== '00-tokens.figma.js' && f !== 'GENESIS-BATCH.figma.js')
    .sort();
  const mock = createFigmaMock();
  const tokens = path.join(lib.dir, '00-tokens.figma.js');
  if (existsSync(tokens)) await runIn(mock, readFileSync(tokens, 'utf8'));
  for (const f of scripts) await runIn(mock, readFileSync(path.join(lib.dir, f), 'utf8'));
  return { ...countChildWider(mock.root), scripts: scripts.length };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const WRITE = process.argv.includes('--write');
  const only = process.argv.includes('--library') ? process.argv[process.argv.indexOf('--library') + 1] : null;
  // `--baseline <path>` lets a gate FALSIFY this check against a planted
  // baseline without mutating the repo's own committed one (a pin that has to
  // break the repo to prove itself can leave it broken when it throws).
  const baselinePath = process.argv.includes('--baseline') ? path.resolve(process.argv[process.argv.indexOf('--baseline') + 1]) : BASELINE_PATH;
  const libs = discoverLibraries().filter((l) => !only || l.name === only);
  const prior = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : { rows: [] };
  const priorBy = new Map(prior.rows.map((r) => [r.library, r]));

  const rows = [];
  for (const lib of libs) {
    const m = await measureLibrary(lib);
    rows.push({ library: lib.name, scripts: m.scripts, overflows: m.overflows, textCaused: m.textCaused, marginBox: m.marginBox, cause: priorBy.get(lib.name)?.cause ?? '', detail: m.detail.slice(0, 4) });
  }

  if (WRITE) {
    const out = {
      _marker:
        'CHILD-WIDER-THAN-PARENT BASELINE — a committed per-library defect count that may only DECREASE. ' +
        '`overflows` counts in-flow children wider than their parent with a non-text cause; `textCaused` counts the ' +
        'exempted class (the corpus-wide text-wrapping gap, docs/22) separately so it can never flatter the first number. ' +
        'Both ratchet TWO-SIDED: an increase is a new defect, a decrease is a fix that must be re-recorded here with its ' +
        'cause named. Re-record deliberately with `node scripts/child-wider.mjs --write` and say what moved.',
      recordedAt: new Date().toISOString().slice(0, 10),
      rows: rows.map((r) => ({ ...r, cause: r.cause || (r.overflows + r.textCaused + r.marginBox > 0 ? 'UNNAMED (name it in the baseline)' : '') })),
    };
    writeFileSync(baselinePath, JSON.stringify(out, null, 2) + '\n');
    console.log(`✔ baseline re-recorded: ${rows.length} libraries → ${path.relative(ROOT, baselinePath)}`);
    for (const r of rows) console.log(`  ${r.library.padEnd(10)} overflows ${String(r.overflows).padStart(3)} · text-caused ${String(r.textCaused).padStart(3)} · margin-box ${String(r.marginBox).padStart(3)} (${r.scripts} scripts)`);
    process.exit(0);
  }

  const failures = [];
  for (const r of rows) {
    const p = priorBy.get(r.library);
    if (!p) {
      failures.push(`${r.library}: NO BASELINE ROW — a library with figma scripts and no committed child-wider number is an ungated surface; run \`node scripts/child-wider.mjs --write\``);
      continue;
    }
    if (r.overflows > p.overflows) {
      failures.push(`${r.library}: child-wider overflows ${p.overflows} → ${r.overflows} — a NEW in-flow child wider than its parent (${r.detail.slice(0, 3).join('; ')})`);
    } else if (r.overflows < p.overflows) {
      failures.push(`${r.library}: child-wider overflows ${p.overflows} → ${r.overflows} — IMPROVED. The ratchet is two-sided on purpose: re-record it (\`--write\`) so the number can never regrow into the slack.`);
    }
    if (r.textCaused !== p.textCaused) {
      failures.push(`${r.library}: text-caused overflows ${p.textCaused} → ${r.textCaused} — the EXEMPTED class moved; re-record it with its cause named (an exemption nobody counts is a silent drop)`);
    }
    if (r.marginBox !== p.marginBox) {
      failures.push(`${r.library}: margin-box paint-outside ${p.marginBox} → ${r.marginBox} — the second EXEMPTED class moved; re-record it`);
    }
    if (r.overflows + r.textCaused + r.marginBox > 0 && (!p.cause || p.cause.startsWith('UNNAMED'))) {
      failures.push(`${r.library}: ${r.overflows + r.textCaused + r.marginBox} overflow(s) with no named cause in the baseline`);
    }
  }

  const w = (n, k) => String(n).padStart(k);
  console.log('library      scripts  overflows  text-caused  margin-box  cause');
  for (const r of rows) {
    const p = priorBy.get(r.library);
    console.log(`${r.library.padEnd(12)} ${w(r.scripts, 7)}  ${w(r.overflows, 9)}  ${w(r.textCaused, 11)}  ${w(r.marginBox, 10)}  ${p?.cause ?? '(no baseline row)'}`);
  }
  if (failures.length > 0) {
    console.error(`\n✖ child-wider ratchet: ${failures.length} failure(s)\n`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log(`\n✔ child-wider ratchet: ${rows.length} libraries at or below their committed baselines (${rows.reduce((n, r) => n + r.overflows, 0)} overflows, ${rows.reduce((n, r) => n + r.textCaused, 0)} text-caused, ${rows.reduce((n, r) => n + r.marginBox, 0)} margin-box paint-outside — every class counted and named)`);
}

/**
 * DECISION LEDGER RE-APPLICATION — `npm run extract:computed:decisions:check`
 * (`-- --write` is the remedy, and the ONLY writer).
 *
 * WHAT IT REFUSES. `out/<component>/resolved.contract.json` is the artifact
 * every promote-floor ships: the freshly fused `enriched.contract.json` with
 * the human-acked `decisions.json` ledger re-applied on top. Nothing in the
 * repo checked that the committed resolved contract IS that computation — the
 * only way to notice was a full library recapture (a browser, an npm sandbox
 * and ~30 minutes per library). So a ledger row could rot in place: RC6, the
 * astryx Badge, where `{color-accent}` moved from `#0064e0` to `#262626`, the
 * ledger kept re-anchoring five SEMANTIC variants onto it, and the component
 * shipped charcoal-on-charcoal through the contract, the CSS module, the
 * Figma script and the census render with no receipt anywhere.
 *
 * This gate re-derives every committed `resolved.contract.json` OFFLINE from
 * committed bytes only — the enriched contract, the ledger, the component's
 * own `captured-truth.json` (the referee), the run's minted tree out of
 * `enriched.extension.json`, and the library's token trees. No browser, no
 * npm install, no network. Then it byte-compares. A difference is a NAMED
 * failure with the remedy printed.
 *
 * It also prints, by name, every row the referee could NOT check
 * (`unverified`) — see decisions.ts. Silence is reported, never passed.
 *
 * FALSIFICATION: disable the value guard in `decisions.ts` and this gate
 * re-derives the STALE alias, so the committed corpus drifts and it exits 1
 * naming the rows. Re-point a ledger target at a token that still agrees with
 * the capture and the same row applies again.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import { loadConfig, propSpaceFor } from './capture.js';
import { applyDecisions, refereeCombos, type AckedDecision } from './decisions.js';
import { gateInventory } from './gate.js';
import { measuredTruth, refereeReaderDisagreements } from './measured.js';
import type { CapturedTruthFile } from './replay.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const REPO = path.resolve(HERE, '..', '..');
const CONFIGS = path.join(HERE, 'configs');
const OUT = path.join(HERE, 'out');
const WRITE = process.argv.includes('--write');

interface Row {
  label: string;
  applied: number;
  refused: string[];
  unverified: string[];
  drift: string | null;
  rewritten: boolean;
}

const rows: Row[] = [];
const failures: string[] = [];

for (const file of readdirSync(CONFIGS).filter((f) => f.endsWith('.json')).sort()) {
  const lib = file.replace(/\.json$/, '');
  // The out root is the CLI convention (`--out extract/computed/out/<lib>`);
  // polaris — the first library — sits at the un-namespaced root.
  const outRoot = existsSync(path.join(OUT, lib)) && statSync(path.join(OUT, lib)).isDirectory() ? path.join(OUT, lib) : OUT;
  const cfg = loadConfig(REPO, path.join(CONFIGS, file));
  for (const comp of cfg.components) {
    const outDir = path.join(outRoot, comp.name.toLowerCase());
    const ledgerPath = path.join(outDir, 'decisions.json');
    if (!existsSync(ledgerPath)) continue;
    const label = `${lib}/${comp.name}`;
    const enrichedPath = path.join(outDir, 'enriched.contract.json');
    const resolvedPath = path.join(outDir, 'resolved.contract.json');
    const truthPath = path.join(outDir, 'captured-truth.json');
    const extPath = path.join(outDir, 'enriched.extension.json');
    for (const [what, p] of [['enriched contract', enrichedPath], ['resolved contract', resolvedPath], ['captured truth', truthPath], ['extension block', extPath]] as const) {
      if (!existsSync(p)) {
        failures.push(`${label}: a decisions ledger exists but the ${what} does not (${path.relative(REPO, p)}) — the ledger cannot be re-applied or checked`);
      }
    }
    if (failures.some((f) => f.startsWith(`${label}:`))) continue;

    const decisions = JSON.parse(readFileSync(ledgerPath, 'utf8')) as AckedDecision[];
    // READ THE BYTES, do not re-parse through the schema: `ContractSchema.parse`
    // re-emits object keys in SCHEMA order, and `resolved.contract.json` is
    // written from the in-memory enriched object (source order). Re-ordering
    // here would report drift on all eleven components for a reason that has
    // nothing to do with a decision. The schema check still runs — on the
    // RESULT, below, exactly where run.ts runs it.
    const enriched = JSON.parse(readFileSync(enrichedPath, 'utf8')) as Contract;
    const truth = JSON.parse(readFileSync(truthPath, 'utf8')) as CapturedTruthFile;
    const ext = JSON.parse(readFileSync(extPath, 'utf8')) as { mintedTokens?: Record<string, unknown> };
    // THE REFEREE'S READER IS ITSELF REFEREED. measured.ts addresses the truth
    // file BY PART (a decision names a part, and an off-base capture renumbers
    // paths); replay.ts addresses it by path. Where both can speak they must
    // say the same thing, or the value check is deciding on a misread.
    const readerDrift = refereeReaderDisagreements(truth);
    if (readerDrift.length > 0) {
      failures.push(
        `${label}: the decision referee's reader DISAGREES with replay.ts on ${readerDrift.length} value(s) — the value check would be refereeing a misread:\n      - ${readerDrift.slice(0, 5).join('\n      - ')}`,
      );
      continue;
    }
    const space = propSpaceFor(REPO, cfg, comp);
    // The SAME inventory and the SAME resolver the gate renders with
    // (gate.ts gateInventory) — one function, every caller.
    const { inventory, resolveValue } = gateInventory(REPO, cfg, ext.mintedTokens ?? {});
    const referee = { resolveValue, measured: measuredTruth(truth), combos: refereeCombos(space.enumeration.combos) };

    const derived = structuredClone(enriched);
    const res = applyDecisions(derived, decisions, inventory, referee);
    ContractSchema.parse(derived);
    const bytes = JSON.stringify(derived, null, 2) + '\n';
    const committed = readFileSync(resolvedPath, 'utf8');
    let drift: string | null = null;
    let rewritten = false;
    if (bytes !== committed) {
      if (WRITE) {
        writeFileSync(resolvedPath, bytes);
        rewritten = true;
      } else {
        drift = `${label}: ${path.relative(REPO, resolvedPath)} is NOT its ledger re-applied to its committed enriched contract`;
      }
    }
    rows.push({ label, applied: res.applied.length, refused: res.skipped, unverified: res.unverified, drift, rewritten });
  }
}

let totalApplied = 0;
const totalRefused: string[] = [];
const totalUnverified: string[] = [];
for (const r of rows) {
  totalApplied += r.applied;
  for (const s of r.refused) totalRefused.push(`${r.label}: ${s}`);
  for (const s of r.unverified) totalUnverified.push(`${r.label}: ${s}`);
}

console.log(
  `${totalApplied} decision(s) applied · ${totalRefused.length} refused BY NAME · ${totalUnverified.length} applied UNVERIFIED (named) across ${rows.length} component(s)`,
);
for (const s of totalRefused) console.log(`  ✖ STALE ALIAS REFUSED — ${s}`);
for (const s of totalUnverified) console.log(`  · UNVERIFIED — ${s}`);
if (WRITE && failures.length === 0) {
  const w = rows.filter((r) => r.rewritten);
  console.log(w.length ? `✔ rewrote ${w.length} resolved.contract.json: ${w.map((r) => r.label).join(', ')}` : '✔ every resolved.contract.json was already the ledger re-applied — nothing to write');
  process.exit(0);
}
const drifted = rows.filter((r) => r.drift);
if (drifted.length || failures.length) {
  console.error(`\n✖ extract:computed:decisions:check — ${drifted.length} committed resolved contract(s) are NOT their ledger re-applied:`);
  for (const r of drifted) console.error(`  - ${r.drift}`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error(`\n  REMEDY: npm run extract:computed:decisions:check -- --write   (then re-emit the library: promote + figma:plan + generated surfaces)`);
  process.exit(1);
}
console.log('✔ every committed resolved.contract.json IS its ledger re-applied to its committed enriched contract');

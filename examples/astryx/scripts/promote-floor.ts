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
 * figmaStatePreviews stays OPTED OUT this round (default-state fidelity is
 * the current gate; state cells are the named next class). Deterministic by
 * construction; re-running is byte-stable.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyDecisions, contractRefs, loadDecisions, resolutionGuard } from './reanchor-minted.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.join(HERE, '..');
const REPO = path.join(EX, '..', '..');
const OUT = path.join(REPO, 'extract', 'computed', 'out', 'astryx');

// Switch is EXCLUDED by name this round: the union carried BOTH labelPosition
// orders as unconditioned sibling branches (order-sensitive signature
// matching — the anatomy join's named limitation); promoting it would double
// the rendered content per variant. Its v0.2.0 curated contract ships until
// the union-order round. Banner remains excluded at capture (unsettled
// transition, determinism refusal).
const COMPONENTS = ['button', 'badge', 'card', 'slider'];
// The minted tree unions over ALL captured components — imported.shared.*
// leaves can be minted during ANY component's fusion (Switch minted shared
// sizes other contracts reference); contract promotion and mint sourcing
// are independent decisions.
const MINT_SOURCES = ['button', 'badge', 'card', 'slider', 'switch'];

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
for (const name of COMPONENTS) {
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

  writeFileSync(path.join(EX, 'contracts', `${name}.contract.json`), JSON.stringify(contract, null, 2) + '\n');
  writeFileSync(path.join(EX, 'contracts', `${name}.extension.json`), JSON.stringify(extension, null, 2) + '\n');
  promoted.push(`${name} (${path.basename(src)})`);
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
const reanchor = applyDecisions(mintedMerged, decisions, base, null);
resolutionGuard(mintedMerged, base, refs);

writeFileSync(path.join(EX, 'tokens', 'astryx-minted.dtcg.json'), JSON.stringify(mintedMerged, null, 2) + '\n');
console.log(`✔ floor-promoted ${promoted.length} contract(s) → examples/astryx/contracts (v0.3.0): ${promoted.join(', ')}`);
console.log(`✔ minted tree → examples/astryx/tokens/astryx-minted.dtcg.json`);
console.log(
  `✔ re-anchoring ledger re-applied: ${reanchor.applied} leaf/leaves aliased from ` +
    `tokens/reanchor-decisions.json (${decisions.length} acked row(s)); resolution guard green`,
);

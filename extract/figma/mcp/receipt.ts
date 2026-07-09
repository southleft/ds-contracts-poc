/**
 * DESKTOP-MCP ROUND-TRIP RECEIPT — proof the third rung reaches plugin-dump
 * name fidelity, replayed from RECORDED live responses (no network, no
 * desktop app — CI-safe).
 *
 * Fixtures in extract/figma/mcp/fixtures/ are LIVE recordings made by
 * `npm run extract:figma:mcp -- <url> --fixture <path>` against the Figma
 * desktop app's Dev Mode MCP server (2026-07-08): the raw REST nodes response
 * plus every get_variable_defs response the join requested, keyed by the node
 * id it asked for. replayImport() reruns the exact live code path over them.
 *
 *   BADGE   the contract-generated set (ground truth contracts/badge.contract
 *           .json). Bars: every variable id name-resolved by the value join
 *           (no Enterprise variables endpoint — it 403'd live), zero
 *           map degradations, zero unbound, zero minted, and the EXISTING
 *           comparator (extract/figma/roundtrip.ts) reports ZERO MISMATCH —
 *           i.e. variable-name fidelity equal to the plugin-dump path
 *           (extract/figma/ROUNDTRIP.md) on everything the MCP exposes.
 *
 *   EVENTZ  a FOREIGN, hand-built Alert (DEMO Eventz Design System). No
 *           shipping contract exists, so the bars are recovery receipts:
 *           the foreign vocabulary comes back by NAME (spacing/2, spacing/4,
 *           component/border/radius/rounded-md, …), the U+2024 variable
 *           ("spacing/0․5", ONE DOT LEADER) is REFUSED by the token-ref
 *           grammar — named, never smuggled in — and whatever stayed unbound
 *           ships as provisional imported.* mints, at literal fidelity.
 *
 * Output: extract/figma/mcp/RECEIPT.md (committed receipt) + exit 1 on any
 * failed bar. `npm run extract:figma:mcp:receipt`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { kebab } from '../../types.js';
import { isDumpSet, type DumpSet } from '../types.js';
import { loadTokenCorpus } from '../tokens.js';
import { loadContracts, proposeFromDump, type FigmaProposalResult } from '../propose.js';
import { compareContracts, type Finding } from '../roundtrip.js';
import { replayImport, type AugmentReport, type McpImportFixture } from './import.js';
import type { MapReport } from '../rest/map.js';

type J = Record<string, unknown>;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, 'fixtures');
const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

interface Check {
  ok: boolean;
  label: string;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const corpus = loadTokenCorpus(root);
  const loaded = loadContracts(path.resolve(root, 'contracts'));

  const propose = (set: DumpSet, fileKey: string | null): FigmaProposalResult =>
    proposeFromDump(set, {
      corpus,
      contractIdByName: loaded.byName,
      contractsById: loaded.byId,
      fileKey,
      mintUnbound: true, // the CLI's exact configuration
    });

  // ------------------------------------------------------------------ BADGE
  const badgeFixture = readJson<McpImportFixture>(path.join(FIXTURES, 'badge.mcp.json'));
  const badge = await replayImport(badgeFixture);
  const badgeSet = Object.values(badge.dump).find(isDumpSet);
  if (!badgeSet) throw new Error('badge fixture replay produced no component set');
  const badgeProposal = propose(badgeSet, badgeFixture.fileKey);
  const shipping = readJson<J>(path.resolve(root, 'contracts', `${kebab(badgeSet.setName)}.contract.json`));
  const findings = compareContracts(shipping, badgeProposal.contract, corpus);
  const count = (fs: Finding[], status: Finding['status']) => fs.filter((f) => f.status === status).length;

  const bChecks: Check[] = [];
  const bCheck = (ok: boolean, label: string) => bChecks.push({ ok, label });
  bCheck(badgeFixture.restVariables === undefined, 'Enterprise variables endpoint absent from the recording (it 403’d live) — every name below came from the MCP join');
  bCheck(
    badge.augment.unresolved.length === 0,
    `every variable id name-resolved by the value join (unresolved: ${badge.augment.unresolved.length})`,
  );
  const nodeScoped = badge.augment.resolved.filter((r) => r.via === 'node-scope');
  bCheck(
    nodeScoped.length > 0,
    `per-node scoping disambiguated same-valued variables (${nodeScoped.length} id(s), e.g. danger vs error — both #fee2e2/#b91c1c at set scope)`,
  );
  bCheck(badge.report.degradations.length === 0, `zero map degradations (got ${badge.report.degradations.length})`);
  bCheck(
    badgeProposal.unbound.length === 0 && (badgeProposal.mintedTokens?.count ?? 0) === 0,
    `zero unbound, zero minted — nothing was left for the fallback tiers (unbound ${badgeProposal.unbound.length}, minted ${badgeProposal.mintedTokens?.count ?? 0})`,
  );
  const mismatches = findings.filter((f) => f.status === 'mismatch');
  bCheck(
    mismatches.length === 0,
    `comparator verdict vs contracts/badge.contract.json: ZERO MISMATCH (got ${mismatches.length}) — name fidelity ≥ plugin-dump path`,
  );

  // ----------------------------------------------------------------- EVENTZ
  const eventzFixture = readJson<McpImportFixture>(path.join(FIXTURES, 'eventz-alert.mcp.json'));
  const eventz = await replayImport(eventzFixture);
  const eventzSet = Object.values(eventz.dump).find(isDumpSet);
  if (!eventzSet) throw new Error('eventz fixture replay produced no component set');
  const eventzProposal = propose(eventzSet, eventzFixture.fileKey);

  const eChecks: Check[] = [];
  const eCheck = (ok: boolean, label: string) => eChecks.push({ ok, label });
  const recoveredNames = eventz.augment.resolved.map((r) => r.name);
  for (const name of ['spacing/1', 'spacing/2', 'spacing/3', 'spacing/4', 'component/border/radius/rounded-md', 'color/content/inverse']) {
    eCheck(recoveredNames.includes(name), `foreign vocabulary recovered by name: "${name}"`);
  }
  const oneDotLeaderName = 'spacing/0․5'; // "spacing/0․5" — U+2024 ONE DOT LEADER, not a dot
  eCheck(
    recoveredNames.includes(oneDotLeaderName),
    'the U+2024 variable ("spacing/0․5", ONE DOT LEADER) is itself recovered by name by the join…',
  );
  eCheck(
    eventzProposal.notes.some((n) => n.includes('0․5') && n.includes('token-ref grammar')),
    '…and then REFUSED by the token-ref grammar (binding not proposed, named in notes) — the refusal fires on live foreign data',
  );
  const rootTokens = ((eventzProposal.contract.anatomy as J).root as J).tokens as Record<string, string> | undefined;
  eCheck(
    rootTokens?.['padding-inline'] === '{spacing.4}' &&
      rootTokens?.['padding-block'] === '{spacing.3}' &&
      rootTokens?.['border-radius'] === '{component.border.radius.rounded-md}' &&
      rootTokens?.['gap'] === '{spacing.2}',
    `recovered names BIND in the proposal: root carries {spacing.4} / {spacing.3} / {component.border.radius.rounded-md} / {spacing.2} (got ${JSON.stringify(rootTokens ?? {})})`,
  );
  eCheck(
    eventzProposal.unbound.length === 0 && (eventzProposal.mintedTokens?.count ?? 0) > 0,
    `everything the join could not name still ships at literal fidelity as imported.* mints (${eventzProposal.mintedTokens?.count ?? 0} minted, ${eventzProposal.unbound.length} unbound)`,
  );

  // --------------------------------------------------------------- RECEIPT
  const lines: string[] = [
    '# Desktop-MCP import round-trip receipt',
    '',
    '<!-- GENERATED by extract/figma/mcp/receipt.ts (`npm run extract:figma:mcp:receipt`) — DO NOT EDIT. -->',
    '',
    'Fixtures in `extract/figma/mcp/fixtures/` are RECORDED LIVE responses (Figma desktop Dev Mode MCP server + REST nodes endpoint, 2026-07-08) — `replayImport()` reruns the exact live code path over them, so this receipt is CI-safe and byte-reproducible. The Enterprise-only variables endpoint 403’d during both recordings: every variable name below was recovered through `get_variable_defs` value joins (extract/figma/mcp/import.ts), never guessed — ambiguous joins are receipts, and anything unnamed ships as a provisional `imported.*` mint at literal fidelity.',
    '',
    '## Badge — contract-generated set vs its shipping contract',
    '',
    `| Component | MATCHED | CANVAS-ABSENT | MISMATCH | Verdict |`,
    '|---|---|---|---|---|',
    `| ${badgeSet.setName} | ${count(findings, 'matched')} | ${count(findings, 'canvas-absent')} | ${mismatches.length} | ${mismatches.length === 0 ? '✅ zero mismatch' : '❌ FAIL'} |`,
    '',
  ];
  for (const c of bChecks) lines.push(`- ${c.ok ? '✅' : '❌'} ${c.label}`);
  if (mismatches.length > 0) {
    lines.push('', '### ❌ MISMATCH', '');
    for (const f of mismatches) lines.push(`- **${f.subject}** — ${f.detail ?? ''}`);
  }
  lines.push('', `### Names recovered by the join (${badge.augment.resolved.length} ids, ${badge.augment.defsCalls} get_variable_defs calls)`, '');
  lines.push(...augmentLines(badge.augment));
  const absent = findings.filter((f) => f.status === 'canvas-absent');
  lines.push('', `### CANVAS-ABSENT (${absent.length}) — declared fidelity limits (same list as the plugin-dump receipt)`, '');
  for (const f of absent) lines.push(`- \`${f.subject}\` — ${f.detail}`);

  lines.push('', '## Eventz Alert — foreign, hand-built vocabulary', '');
  for (const c of eChecks) lines.push(`- ${c.ok ? '✅' : '❌'} ${c.label}`);
  lines.push('', `### Names recovered by the join (${eventz.augment.resolved.length} ids, ${eventz.augment.defsCalls} get_variable_defs calls)`, '');
  lines.push(...augmentLines(eventz.augment));
  lines.push('', `### Map degradations (named, never silent)`, '');
  lines.push(...degradationLines(eventz.report));
  lines.push('', `### Proposal notes (review line items, ${eventzProposal.notes.length})`, '');
  for (const n of eventzProposal.notes) lines.push(`- ${n}`);
  lines.push('');

  const outPath = path.join(HERE, 'RECEIPT.md');
  writeFileSync(outPath, lines.join('\n') + '\n');

  // ------------------------------------------------------------------ CLI
  let failed = false;
  const report = (label: string, checks: Check[]) => {
    console.log(`${label}: ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
    for (const c of checks) {
      if (!c.ok) {
        console.log(`  ✗ ${c.label}`);
        failed = true;
      }
    }
  };
  console.log(
    `Badge: MATCHED ${count(findings, 'matched')} · CANVAS-ABSENT ${count(findings, 'canvas-absent')} · MISMATCH ${mismatches.length}`,
  );
  report('Badge bars', bChecks);
  report('Eventz Alert bars', eChecks);
  console.log(`receipt → ${path.relative(root, outPath)}`);
  if (failed) {
    console.error('Desktop-MCP round trip has failures — the bar is zero mismatch, zero silent degradation.');
    process.exit(1);
  }
}

function augmentLines(augment: AugmentReport): string[] {
  const lines: string[] = [];
  for (const r of augment.resolved) {
    lines.push(`- \`${r.variableId}\` → \`${r.name}\` (${r.via}, ${r.occurrences} occurrence(s))`);
  }
  for (const u of augment.unresolved) {
    const at = u.occurrences.map((o) => `\`${o.nodePath}\` ${o.field}`).join(', ');
    lines.push(
      `- ⚠️ \`${u.variableId}\` UNRESOLVED${at ? ` at ${at}` : ''} — ${u.reason}${u.candidates.length > 0 ? ` — candidates by name: ${u.candidates.map((c) => `\`${c}\``).join(', ')}` : ''}`,
    );
  }
  return lines;
}

function degradationLines(report: MapReport): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const d of report.degradations) {
    const key = `${d.code}|${d.field}|${d.message}`;
    if (seen.has(key)) continue; // variants repeat the same facts
    seen.add(key);
    lines.push(`- \`[${d.code}]\` ${d.nodePath}${d.field ? ` \`${d.field}\`` : ''} — ${d.message}`);
  }
  if (lines.length === 0) lines.push('- (none)');
  return lines;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

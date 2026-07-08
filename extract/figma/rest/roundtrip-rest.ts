/**
 * REST ROUND-TRIP RECEIPT — proof that the no-plugin path lands on the same
 * contract the plugin path does, with the same refusal discipline.
 *
 * Two passes over hand-crafted REST fixtures (faithful GetFileNodesResponse
 * renditions of the SAME Badge and Card canvases the plugin dump captured —
 * semantic ground truth: extract/figma/fixtures/main-file-dumps.json):
 *
 *   FULL      nodes + variables responses → mapRestToDump → the EXISTING
 *             proposer (extract/figma/propose.ts) → the EXISTING comparator
 *             (extract/figma/roundtrip.ts compareContracts) against the
 *             shipping contract. Bars: zero MISMATCH, zero map degradations.
 *
 *   DEGRADED  variables response ABSENT (the Enterprise-only endpoint 403s
 *             for most tokens) → every bound fact degrades to its resolved
 *             literal, each named as a `variable-unresolved` report entry.
 *             Bars: the proposal is still schema-valid (propose.ts parses it
 *             or throws), raw fills surface as named UNBOUND entries with
 *             nearest-token candidates, and NOTHING is fabricated — no color
 *             token ref appears anywhere in the degraded proposal.
 *
 * Output: extract/figma/rest/ROUNDTRIP-REST.md (committed receipt) + exit 1
 * on any failed bar. `npm run extract:figma:rest:roundtrip`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { kebab } from '../../types.js';
import { isDumpSet } from '../types.js';
import { loadTokenCorpus } from '../tokens.js';
import { loadContractIdsByName, proposeFromDump, type FigmaProposalResult } from '../propose.js';
import { compareContracts, type Finding } from '../roundtrip.js';
import { mapRestToDump, type MapReport, type RestNodesResponse, type RestVariablesResponse } from './map.js';

type J = Record<string, unknown>;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, 'fixtures');
const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

interface FullResult {
  component: string;
  findings: Finding[];
  mapReport: MapReport;
  proposal: FigmaProposalResult;
  failures: string[];
}

interface DegradedResult {
  component: string;
  mapReport: MapReport;
  proposal: FigmaProposalResult;
  checks: Array<{ ok: boolean; label: string }>;
}

function main() {
  const root = process.cwd();
  const corpus = loadTokenCorpus(root);
  const contractsDir = path.resolve(root, 'contracts');
  const contractIdByName = loadContractIdsByName(contractsDir);
  const variables = readJson<RestVariablesResponse>(path.join(FIXTURES, 'variables.rest.json'));

  const fixtureFiles = ['badge.rest.json', 'card.rest.json'];
  const full: FullResult[] = [];

  // ------------------------------------------------------------------ FULL
  for (const file of fixtureFiles) {
    const nodesResponse = readJson<RestNodesResponse>(path.join(FIXTURES, file));
    const { dump, report } = mapRestToDump(nodesResponse, { variables, fileKey: '8nim1d0IPnehMxA7B7SYxC' });
    for (const [name, value] of Object.entries(dump)) {
      if (name === '_provenance' || !isDumpSet(value)) continue;
      const shipping = readJson<J>(path.join(contractsDir, `${kebab(name)}.contract.json`));
      const proposal = proposeFromDump(value, { corpus, contractIdByName, fileKey: '8nim1d0IPnehMxA7B7SYxC' });
      const findings = compareContracts(shipping, proposal.contract, corpus);
      const failures: string[] = [];
      // With the variables response present, the REST surface carries every
      // fact the plugin dump carried — any degradation here is a mapper bug.
      for (const d of report.degradations) {
        failures.push(`map degradation on the full path: [${d.code}] ${d.nodePath} — ${d.message}`);
      }
      full.push({ component: name, findings, mapReport: report, proposal, failures });
    }
  }

  // -------------------------------------------------------------- DEGRADED
  const badgeNodes = readJson<RestNodesResponse>(path.join(FIXTURES, 'badge.rest.json'));
  const { dump: degradedDump, report: degradedReport } = mapRestToDump(badgeNodes, {
    fileKey: '8nim1d0IPnehMxA7B7SYxC',
  });
  const badgeSet = degradedDump.Badge;
  if (!badgeSet || !isDumpSet(badgeSet)) throw new Error('degraded map lost the Badge set');
  // proposeFromDump parses the contract against ContractSchema — schema
  // validity of the degraded proposal is enforced here, not asserted after.
  const degradedProposal = proposeFromDump(badgeSet, { corpus, contractIdByName, fileKey: null });

  const checks: DegradedResult['checks'] = [];
  const check = (ok: boolean, label: string) => checks.push({ ok, label });

  const unresolved = degradedReport.degradations.filter((d) => d.code === 'variable-unresolved');
  check(unresolved.length > 0, `variables absent → variable-unresolved degradations named (${unresolved.length})`);
  check(
    unresolved.every((d) => /variable id VariableID:\S+ unresolvable/.test(d.message)),
    'every degradation names the exact variable id and the reason (Enterprise endpoint unavailable)',
  );

  const fillUnbound = degradedProposal.unbound.find((u) => u.property === 'fill');
  check(fillUnbound !== undefined, `raw fill surfaced as a named UNBOUND entry (${fillUnbound?.value ?? 'MISSING'})`);
  check(
    (fillUnbound?.suggestions ?? []).includes('color.feedback.info.background'),
    `nearest-token candidates include color.feedback.info.background (got: ${(fillUnbound?.suggestions ?? []).join(', ') || 'none'})`,
  );
  check(
    degradedProposal.unbound.some((u) => u.property === 'padding') &&
      degradedProposal.unbound.some((u) => u.property === 'cornerRadius'),
    'unbound padding and cornerRadius literals reported (bindings degraded, values never tokenized)',
  );
  const proposalJson = JSON.stringify(degradedProposal.contract);
  check(!proposalJson.includes('{color.'), 'zero fabrication: no color token ref anywhere in the degraded proposal');
  const rootTokens = ((degradedProposal.contract.anatomy as J).root as J).tokens as Record<string, string> | undefined;
  check(
    rootTokens?.['font-size'] === '{font.badge.size}',
    `text-style identity survives (styles map is not Enterprise-gated): font-size = ${rootTokens?.['font-size'] ?? '(none)'}`,
  );
  const degraded: DegradedResult = { component: 'Badge', mapReport: degradedReport, proposal: degradedProposal, checks };

  // --------------------------------------------------------------- RECEIPT
  const count = (fs: Finding[], status: Finding['status']) => fs.filter((f) => f.status === status).length;
  const lines: string[] = [
    '# REST → dump → contract round-trip receipt',
    '',
    '<!-- GENERATED by extract/figma/rest/roundtrip-rest.ts (`npm run extract:figma:rest:roundtrip`) — DO NOT EDIT. -->',
    '',
    'Fixtures in `extract/figma/rest/fixtures/` are hand-crafted `GetFileNodesResponse` / `GetLocalVariablesResponse` renditions (shapes per figma/rest-api-spec) of the SAME Badge and Card canvases the plugin dump captured — semantic ground truth: `extract/figma/fixtures/main-file-dumps.json`. `map.ts` maps REST → dump v1; the EXISTING proposer and comparator do the rest. Bars: zero MISMATCH and zero map degradations on the full path; on the degraded path (variables response absent — the endpoint is Enterprise-only) the proposal must stay schema-valid, surface raw values as named UNBOUND entries with nearest-token candidates, and fabricate nothing.',
    '',
    '## Full path (nodes + variables)',
    '',
    '| Component | MATCHED | CANVAS-ABSENT | MISMATCH | Map degradations | Verdict |',
    '|---|---|---|---|---|---|',
  ];
  let failed = false;
  for (const r of full) {
    const m = count(r.findings, 'matched');
    const a = count(r.findings, 'canvas-absent');
    const x = count(r.findings, 'mismatch');
    const bad = x > 0 || r.failures.length > 0;
    if (bad) failed = true;
    lines.push(`| ${r.component} | ${m} | ${a} | ${x} | ${r.failures.length} | ${bad ? '❌ FAIL' : '✅ zero mismatch'} |`);
  }
  lines.push('');
  for (const r of full) {
    const x = r.findings.filter((f) => f.status === 'mismatch');
    if (x.length > 0 || r.failures.length > 0) {
      lines.push(`### ❌ ${r.component}`, '');
      for (const f of x) lines.push(`- **${f.subject}** — ${f.detail ?? ''}`);
      for (const f of r.failures) lines.push(`- **${f}**`);
      lines.push('');
    }
    const a = r.findings.filter((f) => f.status === 'canvas-absent');
    lines.push(`### ${r.component} — CANVAS-ABSENT (${a.length}) — declared fidelity limits`, '');
    for (const f of a) lines.push(`- \`${f.subject}\` — ${f.detail}`);
    lines.push('');
  }

  lines.push('## Degraded path (variables response absent — Enterprise endpoint unavailable)', '');
  for (const c of degraded.checks) {
    if (!c.ok) failed = true;
    lines.push(`- ${c.ok ? '✅' : '❌'} ${c.label}`);
  }
  lines.push('', `### Degradations named by the mapper (${degraded.mapReport.degradations.length})`, '');
  const seen = new Set<string>();
  for (const d of degraded.mapReport.degradations) {
    const key = `${d.code}|${d.field}|${d.message}`;
    if (seen.has(key)) continue; // five variants repeat the same bindings
    seen.add(key);
    lines.push(`- \`[${d.code}]\` ${d.nodePath}${d.field ? ` \`${d.field}\`` : ''} — ${d.message}`);
  }
  lines.push('', `### Unbound values reported by the proposer (never tokenized)`, '');
  for (const u of degraded.proposal.unbound) {
    lines.push(
      `- \`${u.nodePath}\` ${u.property} = \`${u.value}\` — nearest tokens: ${u.suggestions.map((s) => `\`{${s}}\``).join(', ') || '(none)'}`,
    );
  }
  lines.push('');

  const outPath = path.join(HERE, 'ROUNDTRIP-REST.md');
  writeFileSync(outPath, lines.join('\n') + '\n');

  // ------------------------------------------------------------------ CLI
  for (const r of full) {
    const x = count(r.findings, 'mismatch');
    console.log(
      `${r.component}: MATCHED ${count(r.findings, 'matched')} · CANVAS-ABSENT ${count(r.findings, 'canvas-absent')} · MISMATCH ${x} · map degradations ${r.failures.length}`,
    );
    for (const f of r.findings.filter((f) => f.status === 'mismatch')) console.log(`  ✗ ${f.subject} — ${f.detail ?? ''}`);
    for (const f of r.failures) console.log(`  ✗ ${f}`);
  }
  console.log(`Badge (degraded): ${degraded.checks.filter((c) => c.ok).length}/${degraded.checks.length} checks`);
  for (const c of degraded.checks) if (!c.ok) console.log(`  ✗ ${c.label}`);
  console.log(`receipt → ${path.relative(root, outPath)}`);
  if (failed) {
    console.error('REST round trip has failures — the bar is zero mismatch, zero silent degradation.');
    process.exit(1);
  }
}

main();

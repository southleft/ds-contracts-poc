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
 *   MINTED    the same degraded dump proposed with `mintUnbound: true`
 *             (core/mint-tokens.ts). Bars: every previously-unbound value is
 *             now BOUND to a provisional `imported.*` ref (zero UNBOUND
 *             entries), zero semantic-looking names (no minted ref outside
 *             the `imported.` namespace, nothing outside the repo inventory
 *             fabricated), every minted ref noted as provisional, and the
 *             proposal GENERATES: emitReact + emitHtml run green with an
 *             inventory of repo trees + the minted tree, the emitted css
 *             referencing the minted custom properties whose literal values
 *             ride mintedTokenCss.
 *
 * Output: extract/figma/rest/ROUNDTRIP-REST.md (committed receipt) + exit 1
 * on any failed bar. `npm run extract:figma:rest:roundtrip`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContractSchema, type Contract } from '../../../scripts/contract-schema.js';
import { emitHtml } from '../../../core/emit-html.js';
import { emitReact } from '../../../core/emit-react.js';
import { MINT_NAMESPACE, mintedTokenCss } from '../../../core/mint-tokens.js';
import { tokenInventoryFromJson } from '../../../core/tokens.js';
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

  // ------------------------------------------------------ DEGRADED + MINTED
  // The same degraded dump, with provisional minting on: styles must survive
  // at literal fidelity through machine-named imported.* tokens — and nothing
  // may look semantic.
  const mintedProposal = proposeFromDump(badgeSet, { corpus, contractIdByName, fileKey: null, mintUnbound: true });
  const mChecks: DegradedResult['checks'] = [];
  const mCheck = (ok: boolean, label: string) => mChecks.push({ ok, label });

  const mintedTokens = mintedProposal.mintedTokens;
  const entries = mintedTokens?.entries ?? [];
  mCheck(mintedTokens !== undefined && mintedTokens.count > 0, `provisional tree minted (${mintedTokens?.count ?? 0} leaves)`);
  mCheck(
    mintedProposal.unbound.length === 0,
    `every previously-unbound value is bound to a minted ref (UNBOUND entries: ${mintedProposal.unbound.length})`,
  );
  mCheck(
    entries.length > 0 && entries.every((e) => e.ref.startsWith(`{${MINT_NAMESPACE}.`)),
    'zero semantic-looking names: every minted ref lives under the imported. namespace',
  );
  mCheck(
    entries.every((e) => mintedProposal.notes.some((n) => n.includes(e.ref) && n.includes('rename against your real tokens (provisional)'))),
    'every minted ref lands in notes as provisional (rename against your real tokens)',
  );

  // Nothing fabricated: every token ref in the proposal resolves through the
  // repo inventory or the imported namespace — no third vocabulary exists.
  const readRootJson = (rel: string) => readJson<Record<string, unknown>>(path.resolve(root, rel));
  const repoTrees = [
    readRootJson('tokens/primitives.tokens.json'),
    readRootJson('tokens/semantic.tokens.json'),
    readRootJson('tokens/modes/semantic.light.tokens.json'),
    readRootJson('tokens/modes/semantic.dark.tokens.json'),
  ];
  const repoInventory = tokenInventoryFromJson(repoTrees);
  const enumValues = new Map<string, string[]>(
    (mintedProposal.contract.props as Array<{ name: string; type: unknown }>)
      .filter((p): p is { name: string; type: { enum: string[] } } => typeof p.type === 'object' && p.type !== null && 'enum' in (p.type as object))
      .map((p) => [p.name, p.type.enum]),
  );
  const collectRefs = (node: unknown, out: string[]): string[] => {
    if (!node || typeof node !== 'object') return out;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'tokens' && value && typeof value === 'object') out.push(...Object.values(value as Record<string, string>));
      else collectRefs(value, out);
    }
    return out;
  };
  const resolvable = collectRefs(mintedProposal.contract.anatomy, []).every((r) => {
    const p = r.slice(1, -1);
    if (p.startsWith(`${MINT_NAMESPACE}.`)) return true;
    const ph = p.match(/\{([a-z][\w-]*)\}/);
    if (!ph) return repoInventory.has(p);
    return (enumValues.get(ph[1]) ?? []).every((v) => repoInventory.has(p.replaceAll(`{${ph[1]}}`, v)));
  });
  mCheck(resolvable, 'every anatomy binding resolves through the repo inventory or imported.* — nothing fabricated');

  // The proposal GENERATES: schema-parse (already enforced by proposeFromDump),
  // then emitReact + emitHtml with an inventory of repo trees + the minted tree.
  let generated: { css: string } | null = null;
  let generationError = '';
  try {
    const parsed: Contract = ContractSchema.parse(mintedProposal.contract);
    const emitCtx = {
      tokens: tokenInventoryFromJson([...repoTrees, mintedTokens?.tree ?? {}]),
      icons: new Map<string, string>(),
      contracts: new Map([[parsed.id, parsed]]),
    };
    emitReact(parsed, emitCtx);
    generated = { css: emitHtml(parsed, emitCtx).css };
  } catch (e) {
    generationError = String(e);
  }
  mCheck(generated !== null, `emitReact + emitHtml run green with repo + minted trees${generationError ? ` — ${generationError}` : ''}`);
  const mintedCssVars = mintedTokenCss(mintedTokens?.tree ?? {});
  mCheck(
    generated !== null && entries.some((e) => generated!.css.includes(`var(--${e.ref.slice(1, -1).split('.').join('-')})`)),
    'emitted css references the minted custom properties',
  );
  mCheck(
    entries.every((e) => mintedCssVars.includes(`--${e.ref.slice(1, -1).split('.').join('-')}: ${e.value};`)),
    'mintedTokenCss renders every literal the bindings resolve to (styles survive at literal fidelity)',
  );

  // --------------------------------------------------------------- RECEIPT
  const count = (fs: Finding[], status: Finding['status']) => fs.filter((f) => f.status === status).length;
  const lines: string[] = [
    '# REST → dump → contract round-trip receipt',
    '',
    '<!-- GENERATED by extract/figma/rest/roundtrip-rest.ts (`npm run extract:figma:rest:roundtrip`) — DO NOT EDIT. -->',
    '',
    'Fixtures in `extract/figma/rest/fixtures/` are hand-crafted `GetFileNodesResponse` / `GetLocalVariablesResponse` renditions (shapes per figma/rest-api-spec) of the SAME Badge and Card canvases the plugin dump captured — semantic ground truth: `extract/figma/fixtures/main-file-dumps.json`. `map.ts` maps REST → dump v1; the EXISTING proposer and comparator do the rest. Bars: zero MISMATCH and zero map degradations on the full path; on the degraded path (variables response absent — the endpoint is Enterprise-only) the proposal must stay schema-valid, surface raw values as named UNBOUND entries with nearest-token candidates, and fabricate nothing. A third pass re-proposes the degraded dump with `mintUnbound: true` (core/mint-tokens.ts): every unbound value must bind to a provisional machine-named `imported.*` token, zero semantic-looking names, and the proposal must GENERATE (emitReact + emitHtml) against repo trees + the minted tree.',
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

  lines.push('## Degraded path with minting (`mintUnbound: true`)', '');
  for (const c of mChecks) {
    if (!c.ok) failed = true;
    lines.push(`- ${c.ok ? '✅' : '❌'} ${c.label}`);
  }
  lines.push('', `### Minted provisional tokens (${entries.length} leaves — every name machine-derived, every one a rename candidate)`, '');
  for (const e of entries) {
    lines.push(`- \`${e.ref}\` = \`${e.value}\` — bound at ${e.usageSites.map((s) => `\`${s}\``).join(', ')}`);
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
  console.log(`Badge (degraded + minted): ${mChecks.filter((c) => c.ok).length}/${mChecks.length} checks · ${entries.length} minted leaves`);
  for (const c of mChecks) if (!c.ok) console.log(`  ✗ ${c.label}`);
  console.log(`receipt → ${path.relative(root, outPath)}`);
  if (failed) {
    console.error('REST round trip has failures — the bar is zero mismatch, zero silent degradation.');
    process.exit(1);
  }
}

main();

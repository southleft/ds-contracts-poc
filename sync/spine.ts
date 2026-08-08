/**
 * SYNC SPINE — the one-shot headless drift run (SYNC LAYER STEP 2).
 *
 *   npm run sync:spine                          # live (FIGMA_TOKEN), plan mode
 *   npm run sync:spine -- --fixture sync/fixtures/canvas.rest.fixture.json \
 *                          --ledger sync/fixtures/ledger.fixture.json      # offline twin
 *   npm run sync:spine -- --only polaris.avatar --open-pr                  # ONE real PR
 *
 * The run: observe (sync/ledger.ts arithmetic) → for every CANVAS-AHEAD (and
 * conflict) record, `pull` the set into a reviewable proposal bundle
 * (sync/pull.ts) and shape it as a PR: branch suggestion `sync-spine/<slug>`,
 * the commit-ready file set (proposed contract at its real path + the
 * envelope-v2 sidecars: minted token tree, auto-proposed child stubs), and a
 * PR body draft (drift table + per-property classification + the honesty copy
 * about inversion-vs-roundtrip). For every CODE-AHEAD record the canvas is
 * BEHIND: the spine regenerates the .figma.js + JSON bundle where the
 * first-party engine can (refusals named), and prints the
 * "canvas is behind: publish+apply needed" row — the existing publish/apply
 * transport does the rest; no new transport here.
 *
 * NOTHING IS APPLIED. Output is files under sync/out/<runId>/ and stdout.
 * Opening a PR is opt-in (`--open-pr`, gh CLI must be authenticated) and
 * capped (`--max-prs`, default 1).
 *
 * ECHO SAFETY (no duplicate PRs per drift): a spine-created PR records in its
 * BODY the ledger + observed fingerprints it was based on (the HTML-comment
 * marker), and the spine keeps a cursor (sync/out/state.json) keyed by ledger
 * record: a record whose CURRENT observed fingerprints equal the cursor's is
 * skipped by name — the drift is already on review. A canvas that moves AGAIN
 * after the PR produces new fingerprints and is pulled again (the branch-
 * exists check then refuses politely until the open PR is resolved).
 *
 * Exit codes, gate-style like `sync observe`: 0 clean, 1 drift, 2 usage.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { RestNodesResponse, RestVariablesResponse } from '../extract/figma/rest/map.js';
import { fetchVariables } from '../extract/figma/rest/fetch.js';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { createFigmaEngine } from '../core/emit-figma-script.js';
import { componentIdSlug } from '../core/propose-figma.js';
import {
  driftReport,
  recordKey,
  type DriftRow,
  type LedgerRecord,
  type SetObservation,
  type SyncLedger,
} from './ledger.js';
import { DEFAULT_LEDGER_PATH, loadLedger } from './ledger-io.js';
import {
  fetchNodesResponses,
  observationsFromFixture,
  observationsFromRestNodes,
  type ObservationFixture,
} from './observe.js';
import { currentContractHashes, pullRecord, type PullOutcome } from './pull.js';

const ROOT = process.cwd();

// ---------------------------------------------------------------------------
// argv
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name: string): boolean => args.includes(`--${name}`);

function usage(msg?: string): never {
  if (msg) console.error(`✘ ${msg}`);
  console.error(
    'Usage: tsx sync/spine.ts [--fixture <fixture.json>] [--ledger <path>] [--file-key K]\n' +
      '  [--only id[,id…]] [--out sync/out] [--run-id id] [--state <state.json>]\n' +
      '  [--open-pr] [--base <branch>] [--max-prs N]',
  );
  process.exit(2);
}

// ---------------------------------------------------------------------------
// The cursor — sync/out/state.json (echo safety across runs).
// ---------------------------------------------------------------------------

interface CursorEntry {
  branch: string;
  prUrl: string | null;
  openedAt: string;
  basedOn: {
    ledgerStamp: string | null;
    ledgerBaseline: string | null;
    observedStamp: string | null;
    observedDump: string | null;
    fileVersionId: string | null;
  };
}
interface SpineState {
  version: 1;
  entries: Record<string, CursorEntry>;
}

function loadState(p: string): SpineState {
  if (!existsSync(p)) return { version: 1, entries: {} };
  const raw = JSON.parse(readFileSync(p, 'utf8')) as SpineState;
  if (raw.version !== 1 || typeof raw.entries !== 'object' || raw.entries === null)
    usage(`${p} is not a spine state file (version 1 with an entries map)`);
  return raw;
}

// ---------------------------------------------------------------------------
// PR plan shaping
// ---------------------------------------------------------------------------

interface PrFilePlan {
  destPath: string; // repo-relative
  contents: string;
  kind: 'contract' | 'tokens' | 'stub-contract';
}
interface PrPlan {
  key: string;
  contractId: string;
  branch: string;
  title: string;
  files: PrFilePlan[];
  bodyPath: string; // absolute path of PR.md
  body: string;
  basedOn: CursorEntry['basedOn'];
}

function markerLine(key: string, basedOn: CursorEntry['basedOn']): string {
  return (
    `<!-- ds-contracts sync-spine: key=${key} ` +
    `ledger-stamp=${basedOn.ledgerStamp ?? 'none'} ledger-baseline=${basedOn.ledgerBaseline ?? 'none'} ` +
    `observed-stamp=${basedOn.observedStamp ?? 'none'} observed-dump=${basedOn.observedDump ?? 'none'} ` +
    `file-version=${basedOn.fileVersionId ?? 'none'} -->`
  );
}

function buildPrPlan(
  record: LedgerRecord,
  row: DriftRow,
  outcome: PullOutcome,
  fileVersionId: string | null,
): PrPlan {
  const slug = outcome.slug;
  const contractDir = record.contractPath ? path.posix.dirname(record.contractPath) : 'contracts';
  const files: PrFilePlan[] = [];
  if (outcome.proposedContract && record.contractPath) {
    files.push({
      destPath: record.contractPath,
      contents: JSON.stringify(outcome.proposedContract, null, 2) + '\n',
      kind: 'contract',
    });
  }
  if (outcome.minted) {
    files.push({
      destPath: `${contractDir}/${slug}.sync-minted.dtcg.json`,
      contents: JSON.stringify(outcome.minted.tree, null, 2) + '\n',
      kind: 'tokens',
    });
  }
  for (const stub of outcome.childStubs) {
    const stubId = String((stub as { id?: unknown }).id ?? 'stub');
    files.push({
      destPath: `${contractDir}/${componentIdSlug(stubId)}.stub.contract.proposed.json`,
      contents: JSON.stringify(stub, null, 2) + '\n',
      kind: 'stub-contract',
    });
  }
  const basedOn: CursorEntry['basedOn'] = {
    ledgerStamp: record.canvasFingerprint,
    ledgerBaseline: record.observed?.dumpFingerprint ?? null,
    observedStamp: outcome.observation?.stamp ?? null,
    observedDump: outcome.observation?.dumpFingerprint ?? null,
    fileVersionId,
  };
  const counts = {
    matched: outcome.findings.filter((f) => f.status === 'matched').length,
    absent: outcome.findings.filter((f) => f.status === 'canvas-absent').length,
    mismatch: outcome.findings.filter((f) => f.status === 'mismatch').length,
  };
  const body = [
    markerLine(outcome.key, basedOn),
    '',
    `# Canvas → code: proposed contract for \`${record.contractId}\``,
    '',
    `The sync spine observed **${row.status}** drift for \`${record.contractId}\` ` +
      `(Figma file \`${record.fileKey ?? '?'}\`, set \`${record.setNodeId ?? '?'}\`).`,
    '',
    '## Drift (sync observe)',
    '',
    '| fact | value |',
    '|---|---|',
    `| status | ${row.status} |`,
    `| canvas evidence | ${row.canvasEvidence} |`,
    `| ledger stamp at last sync | \`${basedOn.ledgerStamp ?? 'none'}\` |`,
    `| ledger observation baseline | \`${basedOn.ledgerBaseline ?? 'none'}\` |`,
    `| observed stamp now | \`${basedOn.observedStamp ?? 'none'}\` |`,
    `| observed dump fingerprint now | \`${basedOn.observedDump ?? 'none'}\` |`,
    ...row.notes.map((n) => `| note | ${n.replaceAll('|', '\\|')} |`),
    ...(row.status === 'conflict'
      ? [
          '',
          '**CONFLICT** — the code half moved too (the contract hash no longer matches the ledger). ' +
            'Resolve which side wins before adopting; merging this PR takes the canvas side.',
        ]
      : []),
    '',
    '## Per-property classification (proposal vs current contract)',
    '',
    `${counts.matched} matched · ${counts.absent} canvas-absent (declared fidelity limits) · ${counts.mismatch} mismatch`,
    '',
    '| status | subject | detail |',
    '|---|---|---|',
    ...(outcome.findings.length > 0
      ? outcome.findings.map(
          (f) => `| ${f.status} | ${f.subject} | ${(f.detail ?? '').replaceAll('|', '\\|')} |`,
        )
      : ['| — | (no comparator output — see notes) | |']),
    '',
    '## Honesty — this is an inversion, not a round trip',
    '',
    'This proposed contract is a **reviewable inversion** of what the headless REST surface could read ' +
      'off the canvas (`projectionMode: reviewable-inversion`; unbound canvas values are minted as ' +
      'provisional `imported.*` tokens rather than guessed into semantic names). It is NOT a proven ' +
      'round trip of the shipping contract: a mismatch row can be a designer edit **or** a read limit of ' +
      'the import route (variables degradation, REST captureGaps — named in the proposal notes). ' +
      'Review every row; nothing in this PR was invented.',
    '',
    '## Proposal notes',
    '',
    ...(outcome.proposalNotes.length > 0 ? outcome.proposalNotes.map((n) => `- ${n}`) : ['- none']),
    `- ${outcome.corpusNote}`,
    `- unbound values: ${outcome.unboundCount}; minted tokens: ${outcome.minted?.count ?? 0}`,
    '',
    '## Files in this PR',
    '',
    ...files.map((f) => `- \`${f.destPath}\` (${f.kind})`),
    '',
    '## After merging',
    '',
    '1. Re-baseline the sync ledger so the next observation records the adoption: ' +
      '`npm run sync:observe -- --update` (or `ds-contracts figma receive --apply` when landing via the envelope path).',
    '2. Regenerate code surfaces from the adopted contract (`ds-contracts generate …`).',
    '',
    '_Opened by the sync spine (sync/spine.ts). The fingerprint marker at the top is how the spine avoids ' +
      'opening a duplicate PR for this same drift._',
  ].join('\n');
  return {
    key: outcome.key,
    contractId: record.contractId,
    branch: `sync-spine/${slug}`,
    title: `sync-spine: canvas → code proposal for ${record.contractId}`,
    files,
    bodyPath: path.join(outcome.dir, 'PR.md'),
    body,
    basedOn,
  };
}

// ---------------------------------------------------------------------------
// Code-ahead half — the canvas is BEHIND; regenerate what publish would send.
// ---------------------------------------------------------------------------

interface CodeBehindRow {
  key: string;
  contractId: string;
  detail: string;
  files: string[]; // run-dir-relative regenerated artifacts
}

let firstPartyEngine: ReturnType<typeof createFigmaEngine> | null = null;
let firstPartyContracts: Map<string, Contract> | null = null;

function repoEngine(): { engine: ReturnType<typeof createFigmaEngine>; byId: Map<string, Contract> } {
  if (!firstPartyEngine || !firstPartyContracts) {
    const read = (p: string) =>
      JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')) as Record<string, unknown>;
    const brandNames = ['default'];
    firstPartyEngine = createFigmaEngine({
      tokens: {
        primitives: read('tokens/primitives.tokens.json'),
        semantic: read('tokens/semantic.tokens.json'),
        light: read('tokens/modes/semantic.light.tokens.json'),
        dark: read('tokens/modes/semantic.dark.tokens.json'),
        brands: Object.fromEntries(brandNames.map((n) => [n, read(`tokens/modes/brand.${n}.tokens.json`)])),
      },
      icons: new Map(),
    });
    firstPartyContracts = new Map();
    for (const f of readdirSyncSafe(path.join(ROOT, 'contracts'))) {
      if (!f.endsWith('.contract.json')) continue;
      try {
        const c = ContractSchema.parse(read(path.join('contracts', f)));
        firstPartyContracts.set(c.id, c);
      } catch {
        /* non-contract json — skip */
      }
    }
  }
  return { engine: firstPartyEngine, byId: firstPartyContracts };
}

function readdirSyncSafe(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function regenerateCodeBehind(record: LedgerRecord, row: DriftRow, runDir: string): CodeBehindRow {
  const slug = componentIdSlug(record.contractId);
  const dir = path.join(runDir, slug);
  const files: string[] = [];
  const details: string[] = [];
  if (row.notes.some((n) => n.includes('publish pending apply')))
    details.push('a publish is already pending apply');
  const abs = record.contractPath ? path.resolve(ROOT, record.contractPath) : null;
  if (!abs || !existsSync(abs)) {
    return {
      key: recordKey(record),
      contractId: record.contractId,
      detail: `contract ${record.contractPath ?? '(none)'} is not on disk — nothing to regenerate`,
      files,
    };
  }
  mkdirSync(dir, { recursive: true });
  const contractRaw = JSON.parse(readFileSync(abs, 'utf8')) as Record<string, unknown>;
  // The JSON-only bundle needs no engine — the transport the plugin already
  // accepts (`ds-contracts figma push` / paste into the plugin).
  const bundlePath = path.join(dir, `${slug}.bundle.json`);
  writeFileSync(
    bundlePath,
    JSON.stringify({ type: 'CONTRACTS-BUNDLE', version: 1, contracts: [contractRaw] }, null, 2) + '\n',
  );
  files.push(path.relative(runDir, bundlePath));
  // The .figma.js script: first-party contracts re-emit through the repo
  // engine; example libraries own their emit pipeline (rem conversion, alias
  // flattening…) — pointed at by name, never re-spelled here.
  const rel = record.contractPath!.replaceAll(path.sep, '/');
  const libMatch = rel.match(/^examples\/([^/]+)\//);
  if (libMatch && existsSync(path.join(ROOT, 'examples', libMatch[1], 'generate.ts'))) {
    details.push(
      `regenerate the .figma.js via the library pipeline: npx tsx examples/${libMatch[1]}/generate.ts`,
    );
  } else {
    try {
      const { engine, byId } = repoEngine();
      const contract = ContractSchema.parse(contractRaw);
      const script = engine.buildComponentScript(contract, byId, record.fileKey ?? undefined);
      const scriptPath = path.join(dir, `${slug}.figma.js`);
      writeFileSync(scriptPath, script);
      files.push(path.relative(runDir, scriptPath));
    } catch (e) {
      details.push(
        `figma.js regeneration refused: ${String(e instanceof Error ? e.message : e)} — publish from the library's own pipeline`,
      );
    }
  }
  return {
    key: recordKey(record),
    contractId: record.contractId,
    detail:
      `canvas is behind: publish+apply needed` + (details.length > 0 ? ` (${details.join('; ')})` : ''),
    files,
  };
}

// ---------------------------------------------------------------------------
// --open-pr via the authenticated gh CLI (no local checkout is touched).
// ---------------------------------------------------------------------------

function gh(argv: string[]): string {
  return execFileSync('gh', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function openPr(plan: PrPlan, baseFlag: string | undefined): { prUrl: string } {
  const repo = gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
  let base =
    baseFlag ??
    execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
  let baseSha: string;
  try {
    baseSha = gh(['api', `repos/${repo}/git/ref/heads/${base}`, '--jq', '.object.sha']);
  } catch (e) {
    if (baseFlag) throw new Error(`--base ${base} does not exist on ${repo}: ${String(e)}`);
    const fallback = gh(['repo', 'view', '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name']);
    console.log(`  base branch ${base} is not on the remote — falling back to default branch ${fallback}`);
    base = fallback;
    baseSha = gh(['api', `repos/${repo}/git/ref/heads/${base}`, '--jq', '.object.sha']);
  }
  // Echo safety, second belt: an existing spine branch means an open (or
  // unresolved) spine PR — refuse by name instead of stacking a duplicate.
  let branchExists = false;
  try {
    gh(['api', `repos/${repo}/git/ref/heads/${plan.branch}`]);
    branchExists = true;
  } catch {
    /* 404 — free to create */
  }
  if (branchExists) {
    throw new Error(
      `branch ${plan.branch} already exists on ${repo} — an earlier spine PR for ${plan.contractId} is unresolved; ` +
        'merge/close it (and delete the branch) before opening a new one',
    );
  }
  gh(['api', '-X', 'POST', `repos/${repo}/git/refs`, '-f', `ref=refs/heads/${plan.branch}`, '-f', `sha=${baseSha}`]);
  for (const f of plan.files) {
    let sha: string | null = null;
    try {
      sha = gh(['api', `repos/${repo}/contents/${f.destPath}?ref=${encodeURIComponent(plan.branch)}`, '--jq', '.sha']);
    } catch {
      sha = null; // new file on this branch
    }
    gh([
      'api',
      '-X',
      'PUT',
      `repos/${repo}/contents/${f.destPath}`,
      '-f',
      `message=sync-spine: ${plan.contractId} — canvas → code proposal (${f.kind})`,
      '-f',
      `branch=${plan.branch}`,
      '-f',
      `content=${Buffer.from(f.contents, 'utf8').toString('base64')}`,
      ...(sha ? ['-f', `sha=${sha}`] : []),
    ]);
    console.log(`  ${sha ? 'updated' : 'created'} ${f.destPath} on ${plan.branch}`);
  }
  const prUrl = gh([
    'pr',
    'create',
    '--repo',
    repo,
    '--head',
    plan.branch,
    '--base',
    base,
    '--title',
    plan.title,
    '--body-file',
    plan.bodyPath,
  ]);
  return { prUrl: prUrl.split('\n').pop() ?? prUrl };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  const ledgerPath = flag('ledger') ?? DEFAULT_LEDGER_PATH;
  if (!existsSync(path.resolve(ROOT, ledgerPath)))
    usage(`no ledger at ${ledgerPath} — run \`npm run sync -- seed\` first`);
  const ledger: SyncLedger = loadLedger(path.resolve(ROOT, ledgerPath));
  const fixturePath = flag('fixture');
  const fileKeyFilter = flag('file-key');
  const only = flag('only')?.split(',').map((s) => s.trim()).filter(Boolean);
  const outRoot = path.resolve(ROOT, flag('out') ?? path.join('sync', 'out'));
  const runId = flag('run-id') ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const runDir = path.join(outRoot, runId);
  const statePath = path.resolve(ROOT, flag('state') ?? path.join(outRoot, 'state.json'));
  const openPrWanted = has('open-pr');
  const maxPrs = Number(flag('max-prs') ?? '1');
  if (!Number.isInteger(maxPrs) || maxPrs < 1) usage('--max-prs must be a positive integer');

  // -- gather canvas state (fixture or live) --------------------------------
  const responsesByFile = new Map<string, RestNodesResponse[]>();
  const versionByFile = new Map<string, string | null>();
  const variablesByFile = new Map<string, RestVariablesResponse | undefined>();
  let observations: SetObservation[] = [];
  let fileKeys: Set<string> | undefined;
  let token: string | undefined;
  if (fixturePath) {
    const fixture = JSON.parse(
      readFileSync(path.resolve(ROOT, fixturePath), 'utf8'),
    ) as ObservationFixture;
    observations = observationsFromFixture(fixture);
    const fk = fixture.fileKey ?? '(no-file)';
    responsesByFile.set(fk, [fixture.response]);
    versionByFile.set(fk, fixture.fileVersionId);
    fileKeys = fixture.fileKey ? new Set([fixture.fileKey]) : undefined;
  } else {
    token = process.env.FIGMA_TOKEN;
    if (!token)
      usage('live spine needs FIGMA_TOKEN (source .env) — or pass --fixture <file> for the offline path');
    const byFile = new Map<string, string[]>();
    for (const r of ledger.records) {
      if (!r.fileKey || !r.setNodeId) continue;
      if (fileKeyFilter && r.fileKey !== fileKeyFilter) continue;
      const ids = byFile.get(r.fileKey) ?? [];
      ids.push(r.setNodeId);
      byFile.set(r.fileKey, ids);
    }
    if (byFile.size === 0)
      usage(`no ledger records carry a fileKey${fileKeyFilter ? ` matching ${fileKeyFilter}` : ''}`);
    for (const [fk, ids] of byFile) {
      const { responses, fileVersionId } = await fetchNodesResponses(fk, ids, token);
      responsesByFile.set(fk, responses);
      versionByFile.set(fk, fileVersionId);
      for (const response of responses)
        observations.push(...observationsFromRestNodes(response, fk, fileVersionId));
    }
    fileKeys = new Set(byFile.keys());
  }

  // -- the drift arithmetic -------------------------------------------------
  const scopedRecords = fileKeys
    ? ledger.records.filter((r) => r.fileKey !== null && fileKeys!.has(r.fileKey))
    : ledger.records;
  const hashes = currentContractHashes(ROOT, scopedRecords);
  const report = driftReport(ledger, hashes, observations, fileKeys ? { fileKeys } : {});
  const rows = only
    ? report.rows.filter((r) => only.includes(r.contractId))
    : report.rows;
  if (only && rows.length === 0)
    usage(`--only ${only.join(',')} matches no scoped ledger record`);
  const recordByKey = new Map(ledger.records.map((r) => [recordKey(r), r]));
  const obsByNode = new Map(
    observations.map((o) => [`${o.fileKey ?? '(no-file)'}#${o.setNodeId}`, o]),
  );

  mkdirSync(runDir, { recursive: true });
  const state = loadState(statePath);

  // -- canvas-ahead (and conflict): pull → PR-shaped bundle -----------------
  const canvasRows = rows.filter((r) => r.status === 'canvas-ahead' || r.status === 'conflict');
  const skips: Array<{ key: string; reason: string }> = [];
  const plans: PrPlan[] = [];
  const pulls: PullOutcome[] = [];
  for (const row of canvasRows) {
    const record = recordByKey.get(row.key)!;
    const obs = record.setNodeId
      ? obsByNode.get(`${record.fileKey ?? '(no-file)'}#${record.setNodeId}`)
      : undefined;
    const cursor = state.entries[row.key];
    if (
      cursor &&
      cursor.basedOn.observedStamp === (obs?.stamp ?? null) &&
      cursor.basedOn.observedDump === (obs?.dumpFingerprint ?? null)
    ) {
      skips.push({
        key: row.key,
        reason:
          `already PR'd — ${cursor.prUrl ?? cursor.branch} was opened for exactly this drift ` +
          `(observed ${cursor.basedOn.observedStamp ?? 'none'} / ${cursor.basedOn.observedDump ?? 'none'}; ` +
          `cursor ${path.relative(ROOT, statePath)})`,
      });
      continue;
    }
    const fk = record.fileKey ?? '(no-file)';
    const responses = responsesByFile.get(fk) ?? [];
    const response = responses.find((r) => record.setNodeId !== null && r.nodes?.[record.setNodeId]);
    if (!response) {
      skips.push({ key: row.key, reason: 'set node absent from every fetched nodes response' });
      continue;
    }
    // Variables ride the live route only, fetched at most once per file and
    // degrading silently to minted literals (named by the proposer).
    if (token && !variablesByFile.has(fk) && record.fileKey) {
      variablesByFile.set(fk, await fetchVariables(record.fileKey, token).catch(() => undefined));
    }
    const outcome = pullRecord({
      record,
      row,
      response,
      fileVersionId: versionByFile.get(fk) ?? null,
      variables: variablesByFile.get(fk),
      root: ROOT,
      runDir,
    });
    pulls.push(outcome);
    if (outcome.status === 'pulled') {
      const plan = buildPrPlan(record, row, outcome, versionByFile.get(fk) ?? null);
      writeFileSync(plan.bodyPath, plan.body + '\n');
      writeFileSync(
        path.join(outcome.dir, 'plan.json'),
        JSON.stringify(
          {
            branch: plan.branch,
            title: plan.title,
            files: plan.files.map((f) => ({ destPath: f.destPath, kind: f.kind })),
            basedOn: plan.basedOn,
          },
          null,
          2,
        ) + '\n',
      );
      plans.push(plan);
    }
  }

  // -- code-ahead: the canvas is behind -------------------------------------
  const codeRows = rows.filter((r) => r.status === 'code-ahead');
  const codeBehind: CodeBehindRow[] = codeRows.map((row) =>
    regenerateCodeBehind(recordByKey.get(row.key)!, row, runDir),
  );

  // -- open PRs (opt-in, capped) --------------------------------------------
  const opened: Array<{ key: string; prUrl: string }> = [];
  const prFailures: Array<{ key: string; error: string }> = [];
  if (openPrWanted) {
    for (const plan of plans.slice(0, maxPrs)) {
      try {
        const { prUrl } = openPr(plan, flag('base'));
        opened.push({ key: plan.key, prUrl });
        state.entries[plan.key] = {
          branch: plan.branch,
          prUrl,
          openedAt: new Date().toISOString(),
          basedOn: plan.basedOn,
        };
        mkdirSync(path.dirname(statePath), { recursive: true });
        writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
        console.log(`✔ opened ${prUrl} (${plan.contractId}) — cursor updated`);
      } catch (e) {
        prFailures.push({ key: plan.key, error: String(e instanceof Error ? e.message : e) });
        console.error(`✘ PR for ${plan.contractId} failed: ${String(e instanceof Error ? e.message : e)}`);
      }
    }
    if (plans.length > maxPrs)
      console.log(
        `  (capped: ${plans.length - maxPrs} more PR plan(s) not opened — raise --max-prs or run with --only)`,
      );
  }

  // -- report ---------------------------------------------------------------
  const statusCount = new Map<string, number>();
  for (const r of rows) statusCount.set(r.status, (statusCount.get(r.status) ?? 0) + 1);
  const untracked = only ? [] : report.untracked;
  const lines: string[] = [
    `# sync spine — run ${runId}`,
    '',
    `Ledger: ${path.relative(ROOT, path.resolve(ROOT, ledgerPath))} — ${rows.length} record(s) in scope` +
      (only ? ` (--only ${only.join(',')})` : '') +
      (fixturePath ? ` — OFFLINE fixture ${fixturePath}` : ' — live REST observation'),
    '',
    '## Drift table',
    '',
    '| status | contract | notes |',
    '|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.status} | ${r.contractId} | ${r.notes.join('; ').replaceAll('|', '\\|')} |`,
    ),
    ...untracked.map(
      (u) => `| untracked | ${u.setName} (${u.fileKey ?? '?'}#${u.setNodeId}) | observed set has no ledger record |`,
    ),
    '',
    `Totals: ${['conflict', 'canvas-ahead', 'code-ahead', 'in-sync']
      .filter((s) => statusCount.has(s))
      .map((s) => `${statusCount.get(s)} ${s}`)
      .join(', ') || 'none'}${untracked.length > 0 ? `, ${untracked.length} untracked` : ''}.`,
    '',
    '## Canvas → code (canvas-ahead): PR-shaped proposal bundles',
    '',
    ...(plans.length > 0
      ? plans.flatMap((p) => {
          const outcome = pulls.find((o) => o.key === p.key)!;
          return [
            `### ${p.contractId}`,
            '',
            `- branch: \`${p.branch}\``,
            ...p.files.map((f) => `- file: \`${f.destPath}\` (${f.kind})`),
            `- bundle: \`${path.relative(ROOT, outcome.dir)}/\` (proposed contract, diff, drift.json, DRIFT.md, PR.md)`,
            `- fingerprints: ledger \`${p.basedOn.ledgerStamp ?? 'none'}\`/\`${p.basedOn.ledgerBaseline ?? 'none'}\` → observed \`${p.basedOn.observedStamp ?? 'none'}\`/\`${p.basedOn.observedDump ?? 'none'}\``,
            '',
          ];
        })
      : ['- nothing to pull — no canvas-ahead record in scope', '']),
    ...(pulls.filter((o) => o.status === 'refused').length > 0
      ? [
          '### Refused pulls (named)',
          '',
          ...pulls.filter((o) => o.status === 'refused').map((o) => `- ${o.contractId}: ${o.refusal}`),
          '',
        ]
      : []),
    ...(skips.length > 0
      ? ['### Skipped (echo safety)', '', ...skips.map((s) => `- ${s.key}: ${s.reason}`), '']
      : []),
    '## Code → canvas (code-ahead): canvas is behind',
    '',
    ...(codeBehind.length > 0
      ? codeBehind.map(
          (c) =>
            `- ${c.contractId}: ${c.detail}${c.files.length > 0 ? ` — regenerated: ${c.files.join(', ')}` : ''}`,
        )
      : ['- none — no code-ahead record in scope']),
    '',
    '## PRs',
    '',
    ...(openPrWanted
      ? [
          ...opened.map((o) => `- opened: ${o.prUrl} (${o.key})`),
          ...prFailures.map((f) => `- FAILED: ${f.key} — ${f.error}`),
          ...(opened.length === 0 && prFailures.length === 0 ? ['- nothing to open'] : []),
        ]
      : ['- plan mode (no --open-pr): no PR was opened; the bundles above are ready to review']),
    '',
  ];
  const reportMd = lines.join('\n');
  writeFileSync(path.join(runDir, 'SPINE.md'), reportMd);
  writeFileSync(
    path.join(runDir, 'spine-report.json'),
    JSON.stringify(
      {
        runId,
        mode: fixturePath ? 'fixture' : 'live',
        openPr: openPrWanted,
        rows,
        untracked,
        pulls: pulls.map(({ proposedContract: _p, minted, childStubs, diffText: _d, ...rest }) => ({
          ...rest,
          minted: minted ? { count: minted.count } : null,
          childStubs: childStubs.length,
        })),
        plans: plans.map((p) => ({
          key: p.key,
          branch: p.branch,
          title: p.title,
          files: p.files.map((f) => ({ destPath: f.destPath, kind: f.kind })),
          basedOn: p.basedOn,
        })),
        skips,
        codeBehind,
        opened,
        prFailures,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(reportMd);
  console.log(`✔ spine run → ${path.relative(ROOT, runDir)}/ (SPINE.md, spine-report.json)`);

  const drift =
    rows.some((r) => r.status !== 'in-sync') || untracked.length > 0 || prFailures.length > 0;
  return drift ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(`✘ ${String(e instanceof Error ? e.message : e)}`);
    process.exit(2);
  },
);

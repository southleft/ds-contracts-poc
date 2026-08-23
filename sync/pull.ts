/**
 * SYNC PULL — the canvas→code half of the drift spine (SYNC LAYER STEP 2).
 *
 * For a ledger record whose canvas half is AHEAD (a designer or an unrecorded
 * write moved the set), pull turns the current canvas into a REVIEWABLE
 * proposal instead of a mystery:
 *
 *   REST nodes response ──mapRestToDump──▶ dump v1 ──proposeBatchFromDump──▶
 *   proposed contract (projectionMode "reviewable-inversion", mintUnbound)
 *   ──compareContracts──▶ per-property classification against the CURRENT
 *   contract (matched | canvas-absent | mismatch) + a plain unified diff.
 *
 * Everything lands as FILES in a working directory (sync/out/<runId>/<slug>/)
 * — the proposal is NEVER auto-applied to the contract on disk, and the
 * ledger is NEVER written here. The "updated ledger observation" is part of
 * the drift report (`drift.json.observation` + `proposedLedgerRecord`): the
 * facts an adoption would record, previewed rather than performed.
 *
 * HONESTY DISCIPLINE (the inversion-vs-roundtrip asymmetry, core/
 * canvas-code-plan.ts): the proposal is an INVERSION of what the REST surface
 * can read. Variables may degrade to minted `imported.*` literals, and the
 * REST mapper's captureGaps are named in the proposal notes — a mismatch row
 * can therefore be a READ LIMIT of the import route, not a designer edit.
 * The report says so; nothing here pretends the pull is a round trip.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  mapRestToDump,
  type RestNodesResponse,
  type RestVariablesResponse,
} from '../extract/figma/rest/map.js';
import {
  loadTokenCorpus,
  NoTokenCorpusError,
  type TokenCorpus,
} from '../extract/figma/tokens.js';
import { loadContracts } from '../extract/figma/propose.js';
import {
  componentIdSlug,
  dumpCapturesHidden,
  proposeBatchFromDump,
  type FigmaProposalResult,
} from '../core/propose-figma.js';
import { compareContracts, type Finding } from '../extract/figma/roundtrip.js';
import {
  classifyRecord,
  contractHashOf,
  recordKey,
  type DriftRow,
  type LedgerRecord,
  type SetObservation,
} from './ledger.js';
import { observationsFromRestNodes } from './observe.js';

// ---------------------------------------------------------------------------
// Shared helper — the code-half hashes (also used by cli.ts / spine.ts).
// ---------------------------------------------------------------------------

export function currentContractHashes(
  root: string,
  records: readonly LedgerRecord[],
): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const r of records) {
    let hash: string | null = null;
    if (r.contractPath) {
      const abs = path.resolve(root, r.contractPath);
      if (existsSync(abs)) {
        try {
          hash = contractHashOf(JSON.parse(readFileSync(abs, 'utf8')) as Record<string, unknown>);
        } catch {
          hash = null; // unreadable = unverifiable, classified by name downstream
        }
      }
    }
    out.set(recordKey(r), hash);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-record token corpus — the library's own tokens, never guessed.
// ---------------------------------------------------------------------------

/** Walk UP from the contract's directory looking for an extract.config.json
 *  whose "tokens" names the library's DTCG files (the brownfield convention:
 *  examples/<lib>/extract.config.json, paths repo-root-relative). First-party
 *  contracts (contracts/…) have no such config and use the repo layout. */
export function resolveCorpusForRecord(
  root: string,
  contractPath: string,
): { corpus: TokenCorpus; files: string[]; note: string } {
  let dir = path.dirname(path.resolve(root, contractPath));
  const rootAbs = path.resolve(root);
  while (dir.startsWith(rootAbs)) {
    const cfgPath = path.join(dir, 'extract.config.json');
    if (existsSync(cfgPath)) {
      try {
        const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as { tokens?: unknown };
        const files = Array.isArray(cfg.tokens)
          ? cfg.tokens.filter((t): t is string => typeof t === 'string')
          : [];
        if (files.length > 0) {
          return {
            corpus: loadTokenCorpus(root, {
              files,
              supplyHint: `listed in ${path.relative(rootAbs, cfgPath)}`,
            }),
            files,
            note: `token corpus: ${files.join(', ')} (${path.relative(rootAbs, cfgPath)})`,
          };
        }
      } catch {
        /* unreadable config — keep walking; the fallback names itself below */
      }
    }
    if (dir === rootAbs) break;
    dir = path.dirname(dir);
  }
  const corpus = loadTokenCorpus(root, {
    supplyHint: 'add an extract.config.json with "tokens" next to the contract library',
  });
  return {
    corpus,
    files: [],
    note:
      'token corpus: repo reference layout (no extract.config.json found above the contract) — ' +
      'for a foreign library this binds canvas values to THIS repo’s token names wherever raw values coincide',
  };
}

// ---------------------------------------------------------------------------
// A small line diff (LCS) — the proposed-contract diff as reviewers read it.
// ---------------------------------------------------------------------------

export function unifiedJsonDiff(label: string, wasText: string, nowText: string): string {
  const a = wasText.split('\n');
  const b = nowText.split('\n');
  // Classic O(n·m) LCS — contracts are small documents.
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const lines: string[] = [`--- a/${label}`, `+++ b/${label}`];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push(` ${a[i]}`);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      lines.push(`-${a[i]}`);
      i++;
    } else {
      lines.push(`+${b[j]}`);
      j++;
    }
  }
  while (i < n) lines.push(`-${a[i++]}`);
  while (j < m) lines.push(`+${b[j++]}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// The pull itself — one record, one reviewable bundle on disk.
// ---------------------------------------------------------------------------

export interface PullInput {
  record: LedgerRecord;
  row: DriftRow;
  /** REST nodes response containing (at least) the record's set node. */
  response: RestNodesResponse;
  fileVersionId: string | null;
  /** GET /variables/local when the live route could read it — absent means
   *  bound facts degrade to minted literals, named in the proposal notes. */
  variables?: RestVariablesResponse;
  root: string;
  /** Absolute run directory (…/sync/out/<runId>); the record's slug dir is
   *  created inside. */
  runDir: string;
}

export interface PullOutcome {
  key: string;
  contractId: string;
  contractPath: string | null;
  slug: string;
  status: 'pulled' | 'refused';
  /** Named refusal when status is 'refused' (nothing was invented). */
  refusal?: string;
  dir: string;
  files: string[]; // run-dir-relative
  proposedContract?: Record<string, unknown>;
  findings: Finding[];
  proposalNotes: string[];
  unboundCount: number;
  minted: { count: number; tree: Record<string, unknown> } | null;
  childStubs: Array<Record<string, unknown>>;
  observation: SetObservation | null;
  corpusNote: string;
  diffText?: string;
}

const findingCounts = (findings: readonly Finding[]) => ({
  matched: findings.filter((f) => f.status === 'matched').length,
  canvasAbsent: findings.filter((f) => f.status === 'canvas-absent').length,
  mismatch: findings.filter((f) => f.status === 'mismatch').length,
});

export function pullRecord(input: PullInput): PullOutcome {
  const { record, row, response, fileVersionId, root, runDir } = input;
  const slug = componentIdSlug(record.contractId);
  const dir = path.join(runDir, slug);
  const relFiles: string[] = [];
  const refuse = (refusal: string): PullOutcome => {
    mkdirSync(dir, { recursive: true });
    const p = path.join(dir, 'REFUSED.md');
    writeFileSync(p, `# sync pull refused — ${record.contractId}\n\n${refusal}\n`);
    return {
      key: recordKey(record),
      contractId: record.contractId,
      contractPath: record.contractPath,
      slug,
      status: 'refused',
      refusal,
      dir,
      files: [path.relative(runDir, p)],
      findings: [],
      proposalNotes: [],
      unboundCount: 0,
      minted: null,
      childStubs: [],
      observation: null,
      corpusNote: '',
      diffText: undefined,
    };
  };

  if (!record.setNodeId) return refuse('ledger record carries no setNodeId — nothing to dump');
  const entry = response.nodes?.[record.setNodeId];
  if (!entry)
    return refuse(
      `set node ${record.setNodeId} is not in the nodes response — the set may have been deleted on the canvas`,
    );

  // Observation for THIS node (single-node isolation, same rule observe uses).
  const single: RestNodesResponse = {
    name: response.name,
    nodes: { [record.setNodeId]: entry },
  };
  const observation =
    observationsFromRestNodes(single, record.fileKey, fileVersionId)[0] ?? null;

  // Token corpus + contract scope — the library's own, resolved per record.
  let corpus: TokenCorpus;
  let corpusNote: string;
  try {
    const resolved = resolveCorpusForRecord(root, record.contractPath ?? 'contracts/_.json');
    corpus = resolved.corpus;
    corpusNote = resolved.note;
  } catch (e) {
    if (e instanceof NoTokenCorpusError) return refuse(`no token corpus: ${e.message}`);
    throw e;
  }
  const contractsDir = record.contractPath
    ? path.dirname(path.resolve(root, record.contractPath))
    : path.resolve(root, 'contracts');
  const scope = loadContracts(contractsDir);

  // REST → dump v1 → reviewable-inversion proposal (minted, never guessed).
  const { dump } = mapRestToDump(single, {
    fileKey: record.fileKey,
    ...(input.variables ? { variables: input.variables } : {}),
  });
  // The record's own id prefix (polaris.avatar → "polaris") keeps the
  // proposed id in the library's namespace instead of the default "ds.".
  const idPrefix = record.contractId.includes('.')
    ? record.contractId.slice(0, record.contractId.lastIndexOf('.'))
    : undefined;
  const batch = proposeBatchFromDump(dump as unknown as Record<string, unknown>, {
    corpus,
    contractIdByName: scope.byName,
    contractsById: scope.byId,
    contractIdByKey: scope.byKey,
    ...(idPrefix ? { prefix: idPrefix } : {}),
    fileKey: record.fileKey,
    projectionMode: 'reviewable-inversion',
    mintUnbound: true,
    hiddenCaptured: dumpCapturesHidden(
      (dump as { _provenance?: Record<string, unknown> })._provenance,
    ),
  });
  if (batch.proposals.length === 0) {
    const why = batch.skipped.map((s) => `${s.reason}${s.detail ? ` — ${s.detail}` : ''}`).join('; ');
    return refuse(why || 'the proposer produced no proposal for this set');
  }
  const proposal: FigmaProposalResult & { setName: string } = batch.proposals[0];

  // The disagreement report: proposal vs the CURRENT contract (the base).
  const baseAbs = record.contractPath ? path.resolve(root, record.contractPath) : null;
  let base: Record<string, unknown> | null = null;
  let findings: Finding[] = [];
  const notes: string[] = [...proposal.notes, ...batch.notes];
  // IDENTITY IS LEDGER-PINNED. The ledger record IS the set↔contract link,
  // so the proposal keeps the record's id (and the base's name/$schema when
  // the base exists) instead of re-deriving them from the canvas set name —
  // the Testing-file convention suffixes set names with the contract id,
  // which would otherwise flood the diff with derived-identity churn. The
  // canvas set name is preserved as a note; nothing else is rewritten
  // (minted token stems keep the derived spelling — cosmetic, named here).
  {
    const c = proposal.contract as { id?: unknown; name?: unknown; $schema?: unknown };
    const derivedId = c.id;
    if (derivedId !== record.contractId) {
      notes.push(
        `proposal identity pinned to the ledger record: id ${JSON.stringify(derivedId)} (derived from canvas set name ` +
          `"${proposal.setName}") → ${record.contractId}; minted token paths keep the derived stem`,
      );
      c.id = record.contractId;
    }
    if (baseAbs && existsSync(baseAbs)) {
      const baseDoc = JSON.parse(readFileSync(baseAbs, 'utf8')) as Record<string, unknown>;
      if (typeof baseDoc.name === 'string' && baseDoc.name !== c.name) c.name = baseDoc.name;
      if (typeof baseDoc.$schema === 'string') c.$schema = baseDoc.$schema;
    }
  }
  if (baseAbs && existsSync(baseAbs)) {
    base = JSON.parse(readFileSync(baseAbs, 'utf8')) as Record<string, unknown>;
    try {
      findings = compareContracts(base, proposal.contract, corpus);
    } catch (e) {
      notes.push(
        `comparator refused: ${String(e instanceof Error ? e.message : e)} — review the unified diff instead`,
      );
    }
  } else {
    notes.push(
      `base contract ${record.contractPath ?? '(none)'} is not on disk — the proposal has no base to diff against`,
    );
  }

  // Write the bundle.
  mkdirSync(dir, { recursive: true });
  const write = (name: string, contents: string) => {
    const p = path.join(dir, name);
    writeFileSync(p, contents);
    relFiles.push(path.relative(runDir, p));
    return p;
  };
  const proposedText = JSON.stringify(proposal.contract, null, 2) + '\n';
  write(`${slug}.contract.proposed.json`, proposedText);
  for (const stub of proposal.childStubs ?? []) {
    const stubId = String((stub as { id?: unknown }).id ?? 'stub');
    write(`${componentIdSlug(stubId)}.stub.contract.proposed.json`, JSON.stringify(stub, null, 2) + '\n');
  }
  if (proposal.mintedTokens && proposal.mintedTokens.count > 0) {
    write('minted.dtcg.json', JSON.stringify(proposal.mintedTokens.tree, null, 2) + '\n');
  }
  const baseText = base ? JSON.stringify(base, null, 2) + '\n' : '';
  const diffText = base
    ? unifiedJsonDiff(record.contractPath ?? `${slug}.contract.json`, baseText, proposedText)
    : undefined;
  if (diffText) write(`${slug}.contract.diff`, diffText + '\n');

  /** The ledger facts an ADOPTION would record — previewed, never applied
   *  (that write belongs to `figma receive --apply` / `observe --update`). */
  const proposedLedgerRecord = {
    contractId: record.contractId,
    contractPath: record.contractPath,
    contractHash: contractHashOf(proposal.contract),
    fileKey: record.fileKey,
    setNodeId: record.setNodeId,
    canvasFingerprint: observation?.stamp ?? record.canvasFingerprint,
    lastSyncedVersionId: fileVersionId,
    direction: 'canvas→code',
    observed: observation
      ? { dumpFingerprint: observation.dumpFingerprint, dumpVersion: observation.dumpVersion, fileVersionId }
      : null,
  };
  const counts = findingCounts(findings);
  write(
    'drift.json',
    JSON.stringify(
      {
        key: recordKey(record),
        contractId: record.contractId,
        contractPath: record.contractPath,
        fileKey: record.fileKey,
        setNodeId: record.setNodeId,
        ledger: {
          contractHash: record.contractHash,
          canvasFingerprint: record.canvasFingerprint,
          observedBaseline: record.observed?.dumpFingerprint ?? null,
        },
        observation,
        driftRow: row,
        findings,
        findingCounts: counts,
        proposalNotes: notes,
        unbound: proposal.unbound.length,
        minted: proposal.mintedTokens?.count ?? 0,
        corpus: corpusNote,
        proposedLedgerRecord,
      },
      null,
      2,
    ) + '\n',
  );
  const md: string[] = [
    `# Canvas drift — ${record.contractId}`,
    '',
    `- status: **${row.status}** (evidence: ${row.canvasEvidence})`,
    ...row.notes.map((n) => `- ${n}`),
    '',
    `Ledger fingerprints at last sync: stamp \`${record.canvasFingerprint ?? 'none'}\`, ` +
      `baseline \`${record.observed?.dumpFingerprint ?? 'none'}\`. ` +
      `Observed now: stamp \`${observation?.stamp ?? 'none'}\`, dump \`${observation?.dumpFingerprint ?? 'none'}\` ` +
      `(file version ${fileVersionId ?? 'unknown'}).`,
    '',
    '## Per-property classification (proposal vs current contract)',
    '',
    '| status | subject | detail |',
    '|---|---|---|',
    ...(findings.length > 0
      ? findings.map(
          (f) => `| ${f.status} | ${f.subject} | ${(f.detail ?? '').replaceAll('|', '\\|')} |`,
        )
      : ['| — | (no comparator output) | see notes |']),
    '',
    `Totals: ${counts.matched} matched · ${counts.canvasAbsent} canvas-absent (declared limits) · ${counts.mismatch} mismatch.`,
    '',
    '## Honesty — inversion, not round trip',
    '',
    'This proposal is a REVIEWABLE INVERSION of what the REST surface could read off the canvas ' +
      '(`projectionMode: reviewable-inversion`, unbound values minted as provisional `imported.*` tokens). ' +
      'It is NOT a round trip of the shipping contract: mismatch rows can be designer edits OR read limits ' +
      'of the import route (variables degradation, REST captureGaps — named in the notes below). ' +
      'Review each row before adopting; nothing here was guessed.',
    '',
    '## Proposal notes',
    '',
    ...(notes.length > 0 ? notes.map((n) => `- ${n}`) : ['- none']),
    '',
    `- ${corpusNote}`,
    `- unbound values: ${proposal.unbound.length}; minted tokens: ${proposal.mintedTokens?.count ?? 0}`,
    '',
  ];
  write('DRIFT.md', md.join('\n'));

  return {
    key: recordKey(record),
    contractId: record.contractId,
    contractPath: record.contractPath,
    slug,
    status: 'pulled',
    dir,
    files: relFiles,
    proposedContract: proposal.contract,
    findings,
    proposalNotes: notes,
    unboundCount: proposal.unbound.length,
    minted:
      proposal.mintedTokens && proposal.mintedTokens.count > 0
        ? { count: proposal.mintedTokens.count, tree: proposal.mintedTokens.tree }
        : null,
    childStubs: proposal.childStubs ?? [],
    observation,
    corpusNote,
    diffText,
  };
}

// ---------------------------------------------------------------------------
// Re-export the classify arithmetic the spine composes with.
// ---------------------------------------------------------------------------

export { classifyRecord };

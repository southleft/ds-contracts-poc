/**
 * V1 READINESS — one command runs every row of the definition of v1.
 *
 *   npm run v1:readiness                       every row, every command, on this commit
 *   npm run v1:readiness -- --dry-run          list what would run; resolve evidence; run nothing
 *   npm run v1:readiness -- --only <ids>       a comma list of row IDs (others print as SKIPPED)
 *   npm run v1:readiness -- --skip <ids>       skip rows by ID — SKIPPED still fails the run
 *   npm run v1:readiness -- --allow-skip       … unless this is passed (the skip stays visible)
 *   npm run v1:readiness -- --lanes            run only rows with a command NO lane already runs
 *   npm run v1:readiness -- --trust-lanes      cite a completed lane run instead of re-running
 *                                              a command that lane runs (see LANE EVIDENCE)
 *   npm run v1:readiness -- --pre-release      post-publish chains DEFERRED and open HUMAN ledger
 *                                              rows NAMED instead of red (the lane's mode)
 *   npm run v1:readiness -- --no-reuse         run a command again for every row that names it
 *   npm run v1:readiness -- --no-prep          skip the lanes' prep steps (package builds, build:lib,
 *                                              plugin:zip) that a cold tree needs before any row
 *   npx tsx scripts/v1-readiness.ts --self-test  prove a red row is red, a missing anchor is
 *                                              EVIDENCE-MISSING, a ledger row with no commit is red
 *
 * THE SINGLE SOURCE is docs/26-v1-definition.md. Its requirement tables are
 * parsed with the same parser v1:definition:check uses (scripts/
 * v1-definition-check.mjs); nothing here lists a row or a command by hand.
 * Per row, the FIRST backticked span that is a command (`npm …` / `node …`)
 * is the acceptance chain; a span introduced by "after publish:" is the
 * post-publish chain (V1-REL-02); every other command-shaped span is a
 * mention (a lane transcription or a refresh recipe such as
 * `parity:snapshot:rest`) and is listed, never run. Every markdown link and
 * every bare `docs/…md` / `parity/…md` path in the acceptance cell is an
 * evidence reference: the file must exist and the anchor must resolve
 * (markdownAnchors, the docs:check/v1:definition:check resolver). Prose
 * evidence ("the release PR contains …") is a HUMAN item and is carried into
 * the receipt by name; it cannot turn a row green.
 *
 * WHAT IT WRITES (only on a complete run — no --only/--skip/--lanes/--dry-run):
 *   parity/receipts/v1/READINESS.md     the table — row · state · command · seconds · evidence
 *   parity/receipts/v1/READINESS.json   the same plus each command's captured tail
 *   parity/receipts/v1/AUDIT-LEDGER.md  generated from parity/receipts/v1/audit-ledger.json
 * No wall-clock stamps: the receipt carries the commit SHA, the dirty flag, the
 * definition's sha256 and the flags the run was given. Seconds are measured,
 * so they move run to run; nothing else should.
 *
 * STATES. GREEN · GREEN-BY-LANE (every command cited a lane run) · RED ·
 * EVIDENCE-MISSING · UNRUN (dry run, or behind a failed `&&`) · SKIPPED ·
 * LANE-COVERED (--lanes: every command already a lane step) · DEFERRED is a
 * per-chain state for the post-publish chain under --pre-release. The process
 * exits non-zero on any row that is not GREEN / GREEN-BY-LANE / LANE-COVERED,
 * or SKIPPED without --allow-skip.
 *
 * LANE EVIDENCE (--trust-lanes). The lane map is the one `npm run ci:lanes`
 * derives from the workflow files (.github/scripts/lane-map.ts) — a command
 * is a lane step when a lane invokes it, directly or through a composite. A
 * lane-step command is cited instead of run when
 *   (a) this process is itself inside that lane's GitHub run
 *       (GITHUB_WORKFLOW names the lane) — cited as "this run <id>"; the job's
 *       own verdict is the evidence, the step ran before this one; or
 *   (b) `gh run list --commit <sha> --workflow <lane>.yml` finds a COMPLETED,
 *       SUCCESSFUL run of that lane for this exact commit — locally only when
 *       HEAD is on origin/main (a PR's lanes run on a merge commit and would
 *       not describe this tree); inside Actions, the PR head SHA from the
 *       event payload, with a bounded wait for a run still in progress.
 * No evidence → the command runs. `npm run ci:lane <L>` is the lane itself:
 * with --trust-lanes it is L's run evidence; without it, it runs L locally.
 *
 * NESTED. `npm run ci:lane full` runs the full lane, which ends with this
 * script. A nested invocation (V1_READINESS_DEPTH set) does not run commands
 * again — it runs in --dry-run mode (parse + evidence resolution) and says so;
 * the outer run is the one executing every row.
 *
 * V1-REL-01. The release audit this repo answers is the 2026-08-22 21-agent
 * audit (60 P0/P1 claims; 12 skeptic-verified) whose closures are recorded in
 * docs/23 §D.12–§D.33. It has no structured source in the tree, so
 * parity/receipts/v1/audit-ledger.json was built from those documents ONCE
 * (each row cites where it came from) and this script VERIFIES it: every
 * closing commit is on this history, every acceptance command exits 0, every
 * cited docs/23 anchor resolves; a row marked open-human must name the
 * RELEASE_CHECKLIST row that owns it. A P0/P1 row without a closing commit
 * and a passing command is RED; open-human rows are RED unless --pre-release.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectLaneMap, lanesFor, type LaneMap } from '../.github/scripts/lane-map';
import { DOCUMENT_PATH, markdownAnchors, parseRequirementTables, type RequirementRow } from './v1-definition-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RECEIPT_DIR = path.join(ROOT, 'parity', 'receipts', 'v1');
const LEDGER_SOURCE = path.join(RECEIPT_DIR, 'audit-ledger.json');
const TAIL_BYTES = 6000;
const LANE_WAIT_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------- arguments
interface Options {
  only: Set<string> | null;
  skip: Set<string>;
  allowSkip: boolean;
  dryRun: boolean;
  lanesOnly: boolean;
  trustLanes: boolean;
  preRelease: boolean;
  reuse: boolean;
  prep: boolean;
  nested: boolean;
}

function parseArgs(argv: string[]): Options {
  const list = (flag: string): string[] => {
    const i = argv.indexOf(flag);
    if (i === -1) return [];
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`${flag} needs a comma-separated list of row IDs`);
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  };
  const only = list('--only');
  return {
    only: only.length ? new Set(only) : null,
    skip: new Set(list('--skip')),
    allowSkip: argv.includes('--allow-skip'),
    dryRun: argv.includes('--dry-run'),
    lanesOnly: argv.includes('--lanes'),
    trustLanes: argv.includes('--trust-lanes'),
    preRelease: argv.includes('--pre-release'),
    reuse: !argv.includes('--no-reuse'),
    prep: !argv.includes('--no-prep'),
    nested: Boolean(process.env.V1_READINESS_DEPTH),
  };
}

// ---------------------------------------------------------------- the definition
export interface Chain {
  raw: string;
  commands: string[];
  phase: 'acceptance' | 'post-publish';
}
export interface EvidenceRef {
  raw: string;
  file: string; // repo-relative
  anchor: string | null;
  state: 'OK' | 'FILE-MISSING' | 'ANCHOR-MISSING';
}
export interface Row {
  id: string;
  line: number;
  requirement: string;
  chains: Chain[];
  mentioned: string[];
  evidence: EvidenceRef[];
  human: string[];
}

const COMMAND_SPAN = /^(?:npm\s+(?:run\s|--prefix\s|audit\b)|node\s)/;
const LINK_RE = /\[([^\]]*)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const BARE_PATH_RE = /(?:^|[\s(])((?:docs|parity|\.agents)\/[\w./-]+?\.md)(?=[\s).,;]|$)/g;

export function splitChain(span: string): string[] {
  return span.split(/\s*&&\s*/).map((s) => s.trim()).filter(Boolean);
}

export function resolveEvidence(raw: string, docDir: string, files: (rel: string) => string | null): EvidenceRef {
  if (/^(?:https?:|mailto:|data:)/.test(raw)) return { raw, file: raw, anchor: null, state: 'OK' };
  const [targetPart, anchor] = raw.split('#', 2);
  const file = targetPart ? path.posix.normalize(path.posix.join(docDir, targetPart)) : DOCUMENT_PATH;
  const content = files(file);
  if (content === null) return { raw, file, anchor: anchor ?? null, state: 'FILE-MISSING' };
  if (anchor && !markdownAnchors(content).has(decodeURIComponent(anchor))) {
    return { raw, file, anchor, state: 'ANCHOR-MISSING' };
  }
  return { raw, file, anchor: anchor ?? null, state: 'OK' };
}

export function parseDefinition(markdown: string, files: (rel: string) => string | null): Row[] {
  const docDir = path.posix.dirname(DOCUMENT_PATH);
  return parseRequirementTables(markdown).map((row: RequirementRow): Row => {
    const cell = row.acceptance;
    const chains: Chain[] = [];
    const mentioned: string[] = [];
    const spanRe = /`([^`]+)`/g;
    let m: RegExpExecArray | null;
    while ((m = spanRe.exec(cell)) !== null) {
      const span = m[1].trim();
      if (!COMMAND_SPAN.test(span)) continue;
      const before = cell.slice(0, m.index).replace(/\s+$/, '');
      const postPublish = /after publish:$/i.test(before);
      if (postPublish) chains.push({ raw: span, commands: splitChain(span), phase: 'post-publish' });
      else if (!chains.some((c) => c.phase === 'acceptance')) chains.push({ raw: span, commands: splitChain(span), phase: 'acceptance' });
      else mentioned.push(span);
    }
    const evidence: EvidenceRef[] = [];
    const seen = new Set<string>();
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(cell)) !== null) {
      if (seen.has(m[2])) continue;
      seen.add(m[2]);
      evidence.push(resolveEvidence(m[2], docDir, files));
    }
    const withoutCode = cell.replace(/`[^`]+`/g, ' ').replace(LINK_RE, ' ');
    BARE_PATH_RE.lastIndex = 0;
    while ((m = BARE_PATH_RE.exec(withoutCode)) !== null) {
      const rel = m[1];
      if (seen.has(rel)) continue;
      seen.add(rel);
      const content = files(rel);
      evidence.push({ raw: rel, file: rel, anchor: null, state: content === null ? 'FILE-MISSING' : 'OK' });
    }
    const human: string[] = [];
    const evidenceClause = cell.match(/\bEvidence\s*:\s*([^;]+)/i);
    if (evidenceClause) {
      const text = evidenceClause[1]
        .replace(LINK_RE, '$1')
        .replace(/\s+/g, ' ')
        .trim();
      if (/release (?:PR|notes|security review|record)/i.test(text)) human.push(text);
    }
    return { id: row.id, line: row.line, requirement: row.requirement, chains, mentioned, evidence, human };
  });
}

export function repoFileReader(root: string) {
  const cache = new Map<string, string | null>();
  return (rel: string): string | null => {
    if (cache.has(rel)) return cache.get(rel)!;
    const abs = path.join(root, rel);
    const content = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
    cache.set(rel, content);
    return content;
  };
}

// ---------------------------------------------------------------- commands and lanes
interface ParsedCommand {
  kind: 'script' | 'lane-run' | 'shell';
  dir?: string;
  name?: string;
  lane?: string;
}

function parseCommand(cmd: string): ParsedCommand {
  const laneRun = cmd.match(/^npm run ci:lane\s+([A-Za-z0-9-]+)$/);
  if (laneRun) return { kind: 'lane-run', lane: laneRun[1] };
  const script = cmd.match(/^npm\s+(?:--prefix\s+(\S+)\s+)?run\s+([A-Za-z0-9:_-]+)(?:\s|$)/);
  if (script) return { kind: 'script', dir: script[1] ? path.resolve(ROOT, script[1]) : ROOT, name: script[2] };
  return { kind: 'shell' };
}

/**
 * The lane requirement of a command: a list of GROUPS, each the set of lanes
 * that run one leaf of it. A plain script is one group (the lanes that invoke
 * it, directly or through a composite they run); a composite that no lane runs
 * as a whole (`maintain`) is one group per leaf — ci:lanes' "maintain ≡ fast +
 * full" — and --trust-lanes needs evidence for EVERY group. null = some leaf
 * is no lane's step, so the command is not a lane step.
 */
function laneGroups(map: LaneMap, cmd: string, trail: string[] = []): Set<string>[] | null {
  const parsed = parseCommand(cmd);
  if (parsed.kind === 'lane-run') return [new Set([parsed.lane!])];
  if (parsed.kind !== 'script' || !parsed.dir || !parsed.name) return null;
  const direct = lanesFor(map, parsed.dir, parsed.name);
  if (direct.size) return [direct];
  const body = map.readManifest(parsed.dir).scripts?.[parsed.name] ?? '';
  const nested = [...body.matchAll(/npm(?:\s+--prefix\s+(\S+))?\s+run\s+([A-Za-z0-9:_-]+)/g)];
  if (!nested.length) return null;
  const key = `${parsed.dir}\0${parsed.name}`;
  if (trail.includes(key)) return null;
  const groups: Set<string>[] = [];
  for (const n of nested) {
    const sub = n[1] ? `npm --prefix ${n[1]} run ${n[2]}` : `npm run ${n[2]}`;
    const subGroups = laneGroups(map, sub, [...trail, key]);
    if (!subGroups) return null;
    groups.push(...subGroups);
  }
  return groups;
}

/** Every lane that runs some part of this command — for display; empty when it is not a lane step. */
function lanesForCommand(map: LaneMap, cmd: string): Set<string> {
  const groups = laneGroups(map, cmd);
  if (!groups) return new Set();
  return new Set(groups.flatMap((g) => [...g]));
}

interface LaneEvidence {
  lane: string;
  runId: string;
  kind: 'this-run' | 'completed-run';
}

const git = (args: string[]): string | null => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

function headOnOriginMain(): boolean {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', 'HEAD', 'origin/main'], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function commitUnderTest(): string {
  if (process.env.GITHUB_EVENT_PATH && existsSync(process.env.GITHUB_EVENT_PATH)) {
    try {
      const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) as { pull_request?: { head?: { sha?: string } } };
      if (event.pull_request?.head?.sha) return event.pull_request.head.sha;
    } catch {
      /* fall through to GITHUB_SHA / HEAD */
    }
  }
  return process.env.GITHUB_SHA ?? git(['rev-parse', 'HEAD']) ?? 'unknown';
}

interface GhRun {
  databaseId: number;
  status: string;
  conclusion: string;
  headSha: string;
}

function ghRuns(lane: string, sha: string): GhRun[] | null {
  try {
    const out = execFileSync(
      'gh',
      ['run', 'list', '--commit', sha, '--workflow', `${lane}.yml`, '--json', 'databaseId,status,conclusion,headSha', '--limit', '20'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30_000 },
    );
    return JSON.parse(out) as GhRun[];
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class LaneOracle {
  private cache = new Map<string, LaneEvidence | null>();
  readonly notes: string[] = [];
  constructor(private readonly enabled: boolean) {}

  async evidence(lane: string): Promise<LaneEvidence | null> {
    if (!this.enabled) return null;
    if (this.cache.has(lane)) return this.cache.get(lane)!;
    const found = await this.lookup(lane);
    this.cache.set(lane, found);
    return found;
  }

  private async lookup(lane: string): Promise<LaneEvidence | null> {
    const inActions = process.env.GITHUB_ACTIONS === 'true';
    if (inActions && process.env.GITHUB_WORKFLOW === lane && process.env.GITHUB_RUN_ID) {
      return { lane, runId: process.env.GITHUB_RUN_ID, kind: 'this-run' };
    }
    if (!inActions && !headOnOriginMain()) {
      this.notes.push(`${lane}: HEAD is not on origin/main — no lane run describes this tree`);
      return null;
    }
    const sha = commitUnderTest();
    const deadline = Date.now() + (inActions ? LANE_WAIT_MS : 0);
    for (;;) {
      const runs = ghRuns(lane, sha);
      if (runs === null) {
        this.notes.push(`${lane}: gh run list unavailable (no gh, no token, or offline)`);
        return null;
      }
      const success = runs.find((r) => r.status === 'completed' && r.conclusion === 'success');
      if (success) return { lane, runId: String(success.databaseId), kind: 'completed-run' };
      const pending = runs.find((r) => r.status !== 'completed');
      if (pending && Date.now() < deadline) {
        console.log(`  … ${lane} run ${pending.databaseId} is ${pending.status} for ${sha.slice(0, 8)}; waiting`);
        await sleep(30_000);
        continue;
      }
      const failed = runs.filter((r) => r.status === 'completed').map((r) => `${r.databaseId}:${r.conclusion}`);
      this.notes.push(
        `${lane}: no completed successful run for ${sha.slice(0, 8)}` +
          (failed.length ? ` (completed: ${failed.join(', ')})` : pending ? ` (run ${pending.databaseId} still ${pending.status})` : ' (no run found)'),
      );
      return null;
    }
  }
}

// ---------------------------------------------------------------- running
export interface CommandResult {
  command: string;
  state: 'GREEN' | 'RED' | 'GREEN-BY-LANE' | 'UNRUN' | 'DEFERRED';
  seconds: number;
  exit: number | null;
  lanes: string[];
  laneRun?: string;
  reusedFrom?: string;
  tail?: string;
  changedFiles?: string[];
}

const treeState = (): string => git(['status', '--porcelain', '--untracked-files=no']) ?? '';

function changedBetween(before: string, after: string): string[] {
  if (before === after) return [];
  const a = new Set(before.split('\n').filter(Boolean));
  return after
    .split('\n')
    .filter(Boolean)
    .filter((line) => !a.has(line))
    .map((line) => line.trim());
}

async function runShell(cmd: string): Promise<{ exit: number | null; tail: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, {
      cwd: ROOT,
      shell: '/bin/bash',
      env: { ...process.env, V1_READINESS_DEPTH: String(Number(process.env.V1_READINESS_DEPTH ?? 0) + 1), FORCE_COLOR: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let buffer = '';
    const take = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      if (buffer.length > TAIL_BYTES * 4) buffer = buffer.slice(-TAIL_BYTES * 2);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('close', (code) => resolve({ exit: code, tail: buffer.slice(-TAIL_BYTES) }));
    child.on('error', (err) => resolve({ exit: null, tail: String(err) }));
  });
}

class Runner {
  private memo = new Map<string, { result: CommandResult; rowId: string }>();
  constructor(
    private readonly opts: Options,
    private readonly map: LaneMap,
    private readonly oracle: LaneOracle,
  ) {}

  async run(rowId: string, cmd: string, phase: Chain['phase']): Promise<CommandResult> {
    const groups = laneGroups(this.map, cmd);
    const lanes = lanesForCommand(this.map, cmd);
    const base: CommandResult = { command: cmd, state: 'UNRUN', seconds: 0, exit: null, lanes: [...lanes].sort() };
    if (phase === 'post-publish' && this.opts.preRelease) return { ...base, state: 'DEFERRED' };
    if (this.opts.dryRun) return base;
    if (this.opts.trustLanes && groups) {
      const cited: string[] = [];
      let complete = true;
      for (const group of groups) {
        let found: LaneEvidence | null = null;
        for (const lane of [...group].sort()) {
          found = await this.oracle.evidence(lane);
          if (found) break;
        }
        if (!found) {
          complete = false;
          break;
        }
        const label = `${found.lane} run ${found.runId}${found.kind === 'this-run' ? ' (this run)' : ''}`;
        if (!cited.includes(label)) cited.push(label);
      }
      if (complete) return { ...base, state: 'GREEN-BY-LANE', laneRun: cited.join(' + ') };
    }
    if (this.opts.reuse && this.memo.has(cmd)) {
      const prior = this.memo.get(cmd)!;
      return { ...prior.result, reusedFrom: prior.rowId };
    }
    console.log(`\n▶ ${rowId}  ${cmd}`);
    const before = treeState();
    const started = Date.now();
    const { exit, tail } = await runShell(cmd);
    const seconds = Math.round((Date.now() - started) / 1000);
    const changedFiles = changedBetween(before, treeState());
    const result: CommandResult = { ...base, state: exit === 0 ? 'GREEN' : 'RED', seconds, exit, tail, changedFiles };
    console.log(`${exit === 0 ? '✔' : '✖'} ${cmd}  (${seconds}s${changedFiles.length ? `; changed ${changedFiles.join(', ')}` : ''})`);
    if (exit !== 0) console.log(tail.split('\n').slice(-25).map((l) => `    ${l}`).join('\n'));
    this.memo.set(cmd, { result, rowId });
    return result;
  }
}

// ---------------------------------------------------------------- the audit ledger
export interface LedgerEntry {
  id: string;
  severity: 'P0' | 'P1';
  title: string;
  source: string;
  status: 'closed' | 'refuted' | 'open-human';
  closing?: { commits: string[]; section: string };
  acceptance?: string;
  checklistRow?: string;
  note?: string;
}
export interface LedgerVerification {
  entry: LedgerEntry;
  state: 'CLOSED' | 'REFUTED' | 'OPEN-HUMAN' | 'RED';
  problems: string[];
  command?: CommandResult;
}

async function verifyLedger(
  entries: LedgerEntry[],
  runner: Runner,
  files: (rel: string) => string | null,
  opts: Options,
  isAncestor: (sha: string) => boolean = (sha) => {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: ROOT, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  },
): Promise<LedgerVerification[]> {
  const out: LedgerVerification[] = [];
  for (const entry of entries) {
    const problems: string[] = [];
    if (entry.severity !== 'P0' && entry.severity !== 'P1') problems.push(`severity ${entry.severity} is not P0/P1`);
    let command: CommandResult | undefined;
    if (entry.status === 'open-human') {
      if (!entry.checklistRow) problems.push('open-human row names no RELEASE_CHECKLIST row');
      else {
        const checklist = files('RELEASE_CHECKLIST.md') ?? '';
        if (!checklist.includes(entry.checklistRow)) problems.push(`RELEASE_CHECKLIST.md does not contain "${entry.checklistRow}"`);
      }
    } else {
      if (!entry.closing?.commits.length) problems.push('no closing commit');
      for (const sha of entry.closing?.commits ?? []) {
        if (!isAncestor(sha)) problems.push(`closing commit ${sha} is not on this history`);
      }
      if (!entry.closing?.section) problems.push('no docs section or file cited');
      else {
        const [file, anchor] = entry.closing.section.split('#', 2);
        const content = files(file);
        if (content === null) problems.push(`${file} does not exist`);
        else if (anchor && !file.endsWith('.md')) problems.push(`${file} is not markdown — it cannot carry anchor #${anchor}`);
        else if (anchor && !markdownAnchors(content).has(anchor)) problems.push(`${file} has no anchor #${anchor}`);
      }
      if (!entry.acceptance) problems.push('no acceptance command');
      else {
        command = await runner.run(`ledger:${entry.id}`, entry.acceptance, 'acceptance');
        if (command.state === 'RED') problems.push(`acceptance command exited ${command.exit}`);
        else if (command.state === 'UNRUN' && !opts.dryRun) problems.push('acceptance command not run');
      }
    }
    const state: LedgerVerification['state'] = problems.length
      ? 'RED'
      : entry.status === 'open-human'
        ? 'OPEN-HUMAN'
        : entry.status === 'refuted'
          ? 'REFUTED'
          : 'CLOSED';
    if (state === 'OPEN-HUMAN' && !opts.preRelease) problems.push('open human row (pass --pre-release to name it instead of failing)');
    out.push({ entry, state, problems, command });
  }
  return out;
}

function renderLedger(verifications: LedgerVerification[], source: { source: string; built: string }, commit: string, dryRun: boolean): string {
  const lines: string[] = [];
  lines.push('# V1-REL-01 — P0/P1 audit ledger');
  lines.push('');
  lines.push(`Generated by \`npm run v1:readiness\` from \`parity/receipts/v1/audit-ledger.json\` at commit \`${commit}\`${dryRun ? ' (dry run — acceptance commands NOT executed)' : ''}. Edit the JSON, never this file.`);
  lines.push('');
  lines.push(`**Source.** ${source.source}`);
  lines.push('');
  lines.push(`**Built.** ${source.built}`);
  lines.push('');
  const counts = { CLOSED: 0, REFUTED: 0, 'OPEN-HUMAN': 0, RED: 0 };
  for (const v of verifications) counts[v.state] += 1;
  lines.push(
    `**Rows.** ${verifications.length} · closed ${counts.CLOSED} · refuted ${counts.REFUTED} · open (human) ${counts['OPEN-HUMAN']} · red ${counts.RED}`,
  );
  lines.push('');
  lines.push('| task | sev | state | title | closing commit(s) | acceptance command | result |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const v of verifications) {
    const e = v.entry;
    const commits = e.closing?.commits.map((c) => `\`${c}\``).join(' ') ?? (e.status === 'open-human' ? `human: ${e.checklistRow ?? '?'}` : '—');
    const cmd = e.acceptance ? `\`${e.acceptance.replace(/\|/g, '\\|')}\`` : '—';
    const result = v.command
      ? v.command.state === 'GREEN'
        ? `exit 0${v.command.reusedFrom ? ` (reused: ${v.command.reusedFrom})` : ''}`
        : v.command.state === 'GREEN-BY-LANE'
          ? `by lane: ${v.command.laneRun}`
          : v.command.state === 'UNRUN'
            ? 'not run'
            : `exit ${v.command.exit}`
      : e.status === 'open-human'
        ? 'awaiting the human act'
        : '—';
    const problems = v.problems.length ? ` — ${v.problems.join('; ')}` : '';
    lines.push(`| ${e.id} | ${e.severity} | **${v.state}**${problems} | ${e.title.replace(/\|/g, '\\|')} | ${commits} | ${cmd} | ${result} |`);
  }
  lines.push('');
  lines.push('## Provenance per row');
  lines.push('');
  for (const v of verifications) {
    const e = v.entry;
    lines.push(`- **${e.id}** (${e.severity}) — ${e.source}${e.closing?.section ? ` → [${e.closing.section.split('#')[1] ?? e.closing.section}](../../../${e.closing.section})` : ''}${e.note ? `. ${e.note}` : ''}`);
  }
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------- rows
export interface RowResult {
  id: string;
  line: number;
  state: string;
  chains: Array<{ phase: Chain['phase']; commands: CommandResult[] }>;
  mentioned: string[];
  evidence: EvidenceRef[];
  human: string[];
  seconds: number;
  notes: string[];
  ledger?: LedgerVerification[];
}

export function rowVerdict(r: RowResult, opts: Options): boolean {
  if (r.state === 'SKIPPED') return opts.allowSkip;
  // A dry run proves the definition parses and every evidence reference
  // resolves; UNRUN is its expected state and is not a failure there.
  if (opts.dryRun) return r.state !== 'RED' && r.state !== 'EVIDENCE-MISSING';
  return r.state.startsWith('GREEN') || r.state === 'LANE-COVERED';
}

async function evaluateRow(row: Row, runner: Runner, map: LaneMap, opts: Options, ledgerRun?: () => Promise<LedgerVerification[]>): Promise<RowResult> {
  const result: RowResult = {
    id: row.id,
    line: row.line,
    state: 'UNRUN',
    chains: [],
    mentioned: row.mentioned,
    evidence: row.evidence,
    human: row.human,
    seconds: 0,
    notes: [],
  };
  const skipped = opts.skip.has(row.id) || (opts.only !== null && !opts.only.has(row.id));
  if (skipped) {
    result.state = 'SKIPPED';
    result.notes.push(opts.only && !opts.only.has(row.id) ? 'not in --only' : 'named in --skip');
    return result;
  }
  if (opts.lanesOnly) {
    const all = row.chains.filter((c) => c.phase === 'acceptance').flatMap((c) => c.commands);
    const uncovered = all.filter((c) => laneGroups(map, c) === null);
    if (all.length && !uncovered.length) {
      result.state = 'LANE-COVERED';
      result.notes.push(`every command is a lane step: ${all.map((c) => `${c} (${[...lanesForCommand(map, c)].sort().join('+')})`).join('; ')}`);
      return result;
    }
  }
  let red = false;
  let unrun = false;
  let anyRan = false;
  let allByLane = row.chains.some((c) => c.phase === 'acceptance');
  for (const chain of row.chains) {
    const commands: CommandResult[] = [];
    let failed = false;
    for (const cmd of chain.commands) {
      if (failed) {
        commands.push({ command: cmd, state: 'UNRUN', seconds: 0, exit: null, lanes: [...lanesForCommand(map, cmd)].sort() });
        continue;
      }
      const r = await runner.run(row.id, cmd, chain.phase);
      commands.push(r);
      result.seconds += r.reusedFrom ? 0 : r.seconds;
      if (r.state === 'RED') {
        failed = true;
        red = true;
      } else if (r.state === 'UNRUN') unrun = true;
      else if (r.state === 'GREEN') {
        anyRan = true;
        allByLane = false;
      }
    }
    if (commands.some((c) => c.state === 'DEFERRED')) result.notes.push(`post-publish chain deferred (--pre-release): ${chain.raw}`);
    result.chains.push({ phase: chain.phase, commands });
  }
  if (opts.dryRun) unrun = true;
  if (ledgerRun) {
    result.ledger = await ledgerRun();
    const bad = result.ledger.filter((v) => v.state === 'RED' || (v.state === 'OPEN-HUMAN' && !opts.preRelease));
    if (bad.length) {
      red = true;
      result.notes.push(`audit ledger: ${bad.map((v) => `${v.entry.id} ${v.state}`).join(', ')}`);
    }
    const open = result.ledger.filter((v) => v.state === 'OPEN-HUMAN');
    if (open.length && opts.preRelease) result.notes.push(`audit ledger: ${open.length} open human row(s) named (--pre-release): ${open.map((v) => v.entry.id).join(', ')}`);
    for (const v of result.ledger) result.seconds += v.command && !v.command.reusedFrom ? v.command.seconds : 0;
    if (!opts.dryRun) unrun = unrun || result.ledger.some((v) => v.command?.state === 'UNRUN');
  }
  const evidenceMissing = row.evidence.some((e) => e.state !== 'OK');
  if (red) result.state = 'RED';
  else if (evidenceMissing) result.state = 'EVIDENCE-MISSING';
  else if (unrun) result.state = 'UNRUN';
  else if (!row.chains.length && !ledgerRun) result.state = 'GREEN';
  else if (allByLane && !anyRan) result.state = 'GREEN-BY-LANE';
  else result.state = 'GREEN';
  if (evidenceMissing) result.notes.push(`evidence: ${row.evidence.filter((e) => e.state !== 'OK').map((e) => `${e.raw} ${e.state}`).join(', ')}`);
  return result;
}

// ---------------------------------------------------------------- receipt
function renderReceipt(results: RowResult[], meta: Record<string, string>, oracleNotes: string[]): string {
  const L: string[] = [];
  L.push('# V1 readiness — every row of docs/26, run on this commit');
  L.push('');
  L.push('Written by `npm run v1:readiness` (scripts/v1-readiness.ts). The rows, their commands and their evidence references are parsed from docs/26-v1-definition.md — nothing here is listed by hand. Seconds are measured and move run to run; nothing else in this file should.');
  L.push('');
  for (const [k, v] of Object.entries(meta)) L.push(`- **${k}:** ${v}`);
  L.push('');
  const tally = new Map<string, number>();
  for (const r of results) tally.set(r.state, (tally.get(r.state) ?? 0) + 1);
  L.push(`**Tally.** ${[...tally.entries()].map(([s, n]) => `${s} ${n}`).join(' · ')} — ${results.length} rows.`);
  L.push('');
  L.push('| row | state | command | seconds | evidence |');
  L.push('|---|---|---|---|---|');
  const esc = (s: string) => s.replace(/\|/g, '\\|');
  for (const r of results) {
    const cmdCell = r.chains.length
      ? r.chains
          .map((c) => `${c.phase === 'post-publish' ? 'after publish: ' : ''}${c.commands.map((x) => `${marker(x.state)} \`${esc(x.command)}\`${x.laneRun ? ` ⟨${x.laneRun}⟩` : ''}${x.reusedFrom ? ` ⟨reused ${x.reusedFrom}⟩` : ''}`).join(' && ')}`)
          .join('<br>')
      : '— (evidence only)';
    const ev = [
      ...r.evidence.map((e) => `${e.state === 'OK' ? '✔' : '✖'} ${esc(e.raw)}${e.state === 'OK' ? '' : ` ${e.state}`}`),
      ...r.human.map((h) => `human: ${esc(h)}`),
      ...(r.ledger ? [`ledger: ${r.ledger.length} rows — ${['CLOSED', 'REFUTED', 'OPEN-HUMAN', 'RED'].map((s) => `${s.toLowerCase()} ${r.ledger!.filter((v) => v.state === s).length}`).join(', ')} ([AUDIT-LEDGER.md](AUDIT-LEDGER.md))`] : []),
      ...r.mentioned.map((m) => `mentions (not run): \`${esc(m)}\``),
      ...r.notes.map((n) => esc(n)),
    ].join('<br>');
    L.push(`| ${r.id} | **${r.state}** | ${cmdCell} | ${r.seconds} | ${ev || '—'} |`);
  }
  L.push('');
  if (oracleNotes.length) {
    L.push('## Lane evidence notes');
    L.push('');
    for (const n of oracleNotes) L.push(`- ${n}`);
    L.push('');
  }
  const changed = results.flatMap((r) => r.chains.flatMap((c) => c.commands.filter((x) => x.changedFiles?.length && !x.reusedFrom).map((x) => `${r.id}: \`${x.command}\` changed ${x.changedFiles!.join(', ')}`)));
  L.push('## Tracked files a command rewrote');
  L.push('');
  if (changed.length) for (const c of changed) L.push(`- ${c}`);
  else L.push('- none');
  L.push('');
  L.push('## Red and unrun commands — captured tail');
  L.push('');
  let any = false;
  for (const r of results)
    for (const c of r.chains)
      for (const x of c.commands)
        if (x.state === 'RED' && x.tail && !x.reusedFrom) {
          any = true;
          L.push(`### ${r.id} — \`${x.command}\` (exit ${x.exit}, ${x.seconds}s)`);
          L.push('');
          L.push('```');
          L.push(x.tail.trim().split('\n').slice(-30).join('\n'));
          L.push('```');
          L.push('');
        }
  if (!any) L.push('- none');
  L.push('');
  return L.join('\n');
}

const marker = (s: CommandResult['state']) =>
  s === 'GREEN' ? '✔' : s === 'GREEN-BY-LANE' ? '✔lane' : s === 'RED' ? '✖' : s === 'DEFERRED' ? '⏸' : '·';

// ---------------------------------------------------------------- self-test
async function selfTest(): Promise<void> {
  const files = repoFileReader(ROOT);
  const real = parseDefinition(files(DOCUMENT_PATH)!, files);
  if (real.length < 20) throw new Error(`parsed only ${real.length} rows from ${DOCUMENT_PATH}`);
  for (const r of real) {
    if (!r.chains.length && !r.evidence.length && !r.human.length) throw new Error(`${r.id}: neither a command chain, an evidence reference nor a named human evidence item`);
  }
  const rel02 = real.find((r) => r.id === 'V1-REL-02');
  if (!rel02 || !rel02.chains.some((c) => c.phase === 'post-publish')) throw new Error('V1-REL-02: the "after publish:" chain was not recognised as post-publish');
  const j03 = real.find((r) => r.id === 'V1-JOURNEY-03');
  if (!j03 || j03.chains.length !== 1 || !j03.mentioned.some((m) => m.includes('parity:snapshot:rest'))) {
    throw new Error('V1-JOURNEY-03: the refresh recipe `parity:snapshot:rest` must be a mention, never a chain');
  }
  const map = collectLaneMap(ROOT);
  if (!lanesForCommand(map, 'npm run docs:check').has('fast')) throw new Error('lane map: docs:check should be a fast-lane step');
  if (!lanesForCommand(map, 'npm run test:onboarding').has('fast')) throw new Error('lane map: test:onboarding should resolve through test:cli to the fast lane');
  if (lanesForCommand(map, 'npm run conformance:canvas').size) throw new Error('lane map: conformance:canvas is not a lane step today');

  const synthetic = [
    '## Requirements',
    '',
    '| ID | Requirement | Exact acceptance command or evidence |',
    '|---|---|---|',
    '| **T-GREEN** | a green row | `node -e "process.exit(0)"`; evidence: [A](23-known-limitations.md#a--irreducible). |',
    '| **T-RED** | a red row | `node -e "process.exit(0)" && node -e "process.exit(3)" && node -e "process.exit(0)"` |',
    '| **T-EVID** | a row whose anchor is gone | `node -e "process.exit(0)"`; evidence: [gone](23-known-limitations.md#no-such-heading-anywhere). |',
    '| **T-FILE** | a row whose file is gone | Evidence: parity/receipts/does-not-exist.md; `node -e "process.exit(0)"` |',
    '',
    '## V1 blockers',
  ].join('\n');
  const rows = parseDefinition(synthetic, files);
  const opts: Options = { only: null, skip: new Set(), allowSkip: false, dryRun: false, lanesOnly: false, trustLanes: false, preRelease: false, reuse: true, prep: false, nested: false };
  const runner = new Runner(opts, map, new LaneOracle(false));
  const results: RowResult[] = [];
  for (const row of rows) results.push(await evaluateRow(row, runner, map, opts));
  const byId = Object.fromEntries(results.map((r) => [r.id, r]));
  const expect = (id: string, state: string) => {
    if (byId[id]?.state !== state) throw new Error(`${id}: expected ${state}, got ${byId[id]?.state} (${byId[id]?.notes.join('; ')})`);
  };
  expect('T-GREEN', 'GREEN');
  expect('T-RED', 'RED');
  expect('T-EVID', 'EVIDENCE-MISSING');
  expect('T-FILE', 'EVIDENCE-MISSING');
  const redChain = byId['T-RED'].chains[0].commands;
  if (redChain[1].state !== 'RED' || redChain[2].state !== 'UNRUN') throw new Error('T-RED: the command behind a failed && must be UNRUN');
  if (results.some((r) => rowVerdict(r, opts) && r.id !== 'T-GREEN')) throw new Error('a non-green row passed the verdict');

  const ledger: LedgerEntry[] = [
    { id: 'L-OK', severity: 'P0', title: 'closed', source: 't', status: 'closed', closing: { commits: [git(['rev-parse', 'HEAD'])!], section: 'docs/23-known-limitations.md#a--irreducible' }, acceptance: 'node -e "process.exit(0)"' },
    { id: 'L-NOCOMMIT', severity: 'P0', title: 'no such commit', source: 't', status: 'closed', closing: { commits: ['0000000000000000000000000000000000000000'], section: 'docs/23-known-limitations.md#a--irreducible' }, acceptance: 'node -e "process.exit(0)"' },
    { id: 'L-REDCMD', severity: 'P1', title: 'command fails', source: 't', status: 'closed', closing: { commits: [git(['rev-parse', 'HEAD'])!], section: 'docs/23-known-limitations.md#a--irreducible' }, acceptance: 'node -e "process.exit(2)"' },
    { id: 'L-BADANCHOR', severity: 'P1', title: 'anchor gone', source: 't', status: 'closed', closing: { commits: [git(['rev-parse', 'HEAD'])!], section: 'docs/23-known-limitations.md#nope-nope' }, acceptance: 'node -e "process.exit(0)"' },
    { id: 'L-HUMAN', severity: 'P1', title: 'human', source: 't', status: 'open-human', checklistRow: 'Signed RC tag approved' },
    { id: 'L-HUMAN-FAKE', severity: 'P1', title: 'human row nobody owns', source: 't', status: 'open-human', checklistRow: 'a row RELEASE_CHECKLIST does not have' },
  ];
  const verified = await verifyLedger(ledger, runner, files, opts);
  const st = Object.fromEntries(verified.map((v) => [v.entry.id, v]));
  const expectL = (id: string, state: string) => {
    if (st[id]?.state !== state) throw new Error(`ledger ${id}: expected ${state}, got ${st[id]?.state} (${st[id]?.problems.join('; ')})`);
  };
  expectL('L-OK', 'CLOSED');
  expectL('L-NOCOMMIT', 'RED');
  expectL('L-REDCMD', 'RED');
  expectL('L-BADANCHOR', 'RED');
  expectL('L-HUMAN', 'OPEN-HUMAN');
  expectL('L-HUMAN-FAKE', 'RED');
  if (!st['L-HUMAN'].problems.length) throw new Error('an open human row must be a problem without --pre-release');
  const pre = await verifyLedger([ledger[4]], runner, files, { ...opts, preRelease: true });
  if (pre[0].problems.length) throw new Error('--pre-release must name, not fail, an open human row');

  // the committed ledger parses and every row is P0/P1 with a source
  const committed = JSON.parse(readFileSync(LEDGER_SOURCE, 'utf8')) as { rows: LedgerEntry[] };
  const ids = new Set<string>();
  for (const e of committed.rows) {
    if (ids.has(e.id)) throw new Error(`audit-ledger.json: duplicate id ${e.id}`);
    ids.add(e.id);
    if (!e.source || (e.severity !== 'P0' && e.severity !== 'P1')) throw new Error(`audit-ledger.json: ${e.id} lacks a source or a P0/P1 severity`);
    if (e.status !== 'open-human' && (!e.closing?.commits.length || !e.acceptance)) throw new Error(`audit-ledger.json: ${e.id} is ${e.status} without a commit + command`);
  }

  // nested: a child invocation must not run commands again
  const nested = execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url), '--only', 'V1-COMPAT-01', '--allow-skip'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, V1_READINESS_DEPTH: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!/nested inside v1:readiness/.test(nested)) throw new Error('nested invocation did not announce itself');

  console.log(
    '✔ v1:readiness self-test: a failing command is RED and the command behind it UNRUN; a missing anchor and a missing file are EVIDENCE-MISSING; a ledger row with a foreign commit, a failing command, a dead anchor or an unowned human row is RED; an open human row is named only under --pre-release; the post-publish chain and the refresh mention parse as such; the lane map resolves composites; a nested run executes nothing',
  );
}

// ---------------------------------------------------------------- main
async function main(): Promise<number> {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.nested) {
    console.log(`· v1:readiness: nested inside v1:readiness (V1_READINESS_DEPTH=${process.env.V1_READINESS_DEPTH}) — running as --dry-run; the outer run executes every row`);
    opts.dryRun = true;
  }
  const files = repoFileReader(ROOT);
  const definition = files(DOCUMENT_PATH);
  if (definition === null) throw new Error(`${DOCUMENT_PATH} is missing`);
  const rows = parseDefinition(definition, files);
  const map = collectLaneMap(ROOT);
  if (map.problems.length) console.warn(`! lane map problems (ci:lanes is the gate for these):\n  ${map.problems.join('\n  ')}`);
  const oracle = new LaneOracle(opts.trustLanes);
  const runner = new Runner(opts, map, oracle);
  const ledgerSource = JSON.parse(readFileSync(LEDGER_SOURCE, 'utf8')) as { source: string; built: string; rows: LedgerEntry[] };
  const commit = git(['rev-parse', 'HEAD']) ?? 'unknown';
  const dirty = treeState() !== '';
  const flags = process.argv.slice(2).filter((a) => a.startsWith('--')).join(' ') || '(none)';

  console.log(`V1 READINESS — ${rows.length} rows from ${DOCUMENT_PATH} at ${commit.slice(0, 8)}${dirty ? ' (DIRTY tree)' : ''}; flags: ${flags}`);
  if (opts.dryRun) {
    console.log('DRY RUN — commands are listed, evidence is resolved, nothing executes\n');
    for (const r of rows) {
      console.log(`${r.id}`);
      for (const c of r.chains) for (const cmd of c.commands) console.log(`    ${c.phase === 'post-publish' ? '[after publish] ' : ''}${cmd}  ${[...lanesForCommand(map, cmd)].sort().join('+') || (parseCommand(cmd).kind === 'lane-run' ? 'lane' : 'no lane')}`);
      for (const m of r.mentioned) console.log(`    (mentions, not run) ${m}`);
      for (const e of r.evidence) console.log(`    evidence ${e.state === 'OK' ? '✔' : '✖'} ${e.raw}${e.state === 'OK' ? '' : ` ${e.state}`}`);
      for (const h of r.human) console.log(`    human: ${h}`);
    }
    console.log('');
  }

  // The lanes' prep steps (CI_LANE_STEP: prep): the package builds, build:lib
  // and plugin:zip a cold tree needs before plugin:ui-check / verify:package /
  // publish:check can mean anything. npm ci, the browser install and apt are
  // not npm scripts and are left to the person, as `npm run ci:lane` does.
  const prepSteps: string[] = [];
  for (const lane of ['fast', 'full', 'catalog-visual']) {
    const wf = map.workflows.find((w) => w.lane === lane);
    for (const job of Object.values(wf?.jobs ?? {}))
      for (const step of job.steps ?? []) {
        const run = (step.run ?? '').trim();
        if (step.env?.CI_LANE_STEP === 'prep' && /^npm (?:--prefix \S+ )?run /.test(run) && !prepSteps.includes(run)) prepSteps.push(run);
      }
  }
  const prep: CommandResult[] = [];
  if (opts.dryRun) {
    console.log(`PREP (lane prep steps, run first unless --no-prep): ${prepSteps.join(' · ') || 'none'}\n`);
  } else if (opts.prep) {
    console.log(`PREP — ${prepSteps.length} lane prep step(s)`);
    for (const step of prepSteps) prep.push(await runner.run('prep', step, 'acceptance'));
  }

  const results: RowResult[] = [];
  for (const row of rows) {
    const ledgerRun = row.id === 'V1-REL-01' ? () => verifyLedger(ledgerSource.rows, runner, files, opts) : undefined;
    results.push(await evaluateRow(row, runner, map, opts, ledgerRun));
  }

  const meta: Record<string, string> = {
    commit: `\`${commit}\``,
    'tree dirty at start': dirty ? 'YES' : 'no',
    definition: `${DOCUMENT_PATH} sha256 \`${createHash('sha256').update(definition).digest('hex').slice(0, 16)}\``,
    flags,
    'lane map': `${map.workflows.map((w) => w.lane).sort().join(', ')} (from .github/workflows via .github/scripts/lane-map.ts)`,
    prep: opts.prep
      ? prep.length
        ? prep.map((p) => `${marker(p.state)} \`${p.command}\` ${p.seconds}s`).join(' · ')
        : 'none'
      : 'skipped (--no-prep)',
  };
  const receipt = renderReceipt(results, meta, oracle.notes);
  const complete = !opts.only && !opts.skip.size && !opts.lanesOnly && !opts.dryRun;
  const rel01 = results.find((r) => r.id === 'V1-REL-01');
  if (complete) {
    mkdirSync(RECEIPT_DIR, { recursive: true });
    writeFileSync(path.join(RECEIPT_DIR, 'READINESS.md'), receipt);
    writeFileSync(path.join(RECEIPT_DIR, 'READINESS.json'), `${JSON.stringify({ meta: { commit, dirty, flags }, prep, rows: results, laneNotes: oracle.notes }, null, 2)}\n`);
    if (rel01?.ledger) writeFileSync(path.join(RECEIPT_DIR, 'AUDIT-LEDGER.md'), renderLedger(rel01.ledger, ledgerSource, commit, false));
    console.log(`\nwrote parity/receipts/v1/READINESS.md, READINESS.json${rel01?.ledger ? ', AUDIT-LEDGER.md' : ''}`);
  } else if (rel01?.ledger && !opts.dryRun) {
    // The ledger receipt derives from audit-ledger.json + this verification
    // alone, so a partial run that DID verify V1-REL-01 may re-record it —
    // the row-level READINESS receipt stays reserved for complete runs.
    mkdirSync(RECEIPT_DIR, { recursive: true });
    writeFileSync(path.join(RECEIPT_DIR, 'AUDIT-LEDGER.md'), renderLedger(rel01.ledger, ledgerSource, commit, false));
    console.log('\nwrote parity/receipts/v1/AUDIT-LEDGER.md (partial run; READINESS.md untouched)');
  }

  console.log('\nROW                STATE               SECONDS  NOTES');
  for (const r of results) console.log(`${r.id.padEnd(18)} ${r.state.padEnd(19)} ${String(r.seconds).padStart(7)}  ${r.notes.join('; ')}`);
  const failing = results.filter((r) => !rowVerdict(r, opts));
  if (failing.length) {
    console.error(`\n✖ v1:readiness — ${failing.length} of ${results.length} rows not green: ${failing.map((r) => `${r.id} ${r.state}`).join(', ')}`);
    return 1;
  }
  console.log(
    opts.dryRun
      ? `\n✔ v1:readiness dry run — ${results.length} rows parsed, every evidence reference resolves; nothing executed`
      : `\n✔ v1:readiness — ${results.length}/${results.length} rows green`,
  );
  return 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const task = process.argv.includes('--self-test') ? selfTest().then(() => 0) : main();
  task
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(`✖ v1:readiness — ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    });
}

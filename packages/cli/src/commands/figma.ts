/**
 * `ds-contracts figma` — the canvas as an emit target, both directions.
 *
 *   figma <contracts..> --out <dir> [--tokens f,f] [--icons dir] [--file-key KEY]
 *       emit one Figma Plugin API sync script per contract
 *       (core/emit-figma-script — referee-gated, same engine as the repo)
 *
 *   figma bundle <contracts..> --tokens <base.dtcg.json[,minted.dtcg.json]>
 *       [--modes <light.json[,dark.json]>] [--name <collection>] --out <file.json>
 *       emit a SELF-CONTAINED CONTRACTS-BUNDLE (contracts + tokenSet) — the
 *       one JSON a foreign-library user pastes into the plugin's Generate
 *       tab. The tokenSet carries the flat DTCG base, optional light/dark
 *       mode overrides, and the minted tree; the plugin syncs it as one
 *       named variable collection (Light/Dark modes, Figma-native aliases
 *       for {alias} minted leaves) and resolves the contracts against
 *       base + minted. Deterministic: same inputs → byte-identical bundle.
 *
 *   figma push <bundle-or-contract.json> --code <PAIRING-CODE> [--bridge <url>]
 *       send a CONTRACTS-BUNDLE through the plugin bridge under a pairing
 *       code (the reverse direction of Send-to-Playground). A single
 *       contract document is wrapped into a one-contract bundle. The bridge
 *       stays a dumb pipe: the payload is tagged, never inspected beyond
 *       "is it JSON / is it a well-formed bundle envelope".
 *
 *   figma claim-channel [--bridge <url>]
 *       mint a STANDING CI↔Figma channel: a { writeKey, readKey } pair.
 *       The write key is a CI secret (it publishes); the read key —
 *       sha256(writeKey) — is the half a designer pastes into the plugin.
 *       One-way derivation, so a leaked Figma-side key can read but can
 *       never inject. See workers/assist/src/channel.ts.
 *
 *   figma publish <bundle-or-contract.json> [--channel-key KEY] [--bridge <url>]
 *       [--repo o/n] [--run-id ID] [--run-url URL] [--commit SHA] [--ref REF]
 *       [--no-provenance] [--dry-run]
 *       publish a CONTRACTS-BUNDLE to the standing channel. The designer's
 *       plugin finds it waiting — no pairing code, no human courier, no
 *       synchronous window. GitHub Actions context is auto-detected into a
 *       provenance SIBLING of the bundle (never inside the bundle bytes, so
 *       `figma bundle` output stays byte-deterministic).
 *
 *   figma receive --out <contracts-dir> [--bridge <url>] [--apply]
 *       the DEV DOOR: open a bridge session, print the pairing code, wait
 *       for the plugin's Propose tab to send its CONTRACT-PROPOSAL under
 *       that code, then land it as a REVIEWED LOCAL DIFF. Without --apply
 *       nothing but the proposal artifact (<out>/.proposals/<id>.proposal.json)
 *       is written — the contract file is never touched silently. With
 *       --apply the contract file is written too; git stays yours.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { figmaScriptEmitter } from '../../../../core/emitter.js';
import {
  buildEmitterCtx,
  CliUsageError,
  expandContractArgs,
  flagString,
  loadContracts,
  loadIcons,
  parseFlags,
  splitList,
} from '../lib.js';

export const DEFAULT_BRIDGE_URL = 'https://ds-contracts-assist.southleft-llc.workers.dev';

/** The bundle envelope the bridge and the plugin agree on. */
export const CONTRACTS_BUNDLE_TYPE = 'CONTRACTS-BUNDLE';

export interface ContractsBundle {
  type: typeof CONTRACTS_BUNDLE_TYPE;
  version: 1;
  contracts: unknown[];
  /** Foreign token set (figma bundle writes it) — rides through push
   *  verbatim so the plugin can sync it; never inspected here. */
  tokenSet?: unknown;
  /** Bundle-carried icon assets ({name: svgMarkup}; figma bundle --icons
   *  writes it) — rides through push verbatim. */
  icons?: unknown;
}

/** Read a file as a bundle: an existing CONTRACTS-BUNDLE envelope passes
 *  through (its tokenSet included); a single contract document (has id/name)
 *  is wrapped. */
export function toBundle(filePath: string): ContractsBundle {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new CliUsageError(`${filePath}: not JSON — ${String(err instanceof Error ? err.message : err)}`);
  }
  if (raw && typeof raw === 'object' && (raw as { type?: unknown }).type === CONTRACTS_BUNDLE_TYPE) {
    const contracts = (raw as { contracts?: unknown }).contracts;
    if (!Array.isArray(contracts) || contracts.length === 0) {
      throw new CliUsageError(`${filePath}: a ${CONTRACTS_BUNDLE_TYPE} needs a non-empty "contracts" array`);
    }
    const tokenSet = (raw as { tokenSet?: unknown }).tokenSet;
    const icons = (raw as { icons?: unknown }).icons;
    return {
      type: CONTRACTS_BUNDLE_TYPE,
      version: 1,
      contracts,
      ...(tokenSet !== undefined && tokenSet !== null ? { tokenSet } : {}),
      ...(icons !== undefined && icons !== null ? { icons } : {}),
    };
  }
  if (raw && typeof raw === 'object' && typeof (raw as { id?: unknown }).id === 'string') {
    return { type: CONTRACTS_BUNDLE_TYPE, version: 1, contracts: [raw] };
  }
  throw new CliUsageError(
    `${filePath}: neither a contract document (no "id") nor a ${CONTRACTS_BUNDLE_TYPE} envelope`,
  );
}

// ---------------------------------------------------------------------------
// figma bundle — the self-contained foreign-library payload (JSON only).
// ---------------------------------------------------------------------------

const readJsonObject = (filePath: string): Record<string, unknown> => {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new CliUsageError(`${filePath}: not JSON — ${String(err instanceof Error ? err.message : err)}`);
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new CliUsageError(`${filePath}: expected a JSON object (a DTCG token file)`);
  }
  return raw as Record<string, unknown>;
};

async function bundleCommand(argv: string[]): Promise<number> {
  const parsed = parseFlags(argv, { value: ['tokens', 'modes', 'name', 'out', 'icons'] });
  if (parsed.positionals.length === 0) {
    throw new CliUsageError('figma bundle needs contract files/directories');
  }
  const out = flagString(parsed, 'out');
  if (!out) throw new CliUsageError('figma bundle needs --out <file.json>');
  const tokenFiles = splitList(flagString(parsed, 'tokens'));
  if (tokenFiles.length === 0 || tokenFiles.length > 2) {
    throw new CliUsageError(
      'figma bundle needs --tokens <base.dtcg.json[,minted.dtcg.json]> — the flat DTCG base first, the minted tree (optional) second',
    );
  }
  const modeFiles = splitList(flagString(parsed, 'modes'));
  if (modeFiles.length > 2) {
    throw new CliUsageError('figma bundle takes --modes <light.json[,dark.json]> — light first, dark (optional) second');
  }

  // Contract referee first (loadContracts refuses violations by name), then
  // embed the RAW documents — the bundle carries the files as written, not a
  // schema-normalized copy ($schema keys and field order survive verbatim).
  const files = expandContractArgs(parsed.positionals);
  loadContracts(files);
  const contracts = files.map((f) => JSON.parse(readFileSync(f, 'utf8')) as Record<string, unknown>);

  // MOLECULE round: contracts referencing icon assets (icon.asset) make the
  // bundle carry the SVGs — JSON stays the only thing a user pastes. Exactly
  // the referenced assets embed (sorted — deterministic bytes); a referenced
  // asset missing from --icons, or refs with no --icons at all, refuses BY
  // NAME (a bundle that cannot render its own icons is not a bundle).
  const iconRefs = new Set<string>();
  const collectIconRefs = (v: unknown): void => {
    if (v && typeof v === 'object') {
      const asset = (v as { icon?: { asset?: unknown } }).icon?.asset;
      if (typeof asset === 'string') iconRefs.add(asset);
      for (const x of Object.values(v)) collectIconRefs(x);
    }
  };
  for (const c of contracts) collectIconRefs(c);
  const iconsDir = flagString(parsed, 'icons');
  let icons: Record<string, string> | undefined;
  if (iconRefs.size > 0) {
    if (!iconsDir) {
      throw new CliUsageError(
        `these contracts reference ${iconRefs.size} icon asset(s) (${[...iconRefs].sort().join(', ')}) — pass --icons <dir> so the bundle can carry them`,
      );
    }
    const available = loadIcons(iconsDir);
    const missing = [...iconRefs].sort().filter((n) => !available.has(n));
    if (missing.length > 0) {
      throw new CliUsageError(`icon asset(s) referenced but not in ${iconsDir}: ${missing.join(', ')}`);
    }
    icons = Object.fromEntries([...iconRefs].sort().map((n) => [n, available.get(n)!]));
  }

  // Nested DTCG trees (Polaris's wrap) flatten to dot-path names — the
  // tokenSet base is flat by format; a nested wrap collapsing to one "token"
  // was the live finding this closes. Flat inputs pass through unchanged.
  const flattenDtcg = (node: Record<string, unknown>, prefix: string[] = [], out: Record<string, unknown> = {}): Record<string, unknown> => {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('$')) continue;
      if (v && typeof v === 'object' && '$value' in (v as object)) out[[...prefix, k].join('.')] = v;
      else if (v && typeof v === 'object') flattenDtcg(v as Record<string, unknown>, [...prefix, k], out);
    }
    return out;
  };
  const base = flattenDtcg(readJsonObject(path.resolve(tokenFiles[0])));
  const minted = tokenFiles[1] ? readJsonObject(path.resolve(tokenFiles[1])) : undefined;
  const light = modeFiles[0] ? readJsonObject(path.resolve(modeFiles[0])) : undefined;
  const dark = modeFiles[1] ? readJsonObject(path.resolve(modeFiles[1])) : undefined;
  const name = flagString(parsed, 'name') ?? 'Tokens';

  const bundle = {
    type: CONTRACTS_BUNDLE_TYPE,
    version: 1 as const,
    tokenSet: {
      name,
      base,
      ...(light || dark ? { modes: { ...(light ? { light } : {}), ...(dark ? { dark } : {}) } } : {}),
      ...(minted ? { minted } : {}),
    },
    ...(icons ? { icons } : {}),
    contracts,
  };
  const text = JSON.stringify(bundle, null, 2) + '\n';
  const outPath = path.resolve(out);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, text);
  const baseCount = Object.keys(base).length;
  console.log(
    `✔ Bundle written: ${out} — ${contracts.length} contract(s) + tokenSet "${name}" (${baseCount} base tokens${minted ? ', minted tree' : ''}${light || dark ? `, modes: ${[light && 'light', dark && 'dark'].filter(Boolean).join('/')}` : ''}${icons ? `, ${Object.keys(icons).length} icon asset(s)` : ''}; ${text.length} bytes). Paste it into the plugin's Generate tab — JSON is the only thing a user ever pastes.`,
  );
  return 0;
}

async function pushCommand(argv: string[]): Promise<number> {
  const parsed = parseFlags(argv, { value: ['code', 'bridge'] });
  const file = parsed.positionals[0];
  if (!file) throw new CliUsageError('figma push needs a bundle or contract JSON file');
  const code = flagString(parsed, 'code');
  if (!code) {
    throw new CliUsageError(
      'figma push needs --code <PAIRING-CODE> — the 6-character code shown in the Figma plugin’s Receive panel',
    );
  }
  const base = (
    flagString(parsed, 'bridge') ??
    process.env.DS_CONTRACTS_BRIDGE_URL ??
    DEFAULT_BRIDGE_URL
  ).replace(/\/$/, '');
  const bundle = toBundle(file);
  const body = JSON.stringify(bundle);
  const res = await fetch(`${base}/bridge/${encodeURIComponent(code.toUpperCase())}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  const answer = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean; bytes?: number };
  if (!res.ok) {
    console.error(`✘ bridge refused (${res.status}): ${answer.error ?? 'unnamed error'}`);
    return 1;
  }
  console.log(
    `✔ Pushed ${CONTRACTS_BUNDLE_TYPE} (${bundle.contracts.length} contract(s), ${body.length} bytes) under code ${code.toUpperCase()} — deliver-once, 15-minute TTL`,
  );
  return 0;
}

// ---------------------------------------------------------------------------
// figma claim-channel / figma publish — THE STANDING CI↔FIGMA CHANNEL
// (docs/18 G1, slice S1+S2). PURE CORE first (provenance detection, the
// publish envelope, the dry-run plan — all unit/eval-pinnable with no I/O),
// thin network shells at the bottom.
//
// KEY DISCIPLINE, copied verbatim from propose-pr.ts: the channel write key
// comes from --channel-key or DS_CONTRACTS_CHANNEL_KEY, lives in ONE local
// variable for the duration of the run, and is NEVER persisted, logged, or
// echoed — only a masked prefix ever reaches stdout. --dry-run prints the
// exact plan with no network call and no key required.
// ---------------------------------------------------------------------------

/** The CI-side facts that ride ALONGSIDE the bundle. Never inside it: the
 *  bundle bytes stay exactly what `figma bundle` wrote, so its determinism
 *  guarantee survives contact with the channel. */
export interface ChannelProvenance {
  repo?: string;
  runId?: string;
  runUrl?: string;
  commit?: string;
  ref?: string;
  publishedAt: string;
}

/** GitHub Actions context → provenance. PURE: the environment and the clock
 *  are both arguments. Overrides win over detection; a run with neither
 *  yields null (a publish with no provenance is allowed and says so —
 *  inventing "unknown" fields would be a lie the plugin then renders). */
export function detectProvenance(
  env: Record<string, string | undefined>,
  overrides: {
    repo?: string;
    runId?: string;
    runUrl?: string;
    commit?: string;
    ref?: string;
  },
  now: Date,
): ChannelProvenance | null {
  const repo = overrides.repo ?? env.GITHUB_REPOSITORY;
  const runId = overrides.runId ?? env.GITHUB_RUN_ID;
  const commit = overrides.commit ?? env.GITHUB_SHA;
  const ref = overrides.ref ?? env.GITHUB_REF;
  const server = env.GITHUB_SERVER_URL ?? 'https://github.com';
  const runUrl =
    overrides.runUrl ??
    env.GITHUB_RUN_URL ??
    (repo && runId ? `${server}/${repo}/actions/runs/${runId}` : undefined);
  if (!repo && !runId && !commit && !ref) return null;
  return {
    ...(repo ? { repo } : {}),
    ...(runId ? { runId } : {}),
    ...(runUrl ? { runUrl } : {}),
    ...(commit ? { commit } : {}),
    ...(ref ? { ref } : {}),
    publishedAt: now.toISOString(),
  };
}

/** The publish envelope: bundle + optional provenance SIBLING. PURE. */
export function buildPublishBody(
  bundle: ContractsBundle,
  provenance: ChannelProvenance | null,
): { bundle: ContractsBundle; provenance?: ChannelProvenance } {
  return provenance === null ? { bundle } : { bundle, provenance };
}

/** Everything a log line may ever show of a channel key: its kind prefix and
 *  four characters. Enough to tell two channels apart, useless to a reader. */
export const maskChannelKey = (key: string): string =>
  key.length <= 9 ? '…' : `${key.slice(0, 9)}…`;

/** The --dry-run text — the exact plan, no network, no key needed. PURE. */
export function publishDryRunLines(
  file: string,
  base: string,
  bundle: ContractsBundle,
  provenance: ChannelProvenance | null,
  bytes: number,
): string[] {
  return [
    'DRY RUN — no request leaves this machine, no channel key required. The live run would:',
    `  1. POST ${base}/channel/<writeKey>`,
    `     body: { "bundle": <CONTRACTS-BUNDLE from ${file}>${provenance ? ', "provenance": {…}' : ''} }`,
    `     ${bundle.contracts.length} contract(s), ${bytes} bytes of bundle JSON (cap 4 MB)`,
    provenance
      ? `  2. Provenance sibling (auto-detected, rides UNREAD through the worker): ${[
          provenance.repo && `repo ${provenance.repo}`,
          provenance.runId && `run ${provenance.runId}`,
          provenance.commit && `commit ${provenance.commit.slice(0, 7)}`,
          provenance.ref && `ref ${provenance.ref}`,
        ]
          .filter(Boolean)
          .join(', ')}`
      : '  2. No provenance — not a GitHub Actions run and no --repo/--commit given. The plugin will show the delivery as unattributed.',
    '  3. The worker assigns the next seq and refreshes the channel\'s 30-day TTL. Nothing is delivered anywhere until the designer presses "Check for updates".',
    '  Key source at run time: --channel-key, else DS_CONTRACTS_CHANNEL_KEY — used in memory only, never persisted, never logged.',
  ];
}

const channelBase = (parsed: ReturnType<typeof parseFlags>): string =>
  (flagString(parsed, 'bridge') ?? process.env.DS_CONTRACTS_BRIDGE_URL ?? DEFAULT_BRIDGE_URL).replace(
    /\/$/,
    '',
  );

async function claimChannelCommand(argv: string[]): Promise<number> {
  const parsed = parseFlags(argv, { value: ['bridge'] });
  const base = channelBase(parsed);
  const res = await fetch(`${base}/channel/claim`, { method: 'POST' });
  const answer = (await res.json().catch(() => ({}))) as {
    writeKey?: string;
    readKey?: string;
    ttlSeconds?: number;
    error?: string;
  };
  if (!res.ok || typeof answer.writeKey !== 'string' || typeof answer.readKey !== 'string') {
    console.error(`✘ the channel refused the claim (${res.status}): ${answer.error ?? 'unnamed error'}`);
    return 1;
  }
  const days = Math.round((answer.ttlSeconds ?? 30 * 24 * 60 * 60) / 86400);
  console.log('✔ Channel claimed. Two keys, two different jobs — do not mix them up:\n');
  console.log(`  WRITE KEY (a CI secret — it PUBLISHES; keep it out of Figma and out of git):`);
  console.log(`    ${answer.writeKey}`);
  console.log(`    → store as the repository secret DS_CONTRACTS_CHANNEL_KEY`);
  console.log(`       (GitHub: Settings → Secrets and variables → Actions → New repository secret)\n`);
  console.log(`  READ KEY (the designer's half — it only READS; paste it into the Figma plugin):`);
  console.log(`    ${answer.readKey}`);
  console.log(`    → Figma plugin → Generate or Update library → the channel key field\n`);
  console.log(
    `  The read key is sha256(write key): holding the write key you can compute the read key, but a\n` +
      `  leaked read key can never publish. That is why a shared Figma file cannot inject into your\n` +
      `  source of truth.\n`,
  );
  console.log(
    `  The channel expires after ${days} days with no publish; every publish resets the clock.\n` +
      `  Reads never extend it — a channel CI has abandoned dies on purpose.`,
  );
  return 0;
}

async function publishCommand(argv: string[]): Promise<number> {
  const parsed = parseFlags(argv, {
    value: ['channel-key', 'bridge', 'repo', 'run-id', 'run-url', 'commit', 'ref'],
    bool: ['dry-run', 'no-provenance'],
  });
  const file = parsed.positionals[0];
  if (!file) throw new CliUsageError('figma publish needs a bundle or contract JSON file');
  const base = channelBase(parsed);
  const bundle = toBundle(file);
  const bundleBytes = JSON.stringify(bundle).length;

  const provenance =
    parsed.flags.get('no-provenance') === true
      ? null
      : detectProvenance(
          process.env,
          {
            repo: flagString(parsed, 'repo'),
            runId: flagString(parsed, 'run-id'),
            runUrl: flagString(parsed, 'run-url'),
            commit: flagString(parsed, 'commit'),
            ref: flagString(parsed, 'ref'),
          },
          new Date(),
        );

  if (parsed.flags.get('dry-run') === true) {
    for (const line of publishDryRunLines(file, base, bundle, provenance, bundleBytes)) {
      console.log(line);
    }
    return 0;
  }

  const key = flagString(parsed, 'channel-key') ?? process.env.DS_CONTRACTS_CHANNEL_KEY;
  if (!key) {
    throw new CliUsageError(
      'figma publish needs the channel WRITE key: --channel-key, or the DS_CONTRACTS_CHANNEL_KEY env var (in CI: a repository secret). Run `ds-contracts figma claim-channel` once to mint a pair. It is used in memory only — never stored, never logged.',
    );
  }

  const body = JSON.stringify(buildPublishBody(bundle, provenance));
  const res = await fetch(`${base}/channel/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  const answer = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    seq?: number;
    bytes?: number;
    publishedAt?: string;
    error?: string;
  };
  if (!res.ok) {
    // The worker's refusals are plain words already — echo them verbatim, and
    // never the key itself.
    console.error(
      `✘ the channel refused the publish to ${maskChannelKey(key)} (${res.status}): ${answer.error ?? 'unnamed error'}`,
    );
    return 1;
  }
  console.log(
    `✔ Published delivery #${answer.seq} to channel ${maskChannelKey(key)} — ${bundle.contracts.length} contract(s), ${answer.bytes ?? bundleBytes} bytes, at ${answer.publishedAt ?? 'now'}.` +
      (provenance
        ? `\n  Provenance: ${[provenance.repo, provenance.runId && `run #${provenance.runId}`, provenance.commit && `commit ${provenance.commit.slice(0, 7)}`]
            .filter(Boolean)
            .join(' · ')}`
        : '\n  No provenance attached (not a GitHub Actions run) — the plugin will show this delivery as unattributed.') +
      `\n  The designer's plugin finds it on its next "Check for updates". Nothing applies without their review.`,
  );
  return 0;
}

// ---------------------------------------------------------------------------
// figma receive — the dev door (plugin Propose tab → reviewed local diff).
// PURE CORE below (parse / plan / diff — unit-pinned, no I/O), thin shell at
// the bottom (network + filesystem, executes exactly what the plan says).
// ---------------------------------------------------------------------------

/** The proposal envelope the plugin's Propose tab exports (engine
 *  proposeDiff's exportJson) and the bridge tags as kind 'proposal'. */
export const CONTRACT_PROPOSAL_TYPE = 'CONTRACT-PROPOSAL';

export interface ProposalEnvelope {
  type: typeof CONTRACT_PROPOSAL_TYPE;
  baseContractId: string;
  baseVersion?: string;
  setName?: string;
  summary: string[];
  proposedContract: Record<string, unknown>;
  proposalNotes: string[];
}

/** Envelope referee — refusals by name, never a guess. PURE. */
export function parseProposal(raw: unknown): { ok: true; proposal: ProposalEnvelope } | { ok: false; error: string } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'the delivered payload is not a JSON object' };
  }
  const o = raw as Record<string, unknown>;
  if (o.type !== CONTRACT_PROPOSAL_TYPE) {
    return { ok: false, error: `the payload is not tagged ${CONTRACT_PROPOSAL_TYPE} (got type ${JSON.stringify(o.type ?? null)})` };
  }
  const proposed = o.proposedContract;
  if (proposed === null || typeof proposed !== 'object' || Array.isArray(proposed)) {
    return { ok: false, error: 'the proposal has no "proposedContract" object — re-run Read the set & diff in the plugin and send again' };
  }
  const id = (proposed as { id?: unknown }).id ?? o.baseContractId;
  if (typeof id !== 'string' || id.length === 0) {
    return { ok: false, error: 'neither proposedContract.id nor baseContractId names the contract — the proposal cannot be matched to a file' };
  }
  return {
    ok: true,
    proposal: {
      type: CONTRACT_PROPOSAL_TYPE,
      baseContractId: typeof o.baseContractId === 'string' ? o.baseContractId : id,
      baseVersion: typeof o.baseVersion === 'string' ? o.baseVersion : undefined,
      setName: typeof o.setName === 'string' ? o.setName : undefined,
      summary: Array.isArray(o.summary) ? o.summary.filter((s): s is string => typeof s === 'string') : [],
      proposedContract: proposed as Record<string, unknown>,
      proposalNotes: Array.isArray(o.proposalNotes) ? o.proposalNotes.filter((s): s is string => typeof s === 'string') : [],
    },
  };
}

/** id → filename convention: the namespace prefix drops
 *  (`polaris.badge` → `badge.contract.json`) — the same convention the
 *  plugin's PR path pre-fills. PURE. */
export const contractFileNameForId = (id: string): string =>
  `${id.replace(/^[^.]+\./, '')}.contract.json`;

/** Minimal unified diff (LCS over lines, 3 lines of context) — zero-dep by
 *  repo culture; contract files are small so O(n·m) is fine. PURE. */
export function unifiedDiff(oldText: string, newText: string, filePath: string): string[] {
  if (oldText === newText) return [];
  const a = oldText.split('\n');
  const b = newText.split('\n');
  // LCS table.
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  // Walk into ops: ' ' keep, '-' del, '+' add.
  const ops: Array<{ tag: ' ' | '-' | '+'; line: string; ai: number; bi: number }> = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) ops.push({ tag: ' ', line: a[i], ai: i++, bi: j++ });
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) ops.push({ tag: '-', line: a[i], ai: i++, bi: j });
    else ops.push({ tag: '+', line: b[j], ai: i, bi: j++ });
  }
  while (i < a.length) ops.push({ tag: '-', line: a[i], ai: i++, bi: j });
  while (j < b.length) ops.push({ tag: '+', line: b[j], ai: i, bi: j++ });
  // Group into hunks with 3 lines of context.
  const CONTEXT = 3;
  const changed = ops.map((op) => op.tag !== ' ');
  const keep = new Array<boolean>(ops.length).fill(false);
  for (let k = 0; k < ops.length; k++) {
    if (!changed[k]) continue;
    for (let c = Math.max(0, k - CONTEXT); c <= Math.min(ops.length - 1, k + CONTEXT); c++) keep[c] = true;
  }
  const out: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`];
  let k = 0;
  while (k < ops.length) {
    if (!keep[k]) { k++; continue; }
    const start = k;
    let end = k;
    while (end < ops.length && keep[end]) end++;
    const hunk = ops.slice(start, end);
    const aStart = (hunk.find((h) => h.tag !== '+')?.ai ?? hunk[0].ai) + 1;
    const bStart = (hunk.find((h) => h.tag !== '-')?.bi ?? hunk[0].bi) + 1;
    const aCount = hunk.filter((h) => h.tag !== '+').length;
    const bCount = hunk.filter((h) => h.tag !== '-').length;
    out.push(`@@ -${aStart},${aCount} +${bStart},${bCount} @@`);
    for (const h of hunk) out.push(h.tag + h.line);
    k = end;
  }
  return out;
}

export interface ReceivePlan {
  contractId: string;
  /** Target contract filename inside --out (existing match by id, else the
   *  <name>.contract.json convention). */
  fileName: string;
  /** Proposal artifact filename, always written: .proposals/<id>.proposal.json */
  proposalFileName: string;
  proposalText: string;
  newText: string;
  oldText: string | null;
  changed: boolean;
  diff: string[];
  /** The ONLY contract-file write the shell may perform. null = the shell
   *  MUST NOT touch the contract file (the no-silent-write guarantee lives
   *  here, in the pure core, where it is unit-pinned). */
  contractWrite: { fileName: string; contents: string } | null;
}

/** Decide everything about landing a delivered proposal — PURE. The shell
 *  supplies the delivered envelope, the existing file (matched by contract
 *  id, or null), and whether --apply was given. */
export function planReceive(
  proposal: ProposalEnvelope,
  existing: { fileName: string; text: string } | null,
  apply: boolean,
): ReceivePlan {
  const contractId = String(proposal.proposedContract.id ?? proposal.baseContractId);
  const fileName = existing ? existing.fileName : contractFileNameForId(contractId);
  const newText = JSON.stringify(proposal.proposedContract, null, 2) + '\n';
  const oldText = existing ? existing.text : null;
  const changed = oldText !== newText;
  return {
    contractId,
    fileName,
    proposalFileName: path.join('.proposals', `${contractId}.proposal.json`),
    proposalText: JSON.stringify(proposal, null, 2) + '\n',
    newText,
    oldText,
    changed,
    diff: unifiedDiff(oldText ?? '', newText, fileName),
    contractWrite: apply && changed ? { fileName, contents: newText } : null,
  };
}

/** Find the *.contract.json in outDir whose document id matches — the id is
 *  the identity, the filename only the convention. Thin I/O helper. */
export function findExistingContractFile(outDir: string, contractId: string): { fileName: string; text: string } | null {
  if (!existsSync(outDir)) return null;
  for (const f of readdirSync(outDir).filter((f) => f.endsWith('.contract.json')).sort()) {
    try {
      const text = readFileSync(path.join(outDir, f), 'utf8');
      if ((JSON.parse(text) as { id?: unknown }).id === contractId) return { fileName: f, text };
    } catch {
      /* unreadable/non-JSON neighbors are not this command's problem */
    }
  }
  return null;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function receiveCommand(argv: string[]): Promise<number> {
  const parsed = parseFlags(argv, { value: ['out', 'bridge'], bool: ['apply'] });
  const out = flagString(parsed, 'out');
  if (!out) throw new CliUsageError('figma receive needs --out <contracts-dir> — where the reviewed diff lands');
  const apply = parsed.flags.get('apply') === true;
  const base = (
    flagString(parsed, 'bridge') ??
    process.env.DS_CONTRACTS_BRIDGE_URL ??
    DEFAULT_BRIDGE_URL
  ).replace(/\/$/, '');
  const outDir = path.resolve(out);

  // 1. Mint the pairing code.
  const created = await fetch(`${base}/bridge/session`, { method: 'POST' });
  const session = (await created.json().catch(() => ({}))) as { code?: string; ttlSeconds?: number; error?: string };
  if (!created.ok || typeof session.code !== 'string') {
    console.error(`✘ bridge refused the session (${created.status}): ${session.error ?? 'unnamed error'}`);
    return 1;
  }
  const code = session.code;
  const ttlSeconds = session.ttlSeconds ?? 15 * 60;
  console.log(`Pairing code: ${code}`);
  console.log(
    `In the Figma plugin's Propose tab, run "Read the set & diff", then enter this code under "Send to repo". Waiting (code expires in ${Math.round(ttlSeconds / 60)} minutes; Ctrl-C to stop)…`,
  );

  // 2. Poll politely — the same 2.5s cadence the plugin and playground use.
  const deadline = Date.now() + ttlSeconds * 1000;
  let delivered: { kind?: string; dump?: unknown } | null = null;
  while (Date.now() < deadline) {
    let res: Response;
    try {
      res = await fetch(`${base}/bridge/${encodeURIComponent(code)}`);
    } catch {
      await sleep(2500); // transient network blip — keep polling
      continue;
    }
    const body = (await res.json().catch(() => ({}))) as { status?: string; kind?: string; dump?: unknown; error?: string };
    if (res.ok && body.status === 'delivered') { delivered = body; break; }
    if (res.ok && body.status === 'waiting') { await sleep(2500); continue; }
    console.error(`✘ bridge refused (${res.status}): ${body.error ?? 'unnamed error'}`);
    return 1;
  }
  if (!delivered) {
    console.error('✘ Nothing arrived before the code expired — run figma receive again for a fresh code.');
    return 1;
  }
  const kind = delivered.kind ?? 'dump';
  if (kind !== 'proposal') {
    console.error(
      `✘ Refused — that code carried a ${kind === 'dump' ? 'canvas dump' : kind}, not a ${CONTRACT_PROPOSAL_TYPE}. figma receive only lands proposals from the plugin's Propose tab; deliver-once means this payload is now gone — send again to a fresh code.`,
    );
    return 1;
  }
  const envelope = parseProposal(delivered.dump);
  if (!envelope.ok) {
    console.error(`✘ Refused — ${envelope.error}`);
    return 1;
  }

  // 3. Plan (pure), then execute EXACTLY the plan.
  const proposal = envelope.proposal;
  const plan = planReceive(proposal, findExistingContractFile(outDir, String(proposal.proposedContract.id ?? proposal.baseContractId)), apply);

  mkdirSync(path.dirname(path.join(outDir, plan.proposalFileName)), { recursive: true });
  writeFileSync(path.join(outDir, plan.proposalFileName), plan.proposalText);
  console.log(`✔ Proposal saved: ${path.join(out, plan.proposalFileName)}`);

  if (proposal.summary.length > 0) {
    console.log(`\nProposed change — ${proposal.setName ?? plan.contractId}:`);
    for (const line of proposal.summary) console.log(`  ${line}`);
  }
  if (!plan.changed) {
    console.log(`\n${plan.fileName} already matches the proposal byte-for-byte — nothing to apply.`);
    return 0;
  }
  console.log(plan.oldText === null ? `\nNew contract (no ${plan.fileName} in ${out} yet):` : '');
  for (const line of plan.diff) console.log(line);

  if (plan.contractWrite === null) {
    console.log(
      `\nNothing written to ${plan.fileName} — review the diff above, then re-run with --apply to write it (or apply by hand from ${path.join(out, plan.proposalFileName)}).`,
    );
    return 0;
  }
  writeFileSync(path.join(outDir, plan.contractWrite.fileName), plan.contractWrite.contents);
  console.log(
    `\n✔ Wrote ${path.join(out, plan.contractWrite.fileName)} — review the diff and commit it yourself (ds-contracts never touches git).`,
  );
  return 0;
}

export async function figmaCommand(argv: string[]): Promise<number> {
  if (argv[0] === 'bundle') return bundleCommand(argv.slice(1));
  if (argv[0] === 'push') return pushCommand(argv.slice(1));
  if (argv[0] === 'claim-channel') return claimChannelCommand(argv.slice(1));
  if (argv[0] === 'publish') return publishCommand(argv.slice(1));
  if (argv[0] === 'receive') return receiveCommand(argv.slice(1));

  const parsed = parseFlags(argv, { value: ['out', 'tokens', 'icons', 'file-key'] });
  if (parsed.positionals.length === 0) {
    throw new CliUsageError(
      'figma needs contract files/directories (or the `bundle` / `push` / `publish` / `claim-channel` / `receive` subcommands)',
    );
  }
  const out = flagString(parsed, 'out');
  if (!out) throw new CliUsageError('figma needs --out <dir>');
  const files = expandContractArgs(parsed.positionals);
  const contracts = loadContracts(files);
  const ctx = buildEmitterCtx(
    contracts,
    splitList(flagString(parsed, 'tokens')).map((f) => path.resolve(f)),
    flagString(parsed, 'icons'),
    flagString(parsed, 'file-key'),
  );
  const outDir = path.resolve(out);
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  for (const contract of contracts.values()) {
    for (const file of figmaScriptEmitter.emit(contract, ctx)) {
      writeFileSync(path.join(outDir, file.path), file.contents);
      written.push(file.path);
    }
  }
  console.log(`✔ Emitted ${written.length} Figma sync script(s) → ${outDir}: ${written.join(', ')}`);
  return 0;
}

/**
 * Build-time engine replays for the "How it works" question pages. Nothing
 * here is illustrative: every number, diff, and finding on those pages is
 * computed by running the repository's real machinery at site-build time —
 * the emitters, the import engine, and the actual three-way differ — over
 * committed contracts and committed capture fixtures.
 *
 *   · lifecycle — the real react + figma emitters run over the shipping
 *     Button contract and a reconstructed pre-promotion state (the promoted
 *     vocabulary removed at build time, and labeled as such); the REAL
 *     parity differ (parity/diff.ts, the same script the evals drive) runs
 *     twice in a throwaway scratch copy: once with a hand-added code prop,
 *     once with the canvas snapshot missing the promoted property.
 *   · nesting — the committed CBDS Dialog / Button-Brand Primary captures
 *     plus the Icon record of the committed whole-kit capture, replayed
 *     through the import engine in session order, with per-ref resolutions
 *     classified exactly as the live gauntlet classifies them.
 *   · scale — the dependency graph of the committed whole-kit capture,
 *     counted and layered from the file; the real sortByDependencies over
 *     the shipping contracts; the committed mega-session receipt.
 */
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import type { GraphData } from './diagrams.js';

const ROOT = process.cwd();
const readJson = (rel: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8')) as Record<string, unknown>;

// ---------------------------------------------------------------------------
// Line diffs (real emitter output in, hunks out)
// ---------------------------------------------------------------------------

export interface DiffHunk {
  /** Rendered lines, each prefixed "  " | "+ " | "- ". */
  lines: Array<{ kind: 'ctx' | 'add' | 'del'; text: string }>;
}

export interface FileDiff {
  path: string;
  beforeLines: number;
  afterLines: number;
  added: number;
  removed: number;
  hunks: DiffHunk[];
}

/** Plain LCS line diff — deterministic, no dependency. */
export function diffLines(before: string, after: string): Array<{ kind: 'ctx' | 'add' | 'del'; text: string }> {
  const a = before.split('\n');
  const b = after.split('\n');
  const n = a.length;
  const m = b.length;
  // DP table of LCS lengths (n, m are emitter-file sized — fine).
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: Array<{ kind: 'ctx' | 'add' | 'del'; text: string }> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: 'ctx', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: 'del', text: a[i] });
      i++;
    } else {
      out.push({ kind: 'add', text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ kind: 'del', text: a[i++] });
  while (j < m) out.push({ kind: 'add', text: b[j++] });
  return out;
}

export function toHunks(all: Array<{ kind: 'ctx' | 'add' | 'del'; text: string }>, context = 2): DiffHunk[] {
  const keep = new Array<boolean>(all.length).fill(false);
  all.forEach((l, idx) => {
    if (l.kind !== 'ctx') {
      for (let k = Math.max(0, idx - context); k <= Math.min(all.length - 1, idx + context); k++) keep[k] = true;
    }
  });
  const hunks: DiffHunk[] = [];
  let cur: DiffHunk | undefined;
  all.forEach((l, idx) => {
    if (keep[idx]) {
      if (!cur) {
        cur = { lines: [] };
        hunks.push(cur);
      }
      cur.lines.push(l);
    } else {
      cur = undefined;
    }
  });
  return hunks;
}

function fileDiff(p: string, before: string, after: string): FileDiff {
  const all = diffLines(before, after);
  return {
    path: p,
    beforeLines: before.split('\n').length,
    afterLines: after.split('\n').length,
    added: all.filter((l) => l.kind === 'add').length,
    removed: all.filter((l) => l.kind === 'del').length,
    hunks: toHunks(all),
  };
}

// ---------------------------------------------------------------------------
// The real differ, in a scratch copy (the eval suite's own pattern)
// ---------------------------------------------------------------------------

export interface ParityFinding {
  surface: string;
  classification: string;
  subject: string;
  detail: string;
  proposedPatch?: Record<string, unknown>;
  remedy: string;
}

/** Dirs parity/diff.ts actually reads (subset of the eval scratch list). */
const SCRATCH_DIRS = ['contracts', 'tokens', 'scripts', 'core', 'parity', 'src'];

function runRealDiffer(): { findings: (scratch: string) => ParityFinding[]; scratch: string; dispose: () => void } {
  const scratch = mkdtempSync(path.join(tmpdir(), 'dsc-site-parity-'));
  for (const dir of SCRATCH_DIRS) cpSync(path.join(ROOT, dir), path.join(scratch, dir), { recursive: true });
  for (const file of ['package.json', 'tsconfig.json']) cpSync(path.join(ROOT, file), path.join(scratch, file));
  symlinkSync(path.join(ROOT, 'node_modules'), path.join(scratch, 'node_modules'), 'dir');
  const findings = (s: string): ParityFinding[] => {
    const r = spawnSync(path.join(ROOT, 'node_modules', '.bin', 'tsx'), ['parity/diff.ts'], {
      cwd: s,
      encoding: 'utf8',
      // Freeze the snapshot-age warning so the replay is deterministic;
      // staleness is its own eval (detect-stale-snapshot), not this page's.
      env: { ...process.env, MAX_SNAPSHOT_AGE_DAYS: '100000' },
    });
    if (r.error) throw r.error;
    return (JSON.parse(readFileSync(path.join(s, 'parity', 'report.json'), 'utf8')) as { findings: ParityFinding[] })
      .findings;
  };
  return { findings, scratch, dispose: () => rmSync(scratch, { recursive: true, force: true }) };
}

// ---------------------------------------------------------------------------
// Shapes handed to the pages
// ---------------------------------------------------------------------------

export interface LifecycleReplay {
  /** The hand edit applied to the real generated Button.tsx in the scratch. */
  handEditDiff: FileDiff;
  aheadFinding: ParityFinding;
  /** The promoted prop as it ships in contracts/button.contract.json. */
  promotedProp: Record<string, unknown>;
  contractVersion: string;
  reactDiff: FileDiff;
  cssDiff: FileDiff;
  figmaDiff: FileDiff;
  behindFinding: ParityFinding;
}

export interface RefResolution {
  refId: string;
  resolution: 'linked-session' | 'linked-repo' | 'stubbed' | 'unresolved';
  count: number;
}

export interface ImportStep {
  setName: string;
  contractId: string;
  refs: RefResolution[];
  stubIds: string[];
  minted: number;
  notes: number;
}

export interface NestingReplay {
  dialogAloneStubIds: string[];
  dialogAloneRefs: RefResolution[];
  stubExcerpt: Record<string, unknown>;
  stubDescription: string;
  steps: ImportStep[];
  dialogLinkedRef: Record<string, unknown>;
  /** Key-linking proof from the v1.6 capture: the drawn instance's set key
   *  vs the proposed Icon contract's anchor key. */
  keyProof: { drawnInstanceSetKey: string; proposedAnchorKey: string; parentSet: string };
  megaSession: Record<string, unknown>;
}

export interface ScaleReplay {
  graph: GraphData;
  totalSets: number;
  composites: number;
  multiVariantComposites: number;
  pairEdges: number;
  instanceNodes: number;
  targets: number;
  iconInDegree: number;
  topHubs: Array<[string, number]>;
  topFanout: Array<[string, number]>;
  unresolvedEdges: Array<[string, string]>;
  maxDepth: number;
  chainExample: string[];
  buildOrder: string[];
  megaSession: Record<string, unknown>;
}

export interface HowReplays {
  lifecycle: LifecycleReplay;
  nesting: NestingReplay;
  scale: ScaleReplay;
}

// ---------------------------------------------------------------------------
// The replays
// ---------------------------------------------------------------------------

async function lifecycleReplay(): Promise<LifecycleReplay> {
  const [{ emitters }, schemaMod] = await Promise.all([
    import('../../core/emitter.js'),
    import('../../scripts/contract-schema.js'),
  ]);
  const { ContractSchema } = schemaMod;

  // The shipping contract (post-promotion) and the reconstructed
  // pre-promotion state: the promoted vocabulary removed at build time.
  const after = ContractSchema.parse(readJson('contracts/button.contract.json'));
  const beforeRaw = readJson('contracts/button.contract.json') as {
    props: Array<{ name: string }>;
    anatomy: { root: { parts: Record<string, unknown> } };
  };
  beforeRaw.props = beforeRaw.props.filter((p) => p.name !== 'loading');
  delete beforeRaw.anatomy.root.parts['loadingSpinner'];
  const before = ContractSchema.parse(beforeRaw);
  const promotedProp = (readJson('contracts/button.contract.json') as { props: Array<Record<string, unknown>> }).props.find(
    (p) => p.name === 'loading',
  )!;

  const tokens = {
    primitives: readJson('tokens/primitives.tokens.json'),
    semantic: readJson('tokens/semantic.tokens.json'),
    light: readJson('tokens/modes/semantic.light.tokens.json'),
    dark: readJson('tokens/modes/semantic.dark.tokens.json'),
    brands: { default: readJson('tokens/modes/brand.default.tokens.json') },
  };
  const icons = new Map<string, string>(
    readdirSync(path.join(ROOT, 'assets/icons'))
      .filter((f) => f.endsWith('.svg'))
      .sort()
      .map((f) => [f.replace(/\.svg$/, ''), readFileSync(path.join(ROOT, 'assets/icons', f), 'utf8').trim()]),
  );
  const emitFor = (contract: typeof after, name: string): Map<string, string> => {
    const em = emitters.find((e) => e.name === name);
    if (!em) throw new Error(`emitter "${name}" not registered`);
    const ctx = { tokens, icons, contracts: new Map([[contract.id, contract]]) };
    return new Map(em.emit(contract, ctx as never).map((f) => [f.path, f.contents]));
  };

  const reactBefore = emitFor(before, 'react');
  const reactAfter = emitFor(after, 'react');
  const figmaBefore = emitFor(before, 'figma-script');
  const figmaAfter = emitFor(after, 'figma-script');

  const reactDiff = fileDiff('Button.tsx', reactBefore.get('Button.tsx')!, reactAfter.get('Button.tsx')!);
  const cssDiff = fileDiff('Button.module.css', reactBefore.get('Button.module.css')!, reactAfter.get('Button.module.css')!);
  const figmaDiff = fileDiff('button.figma.js', figmaBefore.get('button.figma.js')!, figmaAfter.get('button.figma.js')!);

  // The real differ, twice, in one scratch — the eval suite's own harness
  // pattern (evals/run.ts detect-code-added-prop / detect-figma-missing-property).
  const differ = runRealDiffer();
  let aheadFinding: ParityFinding;
  let behindFinding: ParityFinding;
  let handEditDiff: FileDiff;
  try {
    const btnPath = path.join(differ.scratch, 'src/components/Button/Button.tsx');
    const original = readFileSync(btnPath, 'utf8');
    const mutated = original
      .replace('loading?: boolean;', "loading?: boolean;\n  /** Renders the icon without a visible label. */\n  iconOnly?: boolean;")
      .replace('loading = false,', 'loading = false,\n    iconOnly = false,');
    if (mutated === original) throw new Error('lifecycle replay: hand-edit mutation did not apply');
    writeFileSync(btnPath, mutated);
    handEditDiff = fileDiff('src/components/Button/Button.tsx', original, mutated);
    const ahead = differ.findings(differ.scratch);
    const found = ahead.find((f) => f.surface === 'code' && f.classification === 'ahead' && f.subject === 'Button.iconOnly');
    if (!found || ahead.length !== 1) {
      throw new Error(`lifecycle replay: expected exactly [code AHEAD] Button.iconOnly, got ${JSON.stringify(ahead)}`);
    }
    aheadFinding = found;
    writeFileSync(btnPath, original); // restore

    // Second run: the canvas snapshot missing the promoted property — the
    // surface that "didn't regenerate".
    const snapPath = path.join(differ.scratch, 'parity/snapshots/figma-components.json');
    const snap = JSON.parse(readFileSync(snapPath, 'utf8')) as {
      sets: Array<{ name: string; properties: Record<string, unknown> }>;
    };
    const btnSet = snap.sets.find((s) => s.name === 'Button');
    if (!btnSet) throw new Error('lifecycle replay: Button set not in snapshot');
    const loadingKey = Object.keys(btnSet.properties).find((k) => k.startsWith('Loading'));
    if (!loadingKey) throw new Error('lifecycle replay: Loading property not in snapshot');
    delete btnSet.properties[loadingKey];
    writeFileSync(snapPath, JSON.stringify(snap));
    const behind = differ.findings(differ.scratch);
    const foundBehind = behind.find(
      (f) => f.surface === 'figma' && f.classification === 'behind' && f.subject === 'Button.Loading',
    );
    if (!foundBehind || behind.length !== 1) {
      throw new Error(`lifecycle replay: expected exactly [figma BEHIND] Button.Loading, got ${JSON.stringify(behind)}`);
    }
    behindFinding = foundBehind;
  } finally {
    differ.dispose();
  }

  return {
    handEditDiff,
    aheadFinding,
    promotedProp,
    contractVersion: after.version,
    reactDiff,
    cssDiff,
    figmaDiff,
    behindFinding,
  };
}

// ---------------------------------------------------------------------------

interface ProposalLike {
  contract: unknown;
  childStubs?: unknown[];
  notes: string[];
  mintedTokens?: { count: number } | null;
}

async function nestingReplay(): Promise<NestingReplay> {
  const [{ loadTokenCorpus }, { loadContracts, proposeFromDump }, schemaMod] = await Promise.all([
    import('../../extract/figma/tokens.js'),
    import('../../extract/figma/propose.js'),
    import('../../scripts/contract-schema.js'),
  ]);
  const { ContractSchema, walkAnatomy } = schemaMod;
  type Contract = ReturnType<typeof ContractSchema.parse>;

  const corpus = loadTokenCorpus(ROOT);
  const loaded = loadContracts(path.resolve(ROOT, 'contracts'));
  const FILE_KEY = 'WofZT8xaxXuc2Q6Je9S4XE';
  const dialogDump = readJson('extract/figma/fixtures/cbds-plugin-dialog.dump.json');
  const buttonDump = readJson('extract/figma/fixtures/cbds-plugin-button-brand-primary.dump.json');
  const v16 = readJson('extract/figma/fixtures/cbds-plugin-all-sets.v16.dump.json');

  const classify = (
    contract: Contract,
    session: Map<string, Contract>,
    stubIds: Set<string>,
  ): RefResolution[] => {
    const counts = new Map<string, RefResolution>();
    for (const w of walkAnatomy(contract)) {
      const ref = w.part.component;
      if (!ref) continue;
      const resolution: RefResolution['resolution'] = session.has(ref.id)
        ? 'linked-session'
        : loaded.byId.has(ref.id)
          ? 'linked-repo'
          : stubIds.has(ref.id)
            ? 'stubbed'
            : 'unresolved';
      const cur = counts.get(ref.id);
      if (cur) cur.count += 1;
      else counts.set(ref.id, { refId: ref.id, resolution, count: 1 });
    }
    return [...counts.values()].sort((a, b) => a.refId.localeCompare(b.refId));
  };

  // --- Control: Dialog imported alone -------------------------------------
  const alone = proposeFromDump(dialogDump['Dialog'] as never, {
    corpus,
    contractIdByName: new Map(loaded.byName),
    contractsById: new Map(loaded.byId),
    fileKey: FILE_KEY,
    mintUnbound: true,
  }) as ProposalLike;
  const aloneContract = ContractSchema.parse(alone.contract);
  const aloneStubs = (alone.childStubs ?? []).map((s) => ContractSchema.parse(s));
  const aloneStubIds = aloneStubs.map((s) => s.id).sort();
  const buttonStub = aloneStubs.find((s) => s.id === 'ds.button-brand-primary');
  if (!buttonStub) throw new Error('nesting replay: Dialog-alone did not stub ds.button-brand-primary');
  const stubExcerpt: Record<string, unknown> = {
    id: buttonStub.id,
    name: buttonStub.name,
    version: buttonStub.version,
    props: (buttonStub.props as unknown[]).slice(0, 1),
    anatomy: { root: buttonStub.anatomy.root },
  };

  // --- The session, children first: Icon → Button → Dialog -----------------
  const session = new Map<string, Contract>();
  const byName = new Map(loaded.byName);
  const byKey = new Map<string, string>();
  const byId = new Map(loaded.byId);
  const register = (c: Contract, drawnName: string): void => {
    session.set(c.id, c);
    byName.set(c.name, c.id);
    byName.set(drawnName, c.id);
    byId.set(c.id, c as never);
    const key = c.anchors.figma.componentSetKey;
    if (key) byKey.set(key, c.id);
  };
  const importStep = (drawnName: string, record: unknown): ImportStep => {
    const proposal = proposeFromDump(record as never, {
      corpus,
      contractIdByName: byName,
      contractIdByKey: byKey,
      contractsById: byId,
      fileKey: FILE_KEY,
      mintUnbound: true,
    }) as ProposalLike;
    const contract = ContractSchema.parse(proposal.contract);
    const stubIds = new Set((proposal.childStubs ?? []).map((s) => ContractSchema.parse(s).id));
    const refs = classify(contract, session, stubIds);
    register(contract, drawnName);
    return {
      setName: drawnName,
      contractId: contract.id,
      refs,
      stubIds: [...stubIds].sort(),
      minted: proposal.mintedTokens?.count ?? 0,
      notes: proposal.notes.length,
    };
  };

  const steps: ImportStep[] = [
    importStep('Icon', v16['Icon']),
    importStep('Button-Brand Primary', buttonDump['Button-Brand Primary']),
    importStep('Dialog', dialogDump['Dialog']),
  ];

  const dialogStep = steps[2];
  const linked = dialogStep.refs.find((r) => r.refId === 'ds.button-brand-primary');
  if (linked?.resolution !== 'linked-session') {
    throw new Error(`nesting replay: Dialog did not link ds.button-brand-primary (got ${JSON.stringify(linked)})`);
  }
  const dialogContract = session.get(dialogStep.contractId)!;
  const linkedRefWalk = walkAnatomy(dialogContract).find((w) => w.part.component?.id === 'ds.button-brand-primary');
  const dialogLinkedRef = { [linkedRefWalk!.name]: { component: linkedRefWalk!.part.component } } as Record<string, unknown>;

  // --- Key-linking proof from the v1.6 capture ------------------------------
  // The committed Dialog capture predates the key channel; the whole-kit
  // v1.6 capture carries instanceSetKey on every drawn instance. Find a
  // drawn Icon instance and compare its captured key to the anchor key the
  // proposed Icon contract carries.
  const iconContract = session.get(steps[0].contractId)!;
  const proposedAnchorKey = iconContract.anchors.figma.componentSetKey ?? '';
  let keyProof: NestingReplay['keyProof'] | undefined;
  const meta = new Set(['_provenance', '_degradations', '_variables']);
  for (const setName of Object.keys(v16).sort()) {
    if (meta.has(setName) || setName === 'Icon') continue;
    const findIcon = (n: Record<string, unknown>): Record<string, unknown> | undefined => {
      if (n['instanceOf'] === 'Icon' && typeof n['instanceSetKey'] === 'string') return n;
      for (const c of (n['children'] as Array<Record<string, unknown>> | undefined) ?? []) {
        const r = findIcon(c);
        if (r) return r;
      }
      return undefined;
    };
    const rec = v16[setName] as { variants?: Array<Record<string, unknown>> };
    for (const variant of rec.variants ?? []) {
      const hit = findIcon(variant);
      if (hit) {
        keyProof = {
          drawnInstanceSetKey: hit['instanceSetKey'] as string,
          proposedAnchorKey,
          parentSet: setName,
        };
        break;
      }
    }
    if (keyProof) break;
  }
  if (!keyProof || keyProof.drawnInstanceSetKey !== proposedAnchorKey) {
    throw new Error(`nesting replay: key proof failed (${JSON.stringify(keyProof)}, anchor ${proposedAnchorKey})`);
  }

  return {
    dialogAloneStubIds: aloneStubIds,
    dialogAloneRefs: classify(aloneContract, new Map(), new Set(aloneStubIds)),
    stubExcerpt,
    stubDescription: buttonStub.description ?? '',
    steps,
    dialogLinkedRef,
    keyProof,
    megaSession: readJson('extract/figma/gauntlet/live/mega-session.json'),
  };
}

// ---------------------------------------------------------------------------

async function scaleReplay(): Promise<ScaleReplay> {
  const schemaMod = await import('../../scripts/contract-schema.js');
  const { ContractSchema, sortByDependencies } = schemaMod;

  const v16 = readJson('extract/figma/fixtures/cbds-plugin-all-sets.v16.dump.json');
  const meta = new Set(['_provenance', '_degradations', '_variables']);
  const setNames = Object.keys(v16).filter((k) => !meta.has(k));
  const setSet = new Set(setNames);

  // instanceOf edges per set (self-references excluded).
  const outEdges = new Map<string, Map<string, number>>();
  let instanceNodes = 0;
  for (const name of setNames) {
    const targets = new Map<string, number>();
    const walk = (n: Record<string, unknown>): void => {
      const io = n['instanceOf'];
      if (typeof io === 'string' && io !== name) {
        instanceNodes += 1;
        targets.set(io, (targets.get(io) ?? 0) + 1);
      }
      for (const c of (n['children'] as Array<Record<string, unknown>> | undefined) ?? []) walk(c);
    };
    for (const v of ((v16[name] as { variants?: unknown[] }).variants ?? []) as Array<Record<string, unknown>>) walk(v);
    if (targets.size > 0) outEdges.set(name, targets);
  }
  const composites = [...outEdges.keys()];
  const multiVariantComposites = composites.filter(
    (k) => (((v16[k] as { variants?: unknown[] }).variants ?? []) as unknown[]).length > 1,
  ).length;

  const inDegree = new Map<string, number>();
  const unresolvedEdges: Array<[string, string]> = [];
  let pairEdges = 0;
  for (const [from, targets] of outEdges) {
    for (const to of targets.keys()) {
      if (setSet.has(to)) {
        inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
        pairEdges += 1;
      } else {
        unresolvedEdges.push([from, to]);
      }
    }
  }

  // Graph node set + longest-path depth.
  const nodes = new Set<string>(composites);
  for (const targets of outEdges.values()) for (const t of targets.keys()) if (setSet.has(t)) nodes.add(t);
  const depthMemo = new Map<string, number>();
  const depthOf = (n: string, stack: Set<string>): number => {
    const memo = depthMemo.get(n);
    if (memo !== undefined) return memo;
    if (stack.has(n)) return 0;
    let d = 0;
    const targets = outEdges.get(n);
    if (targets) {
      for (const t of targets.keys()) {
        if (nodes.has(t)) d = Math.max(d, 1 + depthOf(t, new Set([...stack, n])));
      }
    }
    depthMemo.set(n, d);
    return d;
  };
  const graphNodes = [...nodes].sort().map((name) => ({
    name,
    depth: depthOf(name, new Set()),
    usesIcon: outEdges.get(name)?.has('Icon') ?? false,
  }));
  const edges: Array<[string, string]> = [];
  let iconRefs = 0;
  for (const [from, targets] of [...outEdges].sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const to of [...targets.keys()].sort()) {
      if (!nodes.has(to)) continue;
      if (to === 'Icon') {
        iconRefs += 1;
        continue;
      }
      edges.push([from, to]);
    }
  }

  const graph: GraphData = {
    nodes: graphNodes,
    edges,
    iconRefs,
    compositeCount: composites.length,
    totalSets: setNames.length,
  };

  // A real ≥3-level chain for the prose, picked deterministically.
  const chainExample = ['Dialog', 'Button-Brand Primary', 'Icon'];

  // The real dependency sort over the shipping contracts.
  const contracts = readdirSync(path.join(ROOT, 'contracts'))
    .filter((f) => f.endsWith('.contract.json'))
    .sort()
    .map((f) => ContractSchema.parse(readJson(`contracts/${f}`)));
  const buildOrder = sortByDependencies(contracts).map((c) => c.id);

  return {
    graph,
    totalSets: setNames.length,
    composites: composites.length,
    multiVariantComposites,
    pairEdges,
    instanceNodes,
    targets: inDegree.size,
    iconInDegree: inDegree.get('Icon') ?? 0,
    topHubs: [...inDegree.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8),
    topFanout: composites
      .map((k): [string, number] => [k, outEdges.get(k)!.size])
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8),
    unresolvedEdges,
    maxDepth: Math.max(...graphNodes.map((n) => n.depth)),
    chainExample,
    buildOrder,
    megaSession: readJson('extract/figma/gauntlet/live/mega-session.json'),
  };
}

// ---------------------------------------------------------------------------

let cached: HowReplays | undefined;

export async function loadHowReplays(): Promise<HowReplays> {
  if (cached) return cached;
  cached = {
    lifecycle: await lifecycleReplay(),
    nesting: await nestingReplay(),
    scale: await scaleReplay(),
  };
  return cached;
}

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { emitters, type Contract, type EmittedFile, type SourceFileInput } from '../../../core/index.js';
import { useRoute } from '../router';
import { useTheme } from '../theme';
import { contractsById, icons, rawContractById } from '../engine/data';
import { exampleBySlug, examples, type CodeExample } from '../engine/examples';
import {
  DEMO_URL,
  importFigmaDemo,
  importFigmaUrl,
  proposalsFromDump,
  type FigmaImportResult,
  type FigmaProposal,
} from '../engine/figma-import';
import {
  fetchRepoFile,
  fetchRepoTree,
  MAX_TRACE_FILES,
  traceFromGithubUrl,
  type GithubTrace,
} from '../engine/github-import';
import { assistFetchPlan, assistRepoProfile } from '../engine/assist';
import type { ProposeCodeResult } from '../engine/code-import';
import {
  ANTHROPIC_MODEL,
  ANTHROPIC_MODELS,
  generateFromPrompt,
  MAX_FIX_ROUNDS,
  requestFix,
  type FetchLike,
  type PromptResult,
  type PromptSession,
} from '../engine/prompt-import';
import {
  decodeShareState,
  encodeShareState,
  SHARE_LIMIT_BYTES,
  sharePayloadFromLocation,
} from '../engine/permalink';
import {
  activeMintedTokens,
  applyUserTokens,
  resetToRepoTokens,
  setMintedTokens,
  STARTER_USER_TOKENS,
  storedUserTokensText,
  useTokenSource,
  type MintedTokenLayer,
} from '../engine/token-source';
import { locateJsonParseError, resolveIssueLines } from '../engine/refusal-lines';
import { validateContractText } from '../engine/validate';
import {
  clearWorkspace,
  recordImport,
  removeWorkspaceEntry,
  useWorkspace,
  WORKSPACE_CAP,
  type WorkspaceEntry,
  type WorkspaceSource,
} from '../engine/workspace';
import { reportIfChunkError } from '../engine/chunk-guard';
import { buildPreviewAtState, type PreviewPropOverrides, type PreviewSurface } from '../engine/preview';
import type { ReceiptGroup, Receipts } from '../receipts';
import { CanvasFrame } from '../components/CanvasFrame';
import { ContractEditor, type ContractEditorHandle } from '../components/ContractEditor';
import { CopyButton } from '../components/CopyButton';
import { MintAssist } from '../components/MintAssist';
import { HighlightedCode } from '../components/HighlightedCode';
import { usePaneResize } from '../components/PaneResize';
import { PreviewControls, sanitizeOverrides } from '../components/PreviewControls';
import { PreviewFrame } from '../components/PreviewFrame';
import { ReceiptsPanel } from '../components/ReceiptsPanel';
import { SpecSheet } from '../components/SpecSheet';

type SourceTab = 'workspace' | 'examples' | 'describe' | 'figma' | 'code' | 'json' | 'tokens';
const OUTPUT_LABELS: Record<string, string> = {
  react: 'React',
  html: 'HTML + CSS',
  'react-inline': 'React inline',
  'figma-script': 'Figma script',
};

/** Tab tooltips in designer language — what each output IS, not its
 *  implementation pedigree (the emitter registry's labels speak developer). */
const OUTPUT_TITLES: Record<string, string> = {
  react: 'The component code the shipping generator produces — TSX, scoped CSS, and stories.',
  html: 'Plain HTML + CSS you can paste anywhere — no build step needed.',
  'react-inline': 'React with the token values written in as plain numbers and colors — for codebases without a token pipeline.',
  'figma-script': 'The script that builds or updates this component in Figma.',
};

/** Workspace source tags — plain text, grouped display order. */
const WS_TAGS: Record<WorkspaceSource, string> = {
  figma: 'FIGMA',
  code: 'CODE',
  prompt: 'AI',
  json: 'JSON',
};
const WS_ORDER: WorkspaceSource[] = ['figma', 'code', 'prompt', 'json'];
const WS_GROUP_TITLES: Record<WorkspaceSource, string> = {
  figma: 'From Figma',
  code: 'From code',
  prompt: 'Generated',
  json: 'Pasted JSON',
};

/** The one-line design↔code switch story shown when a workspace entry is loaded. */
const WS_SWITCH_LINES: Record<WorkspaceSource, string> = {
  figma: 'Imported from design — the React / HTML tabs are its code side.',
  code: 'Imported from code — the Figma script tab is its design side.',
  prompt: 'Generated — both sides below.',
  json: 'Imported from JSON — both sides below.',
};

const wsTime = (ms: number) =>
  new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/** Session flag: the switch strip, once dismissed, stays gone for the session. */
const SWITCH_STRIP_KEY = 'ds-playground.switch-strip-dismissed';

/** Persisted preview-surface choice (light / dark / checker backdrop). */
const PREVIEW_SURFACE_KEY = 'ds-playground.preview-surface';
const PREVIEW_SURFACES: ReadonlyArray<readonly [PreviewSurface, string]> = [
  ['light', 'Light'],
  ['dark', 'Dark'],
  ['checker', 'Checker'],
];

/** Persisted preview VIEW: the code side, the design side, or both. */
type PreviewView = 'code' | 'canvas' | 'split';
const PREVIEW_VIEW_KEY = 'ds-playground.preview-view';
const PREVIEW_VIEWS: ReadonlyArray<readonly [PreviewView, string, string]> = [
  ['code', 'Code', 'The code side — the HTML emitter rendered live.'],
  ['canvas', 'Canvas', 'The design side — the figma engine’s compiled variant grid, Figma-canvas-styled.'],
  ['split', 'Split', 'Both sides of the same contract, side by side.'],
];

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

/** The contract's id when the candidate carries one — workspace metadata only. */
const contractIdOf = (contract: unknown): string => {
  const id = (contract as { id?: unknown } | null)?.id;
  return typeof id === 'string' ? id : '';
};

/** First-visit flag for the onboarding strip — set on dismissal, forever. */
const ONBOARD_KEY = 'ds-playground.onboarded';

// ---------------------------------------------------------------------------
// Receipt builders — verbatim engine output, grouped and named.
// ---------------------------------------------------------------------------

function importReportGroups(report: FigmaImportResult['report']): ReceiptGroup[] {
  const groups: ReceiptGroup[] = [];
  if (report.degradations.length > 0) {
    groups.push({
      title: 'Import report — degradations',
      kind: 'degradation',
      entries: report.degradations.map((d) => ({
        code: d.code,
        label: d.field ? `${d.nodePath} · ${d.field}` : d.nodePath,
        message: d.message,
      })),
    });
  }
  if (report.notes.length > 0) {
    groups.push({
      title: 'Import report — notes',
      kind: 'note',
      entries: report.notes.map((message) => ({ message })),
    });
  }
  return groups;
}

function proposalGroups(proposal: FigmaProposal): ReceiptGroup[] {
  const groups: ReceiptGroup[] = [];
  // The engine's MINTED lines move into their own group (verbatim) — the
  // provisional-token story reads as one block, not scattered notes.
  const notes = proposal.notes.filter((n) => !n.startsWith('MINTED '));
  if (notes.length > 0) {
    groups.push({
      title: `Proposal notes — ${proposal.setName}`,
      kind: 'note',
      entries: notes.map((message) => ({ message })),
    });
  }
  const minted = proposal.mintedTokens;
  if (minted && minted.count > 0) {
    // The panel appends the entry count — this renders as
    // "Minted provisional tokens (N)". Each line carries the engine's own
    // rename guidance, verbatim from the MINTED note wording.
    groups.push({
      title: 'Minted provisional tokens',
      kind: 'minted',
      entries: minted.entries.map((e) => ({
        message: `${e.ref} = ${e.value} — machine-named from a resolved value — rename against your real tokens (provisional); bound at: ${e.usageSites.join(', ')}`,
      })),
    });
  }
  if (proposal.unbound.length > 0) {
    groups.push({
      title: `Unbound values — ${proposal.setName}`,
      kind: 'unbound',
      entries: proposal.unbound.map((u) => ({
        label: `${u.nodePath} · ${u.property}`,
        message: String(u.value),
        suggestions: u.suggestions,
      })),
    });
  }
  return groups;
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export function Playground() {
  const { params } = useRoute();
  const { theme, set: setTheme } = useTheme();
  // The active token source (repo bundled ↔ user pasted) — validation,
  // preview, proposals, and emitters all rebind when it changes.
  const tokenSource = useTokenSource();

  // -------------------------------------------------- contract editor state
  const [text, setText] = useState('');
  const [provenance, setProvenance] = useState('');
  // The pristine original of whatever was last LOADED (example, import,
  // generation, share link). While the editor text diverges from it, a small
  // Reset in the pane header puts it back — one click, nothing lost but the
  // divergence.
  const [pristine, setPristine] = useState<{ text: string; provenance: string } | null>(null);
  const [debouncedText, setDebouncedText] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedText(text), 250);
    return () => window.clearTimeout(t);
  }, [text]);
  const validation = useMemo(
    () => validateContractText(debouncedText),
    // validateContractText reads the active token inventory.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedText, tokenSource],
  );

  const lastGood = useRef<{ contract: Contract; contracts: Map<string, Contract> } | null>(null);
  if (validation.status === 'valid') {
    lastGood.current = { contract: validation.contract, contracts: validation.contracts };
  }

  // ------------------------------------------------ JSON | Spec pane views
  // The Spec view renders the SAME contract as a designer-facing sheet —
  // read-only; the JSON view (with the refereeing editor) is one toggle
  // away and its text is never touched by switching. The spec tracks the
  // last SCHEMA-VALID parse (generator violations still have a shape to
  // show); while the text on screen isn't schema-valid, the sheet goes
  // stale and says so — the refusal list below stays visible in both views.
  const [contractView, setContractView] = useState<'json' | 'spec'>('json');
  const lastSpec = useRef<{ contract: Contract; contracts: Map<string, Contract> } | null>(null);
  if (validation.status === 'valid' || validation.status === 'violations') {
    lastSpec.current = { contract: validation.contract, contracts: validation.contracts };
  }
  const specLive = validation.status === 'valid' || validation.status === 'violations';

  // Refusal → editor line resolution. Lines are only trusted while the text
  // on screen IS the text that was validated (the debounce window would
  // otherwise highlight yesterday's lines on today's keystrokes).
  const editorRef = useRef<ContractEditorHandle>(null);
  const issueLines = useMemo<(number | null)[] | null>(() => {
    if (text !== debouncedText) return null;
    if (validation.status === 'json-error') return [locateJsonParseError(validation.message)];
    if (validation.status === 'schema-error' || validation.status === 'violations') {
      return resolveIssueLines(debouncedText, validation.details);
    }
    return null;
  }, [validation, debouncedText, text]);
  const highlightLines = useMemo(() => {
    const set = new Set<number>();
    for (const line of issueLines ?? []) if (line !== null) set.add(line);
    return set;
  }, [issueLines]);

  /** Scroll the JSON editor to a refusal's line — from the Spec view this
   *  flips back to JSON first (the line lives in the text, not the sheet). */
  const jumpToLine = (line: number) => {
    if (contractView !== 'json') {
      setContractView('json');
      window.setTimeout(() => editorRef.current?.scrollToLine(line), 0);
    } else {
      editorRef.current?.scrollToLine(line);
    }
  };

  /** The refusal list — each entry that resolved to a line scrolls there. */
  const refusalList = (issues: string[]) => (
    <ul className="validation__list">
      {issues.map((issue, i) => {
        const line = issueLines?.[i] ?? null;
        return (
          <li key={i}>
            {line !== null ? (
              <button
                type="button"
                className="validation__jump"
                onClick={() => jumpToLine(line)}
              >
                {issue}
                <span className="validation__jump-line"> → line {line + 1}</span>
              </button>
            ) : (
              issue
            )}
          </li>
        );
      })}
    </ul>
  );

  // -------------------------------------------------------------- receipts
  const [receipts, setReceipts] = useState<Receipts | null>(null);
  // The live minted layer (tokenSource re-renders this component whenever it
  // changes) — drives the assist rename block under the minted receipts group.
  const mintedLayer = activeMintedTokens();

  // -------------------------------------------------------- resizable panes
  const pgRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const outputRef = useRef<HTMLElement>(null);
  const { cols: paneCols, gutterProps } = usePaneResize(pgRef, railRef, outputRef);

  // ------------------------------------------------------------- input rail
  const [sourceTab, setSourceTab] = useState<SourceTab>('examples');
  const [activeExample, setActiveExample] = useState<string | null>(null);
  // The rail tabs scroll horizontally (one row, never wrapping) — keep the
  // active tab visible when the selection lands off-screen.
  const railTabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    railTabsRef.current
      ?.querySelector<HTMLElement>('.tabs__tab.is-active')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [sourceTab]);

  // ---------------------------------------------------- session workspace
  const workspace = useWorkspace();
  // The workspace entry currently in the editor (drives the switch strip);
  // any other load clears it.
  const [wsLoaded, setWsLoaded] = useState<WorkspaceEntry | null>(null);
  const [switchStripDismissed, setSwitchStripDismissed] = useState(() => {
    try {
      return window.sessionStorage.getItem(SWITCH_STRIP_KEY) === '1';
    } catch {
      return false;
    }
  });
  const dismissSwitchStrip = () => {
    setSwitchStripDismissed(true);
    try {
      window.sessionStorage.setItem(SWITCH_STRIP_KEY, '1');
    } catch {
      /* storage unavailable — the strip just returns next load */
    }
  };

  const loadWorkspaceEntry = (entry: WorkspaceEntry) => {
    const origin = `workspace — ${entry.name} (${entry.source} import)`;
    setText(entry.contractText);
    setProvenance(origin);
    setPristine({ text: entry.contractText, provenance: origin });
    setReceipts(entry.receipts);
    // The entry's minted provisional layer comes back with it (or clears).
    setMintedTokens(entry.mintedTokens ?? null);
    setActiveExample(null);
    setWsLoaded(entry);
  };

  const loadContract = (contractId: string, source: string, slug?: string) => {
    const raw = rawContractById.get(contractId);
    if (!raw) return;
    setText(pretty(raw));
    setReceipts(null);
    setMintedTokens(null);
    setProvenance(source);
    setPristine({ text: pretty(raw), provenance: source });
    setActiveExample(slug ?? contractId);
    setWsLoaded(null);
  };

  // ------------------------------------------------------------- code state
  const [codeMode, setCodeMode] = useState<'paste' | 'url'>('paste');
  const [codeUrl, setCodeUrl] = useState('');
  const [codeTsx, setCodeTsx] = useState('');
  const [codeCss, setCodeCss] = useState('');
  const [codeBusy, setCodeBusy] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  // The last GitHub trace — files, receipts, and NAMED gaps. Gaps are the
  // input for the assist fetch-plan rung (deterministic first, AI next).
  const [codeTrace, setCodeTrace] = useState<GithubTrace | null>(null);
  const [codeGaps, setCodeGaps] = useState<string[]>([]);

  /** Shared landing for every code proposal (paste, trace, assist re-run):
   *  receipts assembled, workspace recorded, editor loaded. Returns the
   *  skipped-component reasons (they join the trace gaps for assist). */
  const applyCodeResult = (
    result: ProposeCodeResult,
    origin: string,
    preGroups: ReceiptGroup[],
  ): string[] => {
    const groups: ReceiptGroup[] = [...preGroups];
    for (const { name, proposal } of result.proposals) {
      if (proposal.notes.length > 0) {
        groups.push({
          title: `Proposal notes — ${name}`,
          kind: 'note',
          entries: proposal.notes.map((message) => ({ message })),
        });
      }
    }
    if (result.skipped.length > 0) {
      groups.push({
        title: 'Skipped components (visible but not readable)',
        kind: 'skipped',
        entries: result.skipped.map((s) => ({ label: `${s.name} (${s.source})`, message: s.reason })),
      });
    }
    const codeReceipts: Receipts = { source: origin, groups };
    const first = result.proposals[0];
    if (first) {
      const contractText = pretty(first.proposal.contract);
      // A successful code import lands in the session workspace.
      const recorded = recordImport({
        name: first.name,
        contractId: contractIdOf(first.proposal.contract),
        source: 'code',
        contractText,
        receipts: codeReceipts,
      });
      setReceipts(recorded.receipts);
      setMintedTokens(null);
      setText(contractText);
      setProvenance(`proposed from code — ${first.name}`);
      setPristine({ text: contractText, provenance: `proposed from code — ${first.name}` });
      setWsLoaded(null);
    } else {
      setReceipts(codeReceipts);
      if (result.skipped.length === 0) setCodeError('No component found in the source.');
    }
    setActiveExample(null);
    return result.skipped.map((s) => `component ${s.name} skipped: ${s.reason}`);
  };

  const runCodePropose = async (tsx: string, css: string, origin: string) => {
    setCodeBusy('Loading the TypeScript compiler (lazy chunk, ~5 MB — first run only)…');
    setCodeError(null);
    setCodeTrace(null);
    setCodeGaps([]);
    try {
      const { proposeFromCodeText } = await import('../engine/code-import');
      setCodeBusy('Proposing…');
      applyCodeResult(proposeFromCodeText(tsx, css, 'playground/Pasted.tsx'), origin, []);
    } catch (e) {
      // A chunk-load failure is the redeploy condition — the banner is the
      // message; anything else stays a named inline error.
      if (!reportIfChunkError(e)) setCodeError(e instanceof Error ? e.message : String(e));
    } finally {
      setCodeBusy(null);
    }
  };

  const loadCodeExample = (example: CodeExample, autoRun: boolean) => {
    setSourceTab('code');
    setCodeMode('paste');
    setCodeTsx(example.tsx);
    setCodeCss(example.css);
    setActiveExample(example.slug);
    if (autoRun) void runCodePropose(example.tsx, example.css, `code proposal — ${example.sourcePath}`);
  };

  /** The trace's receipts, rebuilt fresh for every (re-)proposal. */
  const traceGroups = (trace: GithubTrace, extra: ReceiptGroup[] = []): ReceiptGroup[] => [
    {
      title: 'GitHub import — trace',
      kind: 'note',
      entries: trace.notes.map((message) => ({ message })),
    },
    ...(trace.gaps.length > 0
      ? [
          {
            title: 'Trace gaps (what import-following could not close)',
            kind: 'degradation' as const,
            entries: trace.gaps.map((message) => ({ message })),
          },
        ]
      : []),
    ...extra,
  ];

  const runGithubImport = async () => {
    setCodeBusy('Tracing from GitHub (browser-direct, unauthenticated)…');
    setCodeError(null);
    setCodeTrace(null);
    setCodeGaps([]);
    try {
      const trace = await traceFromGithubUrl(codeUrl);
      setCodeTsx(trace.files[0].source);
      setCodeCss(trace.files[0].css ?? '');
      setCodeBusy('Loading the TypeScript compiler (lazy chunk, ~5 MB — first run only)…');
      const { proposeFromCodeFiles } = await import('../engine/code-import');
      setCodeBusy(`Proposing over ${trace.files.length} traced file${trace.files.length === 1 ? '' : 's'}…`);
      const skippedGaps = applyCodeResult(
        proposeFromCodeFiles(trace.files),
        `code proposal — ${trace.sourcePath} (+ ${trace.files.length - 1} traced files)`,
        traceGroups(trace),
      );
      setCodeTrace(trace);
      setCodeGaps([...trace.gaps, ...skippedGaps]);
    } catch (e) {
      if (!reportIfChunkError(e)) setCodeError(e instanceof Error ? e.message : String(e));
    } finally {
      setCodeBusy(null);
    }
  };

  /** The assist rung: repo profile (once per repo@ref per session) → fetch
   *  plan over the full tree listing + the named gaps → receipted fetches →
   *  re-propose. Deterministic tracing already ran; this only closes gaps. */
  const runAssistFetchPlan = async () => {
    const trace = codeTrace;
    if (!trace) return;
    setCodeError(null);
    try {
      setCodeBusy('Listing the repo tree (git trees API)…');
      const { listing, truncated } = await fetchRepoTree(trace.parsed, trace.entryPath);
      const repoUrl = `https://github.com/${trace.parsed.owner}/${trace.parsed.repo}`;

      setCodeBusy('Profiling the repo (assist — cached per repo@ref)…');
      const samples: Array<{ path: string; content: string }> = [];
      try {
        samples.push({ path: 'package.json', content: await fetchRepoFile(trace.parsed, 'package.json') });
      } catch {
        /* a repo without a root package.json still profiles from the entry */
      }
      samples.push({ path: trace.entryPath, content: trace.files[0].source.slice(0, 40_000) });
      const profileResult = await assistRepoProfile({
        repoUrl,
        ref: trace.parsed.ref,
        tree: listing,
        samples,
      });
      if (!profileResult.ok) {
        setCodeError(profileResult.message);
        return;
      }

      setCodeBusy('Planning fetches (assist)…');
      const plan = await assistFetchPlan({
        entryUrl: codeUrl,
        listing,
        alreadyFetched: trace.alreadyFetched,
        gaps: codeGaps,
        profile: profileResult.data.profile,
      });
      if (!plan.ok) {
        setCodeError(plan.message);
        return;
      }

      const aiEntries: ReceiptGroup['entries'] = [
        {
          message: `assist plan: styleSystem = ${plan.data.styleSystem}; repo profile ${
            profileResult.data.cached ? 'cache hit' : 'fresh'
          }${truncated ? '; tree listing truncated at 2000 entries' : ''}`,
        },
        ...plan.data.notes.map((n) => ({ message: `assist note: ${n}` })),
      ];
      const files: SourceFileInput[] = trace.files.map((f) => ({ ...f }));
      const alreadyFetched = [...trace.alreadyFetched];
      setCodeBusy(`Fetching the ${plan.data.fetch.length} assist-proposed file${plan.data.fetch.length === 1 ? '' : 's'}…`);
      for (const f of plan.data.fetch) {
        if (alreadyFetched.includes(f.path)) {
          aiEntries.push({ message: `ai-proposed fetch: ${f.path} — ${f.reason} (already fetched, skipped)` });
          continue;
        }
        try {
          const text = await fetchRepoFile(trace.parsed, f.path);
          alreadyFetched.push(f.path);
          aiEntries.push({ message: `ai-proposed fetch: ${f.path} — ${f.reason}` });
          if (/\.(css|scss)$/.test(f.path)) {
            // Style sources attach to the ENTRY file — the component the
            // import is about; the proposer reads css per source file.
            const entry = files[0];
            const block = `/* --- ${f.path} (ai-proposed fetch) --- */\n${text}`;
            entry.css = entry.css ? `${entry.css}\n\n${block}` : block;
          } else if (/\.(tsx|ts|jsx|js)$/.test(f.path)) {
            files.push({ sourcePath: `${trace.parsed.owner}/${trace.parsed.repo}/${f.path}`, source: text });
          } else {
            aiEntries.push({
              message: `${f.path} fetched but not a TSX/CSS source — the proposer reads component code and stylesheets only; inspect it manually`,
            });
          }
        } catch (e) {
          aiEntries.push({
            message: `ai-proposed fetch: ${f.path} — ${f.reason} — FAILED: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      }

      setCodeBusy(`Re-proposing over ${files.length} files…`);
      const { proposeFromCodeFiles } = await import('../engine/code-import');
      const skippedGaps = applyCodeResult(
        proposeFromCodeFiles(files),
        `code proposal — ${trace.sourcePath} (+ ${files.length - 1} files, assist-planned)`,
        traceGroups(trace, [
          { title: 'Assist fetch plan (ai-proposed)', kind: 'note', entries: aiEntries },
        ]),
      );
      setCodeTrace({ ...trace, files, alreadyFetched });
      setCodeGaps([...trace.gaps, ...skippedGaps]);
      setCodeTsx(files[0].source);
      setCodeCss(files[0].css ?? '');
    } catch (e) {
      if (!reportIfChunkError(e)) setCodeError(e instanceof Error ? e.message : String(e));
    } finally {
      setCodeBusy(null);
    }
  };

  // ------------------------------------------------------------ figma state
  const [figmaUrl, setFigmaUrl] = useState('');
  const [figmaToken, setFigmaToken] = useState('');
  const [figmaDegraded, setFigmaDegraded] = useState(false);
  const [figmaBusy, setFigmaBusy] = useState(false);
  const [figmaError, setFigmaError] = useState<string | null>(null);
  const [figmaProposals, setFigmaProposals] = useState<FigmaProposal[] | null>(null);
  const importGroupsRef = useRef<ReceiptGroup[]>([]);

  const applyProposal = (proposal: FigmaProposal, origin: string, wsSource: WorkspaceSource) => {
    const contractText = pretty(proposal.contract);
    const provenanceLine = `proposed from ${origin} — ${proposal.setName}`;
    const minted: MintedTokenLayer | null =
      proposal.mintedTokens && proposal.mintedTokens.count > 0 ? proposal.mintedTokens : null;
    // Register the minted provisional layer BEFORE the text lands, so the
    // editor's very first validation pass already resolves imported.* refs.
    setMintedTokens(minted);
    // A successful design import lands in the session workspace, receipts
    // and all — re-applying the same set refreshes its entry.
    const recorded = recordImport({
      name: proposal.setName,
      contractId: contractIdOf(proposal.contract),
      source: wsSource,
      contractText,
      receipts: { source: origin, groups: [...importGroupsRef.current, ...proposalGroups(proposal)] },
      ...(minted ? { mintedTokens: minted } : {}),
    });
    setText(contractText);
    setProvenance(provenanceLine);
    setPristine({ text: contractText, provenance: provenanceLine });
    setReceipts(recorded.receipts);
    setActiveExample(null);
    setWsLoaded(null);
  };

  const handleImportResult = (result: FigmaImportResult, origin: string) => {
    const proposals = proposalsFromDump(result.dump);
    if (proposals.length === 0) {
      setFigmaError('The import returned no component set to propose from.');
      return;
    }
    importGroupsRef.current = importReportGroups(result.report);
    setFigmaProposals(proposals);
    applyProposal(proposals[0], origin, 'figma');
  };

  const runFigmaImport = async () => {
    setFigmaBusy(true);
    setFigmaError(null);
    try {
      const result = await importFigmaUrl(figmaUrl.trim(), figmaToken.trim());
      handleImportResult(result, 'Figma REST import');
    } catch (e) {
      setFigmaError(e instanceof Error ? e.message : String(e));
    } finally {
      setFigmaBusy(false);
    }
  };

  const runFigmaDemo = async (degraded: boolean) => {
    setFigmaBusy(true);
    setFigmaError(null);
    try {
      const result = await importFigmaDemo({ degraded });
      handleImportResult(
        result,
        degraded ? 'Figma REST import (demo fixture, variables 403)' : 'Figma REST import (demo fixture)',
      );
    } catch (e) {
      setFigmaError(e instanceof Error ? e.message : String(e));
    } finally {
      setFigmaBusy(false);
    }
  };

  // ------------------------------------------------------------- json state
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const loadJson = () => {
    setJsonError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : String(e));
      return;
    }
    const isDump =
      parsed !== null &&
      typeof parsed === 'object' &&
      Object.entries(parsed).some(
        ([k, v]) => k !== '_provenance' && v !== null && typeof v === 'object' && 'variants' in v,
      );
    if (isDump) {
      try {
        importGroupsRef.current = [];
        const proposals = proposalsFromDump(parsed as FigmaImportResult['dump']);
        if (proposals.length === 0) {
          setJsonError('No component set found in the pasted dump.');
          return;
        }
        setFigmaProposals(proposals);
        applyProposal(proposals[0], 'pasted Figma dump', 'json');
      } catch (e) {
        setJsonError(e instanceof Error ? e.message : String(e));
      }
      return;
    }
    const contractText = pretty(parsed);
    const record = parsed as { name?: unknown; id?: unknown };
    const recorded = recordImport({
      name:
        typeof record.name === 'string'
          ? record.name
          : typeof record.id === 'string'
            ? record.id
            : 'Pasted contract',
      contractId: contractIdOf(parsed),
      source: 'json',
      contractText,
      receipts: null,
    });
    setText(contractText);
    setReceipts(recorded.receipts);
    setMintedTokens(null);
    setProvenance('pasted contract JSON');
    setPristine({ text: contractText, provenance: 'pasted contract JSON' });
    setActiveExample(null);
    setWsLoaded(null);
  };

  // ---------------------------------------------------------- describe state
  const [descPrompt, setDescPrompt] = useState('');
  const [descKey, setDescKey] = useState('');
  const [descModel, setDescModel] = useState<string>(ANTHROPIC_MODEL);
  const [descBusy, setDescBusy] = useState<string | null>(null);
  const [descError, setDescError] = useState<string | null>(null);
  // Refusals from the LAST generation — shown by the editor, echoed here to
  // gate the one-click fix round. Never auto-retried.
  const [descRefusals, setDescRefusals] = useState<string[] | null>(null);
  const [descRounds, setDescRounds] = useState(0);
  const descSession = useRef<PromptSession | null>(null);
  // Demo mode swaps ONLY the transport (recorded-shape fixture responses);
  // kept for the session so fix rounds ride the same transport.
  const descTransport = useRef<FetchLike | null>(null);

  const applyPromptResult = (result: PromptResult, origin: string) => {
    descSession.current = result.session;
    setDescRounds(result.session.rounds);
    const contractText = pretty(result.contract);
    setText(contractText);
    setMintedTokens(null);
    setProvenance(origin);
    setPristine({ text: contractText, provenance: origin });
    setActiveExample(null);
    // The SAME governed editor referees the model output — run it now so the
    // fix affordance appears exactly when the refusals do.
    const v = validateContractText(contractText);
    const issues =
      v.status === 'schema-error' || v.status === 'violations'
        ? v.issues
        : v.status === 'json-error'
          ? [v.message]
          : null;
    setDescRefusals(issues);
    const { usage, rounds } = result.session;
    const promptReceipts: Receipts = {
      source: origin,
      groups: [
        {
          title: 'Prompt generation',
          kind: 'note',
          entries: [
            { message: `model: ${descTransport.current ? 'demo fixture' : descModel}` },
            {
              message:
                usage.inputTokens !== null || usage.outputTokens !== null
                  ? `tokens: ${usage.inputTokens ?? '?'} in / ${usage.outputTokens ?? '?'} out (cumulative)`
                  : 'tokens: not reported by the response',
            },
            { message: `fix rounds used: ${rounds} of ${MAX_FIX_ROUNDS}` },
            ...(issues
              ? [
                  {
                    message: `the proposal is REFUSED by name (${issues.length} violation${
                      issues.length === 1 ? '' : 's'
                    }, shown under the editor) — nothing is auto-retried; the fix round is yours to trigger`,
                  },
                ]
              : []),
          ],
        },
      ],
    };
    // A generation lands in the session workspace too — the fix round
    // refreshes the same entry (one per source + name).
    const candidate = result.contract as { name?: unknown } | null;
    const recorded = recordImport({
      name: typeof candidate?.name === 'string' ? candidate.name : 'Generated component',
      contractId: contractIdOf(result.contract),
      source: 'prompt',
      contractText,
      receipts: promptReceipts,
    });
    setReceipts(recorded.receipts);
    setWsLoaded(null);
  };

  const runDescribe = async (demo: boolean) => {
    let prompt = descPrompt.trim();
    setDescError(null);
    setDescRefusals(null);
    setDescBusy(
      demo
        ? 'Generating over the recorded fixture (identical code path, fixture transport)…'
        : `Asking ${descModel} (browser-direct)…`,
    );
    try {
      let fetchImpl: FetchLike | undefined;
      if (demo) {
        const { createDemoTransport, DEMO_PROMPT } = await import('../engine/fixtures/prompt-demo');
        descTransport.current = createDemoTransport();
        fetchImpl = descTransport.current;
        if (!prompt) {
          prompt = DEMO_PROMPT;
          setDescPrompt(DEMO_PROMPT);
        }
      } else {
        descTransport.current = null;
      }
      const result = await generateFromPrompt(prompt, demo ? 'demo-fixture-key' : descKey.trim(), {
        fetchImpl,
        model: descModel,
      });
      applyPromptResult(
        result,
        demo ? 'prompt generation (demo fixture)' : `prompt generation — ${descModel}`,
      );
    } catch (e) {
      if (!reportIfChunkError(e)) setDescError(e instanceof Error ? e.message : String(e));
    } finally {
      setDescBusy(null);
    }
  };

  const runDescribeFix = async () => {
    const session = descSession.current;
    if (!session || !descRefusals) return;
    setDescError(null);
    setDescBusy(`Sending the named refusals back (round ${session.rounds + 1} of ${MAX_FIX_ROUNDS})…`);
    try {
      const demo = descTransport.current !== null;
      const result = await requestFix(session, descRefusals, demo ? 'demo-fixture-key' : descKey.trim(), {
        fetchImpl: descTransport.current ?? undefined,
        model: descModel,
      });
      applyPromptResult(
        result,
        demo
          ? `prompt generation (demo fixture) — fix round ${result.session.rounds}`
          : `prompt generation — ${descModel}, fix round ${result.session.rounds}`,
      );
    } catch (e) {
      setDescError(e instanceof Error ? e.message : String(e));
    } finally {
      setDescBusy(null);
    }
  };

  // ------------------------------------------------------------ tokens state
  const [tokensText, setTokensText] = useState(() => storedUserTokensText());
  const [tokensErrors, setTokensErrors] = useState<string[] | null>(null);
  const [tokensNote, setTokensNote] = useState<string | null>(null);

  const applyTokens = () => {
    const result = applyUserTokens(tokensText);
    if (result.ok) {
      setTokensErrors(null);
      setTokensNote(
        `Applied — ${result.source.inventory.size} token paths from ${result.source.docCount} document${
          result.source.docCount === 1 ? '' : 's'
        }. Everything now binds against your tree.`,
      );
    } else {
      setTokensNote(null);
      setTokensErrors(result.errors);
    }
  };

  // ----------------------------------------------- URL params (?example=…)
  const appliedQuery = useRef<string | null>(null);
  useEffect(() => {
    const query = params.toString();
    if (appliedQuery.current === query) return;
    appliedQuery.current = query;
    const slug = params.get('example');
    const source = params.get('source');
    if (slug) {
      const example = exampleBySlug.get(slug);
      if (example?.kind === 'contract') {
        loadContract(example.contractId, `loaded from examples — ${example.contractId}`, example.slug);
      } else if (example?.kind === 'code') {
        loadCodeExample(example, true);
      }
      return;
    }
    if (source === 'figma' || source === 'code' || source === 'json') setSourceTab(source);
    // A share hash owns the boot state — don't race it with the default example.
    if (!text && !sharePayloadFromLocation()) {
      loadContract('ds.badge', 'loaded from examples — ds.badge', 'badge');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // ------------------------------------------------------------ output pane
  const [outputTab, setOutputTab] = useState('preview');

  // ------------------------------------------------- share links (#s=…)
  const [shareNote, setShareNote] = useState<string | null>(null);
  useEffect(() => {
    // Decode a share link on boot: contract + output tab + theme. User
    // tokens and secrets never travel in links, so none are read here.
    // (The cancelled flag keeps StrictMode's double-mount harmless.)
    const payload = sharePayloadFromLocation();
    if (!payload) return;
    let cancelled = false;
    void (async () => {
      try {
        const state = await decodeShareState(payload);
        if (cancelled) return;
        setText(state.contract);
        setMintedTokens(null);
        setProvenance('loaded from share link');
        setPristine({ text: state.contract, provenance: 'loaded from share link' });
        setActiveExample(null);
        setOutputTab(
          state.output === 'preview' || emitters.some((e) => e.name === state.output)
            ? state.output
            : 'preview',
        );
        setTheme(state.theme);
      } catch (e) {
        if (!cancelled) setShareNote(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------- first-visit onboarding strip
  const [onboardDismissed, setOnboardDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(ONBOARD_KEY) === '1';
    } catch {
      return true;
    }
  });
  const [onboardDone, setOnboardDone] = useState<boolean[]>([false, false, false, false]);

  const markOnboardStep = (i: number) =>
    setOnboardDone((d) => d.map((v, j) => (j === i ? true : v)));

  const dismissOnboarding = () => {
    setOnboardDismissed(true);
    try {
      window.localStorage.setItem(ONBOARD_KEY, '1');
    } catch {
      /* storage unavailable — the strip just returns next visit */
    }
  };

  const onboardSteps: Array<{ label: string; run: () => void }> = [
    {
      label: 'Pick an example',
      run: () => {
        setSourceTab('examples');
        setOutputTab('preview');
        loadContract('ds.badge', 'loaded from examples — ds.badge', 'badge');
      },
    },
    {
      label: 'Break the contract — watch a named refusal',
      run: () => {
        const raw = rawContractById.get('ds.badge');
        if (!raw) return;
        setText(pretty(raw).replace('{radius.badge}', '{radius.bogus}'));
        setProvenance('onboarding — one token ref broken on purpose');
        setActiveExample(null);
      },
    },
    {
      label: 'Check the React output',
      run: () => setOutputTab('react'),
    },
    {
      label: 'Reset the example',
      run: () => {
        // Step 2 broke the contract on purpose — this puts the pristine
        // Badge back (same as the pane-header Reset while text diverges).
        setOutputTab('preview');
        loadContract('ds.badge', 'loaded from examples — ds.badge', 'badge');
      },
    },
  ];

  const runShare = async () => {
    try {
      const payload = await encodeShareState({ contract: text, output: outputTab, theme });
      if (payload.length > SHARE_LIMIT_BYTES) {
        setShareNote(
          `share-link-too-long: ${(payload.length / 1024).toFixed(1)} KB exceeds the ${
            SHARE_LIMIT_BYTES / 1024
          } KB URL guard — share the contract JSON itself instead.`,
        );
        return;
      }
      const url = `${window.location.origin}/playground#s=${payload}`;
      window.history.replaceState(null, '', `/playground#s=${payload}`);
      await navigator.clipboard.writeText(url);
      setShareNote(`copied — ${(payload.length / 1024).toFixed(1)} KB link`);
      window.setTimeout(() => setShareNote(null), 4000);
    } catch (e) {
      setShareNote(`share-link-failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const [format, setFormat] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [formattedFiles, setFormattedFiles] = useState<EmittedFile[] | null>(null);

  const emittable =
    validation.status === 'valid' || validation.status === 'violations' ? validation : null;

  const emitted = useMemo(() => {
    if (outputTab === 'preview' || !emittable) return null;
    const emitter = emitters.find((e) => e.name === outputTab);
    if (!emitter) return null;
    try {
      return {
        files: emitter.emit(emittable.contract, {
          tokens: tokenSource.tree,
          icons,
          contracts: emittable.contracts,
          mode: theme,
        }),
        error: null as string | null,
      };
    } catch (e) {
      return { files: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [outputTab, emittable, theme, tokenSource]);

  useEffect(() => {
    setFormattedFiles(null);
    if (!format || !emitted?.files) return;
    let cancelled = false;
    setFormatting(true);
    void (async () => {
      const { formatTsx, formatCss } = await import('../engine/format-lazy');
      const files = await Promise.all(
        emitted.files!.map(async (f) => {
          try {
            if (/\.(tsx|ts|jsx|js)$/.test(f.path)) return { ...f, contents: await formatTsx(f.contents) };
            if (f.path.endsWith('.css')) return { ...f, contents: await formatCss(f.contents) };
          } catch {
            /* unformattable file (e.g. the figma script's runtime shape) — show as emitted */
          }
          return f;
        }),
      );
      if (!cancelled) setFormattedFiles(files);
    })()
      .catch((e) => {
        // The prettier chunk failing to load is the redeploy condition —
        // the banner handles it; output simply stays unformatted.
        reportIfChunkError(e);
      })
      .finally(() => {
        if (!cancelled) setFormatting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [format, emitted]);

  const previewTarget = validation.status === 'valid' ? validation : null;

  // Hold-last-render is only honest while the text on screen is still the
  // SAME contract: a different id means the previous component's render would
  // masquerade as this one's. The id comes from the parse when there is one,
  // else a cheap scan of the text (a mid-edit JSON error still names itself).
  const currentContractId =
    validation.status === 'valid' || validation.status === 'violations'
      ? validation.contract.id
      : validation.status === 'empty'
        ? null
        : (debouncedText.match(/"id"\s*:\s*"([^"]+)"/)?.[1] ?? null);
  const sameContractAsLastGood =
    currentContractId !== null && currentContractId === (lastGood.current?.contract.id ?? null);
  const holdLastRender = !previewTarget && sameContractAsLastGood ? lastGood.current : null;
  const stale = !previewTarget && holdLastRender;
  // Neutral empty state: an invalid contract that is NOT the one last
  // rendered — show nothing rather than someone else's pills.
  const neutralPreview = !previewTarget && !holdLastRender && validation.status !== 'empty';
  // The demo generation deliberately refuses round 1 — say so on the banner.
  const demoRefusalSuffix =
    provenance.startsWith('prompt generation (demo fixture)') && descRefusals && descRefusals.length > 0
      ? ' (deliberate demo refusal — trigger the fix round)'
      : '';

  // ------------------------------------------ interactive preview controls
  // Single (controls + one instance at the chosen props) is the default;
  // All variants is the classic showcase grid, one row per axis value.
  const [previewMode, setPreviewMode] = useState<'single' | 'all'>('single');
  // The canvas SURFACE behind the component — neutral light by default, like
  // Figma's canvas, independent of the app theme (a dark-styled import must
  // stay visible with the app in dark mode). Persisted per browser.
  const [previewSurface, setPreviewSurface] = useState<PreviewSurface>(() => {
    try {
      const stored = window.localStorage.getItem(PREVIEW_SURFACE_KEY);
      return stored === 'dark' || stored === 'checker' ? stored : 'light';
    } catch {
      return 'light';
    }
  });
  const changePreviewSurface = (s: PreviewSurface) => {
    setPreviewSurface(s);
    try {
      window.localStorage.setItem(PREVIEW_SURFACE_KEY, s);
    } catch {
      /* storage unavailable — the choice just doesn't persist */
    }
  };
  // Code | Canvas | Split — which SIDE of the contract the preview shows.
  // Split (the two surfaces side by side) is the design↔code story in one
  // glance; the choice persists per browser.
  const [previewView, setPreviewView] = useState<PreviewView>(() => {
    try {
      const stored = window.localStorage.getItem(PREVIEW_VIEW_KEY);
      return stored === 'canvas' || stored === 'split' ? stored : 'code';
    } catch {
      return 'code';
    }
  });
  const changePreviewView = (v: PreviewView) => {
    setPreviewView(v);
    try {
      window.localStorage.setItem(PREVIEW_VIEW_KEY, v);
    } catch {
      /* storage unavailable — the choice just doesn't persist */
    }
  };
  const [previewOverrides, setPreviewOverrides] = useState<PreviewPropOverrides>({});
  // The prop whose last toggle changed nothing visible — honest inline note.
  const [previewNoteProp, setPreviewNoteProp] = useState<string | null>(null);
  const lastChangedProp = useRef<string | null>(null);
  const prevInstance = useRef<{ stateKey: string; sig: string | null } | null>(null);

  const previewData = previewTarget ?? holdLastRender;
  const previewContractId = previewData?.contract.id ?? null;
  // A different contract in the frame resets the chosen state.
  useEffect(() => {
    setPreviewOverrides({});
    setPreviewNoteProp(null);
    lastChangedProp.current = null;
    prevInstance.current = null;
  }, [previewContractId]);

  const activeOverrides = useMemo(
    () => (previewData ? sanitizeOverrides(previewData.contract, previewOverrides) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previewData?.contract, previewOverrides],
  );

  const singlePreview = useMemo(() => {
    if (!previewData || outputTab !== 'preview' || previewView === 'canvas' || previewMode !== 'single')
      return null;
    return buildPreviewAtState(previewData.contract, previewData.contracts, previewSurface, activeOverrides);
    // buildPreviewAtState reads the active token source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewData?.contract, previewData?.contracts, previewSurface, activeOverrides, tokenSource, outputTab, previewMode, previewView]);

  // Honest-note bookkeeping: when a control change leaves the instance
  // markup byte-identical, the change had no visible effect BY DESIGN (the
  // emitted CSS is state-independent) — say so on that control.
  useEffect(() => {
    if (!singlePreview?.ok) return;
    const stateKey = JSON.stringify(activeOverrides);
    const prev = prevInstance.current;
    if (
      prev &&
      prev.stateKey !== stateKey &&
      lastChangedProp.current &&
      prev.sig !== null &&
      singlePreview.instanceHtml !== null
    ) {
      setPreviewNoteProp(prev.sig === singlePreview.instanceHtml ? lastChangedProp.current : null);
    }
    prevInstance.current = { stateKey, sig: singlePreview.instanceHtml };
  }, [singlePreview, activeOverrides]);

  const handlePreviewControl = (name: string, value: string | boolean | number) => {
    lastChangedProp.current = name;
    setPreviewOverrides((o) => ({ ...o, [name]: value }));
  };

  // ------------------------------------------- workspace entry rendering
  const wsEntryRow = (entry: WorkspaceEntry) => (
    <div key={entry.id} className="ws__row">
      <button
        type="button"
        className={`rail__item ws__load${wsLoaded?.id === entry.id ? ' is-active' : ''}`}
        onClick={() => loadWorkspaceEntry(entry)}
        title={
          entry.contractId
            ? `${entry.contractId} — imported at ${wsTime(entry.importedAt)}`
            : `imported at ${wsTime(entry.importedAt)}`
        }
      >
        <span className="ws__tag" aria-hidden>
          {WS_TAGS[entry.source]}
        </span>
        <span className="ws__name">{entry.name}</span>
        <span className="ws__time">{wsTime(entry.importedAt)}</span>
      </button>
      <button
        type="button"
        className="ws__remove"
        aria-label={`Remove ${entry.name} from the workspace`}
        onClick={() => removeWorkspaceEntry(entry.id)}
      >
        ×
      </button>
    </div>
  );

  /** "Imported this session" — the same workspace entries, filtered, shown
   *  under the form that produced them. */
  const wsMiniList = (source: WorkspaceSource) => {
    const items = workspace.filter((e) => e.source === source);
    if (items.length === 0) return null;
    return (
      <div className="rail__group ws__mini">
        <div className="rail__group-title">Imported this session</div>
        {items.map(wsEntryRow)}
      </div>
    );
  };

  // ------------------------------------------------------------------ render
  return (
    <>
      {!onboardDismissed && (
        <div className="onboard" role="note" aria-label="Getting started">
          <span className="onboard__title">New here? The whole loop in three clicks, plus a reset:</span>
          {onboardSteps.map((step, i) => (
            <button
              key={step.label}
              type="button"
              className={`onboard__step${onboardDone[i] ? ' is-done' : ''}`}
              onClick={() => {
                step.run();
                markOnboardStep(i);
              }}
            >
              <span className="onboard__num" aria-hidden>
                {onboardDone[i] ? '✓' : i + 1}
              </span>
              {step.label}
            </button>
          ))}
          <button type="button" className="btn--ghost onboard__dismiss" onClick={dismissOnboarding}>
            Dismiss
          </button>
        </div>
      )}
      <div
        className="pg"
        ref={pgRef}
        style={paneCols ? ({ '--pg-cols': paneCols } as CSSProperties) : undefined}
      >
      {/* ------------------------------------------------------- left rail */}
      <aside className="pg__rail" ref={railRef}>
        <div className="tabs" role="tablist" aria-label="Input source" ref={railTabsRef}>
          {(
            [
              // The Workspace tab appears with the first import (and stays
              // while selected, so Clear all doesn't yank the floor away).
              ...(workspace.length > 0 || sourceTab === 'workspace'
                ? [['workspace', 'Workspace'] as const]
                : []),
              ['examples', 'Examples'],
              ['describe', 'Describe'],
              ['figma', 'Figma'],
              ['code', 'Code'],
              ['json', 'JSON'],
              ['tokens', 'Tokens'],
            ] as ReadonlyArray<readonly [SourceTab, string]>
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={sourceTab === tab}
              className={`tabs__tab${sourceTab === tab ? ' is-active' : ''}`}
              onClick={() => setSourceTab(tab)}
            >
              {label}
              {tab === 'tokens' && tokenSource.kind === 'user' ? (
                <span className="tabs__dot" aria-label="user tokens active" />
              ) : null}
            </button>
          ))}
        </div>

        {sourceTab === 'workspace' && (
          <div className="rail__section">
            {workspace.length === 0 ? (
              <p className="hint">
                Nothing imported yet — Figma, Code, and Describe imports collect here for the
                session.
              </p>
            ) : (
              <>
                {WS_ORDER.filter((s) => workspace.some((e) => e.source === s)).map((s) => (
                  <div key={s} className="rail__group">
                    <div className="rail__group-title">{WS_GROUP_TITLES[s]}</div>
                    {workspace.filter((e) => e.source === s).map(wsEntryRow)}
                  </div>
                ))}
                <p className="hint">
                  Session-only (this tab&rsquo;s sessionStorage, gone on close). Click an entry to
                  restore its contract and receipts; the newest {WORKSPACE_CAP} are kept.
                </p>
                <button type="button" style={{ marginTop: 8 }} onClick={clearWorkspace}>
                  Clear all
                </button>
              </>
            )}
          </div>
        )}

        {sourceTab === 'examples' && (
          <div className="rail__section">
            {(['Atom', 'Molecule', 'Composition', 'Foreign code'] as const).map((category) => (
              <div key={category} className="rail__group">
                <div className="rail__group-title">{category}</div>
                {examples
                  .filter((e) => e.category === category)
                  .map((e) => (
                    <button
                      key={e.slug}
                      type="button"
                      className={`rail__item${activeExample === e.slug ? ' is-active' : ''}`}
                      onClick={() =>
                        e.kind === 'contract'
                          ? loadContract(e.contractId, `loaded from examples — ${e.contractId}`, e.slug)
                          : loadCodeExample(e, true)
                      }
                    >
                      {e.name}
                    </button>
                  ))}
              </div>
            ))}
            <div className="rail__group">
              <div className="rail__group-title">All {contractsById.size} contracts</div>
              <select
                aria-label="Load any contract"
                value={activeExample && contractsById.has(activeExample) ? activeExample : ''}
                onChange={(e) => {
                  if (e.target.value) loadContract(e.target.value, `loaded from contracts/ — ${e.target.value}`);
                }}
              >
                <option value="">Pick a contract…</option>
                {[...contractsById.keys()].sort().map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {sourceTab === 'describe' && (
          <div className="rail__section rail__form">
            <div className="field">
              <label htmlFor="desc-prompt">Describe a component</label>
              <textarea
                id="desc-prompt"
                rows={5}
                value={descPrompt}
                onChange={(e) => setDescPrompt(e.target.value)}
                placeholder="A small pill-shaped tag that labels content with a feedback tone: info, success, warning, or danger."
              />
            </div>
            <div className="field">
              <label htmlFor="desc-key">Anthropic API key</label>
              <input
                id="desc-key"
                type="password"
                value={descKey}
                onChange={(e) => setDescKey(e.target.value)}
                autoComplete="off"
                placeholder="sk-ant-…"
              />
              <p className="hint">
                Session-only, like the Figma token — sent browser-direct to api.anthropic.com and
                nowhere else, gone on reload.
              </p>
            </div>
            <div className="field">
              <label htmlFor="desc-model">Model</label>
              <select id="desc-model" value={descModel} onChange={(e) => setDescModel(e.target.value)}>
                {ANTHROPIC_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn--primary"
              disabled={!!descBusy || !descPrompt.trim() || !descKey.trim()}
              onClick={() => void runDescribe(false)}
            >
              {descBusy ? 'Working…' : 'Generate contract'}
            </button>
            <p className="hint">
              Model: {ANTHROPIC_MODEL}. A forced tool call constrains the output to the contract
              shape — never freeform code — and the same governed editor referees it, refusals by
              name.
            </p>

            <details className="rail__details">
              <summary>No key handy? Demo generate instead</summary>
              <p className="hint">
                The identical code path over a recorded-shape response — fixture transport, same
                governance. Round 1 deliberately references a token that does not exist, so the
                named refusal and the fix round both demo.
              </p>
              <button type="button" disabled={!!descBusy} onClick={() => void runDescribe(true)}>
                {descBusy ? 'Working…' : 'Demo generate (recorded fixture)'}
              </button>
            </details>

            {descBusy ? <p className="hint">{descBusy}</p> : null}
            {descError ? <div className="notice notice--error">{descError}</div> : null}

            {descRefusals && descSession.current ? (
              <div className="notice">
                The proposal was refused by name ({descRefusals.length} violation
                {descRefusals.length === 1 ? '' : 's'} under the editor). Nothing retries silently —
                send the refusal text back yourself:
                <div style={{ marginTop: 8 }}>
                  {descRounds < MAX_FIX_ROUNDS ? (
                    <button type="button" disabled={!!descBusy} onClick={() => void runDescribeFix()}>
                      Ask the model to fix (round {descRounds + 1} of {MAX_FIX_ROUNDS})
                    </button>
                  ) : (
                    <span className="hint">
                      Fix round limit reached ({MAX_FIX_ROUNDS}) — edit the contract by hand; the
                      editor referees every keystroke.
                    </span>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {sourceTab === 'figma' && (
          <div className="rail__section">
            {/* The three-rung fidelity ladder moved to the Help drawer
                ("Coming from design" → "Working locally?") — public visitors
                can't run CLIs, so the tab keeps only what runs HERE:
                URL + token, and the fixture demo. */}
            <div className="field">
              <label htmlFor="figma-url">figma.com component URL</label>
              <input
                id="figma-url"
                type="text"
                value={figmaUrl}
                onChange={(e) => setFigmaUrl(e.target.value)}
                placeholder="https://www.figma.com/design/…?node-id=1-23"
                spellCheck={false}
              />
            </div>
            <div className="field">
              <label htmlFor="figma-token">Personal access token</label>
              <input
                id="figma-token"
                type="password"
                value={figmaToken}
                onChange={(e) => setFigmaToken(e.target.value)}
                autoComplete="off"
                placeholder="figd_…"
              />
              <p className="hint">
                Session-only. Sent to api.figma.com and nowhere else — never stored, never
                persisted, gone on reload.
              </p>
            </div>
            <button
              type="button"
              className="btn--primary"
              disabled={figmaBusy || !figmaUrl.trim() || !figmaToken.trim()}
              onClick={() => void runFigmaImport()}
            >
              {figmaBusy ? 'Importing…' : 'Import'}
            </button>

            <p className="hint" style={{ marginTop: 16 }}>
              No token handy? Run the same import over the repo&rsquo;s committed REST fixture —
              identical code path, fixture transport.
            </p>
            <div className="checkline">
              <input
                id="figma-degraded"
                type="checkbox"
                checked={figmaDegraded}
                onChange={(e) => setFigmaDegraded(e.target.checked)}
              />
              <label htmlFor="figma-degraded" style={{ margin: 0 }}>
                Simulate a non-Enterprise plan (variables endpoint 403s)
              </label>
            </div>
            <button type="button" disabled={figmaBusy} onClick={() => void runFigmaDemo(figmaDegraded)}>
              {figmaBusy ? 'Importing…' : 'Demo import (Badge fixture)'}
            </button>
            <p className="hint">Fixture URL: {DEMO_URL.replace('https://www.', '')}</p>

            {figmaError ? <div className="notice notice--error">{figmaError}</div> : null}

            {figmaProposals && figmaProposals.length > 1 ? (
              <div className="rail__group" style={{ marginTop: 12 }}>
                <div className="rail__group-title">Proposed sets</div>
                {figmaProposals.map((p) => (
                  <button
                    key={p.setName}
                    type="button"
                    className="rail__item"
                    onClick={() => applyProposal(p, 'Figma REST import', 'figma')}
                  >
                    {p.setName}
                  </button>
                ))}
              </div>
            ) : null}

            {wsMiniList('figma')}
          </div>
        )}

        {sourceTab === 'code' && (
          <div className="rail__section">
            <div className="tabs tabs--sub" role="tablist" aria-label="Code input mode">
              {(['paste', 'url'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={codeMode === mode}
                  className={`tabs__tab${codeMode === mode ? ' is-active' : ''}`}
                  onClick={() => setCodeMode(mode)}
                >
                  {mode === 'paste' ? 'Paste' : 'GitHub URL'}
                </button>
              ))}
            </div>

            {codeMode === 'url' && (
              <>
                <div className="field">
                  <label htmlFor="code-url">Public GitHub file or directory URL</label>
                  <input
                    id="code-url"
                    type="text"
                    value={codeUrl}
                    onChange={(e) => setCodeUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo/blob/main/src/Button.tsx"
                    spellCheck={false}
                  />
                  <p className="hint">
                    blob, raw, or directory (tree) URLs — public repos only, fetched browser-direct
                    with no token. The tracer follows the entry&rsquo;s relative imports (up to{' '}
                    {MAX_TRACE_FILES} files: .tsx/.ts/.css/.scss), every fetch receipted; what it
                    can&rsquo;t close is a named gap.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn--primary"
                  disabled={!!codeBusy || !codeUrl.trim()}
                  onClick={() => void runGithubImport()}
                >
                  {codeBusy ? 'Working…' : 'Fetch & propose'}
                </button>
                {codeBusy ? <p className="hint">{codeBusy}</p> : null}
                {codeError ? <div className="notice notice--error">{codeError}</div> : null}
                {!codeBusy && codeTrace && codeGaps.length > 0 ? (
                  <div className="notice">
                    The deterministic trace left {codeGaps.length} named gap
                    {codeGaps.length === 1 ? '' : 's'} (listed in the receipts). The next rung is
                    AI: an assist plan proposes which repo files close them — every fetch labeled
                    ai-proposed, then the same proposer re-runs.
                    <div style={{ marginTop: 8 }}>
                      <button type="button" disabled={!!codeBusy} onClick={() => void runAssistFetchPlan()}>
                        Plan fetches with AI
                      </button>
                    </div>
                  </div>
                ) : null}
                {!codeBusy && !codeError && codeTsx ? (
                  <p className="hint">
                    Fetched source is loaded into the Paste fields — switch modes to inspect or edit
                    it.
                  </p>
                ) : null}
              </>
            )}

            {codeMode === 'paste' && (
              <>
                <div className="field">
                  <label htmlFor="code-tsx">Component source (TSX)</label>
                  <textarea
                    id="code-tsx"
                    rows={10}
                    value={codeTsx}
                    onChange={(e) => setCodeTsx(e.target.value)}
                    placeholder="export function Badge({ variant = 'info' }: … ) { … }"
                    spellCheck={false}
                  />
                </div>
                <div className="field">
                  <label htmlFor="code-css">CSS Module (optional — unlocks anatomy)</label>
                  <textarea
                    id="code-css"
                    rows={7}
                    value={codeCss}
                    onChange={(e) => setCodeCss(e.target.value)}
                    placeholder=".root { … }"
                    spellCheck={false}
                  />
                </div>
                <button
                  type="button"
                  className="btn--primary"
                  disabled={!!codeBusy || !codeTsx.trim()}
                  onClick={() => void runCodePropose(codeTsx, codeCss, 'code proposal — pasted source')}
                >
                  {codeBusy ? 'Working…' : 'Propose contract'}
                </button>
                {codeBusy ? <p className="hint">{codeBusy}</p> : null}
                {codeError ? <div className="notice notice--error">{codeError}</div> : null}
              </>
            )}

            {wsMiniList('code')}
          </div>
        )}

        {sourceTab === 'json' && (
          <div className="rail__section">
            <div className="field">
              <label htmlFor="json-paste">Contract JSON or Figma dump (v1)</label>
              <textarea
                id="json-paste"
                rows={14}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='{ "id": "ds.badge", … }  — or a plugin/REST dump'
                spellCheck={false}
              />
              <p className="hint">
                The power-user path: a pasted contract goes straight to the editor; a pasted dump
                (the JSON a Figma plugin or REST export produces) runs the same proposer the
                Figma import runs.
              </p>
            </div>
            <button type="button" className="btn--primary" disabled={!jsonText.trim()} onClick={loadJson}>
              Load
            </button>
            {jsonError ? <div className="notice notice--error">{jsonError}</div> : null}
          </div>
        )}

        {sourceTab === 'tokens' && (
          <div className="rail__section rail__form">
            <div className="token-status">
              <span className="token-status__k">active token source</span>
              {tokenSource.label} — {tokenSource.inventory.size} token paths. Proposals,
              suggestions, the inline emitter&rsquo;s literals, and the preview stylesheet all
              bind against this tree.
              {tokenSource.kind === 'user' ? (
                <button type="button" onClick={() => { resetToRepoTokens(); setTokensNote(null); setTokensErrors(null); }}>
                  Back to repo tokens
                </button>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="tokens-paste">Your DTCG token JSON (a single tree or an array of trees)</label>
              <textarea
                id="tokens-paste"
                rows={14}
                value={tokensText}
                onChange={(e) => setTokensText(e.target.value)}
                placeholder='{ "color": { "feedback": { "info": { "background": { "$value": "#dbeafe", "$type": "color" } } } } }'
                spellCheck={false}
              />
              <p className="hint">
                Session-only: kept in this tab&rsquo;s sessionStorage, sent nowhere, gone when the
                tab closes. Multiple documents merge into one modeless tree — light and dark
                resolve identically.
              </p>
            </div>
            <div className="btn-row">
              <button type="button" className="btn--primary" disabled={!tokensText.trim()} onClick={applyTokens}>
                Apply tokens
              </button>
              <button type="button" onClick={() => setTokensText(STARTER_USER_TOKENS)}>
                Load starter tree
              </button>
            </div>
            <p className="hint">
              The starter tree covers exactly what ds.badge needs, with values the repo never
              shipped. Load any other contract against it and the generator refuses by name —
              honest degradation, nothing invented.
            </p>
            {tokensNote ? <div className="notice">{tokensNote}</div> : null}
            {tokensErrors ? (
              <div className="notice notice--error">
                Refused — {tokensErrors.length} issue{tokensErrors.length === 1 ? '' : 's'}
                <ul className="validation__list">
                  {tokensErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </aside>

      <div
        className="pg__gutter"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the input rail — drag, or nudge with the arrow keys; double-click resets"
        tabIndex={0}
        {...gutterProps('rail')}
      />

      {/* ---------------------------------------------------------- center */}
      <section className="pg__center">
        <div className="pane__head">
          <span className="pane__title">Contract</span>
          <div className="seg" role="group" aria-label="Contract view">
            <button
              type="button"
              className={`seg__btn${contractView === 'json' ? ' is-active' : ''}`}
              aria-pressed={contractView === 'json'}
              onClick={() => setContractView('json')}
            >
              JSON
            </button>
            <button
              type="button"
              className={`seg__btn${contractView === 'spec' ? ' is-active' : ''}`}
              aria-pressed={contractView === 'spec'}
              onClick={() => setContractView('spec')}
              title="The same contract as a readable spec sheet — props, variants, slots, tokens. Read-only; editing stays in JSON."
            >
              Spec
            </button>
          </div>
          <span className="editor__meta">{provenance}</span>
          {pristine !== null && text !== pristine.text ? (
            <button
              type="button"
              className="btn--small share__btn"
              onClick={() => {
                setText(pristine.text);
                setProvenance(pristine.provenance);
              }}
              title="Restore the pristine original of what was loaded — your edits are discarded."
            >
              Reset
            </button>
          ) : null}
          <button
            type="button"
            className="btn--small share__btn"
            disabled={!text.trim()}
            onClick={() => void runShare()}
            title="Copy a link carrying this contract, the active output tab, and the theme — never your tokens or keys."
          >
            Share
          </button>
        </div>
        {shareNote ? (
          <div className={`share__note${shareNote.startsWith('copied') ? '' : ' share__note--warn'}`}>
            {shareNote}
          </div>
        ) : null}
        <div className="editor">
          {contractView === 'spec' ? (
            lastSpec.current ? (
              <>
                {!specLive ? (
                  <div className="preview__stale">
                    Contract not schema-valid — showing the spec of the last valid parse. The
                    refusals below name what to fix.
                  </div>
                ) : null}
                <SpecSheet
                  contract={lastSpec.current.contract}
                  contracts={lastSpec.current.contracts}
                  onEditJson={() => setContractView('json')}
                />
              </>
            ) : (
              <div className="pane__body hint">
                No spec to show yet — load or paste a contract, then flip back here.
              </div>
            )
          ) : (
            <ContractEditor
              ref={editorRef}
              text={text}
              onChange={setText}
              highlights={highlightLines}
              placeholder="The contract — pick an example, import from Figma, or paste code."
            />
          )}
          <div
            className={`validation ${
              validation.status === 'valid'
                ? 'validation--valid'
                : validation.status === 'empty'
                  ? ''
                  : 'validation--invalid'
            }`}
            role="status"
          >
            {validation.status === 'empty' && 'No contract yet.'}
            {validation.status === 'valid' &&
              `Schema-valid: ${validation.contract.id} v${validation.contract.version}`}
            {validation.status === 'json-error' && (
              <>
                Not JSON
                {refusalList([validation.message])}
              </>
            )}
            {validation.status === 'schema-error' && (
              <>
                Refused by ContractSchema — {validation.issues.length} issue
                {validation.issues.length === 1 ? '' : 's'}
                {refusalList(validation.issues)}
              </>
            )}
            {validation.status === 'violations' && (
              <>
                Schema-valid, but the generator refuses — {validation.issues.length} named violation
                {validation.issues.length === 1 ? '' : 's'}
                {refusalList(validation.issues)}
              </>
            )}
          </div>
          <ReceiptsPanel
            receipts={receipts}
            mintedExtras={
              mintedLayer ? (
                <MintAssist
                  key={provenance}
                  minted={mintedLayer}
                  component={lastSpec.current?.contract.name ?? 'Component'}
                  text={text}
                  onApplyText={setText}
                />
              ) : undefined
            }
          />
        </div>
      </section>

      <div
        className="pg__gutter"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the output pane — drag, or nudge with the arrow keys; double-click resets"
        tabIndex={0}
        {...gutterProps('output')}
      />

      {/* ---------------------------------------------------------- output */}
      <section className="pg__output" ref={outputRef}>
        {wsLoaded && !switchStripDismissed ? (
          <div className="switch-strip" role="note">
            <span>{WS_SWITCH_LINES[wsLoaded.source]}</span>
            <button
              type="button"
              className="btn--ghost switch-strip__dismiss"
              onClick={dismissSwitchStrip}
              aria-label="Dismiss for this session"
            >
              Dismiss
            </button>
          </div>
        ) : null}
        <div className="tabs" role="tablist" aria-label="Output target">
          <button
            type="button"
            role="tab"
            aria-selected={outputTab === 'preview'}
            className={`tabs__tab${outputTab === 'preview' ? ' is-active' : ''}`}
            onClick={() => setOutputTab('preview')}
          >
            Preview
          </button>
          {emitters.map((e) => (
            <button
              key={e.name}
              type="button"
              role="tab"
              aria-selected={outputTab === e.name}
              title={OUTPUT_TITLES[e.name] ?? e.label}
              className={`tabs__tab${outputTab === e.name ? ' is-active' : ''}`}
              onClick={() => setOutputTab(e.name)}
            >
              {OUTPUT_LABELS[e.name] ?? e.name}
            </button>
          ))}
        </div>

        {outputTab === 'preview' ? (
          <div className="preview">
            {stale ? (
              <div className="preview__stale">
                Contract invalid — showing the last valid render. Fix the named refusals to update.
              </div>
            ) : null}
            {previewData ? (
              (() => {
                const codeBody =
                  previewMode === 'single' ? (
                    <>
                      <PreviewControls
                        contract={previewData.contract}
                        overrides={activeOverrides}
                        onChange={handlePreviewControl}
                        notedProp={previewNoteProp}
                      />
                      {singlePreview?.ok ? (
                        <iframe
                          sandbox=""
                          srcDoc={singlePreview.doc}
                          title={previewTarget ? 'Contract preview — chosen state' : 'Contract preview — chosen state (last valid)'}
                        />
                      ) : singlePreview ? (
                        <div className="output__error">{singlePreview.error}</div>
                      ) : null}
                    </>
                  ) : (
                    <PreviewFrame
                      contract={previewData.contract}
                      contracts={previewData.contracts}
                      surface={previewSurface}
                      title={previewTarget ? 'Contract preview' : 'Contract preview (last valid)'}
                    />
                  );
                const canvasBody = (
                  <CanvasFrame
                    contract={previewData.contract}
                    contracts={previewData.contracts}
                    title={previewTarget ? 'Canvas preview' : 'Canvas preview (last valid)'}
                  />
                );
                return (
                  <>
                    <div className="preview__bar">
                      <div className="seg" role="group" aria-label="Preview side">
                        {PREVIEW_VIEWS.map(([v, label, hint]) => (
                          <button
                            key={v}
                            type="button"
                            className={`seg__btn${previewView === v ? ' is-active' : ''}`}
                            aria-pressed={previewView === v}
                            title={hint}
                            onClick={() => changePreviewView(v)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {previewView !== 'canvas' ? (
                        <div className="seg" role="group" aria-label="Preview mode">
                          <button
                            type="button"
                            className={`seg__btn${previewMode === 'single' ? ' is-active' : ''}`}
                            aria-pressed={previewMode === 'single'}
                            onClick={() => setPreviewMode('single')}
                          >
                            Single
                          </button>
                          <button
                            type="button"
                            className={`seg__btn${previewMode === 'all' ? ' is-active' : ''}`}
                            aria-pressed={previewMode === 'all'}
                            onClick={() => setPreviewMode('all')}
                          >
                            All variants
                          </button>
                        </div>
                      ) : null}
                      <span className="preview__bar-hint">
                        {previewView === 'canvas'
                          ? PREVIEW_VIEWS[1][2]
                          : previewView === 'split'
                            ? 'Both sides compiled from the same contract — code left, canvas right.'
                            : previewMode === 'single'
                              ? 'One instance at the props you pick — rendered live by the same HTML emitter.'
                              : 'Every variant value and boolean, one row each.'}
                      </span>
                      {previewView !== 'canvas' ? (
                        <div
                          className="seg preview__surface"
                          role="group"
                          aria-label="Preview canvas surface"
                          title="The backdrop behind the component — independent of the app theme, like Figma's canvas. Dark also switches the token mode. (The Canvas side is always light, like Figma.)"
                        >
                          {PREVIEW_SURFACES.map(([s, label]) => (
                            <button
                              key={s}
                              type="button"
                              className={`seg__btn${previewSurface === s ? ' is-active' : ''}`}
                              aria-pressed={previewSurface === s}
                              onClick={() => changePreviewSurface(s)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {previewView === 'code' ? (
                      codeBody
                    ) : previewView === 'canvas' ? (
                      canvasBody
                    ) : (
                      <div className="preview__split">
                        <div className="preview__split-col">
                          <div className="preview__split-cap">Code — HTML emitter</div>
                          {codeBody}
                        </div>
                        <div className="preview__split-col">
                          <div className="preview__split-cap">Canvas — figma engine</div>
                          {canvasBody}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()
            ) : neutralPreview ? (
              <div className="pane__body hint preview__neutral">
                No valid render yet{currentContractId ? ` for ${currentContractId}` : ''} — fix the
                refusals to see it{demoRefusalSuffix}
              </div>
            ) : (
              <div className="pane__body hint">Nothing to render yet.</div>
            )}
          </div>
        ) : (
          <>
            <div className="output__toolbar">
              <label>
                <input type="checkbox" checked={format} onChange={(e) => setFormat(e.target.checked)} />
                Format (prettier, lazy ~1.4 MB){formatting ? ' — formatting…' : ''}
              </label>
              {outputTab === 'react-inline' ? (
                <span>
                  tokens resolved for {theme} mode
                  {tokenSource.kind === 'user' ? ' — from your pasted tree' : ''}
                </span>
              ) : null}
            </div>
            <div className="output__files">
              {!emittable ? (
                <div className="pane__body hint">A schema-valid contract flows here.</div>
              ) : emitted?.error ? (
                <div className="output__error">{emitted.error}</div>
              ) : (
                (formattedFiles ?? emitted?.files ?? []).map((file) => (
                  <div key={file.path} className="output__file">
                    <div className="output__filehead">
                      <span className="output__filename">{file.path}</span>
                      <CopyButton text={file.contents} className="output__copy" />
                    </div>
                    <HighlightedCode path={file.path} code={file.contents} />
                  </div>
                ))
              )}
            </div>
          </>
        )}
        <div className="provenance">
          Generated in your browser by the same core that ships the repo&rsquo;s{' '}
          {contractsById.size} components — core/index.ts,{' '}
          <span
            title="Golden-guarded: the CLI's output from this same core is byte-compared against committed reference files on every eval run — the playground cannot drift from the shipping generator."
            style={{ textDecoration: 'underline dotted', cursor: 'help' }}
          >
            golden-guarded
          </span>
          .
        </div>
      </section>
      </div>
    </>
  );
}

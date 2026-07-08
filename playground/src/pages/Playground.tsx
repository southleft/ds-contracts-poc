import { useEffect, useMemo, useRef, useState } from 'react';
import { emitters, type Contract, type EmittedFile } from '../../../core/index.js';
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
import { importFromGithubUrl } from '../engine/github-import';
import {
  ANTHROPIC_MODEL,
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
  applyUserTokens,
  resetToRepoTokens,
  STARTER_USER_TOKENS,
  storedUserTokensText,
  useTokenSource,
} from '../engine/token-source';
import { locateJsonParseError, resolveIssueLines } from '../engine/refusal-lines';
import { validateContractText } from '../engine/validate';
import type { ReceiptGroup, Receipts } from '../receipts';
import { ContractEditor, type ContractEditorHandle } from '../components/ContractEditor';
import { CopyButton } from '../components/CopyButton';
import { PreviewFrame } from '../components/PreviewFrame';
import { ReceiptsPanel } from '../components/ReceiptsPanel';

type SourceTab = 'examples' | 'describe' | 'figma' | 'code' | 'json' | 'tokens';
const OUTPUT_LABELS: Record<string, string> = {
  react: 'React',
  html: 'HTML + CSS',
  'react-inline': 'React inline',
  'figma-script': 'Figma script',
};

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

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
  if (proposal.notes.length > 0) {
    groups.push({
      title: `Proposal notes — ${proposal.setName}`,
      kind: 'note',
      entries: proposal.notes.map((message) => ({ message })),
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
                onClick={() => editorRef.current?.scrollToLine(line)}
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

  // ------------------------------------------------------------- input rail
  const [sourceTab, setSourceTab] = useState<SourceTab>('examples');
  const [activeExample, setActiveExample] = useState<string | null>(null);

  const loadContract = (contractId: string, source: string, slug?: string) => {
    const raw = rawContractById.get(contractId);
    if (!raw) return;
    setText(pretty(raw));
    setReceipts(null);
    setProvenance(source);
    setPristine({ text: pretty(raw), provenance: source });
    setActiveExample(slug ?? contractId);
  };

  // ------------------------------------------------------------- code state
  const [codeMode, setCodeMode] = useState<'paste' | 'url'>('paste');
  const [codeUrl, setCodeUrl] = useState('');
  const [codeTsx, setCodeTsx] = useState('');
  const [codeCss, setCodeCss] = useState('');
  const [codeBusy, setCodeBusy] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const runCodePropose = async (
    tsx: string,
    css: string,
    origin: string,
    opts: { sourcePath?: string; preGroups?: ReceiptGroup[] } = {},
  ) => {
    setCodeBusy('Loading the TypeScript compiler (lazy chunk, ~5 MB — first run only)…');
    setCodeError(null);
    try {
      const { proposeFromCodeText } = await import('../engine/code-import');
      setCodeBusy('Proposing…');
      const result = proposeFromCodeText(tsx, css, opts.sourcePath ?? 'playground/Pasted.tsx');
      const groups: ReceiptGroup[] = [...(opts.preGroups ?? [])];
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
      setReceipts({ source: origin, groups });
      const first = result.proposals[0];
      if (first) {
        setText(pretty(first.proposal.contract));
        setProvenance(`proposed from code — ${first.name}`);
        setPristine({
          text: pretty(first.proposal.contract),
          provenance: `proposed from code — ${first.name}`,
        });
      } else if (result.skipped.length === 0) {
        setCodeError('No component found in the pasted source.');
      }
      setActiveExample(null);
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : String(e));
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

  const runGithubImport = async () => {
    setCodeBusy('Fetching from GitHub (browser-direct, unauthenticated)…');
    setCodeError(null);
    try {
      const imported = await importFromGithubUrl(codeUrl);
      setCodeTsx(imported.tsx);
      setCodeCss(imported.css);
      setActiveExample(null);
      await runCodePropose(imported.tsx, imported.css, `code proposal — ${imported.sourcePath}`, {
        sourcePath: imported.sourcePath,
        preGroups: [
          {
            title: 'GitHub import',
            kind: 'note',
            entries: imported.notes.map((message) => ({ message })),
          },
        ],
      });
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : String(e));
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

  const applyProposal = (proposal: FigmaProposal, origin: string) => {
    setText(pretty(proposal.contract));
    setProvenance(`proposed from ${origin} — ${proposal.setName}`);
    setPristine({
      text: pretty(proposal.contract),
      provenance: `proposed from ${origin} — ${proposal.setName}`,
    });
    setReceipts({ source: origin, groups: [...importGroupsRef.current, ...proposalGroups(proposal)] });
    setActiveExample(null);
  };

  const handleImportResult = (result: FigmaImportResult, origin: string) => {
    const proposals = proposalsFromDump(result.dump);
    if (proposals.length === 0) {
      setFigmaError('The import returned no component set to propose from.');
      return;
    }
    importGroupsRef.current = importReportGroups(result.report);
    setFigmaProposals(proposals);
    applyProposal(proposals[0], origin);
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
        applyProposal(proposals[0], 'pasted Figma dump');
      } catch (e) {
        setJsonError(e instanceof Error ? e.message : String(e));
      }
      return;
    }
    setText(pretty(parsed));
    setReceipts(null);
    setProvenance('pasted contract JSON');
    setPristine({ text: pretty(parsed), provenance: 'pasted contract JSON' });
    setActiveExample(null);
  };

  // ---------------------------------------------------------- describe state
  const [descPrompt, setDescPrompt] = useState('');
  const [descKey, setDescKey] = useState('');
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
    setReceipts({
      source: origin,
      groups: [
        {
          title: 'Prompt generation',
          kind: 'note',
          entries: [
            { message: `model: ${ANTHROPIC_MODEL}` },
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
    });
  };

  const runDescribe = async (demo: boolean) => {
    let prompt = descPrompt.trim();
    setDescError(null);
    setDescRefusals(null);
    setDescBusy(
      demo
        ? 'Generating over the recorded fixture (identical code path, fixture transport)…'
        : `Asking ${ANTHROPIC_MODEL} (browser-direct)…`,
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
      });
      applyPromptResult(
        result,
        demo ? 'prompt generation (demo fixture)' : `prompt generation — ${ANTHROPIC_MODEL}`,
      );
    } catch (e) {
      setDescError(e instanceof Error ? e.message : String(e));
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
      });
      applyPromptResult(
        result,
        demo
          ? `prompt generation (demo fixture) — fix round ${result.session.rounds}`
          : `prompt generation — ${ANTHROPIC_MODEL}, fix round ${result.session.rounds}`,
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
    (async () => {
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
    })().finally(() => {
      if (!cancelled) setFormatting(false);
    });
    return () => {
      cancelled = true;
    };
  }, [format, emitted]);

  const previewTarget = validation.status === 'valid' ? validation : null;
  const stale = !previewTarget && lastGood.current;

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
      <div className="pg">
      {/* ------------------------------------------------------- left rail */}
      <aside className="pg__rail">
        <div className="tabs" role="tablist" aria-label="Input source">
          {(
            [
              ['examples', 'Examples'],
              ['describe', 'Describe'],
              ['figma', 'Figma'],
              ['code', 'Code'],
              ['json', 'JSON'],
              ['tokens', 'Tokens'],
            ] as const
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
                    onClick={() => applyProposal(p, 'Figma REST import')}
                  >
                    {p.setName}
                  </button>
                ))}
              </div>
            ) : null}
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
                  <label htmlFor="code-url">Public GitHub file URL</label>
                  <input
                    id="code-url"
                    type="text"
                    value={codeUrl}
                    onChange={(e) => setCodeUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo/blob/main/src/Button.tsx"
                    spellCheck={false}
                  />
                  <p className="hint">
                    blob, raw, or directory URLs — public repos only, fetched browser-direct with no
                    token. The co-located *.module.css is auto-discovered (the component&rsquo;s own
                    import, the same-name sibling, then the directory listing).
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
                runs the same proposer the Figma import runs.
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

      {/* ---------------------------------------------------------- center */}
      <section className="pg__center">
        <div className="pane__head">
          <span className="pane__title">Contract</span>
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
          <ContractEditor
            ref={editorRef}
            text={text}
            onChange={setText}
            highlights={highlightLines}
            placeholder="The contract — pick an example, import from Figma, or paste code."
          />
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
          <ReceiptsPanel receipts={receipts} />
        </div>
      </section>

      {/* ---------------------------------------------------------- output */}
      <section className="pg__output">
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
              title={e.label}
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
            {previewTarget ? (
              <PreviewFrame
                contract={previewTarget.contract}
                contracts={previewTarget.contracts}
                title="Contract preview"
              />
            ) : lastGood.current ? (
              <PreviewFrame
                contract={lastGood.current.contract}
                contracts={lastGood.current.contracts}
                title="Contract preview (last valid)"
              />
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
                    <pre className="output__code">{file.contents}</pre>
                  </div>
                ))
              )}
            </div>
          </>
        )}
        <div className="provenance">
          Generated in your browser by the same core that ships the repo&rsquo;s{' '}
          {contractsById.size} components — core/index.ts, golden-guarded.
        </div>
      </section>
      </div>
    </>
  );
}

/**
 * CODE → CONTRACT, one call — the browser-facing composition of the pure
 * extraction pipeline: TypeScript-API prop reading (core/extract-react-tsx),
 * CSS-Module anatomy inversion (core/extract-css-module), and proposal
 * shaping (extract/propose.ts, already pure). No node:* imports.
 *
 * The CLI equivalents (extract/run.ts, extract/roundtrip-code.ts) walk the
 * file system and call the same modules — the receipts referee this code.
 */
import { extractFromSource, type SkippedComponent, type SourceFileInput } from './extract-react-tsx.js';
import { tokenIndexFromJson, type TokenIndex } from './extract-css-module.js';
import { collectRootCustomProps } from './mint-code.js';
import { proposeContract, type ProposalResult } from '../extract/propose.js';

export interface ProposeCodeCtx {
  /** Parsed DTCG token trees (referee for var(--x) → {a.b.c} bindings),
   *  or a prebuilt index. */
  tokens: unknown[] | TokenIndex;
  /** Contract id namespace (default "ds" → "ds.<kebab-name>"). */
  prefix?: string;
  /** OPT-IN provisional minting: unbindable styled declarations (raw
   *  literals + foreign var()s) become `imported.*` leaves and the proposal
   *  binds to them (ProposalResult.mintedTokens carries the tree). Default
   *  off — the CLI's report-only behavior is unchanged. */
  mintUnbound?: boolean;
  /** Stylesheets fetched for their `:root { --x: … }` declarations alone
   *  (a tokens.css / theme.css no component imports directly) — the
   *  vocabulary foreign var()s resolve against, alongside every traced
   *  file's own attached css. */
  extraCss?: string[];
}

export interface ProposeCodeResult {
  /** One schema-valid proposed contract per readable component. */
  proposals: Array<{ name: string; proposal: ProposalResult }>;
  /** Components that were visible but not readable — reported, never dropped. */
  skipped: SkippedComponent[];
}

/** Propose contracts from React/TypeScript source text (+ optional
 *  co-located CSS Module text for anatomy). */
export function proposeFromCode(
  sources: SourceFileInput | SourceFileInput[],
  ctx: ProposeCodeCtx,
): ProposeCodeResult {
  const index: TokenIndex = Array.isArray(ctx.tokens) ? tokenIndexFromJson(ctx.tokens) : ctx.tokens;
  const inputs = Array.isArray(sources) ? sources : [sources];
  // The mint pass's :root vocabulary — harvested ONCE across the whole
  // fetched CSS set (every traced file's attached css + extraCss).
  const mint = ctx.mintUnbound
    ? {
        customProps: collectRootCustomProps([
          ...inputs.map((i) => i.css ?? '').filter((t) => t.length > 0),
          ...(ctx.extraCss ?? []),
        ]),
      }
    : undefined;
  const skipped: SkippedComponent[] = [];
  const seen = new Set<string>();
  const proposals: Array<{ name: string; proposal: ProposalResult }> = [];
  for (const input of inputs) {
    for (const component of extractFromSource(input, () => index, seen, skipped)) {
      proposals.push({ name: component.name, proposal: proposeContract(component, ctx.prefix ?? 'ds', mint) });
    }
  }
  return { proposals, skipped };
}

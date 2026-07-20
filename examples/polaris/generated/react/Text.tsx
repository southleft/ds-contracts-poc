/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/text.contract.json (polaris.text v0.3.2)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Text.module.css';

export interface TextProps extends HTMLAttributes<HTMLParagraphElement> {
  /** Adjust horizontal alignment of text */
  alignment?: 'start' | 'center' | 'end' | 'justify';
  /** The element type */
  as?: 'dt' | 'dd' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'strong' | 'legend';
  /** Prevent text from overflowing */
  breakWord?: boolean;
  /** Adjust tone of text */
  tone?: 'base' | 'disabled' | 'inherit' | 'success' | 'critical' | 'caution' | 'subdued' | 'text-inverse' | 'text-inverse-secondary' | 'magic' | 'magic-subdued';
  /** Adjust weight of text */
  fontWeight?: 'regular' | 'medium' | 'semibold' | 'bold';
  /** Use a numeric font variant with monospace appearance */
  numeric?: boolean;
  /** Truncate text overflow with ellipsis */
  truncate?: boolean;
  /** Typographic style of text */
  variant?: 'headingXs' | 'headingSm' | 'headingMd' | 'headingLg' | 'headingXl' | 'heading2xl' | 'heading3xl' | 'bodyXs' | 'bodySm' | 'bodyMd' | 'bodyLg';
  /** Visually hide the text */
  visuallyHidden?: boolean;
}

/** PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Text/Text.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 148.0.7778.96; overflow channels in the sibling extension file. FLOOR-PROMOTED v0.3.2 (extract/computed rounds 4 + 5c + 5d): this contract is the computed-floor rebuild — complete browser truth captured from the real @shopify/polaris@13.9.5 npm package rendered in headless Chromium 148.0.7778.96 (every enumerated longhand per element incl. ::before/::after, full state sweep, double-run byte-identity), fused with the static semantic layer (BOUND bindings browser-confirmed, unlabeled channels MINTED as imported.* tokens in tokens/polaris-minted.dtcg.json, uniform registry channels DECLARED), with the round-4 DOM-ANATOMY PROMOTION: every rendered element is a carried part, svg glyph content rides committed icon assets reconstructed from the captured d/fill channels, presence facts gate structure-creating props, zero binding contradictions in the review queue (source enriched.contract.json). Round 5c promotion lifts: complement-of-product presence (a default subtree an alternative replaces carries an ordered hide/restore stylesWhen cascade, verified per combo), root-hosted svg plans, authored-viewBox unification across per-size glyph captures, carried-channel re-mint when a defaultless axis contests the reviewed carriage (S2 maps with the unset base), curated shape geometry re-derived from the captured computed box, and drawn pseudo-element decor boxes carried as shape parts (S5 v1). Round 5d lifts (owner visual review): svg dash channels are DROPPED with a named receipt — they are pathLength-relative and pathLength is not a computed style, so the settled draw-on stroke carries as the continuous resting glyph (the Checkbox check); and a carried CSS SHORTHAND covers every constituent longhand in fusion coverage (border-radius all four corners, border-width/-color all four sides, gap both gaps) — the minted sibling longhands that overrode semantic bindings (Badge radius corners as imported.shared.size-8 over {p.border-radius-200}) are retired. Everything the vocabulary cannot carry is named in contracts/text.extension.json. Delta ledger: extract/computed/out/text/LEDGER.md (supersedes this component's section of extraction/PROMOTION.md). */
export const Text = forwardRef<HTMLParagraphElement, TextProps>(function Text(
  { alignment = 'undefined', as = 'undefined', tone = 'undefined', fontWeight = 'undefined', variant = 'undefined', breakWord = false, numeric = false, truncate = false, visuallyHidden = false, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`alignment-${alignment}`], styles[`as-${as}`], styles[`tone-${tone}`], styles[`fontWeight-${fontWeight}`], styles[`variant-${variant}`], className].filter(Boolean).join(' ');
  return (
    <p ref={ref} className={classes} data-break-word={breakWord || undefined} data-numeric={numeric || undefined} data-truncate={truncate || undefined} data-visually-hidden={visuallyHidden || undefined} {...rest}>
      {children}
    </p>
  );
});

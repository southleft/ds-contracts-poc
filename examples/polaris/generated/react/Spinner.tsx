/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/spinner.contract.json (polaris.spinner v0.3.2)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Spinner.module.css';

const ICONS: Record<string, string> = {
  "spinner-root-small": "<svg viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 7.229 1.173 A 9.25 9.25 0 1 0 18.884 12.585 A 1.25 1.25 0 1 0 16.484 11.887 A 6.75 6.75 0 1 1 7.978 3.558 A 1.25 1.25 0 1 0 7.228 1.173 Z\" fill=\"currentColor\"/></svg>",
  "spinner-root-large": "<svg viewBox=\"0 0 44 44\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 15.542 1.487 A 21.507 21.507 0 0 0 0.5 22 C 0.5 33.874 10.126 43.5 22 43.5 C 31.847 43.5 40.364 36.825 42.809 27.428 A 1.5 1.5 0 0 0 39.905 26.672 C 37.803 34.755 30.473 40.5 22 40.5 C 11.783 40.5 3.5 32.217 3.5 22 C 3.5 13.863 8.8 6.753 16.442 4.35 A 1.5 1.5 0 1 0 15.542 1.487 Z\" fill=\"currentColor\"/></svg>",
};

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  /** Size of spinner */
  size?: 'small' | 'large';
  /** Accessible label for the spinner */
  accessibilityLabel?: string;
  /** Allows the component to apply the correct accessibility roles based on focus */
  hasFocusableParent?: boolean;
}

/** PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Spinner/Spinner.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 148.0.7778.96; overflow channels in the sibling extension file. FLOOR-PROMOTED v0.3.2 (extract/computed rounds 4 + 5c + 5d): this contract is the computed-floor rebuild — complete browser truth captured from the real @shopify/polaris@13.9.5 npm package rendered in headless Chromium 148.0.7778.96 (every enumerated longhand per element incl. ::before/::after, full state sweep, double-run byte-identity), fused with the static semantic layer (BOUND bindings browser-confirmed, unlabeled channels MINTED as imported.* tokens in tokens/polaris-minted.dtcg.json, uniform registry channels DECLARED), with the round-4 DOM-ANATOMY PROMOTION: every rendered element is a carried part, svg glyph content rides committed icon assets reconstructed from the captured d/fill channels, presence facts gate structure-creating props, zero binding contradictions in the review queue (source enriched.contract.json). Round 5c promotion lifts: complement-of-product presence (a default subtree an alternative replaces carries an ordered hide/restore stylesWhen cascade, verified per combo), root-hosted svg plans, authored-viewBox unification across per-size glyph captures, carried-channel re-mint when a defaultless axis contests the reviewed carriage (S2 maps with the unset base), curated shape geometry re-derived from the captured computed box, and drawn pseudo-element decor boxes carried as shape parts (S5 v1). Round 5d lifts (owner visual review): svg dash channels are DROPPED with a named receipt — they are pathLength-relative and pathLength is not a computed style, so the settled draw-on stroke carries as the continuous resting glyph (the Checkbox check); and a carried CSS SHORTHAND covers every constituent longhand in fusion coverage (border-radius all four corners, border-width/-color all four sides, gap both gaps) — the minted sibling longhands that overrode semantic bindings (Badge radius corners as imported.shared.size-8 over {p.border-radius-200}) are retired. Everything the vocabulary cannot carry is named in contracts/spinner.extension.json. Delta ledger: extract/computed/out/spinner/LEDGER.md (supersedes this component's section of extraction/PROMOTION.md). */
export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { size = 'large', hasFocusableParent = false, accessibilityLabel, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} data-has-focusable-parent={hasFocusableParent || undefined} {...rest}>
      {size === 'small' ? (<span className={styles["root-small"]} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS["spinner-root-small"] }} />) : null}
{size === 'large' ? (<span className={styles["root-large"]} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS["spinner-root-large"] }} />) : null}
    </span>
  );
});

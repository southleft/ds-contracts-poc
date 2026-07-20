/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/badge.contract.json (polaris.badge v0.3.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Badge.module.css';

const ICONS: Record<string, string> = {
  "badge-icon-3-incomplete": "<svg viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 8.547 12.69 C 8.73 12.74 8.99 12.75 10 12.75 S 11.27 12.74 11.453 12.69 A 1.75 1.75 0 0 0 12.69 11.453 C 12.74 11.271 12.75 11.01 12.75 10 S 12.74 8.73 12.69 8.547 A 1.75 1.75 0 0 0 11.453 7.31 C 11.271 7.26 11.01 7.25 10 7.25 S 8.73 7.26 8.547 7.31 A 1.75 1.75 0 0 0 7.31 8.547 C 7.26 8.73 7.25 8.99 7.25 10 S 7.26 11.27 7.31 11.453 A 1.75 1.75 0 0 0 8.547 12.69 Z M 6.102 8.224 C 6 8.605 6 9.07 6 10 S 6 11.395 6.102 11.777 A 3 3 0 0 0 8.224 13.897 C 8.605 14 9.07 14 10 14 S 11.395 14 11.777 13.898 A 3 3 0 0 0 13.897 11.777 C 14 11.395 14 10.93 14 10 C 14 9.07 14 8.605 13.898 8.224 A 3 3 0 0 0 11.777 6.102 C 11.395 6 10.93 6 10 6 C 9.07 6 8.605 6 8.224 6.102 A 3 3 0 0 0 6.102 8.224 Z\" fill-rule=\"evenodd\"/></svg>",
  "badge-icon-3-partiallycomplete": "<svg viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 8.888 6.014 L 8.871 5.996 L 8.851 6.016 C 8.598 6.029 8.401 6.054 8.223 6.102 A 3 3 0 0 0 6.103 8.224 C 6 8.605 6 9.07 6 10 S 6 11.395 6.102 11.777 A 3 3 0 0 0 8.223 13.897 C 8.605 14 9.07 14 10 14 C 10.93 14 11.395 14 11.776 13.898 A 3 3 0 0 0 13.898 11.777 C 14 11.395 14 10.93 14 10 C 14 9.07 14 8.605 13.898 8.224 A 3 3 0 0 0 11.776 6.102 C 11.395 6 10.93 6 10 6 C 9.525 6 9.171 6 8.888 6.014 Z M 8.446 7.34 A 1.75 1.75 0 0 0 7.405 8.28 L 11.719 12.595 C 12.162 12.395 12.505 12.019 12.66 11.553 L 8.446 7.34 Z M 12.75 9.876 L 10.124 7.25 C 11.032 7.251 11.278 7.263 11.453 7.31 A 1.75 1.75 0 0 1 12.69 8.547 C 12.737 8.722 12.749 8.967 12.75 9.876 Z M 8.547 12.69 C 8.729 12.74 8.989 12.75 10 12.75 H 10.106 L 7.25 9.894 V 10 C 7.25 11.01 7.26 11.27 7.31 11.453 A 1.75 1.75 0 0 0 8.547 12.69 Z\" fill-rule=\"evenodd\"/></svg>",
  "badge-icon-3-complete": "<svg viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 6 10 C 6 9.07 6 8.605 6.102 8.224 A 3 3 0 0 1 8.223 6.102 C 8.605 6 9.07 6 10 6 C 10.93 6 11.395 6 11.776 6.102 A 3 3 0 0 1 13.898 8.224 C 14 8.605 14 9.07 14 10 S 14 11.395 13.898 11.777 A 3 3 0 0 1 11.776 13.897 C 11.395 14 10.93 14 10 14 S 8.605 14 8.223 13.898 A 3 3 0 0 1 6.103 11.777 C 6 11.395 6 10.93 6 10 Z\"/></svg>",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Colors and labels the badge with the given tone (round 4: enumerated from the real @shopify/polaris@13.9.5 Badge API — the static extraction had missed the styling axes entirely). */
  tone?: 'info' | 'success' | 'warning' | 'critical' | 'attention' | 'new' | 'magic' | 'info-strong' | 'success-strong' | 'warning-strong' | 'critical-strong' | 'attention-strong' | 'read-only' | 'enabled';
  /** Render a pip showing the progress of a given task (round 4: real Badge API axis). */
  progress?: 'incomplete' | 'partiallyComplete' | 'complete';
  /** Pass a custom accessibilityLabel */
  toneAndProgressLabelOverride?: string;
}

/** PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Badge/Badge.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. ROUND 4: single-tone static bindings on root (background-color/color/font-weight) and label typography REMOVED — the real tone/progress axes contest them per value; the computed floor rebuilds these channels from browser truth (S2 base + per-axis mint). COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 148.0.7778.96; overflow channels in the sibling extension file. FLOOR-PROMOTED v0.3.0 (extract/computed round 4): this contract is the computed-floor rebuild — complete browser truth captured from the real @shopify/polaris@13.9.5 npm package rendered in headless Chromium 148.0.7778.96 (every enumerated longhand per element incl. ::before/::after, full state sweep, double-run byte-identity), fused with the static semantic layer (BOUND bindings browser-confirmed, unlabeled channels MINTED as imported.* tokens in tokens/polaris-minted.dtcg.json, uniform registry channels DECLARED), with the round-4 DOM-ANATOMY PROMOTION: every rendered element is a carried part, svg glyph content rides committed icon assets reconstructed from the captured d/fill channels, presence facts gate structure-creating props, zero binding contradictions in the review queue (source enriched.contract.json). Everything the vocabulary cannot carry is named in contracts/badge.extension.json. Delta ledger: extract/computed/out/badge/LEDGER.md (supersedes this component's section of extraction/PROMOTION.md). */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = 'undefined', progress = 'undefined', toneAndProgressLabelOverride, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`tone-${tone}`], styles[`progress-${progress}`], className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} {...rest}>
      <span className={styles["label-2"]}>Info</span>
<span className={styles.icon}>
<span className={styles["icon-2"]}>
<span className={styles["label-3"]}>Incomplete</span>
<div className={styles["icon-3"]}>
{progress === 'incomplete' ? (<span className={styles["icon-3-incomplete"]} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS["badge-icon-3-incomplete"] }} />) : null}
{progress === 'partiallyComplete' ? (<span className={styles["icon-3-partiallycomplete"]} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS["badge-icon-3-partiallycomplete"] }} />) : null}
{progress === 'complete' ? (<span className={styles["icon-3-complete"]} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS["badge-icon-3-complete"] }} />) : null}
</div>
</span>
</span>
<span className={styles.label}>Fulfilled</span>
    </span>
  );
});

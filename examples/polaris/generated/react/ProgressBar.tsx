/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/progress-bar.contract.json (polaris.progress-bar v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './ProgressBar.module.css';

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** The progression of certain tasks */
  progress?: number;
  /** Size of progressbar */
  size?: 'small' | 'medium' | 'large';
  /** Whether the fill animation is triggered */
  animated?: boolean;
  /** Id (ids) of element (elements) that describes progressbar */
  ariaLabelledBy?: string;
  /** Color of progressbar */
  tone?: 'highlight' | 'primary' | 'success' | 'critical';
}

/** PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/ProgressBar/ProgressBar.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 148.0.7778.96; overflow channels in the sibling extension file. FLOOR-PROMOTED v0.2.0 (extract/computed round 2): this contract is the computed-floor rebuild — complete browser truth captured from the real @shopify/polaris@13.9.5 npm package rendered in headless Chromium 148.0.7778.96 (every enumerated longhand per element incl. ::before/::after, full state sweep, double-run byte-identity), fused with the static semantic layer (BOUND bindings browser-confirmed, unlabeled channels MINTED as imported.* tokens in tokens/polaris-minted.dtcg.json, uniform registry channels DECLARED), contradictions resolved computed-wins per the decisions ledger (extract/computed/out/progressbar/decisions.md, human-acked; source enriched.contract.json). Everything the vocabulary cannot carry is named in contracts/progress-bar.extension.json. Delta ledger: extract/computed/out/progressbar/LEDGER.md (supersedes this component's section of extraction/PROMOTION.md). */
export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(function ProgressBar(
  { size = 'medium', tone = 'highlight', animated = false, progress = 0, ariaLabelledBy, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], styles[`tone-${tone}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} data-animated={animated || undefined} {...rest}>
      <div className={styles.indicator}>

</div>
    </div>
  );
});

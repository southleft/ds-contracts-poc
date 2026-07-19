/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/progress-bar.contract.json (polaris.progress-bar v0.1.0)
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

/** PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/ProgressBar/ProgressBar.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. */
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

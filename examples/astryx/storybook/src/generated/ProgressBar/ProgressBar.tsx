/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/progress-bar.contract.json (astryx.progress-bar v0.3.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './ProgressBar.module.css';

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Current progress value. */
  value?: number;
  /** Maximum progress value. */
  max?: number;
  /** Accessible label for the progress bar. */
  label: string;
  /** The fill tone. */
  variant?: 'accent' | 'success' | 'warning' | 'neutral' | 'error';
  /** Whether progress is indeterminate. */
  isIndeterminate?: boolean;
  /** Whether the progress bar is disabled. */
  isDisabled?: boolean;
}

/** Astryx ProgressBar — a determinate meter with a label row. Promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/ProgressBar/ProgressBar.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). value/max/label/variant and the indeterminate/disabled flags are verbatim; isLabelHidden, hasValueLabel and formatValueLabel are dropped. CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2). COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @astryxdesign/core@0.1.6 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/astryx/scripts/promote-floor.ts): enriched.contract.json — computed-capture truth with the decisions ledger applied (extract/computed/out/astryx/progressbar/decisions.md); extension sidecar carries the named overflow. */
export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(function ProgressBar(
  {
    variant = 'accent',
    isIndeterminate = false,
    isDisabled = false,
    value = 40,
    max = 100,
    label,
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], className].filter(Boolean).join(' ');
  return (
    <div
      ref={ref}
      className={classes}
      data-is-indeterminate={isIndeterminate || undefined}
      data-is-disabled={isDisabled || undefined}
      {...rest}
    >
      <div className={styles['part-0']}>
        <span className={styles.label}>{label}</span>
      </div>
      <div className={styles['progressbar-track']}>
        <div className={styles['progressbar-fill']}></div>
      </div>
    </div>
  );
});

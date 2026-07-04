/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/progress-bar.contract.json (ds.progress-bar v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './ProgressBar.module.css';

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Semantic color of the fill. */
  variant?: 'accent' | 'success' | 'warning' | 'error' | 'neutral';
  /** Current progress value. */
  value?: number;
  /** Maximum value. */
  max?: number;
  /** Accessible name — screen readers must know what is progressing. */
  label: string;
}

/** Horizontal bar showing completion progress. API mirrors industry convention (Astryx ProgressBar): number-valued value/max drive the fill; the canvas renders the defaults' fraction as its honest static state. Indeterminate mode needs animation on the canvas — a documented boundary. */
export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(function ProgressBar(
  { variant = 'accent', value = 60, max = 100, label, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: `${Math.min(100, Math.max(0, (value / max) * 100))}%` }}
        />
      </div>
    </div>
  );
});

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/status-dot.contract.json (ds.status-dot v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './StatusDot.module.css';

export interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
  /** Semantic color variant. */
  variant?: 'success' | 'warning' | 'error' | 'accent' | 'neutral';
  /** Accessible label announced by screen readers — status must never be conveyed by color alone. */
  label: string;
}

/** Small colored dot communicating status — presence, severity, activity. API mirrors industry convention (Astryx StatusDot): five semantic variants with a required accessible label. */
export const StatusDot = forwardRef<HTMLSpanElement, StatusDotProps>(function StatusDot(
  { variant = 'neutral', label, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} role="img" {...rest}>
      {children}
    </span>
  );
});

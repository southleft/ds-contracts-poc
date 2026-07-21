/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/badge.contract.json (astryx.badge v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Badge.module.css';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** The visual style variant of the badge. */
  variant?:
    | 'neutral'
    | 'info'
    | 'success'
    | 'warning'
    | 'error'
    | 'blue'
    | 'cyan'
    | 'green'
    | 'orange'
    | 'pink'
    | 'purple'
    | 'red'
    | 'teal'
    | 'yellow';
}

/** Astryx Badge — a small status/category label. Promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/Badge/Badge.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). API surface (variant) is verbatim; the label is materialized as a text content part (Astryx types it as a ReactNode child slot, dropped as a `node` prop in extraction — see DEV-JOURNEY.md). CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2). */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = 'neutral', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} {...rest}>
      <span className={styles.label}>{children}</span>
    </span>
  );
});

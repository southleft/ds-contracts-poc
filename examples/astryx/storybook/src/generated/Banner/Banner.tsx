/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/banner.contract.json (astryx.banner v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Banner.module.css';

export interface BannerProps extends HTMLAttributes<HTMLDivElement> {
  /** The banner tone. */
  status?: 'info' | 'warning' | 'error' | 'success';
  /** How the banner is contained. */
  container?: 'card' | 'section';
  /** Whether the banner can be dismissed. */
  isDismissable?: boolean;
}

/** Astryx Banner — promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/Banner/Banner.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). status + container axes and the dismissable/expanded flags are verbatim; the banner message is a materialized text slot (Astryx types it as ReactNode children). CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2). */
export const Banner = forwardRef<HTMLDivElement, BannerProps>(function Banner(
  { status = 'info', container = 'card', isDismissable = false, className, children, ...rest },
  ref,
) {
  const classes = [
    styles.root,
    styles[`status-${status}`],
    styles[`container-${container}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} data-is-dismissable={isDismissable || undefined} {...rest}>
      <div className={styles.message}>{children}</div>
    </div>
  );
});

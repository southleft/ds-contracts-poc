/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/banner.contract.json (astryx.banner v0.3.0)
 * Regenerate with: npm run generate
 *
 * DOM attrs OMITTED from HTMLAttributes<HTMLDivElement> — the contract's own props claim these
 * names, so the HTML attribute of the same name cannot be passed through ...rest:
 *   title
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Banner.module.css';

const ICONS: Record<string, string> = {
  'banner-icon-info':
    '<svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M 12 16 V 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M 12 8 H 12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'banner-icon-warning':
    '<svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg"><path d="M 21.73 18 L 13.73 4 A 2 2 0 0 0 10.25 4 L 2.25 18 A 2 2 0 0 0 4 21 H 20 A 2 2 0 0 0 21.73 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M 12 9 V 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M 12 17 H 12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'banner-icon-error':
    '<svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M 15 9 L 9 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M 9 9 L 15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'banner-icon-success':
    '<svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg"><path d="M 21.801 10 A 10 10 0 1 1 17 3.335" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M 9 11 L 12 14 L 22 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export interface BannerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Status type controlling the icon and color scheme. */
  status?: 'info' | 'warning' | 'error' | 'success';
  /** How the banner is contained. */
  container?: 'card' | 'section';
  /** Whether the banner can be dismissed. */
  isDismissable?: boolean;
  /** Title text displayed prominently in the header area. */
  title?: string;
  /** Optional supporting text below the title in the header area. */
  description?: string;
}

/** Astryx Banner — a status surface with title, description and optional dismiss. Promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/Banner/Banner.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). status/container/isDismissable are verbatim; title and description are materialized text slots (Astryx types both as ReactNode). CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2). COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @astryxdesign/core@0.1.6 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/astryx/scripts/promote-floor.ts): enriched.contract.json — computed-capture truth with the decisions ledger applied (extract/computed/out/astryx/banner/decisions.md); extension sidecar carries the named overflow. */
export const Banner = forwardRef<HTMLDivElement, BannerProps>(function Banner(
  {
    status = 'info',
    container = 'card',
    isDismissable = false,
    title = 'A new software update is available.',
    description = 'See what changed in this version.',
    className,
    children,
    ...rest
  },
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
      <div className={styles.banner}>
        <div className={styles['banner-icon']}>
          <span className={styles.icon}>
            {status === 'info' ? (
              <span
                className={styles['icon-info']}
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: ICONS['banner-icon-info'] }}
              />
            ) : null}
            {status === 'warning' ? (
              <span
                className={styles['icon-warning']}
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: ICONS['banner-icon-warning'] }}
              />
            ) : null}
            {status === 'error' ? (
              <span
                className={styles['icon-error']}
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: ICONS['banner-icon-error'] }}
              />
            ) : null}
            {status === 'success' ? (
              <span
                className={styles['icon-success']}
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: ICONS['banner-icon-success'] }}
              />
            ) : null}
          </span>
        </div>
        <div className={styles['part-0-1']}>
          <span className={styles.label}>{title}</span>
          <span className={styles['label-2']}>{description}</span>
        </div>
      </div>
    </div>
  );
});

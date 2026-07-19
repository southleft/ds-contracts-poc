/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/banner.contract.json (polaris.banner v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Banner.module.css';

const ROLE_MAP: Record<string, string> = {"success":"status","info":"status","warning":"alert","critical":"alert"};

export interface BannerProps extends HTMLAttributes<HTMLDivElement> {
  /** Title content for the banner. */
  title?: string;
  /** Renders the banner without a status icon. */
  hideIcon?: boolean;
  /** Sets the status of the banner. */
  tone?: 'success' | 'info' | 'warning' | 'critical';
  /** Disables screen reader announcements when changing the content of the banner */
  stopAnnouncements?: boolean;
}

/** PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Banner/Banner.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. */
export const Banner = forwardRef<HTMLDivElement, BannerProps>(function Banner(
  { tone = 'info', hideIcon = false, stopAnnouncements = false, title, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`tone-${tone}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} data-hide-icon={hideIcon || undefined} data-stop-announcements={stopAnnouncements || undefined} role={ROLE_MAP[tone]} {...rest}>
      <h2 className={styles.title}>{title}</h2>
<span className={styles.body}>Your order has shipped.</span>
    </div>
  );
});

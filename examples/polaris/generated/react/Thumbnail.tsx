/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/thumbnail.contract.json (polaris.thumbnail v0.4.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Thumbnail.module.css';

export interface ThumbnailProps extends HTMLAttributes<HTMLSpanElement> {
  /** Size of thumbnail */
  size?: 'extraSmall' | 'small' | 'medium' | 'large';
  /** Alt text for the thumbnail image */
  alt: string;
  /** Transparent background */
  transparent?: boolean;
}

/** PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Thumbnail/Thumbnail.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/polaris/scripts/promote-floor.ts): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Polaris's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Thumbnail = forwardRef<HTMLSpanElement, ThumbnailProps>(function Thumbnail(
  { size = 'medium', transparent = false, alt, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} data-transparent={transparent || undefined} {...rest}>
      <img className={styles["part-0"]} alt={String(alt)}>

</img>
    </span>
  );
});

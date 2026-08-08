/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/card.contract.json (shadcn.card v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'default' | 'sm';
}

/** SEED contract for the SHADCN round — props/axes only; anatomy is promoted from captured DOM truth. Subject: shadcn registry defaults vendored via CLI 4.16.2 (radix-vega, sha256 ledger in examples/shadcn/RECON.md §2.2), mounted through the @shadcn-sandbox/ui barrel (RECON §2.1).  COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shadcn-sandbox/ui@0.0.1 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/shadcn/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to shadcn's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { size = 'default', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles['part-0']}>
        <span className={styles.label}>Card title</span>
        <span className={styles['label-2']}>Card description</span>
      </div>
      <span className={styles['label-3']}>Card content copy for the shadcn round.</span>
    </div>
  );
});

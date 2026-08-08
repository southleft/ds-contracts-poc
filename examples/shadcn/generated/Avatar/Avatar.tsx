/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/avatar.contract.json (shadcn.avatar v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Avatar.module.css';

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'default' | 'sm' | 'lg';
}

/** SEED contract for the SHADCN round — props/axes only; anatomy is promoted from captured DOM truth. Subject: shadcn registry defaults vendored via CLI 4.16.2 (radix-vega, sha256 ledger in examples/shadcn/RECON.md §2.2), mounted through the @shadcn-sandbox/ui barrel (RECON §2.1). Fallback-only capture by name (AvatarImage refused in a network-free harness — RECON §4.2). COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shadcn-sandbox/ui@0.0.1 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/shadcn/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to shadcn's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { size = 'default', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} {...rest}>
      <span className={styles.label}>CN</span>
    </span>
  );
});

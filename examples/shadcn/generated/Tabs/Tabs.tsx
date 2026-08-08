/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tabs.contract.json (shadcn.tabs v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Tabs.module.css';

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {}

/** SEED contract for the SHADCN round — HAND-AUTHORED at capture-config time from the Radix prop surface (the react-tsx adapter refuses purely Radix-typed components by name — RECON §3's structural law). Subject: shadcn registry defaults vendored via CLI 4.16.2 (radix-vega, sha256 ledger in examples/shadcn/RECON.md §2.2), mounted through the @shadcn-sandbox/ui barrel (RECON §2.1). Root mount with the canonical 2-deep childrenSpec, CONTROLLED value (Carbon Tabs double-run lesson). The variant axis lives on the CHILD TabsList — child-axis limitation (docs/21 §7.3), pinned default, deferred by name ('TabsList-with-children as the mount' is not mountable: witnessed Radix context throw). COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shadcn-sandbox/ui@0.0.1 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/shadcn/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to shadcn's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Tabs = forwardRef<HTMLDivElement, TabsProps>(function Tabs(
  { className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles['part-0']}>
        <button className={styles.label}>Overview</button>
        <button className={styles['label-2']}>Activity</button>
        <button className={styles['label-3']}>Settings</button>
      </div>
      <span className={styles['label-4']}>Overview panel copy for the shadcn round.</span>
    </div>
  );
});

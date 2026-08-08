/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/switch.contract.json (shadcn.switch v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from './Switch.module.css';

export interface SwitchProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'default';
  checked?: 'unchecked' | 'checked';
}

/** SEED contract for the SHADCN round — props/axes only; anatomy is promoted from captured DOM truth. Subject: shadcn registry defaults vendored via CLI 4.16.2 (radix-vega, sha256 ledger in examples/shadcn/RECON.md §2.2), mounted through the @shadcn-sandbox/ui barrel (RECON §2.1). checked is a VARIANT AXIS (prop-selected Radix data-state rendering — RECON H4); the real-DOM thumb's translate question is H6. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shadcn-sandbox/ui@0.0.1 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/shadcn/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to shadcn's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { size = 'default', checked = 'unchecked', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], styles[`checked-${checked}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} className={classes} {...rest}>
      <span className={styles['part-0']}></span>
    </button>
  );
});

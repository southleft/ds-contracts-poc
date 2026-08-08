/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (shadcn.button v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
  size?: 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';
  asChild?: boolean;
}

/** SEED contract for the SHADCN round — props/axes only; anatomy is promoted from captured DOM truth. Subject: shadcn registry defaults vendored via CLI 4.16.2 (radix-vega, sha256 ledger in examples/shadcn/RECON.md §2.2), mounted through the @shadcn-sandbox/ui barrel (RECON §2.1).  COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shadcn-sandbox/ui@0.0.1 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/shadcn/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to shadcn's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'default', asChild = false, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], styles[`size-${size}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} className={classes} data-as-child={asChild || undefined} {...rest}>
      {children}
    </button>
  );
});

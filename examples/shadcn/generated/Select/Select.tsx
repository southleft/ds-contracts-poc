/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/select.contract.json (shadcn.select v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Select.module.css';

const ICONS: Record<string, string> = {
  'select-icon':
    '<svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path d="M 6 9 L 12 15 L 18 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export interface SelectProps extends HTMLAttributes<HTMLDivElement> {}

/** SEED contract for the SHADCN round — HAND-AUTHORED at capture-config time from the Radix prop surface (the react-tsx adapter refuses purely Radix-typed components by name — RECON §3's structural law). Subject: shadcn registry defaults vendored via CLI 4.16.2 (radix-vega, sha256 ledger in examples/shadcn/RECON.md §2.2), mounted through the @shadcn-sandbox/ui barrel (RECON §2.1). Composed ROOT mount, portalCapture + openDriver {open:true} (RECON H3). The size axis lives on the CHILD SelectTrigger — child-axis limitation (docs/21 §7.3), pinned default, deferred by name. SelectTrigger as its own closed component is STOPPED: witnessed Radix context throw (RECON-round capture note). states:[] pinned — portal captures take no state planes. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shadcn-sandbox/ui@0.0.1 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/shadcn/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to shadcn's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Select = forwardRef<HTMLDivElement, SelectProps>(function Select(
  { className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <span className={styles.label}>Select an option</span>
      <span
        className={styles.icon}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: ICONS['select-icon'] }}
      />
    </div>
  );
});

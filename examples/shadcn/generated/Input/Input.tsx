/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/input.contract.json (shadcn.input v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

/** SEED contract for the SHADCN round — HAND-AUTHORED at capture-config time from the Radix prop surface (the react-tsx adapter refuses purely Radix-typed components by name — RECON §3's structural law). Subject: shadcn registry defaults vendored via CLI 4.16.2 (radix-vega, sha256 ledger in examples/shadcn/RECON.md §2.2), mounted through the @shadcn-sandbox/ui barrel (RECON §2.1). v1: default text input; `type` deferred by name (attribute pass-through, not an enum prop in source — RECON §4.2). COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shadcn-sandbox/ui@0.0.1 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/shadcn/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to shadcn's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <input ref={ref} className={classes} {...rest}>
      {children}
    </input>
  );
});

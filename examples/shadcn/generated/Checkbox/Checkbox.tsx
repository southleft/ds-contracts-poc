/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/checkbox.contract.json (shadcn.checkbox v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from './Checkbox.module.css';

const ICONS: Record<string, string> = {
  'checkbox-part-0':
    '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M 20 6 L 9 17 L 4 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export interface CheckboxProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: 'unchecked' | 'checked' | 'indeterminate';
}

/** SEED contract for the SHADCN round — HAND-AUTHORED at capture-config time from the Radix prop surface (the react-tsx adapter refuses purely Radix-typed components by name — RECON §3's structural law). Subject: shadcn registry defaults vendored via CLI 4.16.2 (radix-vega, sha256 ledger in examples/shadcn/RECON.md §2.2), mounted through the @shadcn-sandbox/ui barrel (RECON §2.1). TRI-STATE ON ONE AXIS (MUI/Carbon precedent): Radix accepts checked='indeterminate' directly, so the axis maps to plain values — keeps the lucide CheckIcon/MinusIcon svg-content promotion single-axis. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shadcn-sandbox/ui@0.0.1 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/shadcn/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to shadcn's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
  { checked = 'unchecked', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`checked-${checked}`], className].filter(Boolean).join(' ');
  return (
    <button ref={ref} className={classes} {...rest}>
      <span className={styles['part-0']}>
        <span
          aria-hidden="true"
          className={styles['part-0Glyph']}
          dangerouslySetInnerHTML={{ __html: ICONS['checkbox-part-0'] }}
        />
      </span>
    </button>
  );
});

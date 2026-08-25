/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/input.contract.json (antd.input v0.2.0)
 * Regenerate with: npm run generate
 *
 * DOM attrs OMITTED from InputHTMLAttributes<HTMLInputElement> — the contract's own props claim these
 * names, so the HTML attribute of the same name cannot be passed through ...rest:
 *   placeholder, size
 */
import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import styles from './Input.module.css';

export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'placeholder' | 'size'
> {
  size?: 'small' | 'middle' | 'large';
  status?: 'error' | 'warning';
  variant?: 'outlined' | 'borderless' | 'filled' | 'underlined';
  disabled?: boolean;
  placeholder?: string;
}

/** Subject: antd@5.29.3 (pinned, examples/antd/PROVENANCE.md). CURATED seed for the antd P2 exam (code→canvas, held out) — props/axes only; anatomy is promoted from captured DOM truth. Every axis value is the library's own declared enum (antd spells them as `readonly [...]` tuples; seed-gen reads them once its declaration lookup ignores directory case — W1, examples/antd/RECON.md §4). ATOM WITH A ROOT-SWAP TRAP. Bare Input is ONE element (input.ant-input); prefix/suffix/addon/allowClear each REPLACE the root with span.ant-input-affix-wrapper > [prefix + input] (measured, RECON §2.6) — a presence prop that swaps the ROOT signature cannot factor (the Altitude href precedent), so they are NAMED OUT; an `InputAffix` subject with prefix pinned on is the honest spelling if wanted. `variant` is antd's FOUR-value tuple (underlined since 5.24, seed-gen read it); `bordered` is @deprecated (Input.d.ts:45) and not an axis. `status` is DEFAULTLESS (unset = no status). Focus is a box-shadow ring (carried channel), not an outline. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of antd@5.29.3 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/antd/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Ant Design's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = 'middle',
    status = 'undefined',
    variant = 'outlined',
    disabled = false,
    placeholder = 'Input',
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [
    styles.root,
    styles[`size-${size}`],
    styles[`status-${status}`],
    styles[`variant-${variant}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <input ref={ref} className={classes} disabled={disabled} {...rest}>
      {children}
    </input>
  );
});

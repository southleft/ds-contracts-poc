/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button-set-button-button-1-proof.contract.json (ds.button-set-button-button-1-proof v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { ButtonHelperLoadingSpinner1 } from '../ButtonHelperLoadingSpinner1';
import { ButtonHelperLeadingIcon1 } from '../ButtonHelperLeadingIcon1';
import styles from './ButtonSetButtonButton1Proof.module.css';

export interface ButtonSetButtonButton1ProofProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'secondary' | 'primary';
  size?: 'medium' | 'small' | 'large';
  state?: 'default' | 'hover' | 'pressed' | 'focusVisible' | 'disabled' | 'loading';
  icons?: 'none' | 'leading' | 'trailing' | 'both';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const ButtonSetButtonButton1Proof = forwardRef<
  HTMLButtonElement,
  ButtonSetButtonButton1ProofProps
>(function ButtonSetButtonButton1Proof(
  {
    variant = 'secondary',
    size = 'medium',
    state = 'default',
    icons = 'none',
    className,
    children,
    ...rest
  },
  ref,
) {
  // axis-inert (ledgered, not a throw): size, icons — no `.<axis>-*` rule
  // exists in ButtonSetButtonButton1Proof.module.css, so no class is composed for them. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever these axes carry rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, styles[`variant-${variant}`], styles[`state-${state}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} className={classes} {...rest}>
      {state === 'loading' ? <ButtonHelperLoadingSpinner1 /> : null}
      <span className={styles.buttonlabelLabel}>Button</span>
      {icons === 'trailing' || icons === 'both' ? <ButtonHelperLeadingIcon1 /> : null}
    </button>
  );
});

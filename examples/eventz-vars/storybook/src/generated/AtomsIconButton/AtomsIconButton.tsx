/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/atoms-icon-button.contract.json (ds.atoms-icon-button v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from './AtomsIconButton.module.css';

export interface AtomsIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'knockout' | 'secondary' | 'bare' | 'bareKnockout';
  isDisabled?: boolean;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const AtomsIconButton = forwardRef<HTMLButtonElement, AtomsIconButtonProps>(
  function AtomsIconButton(
    { variant = 'primary', isDisabled = false, className, children, ...rest },
    ref,
  ) {
    const classes = [styles.root, styles[`variant-${variant}`], className]
      .filter(Boolean)
      .join(' ');
    return (
      <button ref={ref} className={classes} data-is-disabled={isDisabled || undefined} {...rest}>
        <div className={styles.Icon}>{children}</div>
      </button>
    );
  },
);

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (ds.button v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'knockout' | 'secondary' | 'bare';
  isDisabled?: boolean;
  text?: string;
  hasStartIcon?: boolean;
  hasEndIcon?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', isDisabled = false, hasStartIcon = true, hasEndIcon = true, text = 'Label', startIcon, endIcon, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], className].filter(Boolean).join(' ');
  return (
    <button ref={ref} className={classes} data-is-disabled={isDisabled || undefined} data-has-start-icon={hasStartIcon || undefined} data-has-end-icon={hasEndIcon || undefined} {...rest}>
      {hasStartIcon ? (<div className={styles.startIcon}>{startIcon}</div>) : null}
<span className={styles.Label}>{text}</span>
{hasEndIcon ? (<div className={styles.endIcon}>{endIcon}</div>) : null}
    </button>
  );
});

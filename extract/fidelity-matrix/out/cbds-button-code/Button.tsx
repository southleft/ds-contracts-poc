/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (ds.button v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'surface' | 'danger' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

/** PROPOSED contract extracted from southleft/cbds-components/src/components/Button/Button.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'medium', fullWidth = false, iconLeft, iconRight, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <button ref={ref} className={classes} data-full-width={fullWidth || undefined} {...rest}>
      {iconLeft != null ? <span className={styles.iconLeft}>{iconLeft}</span> : null}
<div className={styles.children}>{children}</div>
{iconRight != null ? <span className={styles.iconRight}>{iconRight}</span> : null}
    </button>
  );
});

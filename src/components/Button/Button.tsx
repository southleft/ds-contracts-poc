/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (ds.button v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual prominence of the action. */
  variant?: 'primary' | 'secondary' | 'danger';
  /** Control density. */
  size?: 'sm' | 'md' | 'lg';
  /** Prevents interaction and communicates unavailability. */
  disabled?: boolean;
}

/** Triggers an action or event. Use one primary button per context. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', disabled = false, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], styles[`size-${size}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} className={classes} disabled={disabled} {...rest}>
      {children}
    </button>
  );
});

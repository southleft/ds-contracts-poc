/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/divider.contract.json (ds.divider v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Divider.module.css';

export interface DividerProps extends HTMLAttributes<HTMLHRElement> {
  /** Visual weight of the line. */
  variant?: 'subtle' | 'strong';
}

/** Visual separator dividing content into distinct sections. API mirrors industry convention (Astryx Divider) at the variant level; orientation requires per-enum-value property overrides — a documented schema gap. */
export const Divider = forwardRef<HTMLHRElement, DividerProps>(function Divider(
  { variant = 'subtle', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], className].filter(Boolean).join(' ');
  return (
    <hr ref={ref} className={classes} role="separator" {...rest}>
      {children}
    </hr>
  );
});

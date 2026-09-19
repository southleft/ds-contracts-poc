/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/icon.contract.json (ds.icon v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Icon.module.css';

export interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'small' | 'xsmall';
}

/** STUB contract auto-proposed for the nested "Icon" instances of Badge — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const Icon = forwardRef<HTMLSpanElement, IconProps>(function Icon(
  { size = 'small', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return <span ref={ref} className={classes} {...rest}></span>;
});

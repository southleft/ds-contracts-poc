/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/size-small.contract.json (ds.size-small v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './SizeSmall.module.css';

export interface SizeSmallProps extends HTMLAttributes<HTMLSpanElement> {
  iconSwap?: string;
  size?: 'small' | 'xsmall';
}

/** STUB contract auto-proposed for the nested "size=small" instances of Badge — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const SizeSmall = forwardRef<HTMLSpanElement, SizeSmallProps>(function SizeSmall(
  { size = 'small', iconSwap = '187:877', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} {...rest}>
      <span className={styles.iconSwap}>{iconSwap}</span>
    </span>
  );
});

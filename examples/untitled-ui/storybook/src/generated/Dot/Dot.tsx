/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/dot.contract.json (ds.dot v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Dot.module.css';

export interface DotProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'sm';
}

/** STUB contract auto-proposed for the nested "_Dot" instances of _Badge base — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const Dot = forwardRef<HTMLSpanElement, DotProps>(function Dot(
  { size = 'sm', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return <span ref={ref} className={classes} {...rest}></span>;
});

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/x.contract.json (ds.x v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './X.module.css';

export interface XProps extends HTMLAttributes<HTMLSpanElement> {}

/** STUB contract auto-proposed for the nested "x" instances of _Badge base — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const X = forwardRef<HTMLSpanElement, XProps>(function X(
  { className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return <span ref={ref} className={classes} {...rest}></span>;
});

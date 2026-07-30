/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/arrow-up.contract.json (ds.arrow-up v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './ArrowUp.module.css';

export interface ArrowUpProps extends HTMLAttributes<HTMLSpanElement> {}

/** STUB contract auto-proposed for the nested "arrow-up" instances of _Badge base — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const ArrowUp = forwardRef<HTMLSpanElement, ArrowUpProps>(function ArrowUp(
  { className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return <span ref={ref} className={classes} {...rest}></span>;
});

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/code.contract.json (ds.code v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Code.module.css';

export interface CodeProps extends HTMLAttributes<HTMLElement> {}

/** Inline code element with monospace font and muted background. API mirrors industry convention (Astryx Code); block code is a separate component family. */
export const Code = forwardRef<HTMLElement, CodeProps>(function Code(
  { className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <code ref={ref} className={classes} {...rest}>
      {children}
    </code>
  );
});

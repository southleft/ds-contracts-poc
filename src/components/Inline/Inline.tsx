/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/inline.contract.json (ds.inline v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Inline.module.css';

export interface InlineProps extends HTMLAttributes<HTMLDivElement> {
  /** Space between children. */
  gap?: 'sm' | 'md' | 'lg';
}

/** Horizontal layout primitive — lays children out in a row with a token-governed gap, vertically centered. */
export const Inline = forwardRef<HTMLDivElement, InlineProps>(function Inline(
  { gap = 'md', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`gap-${gap}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      {children}
    </div>
  );
});

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/stack.contract.json (ds.stack v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Stack.module.css';

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  /** Space between children. */
  gap?: 'sm' | 'md' | 'lg';
}

/** Vertical layout primitive — stacks children with a token-governed gap. Screens compose from Stack/Inline instead of raw styled divs. */
export const Stack = forwardRef<HTMLDivElement, StackProps>(function Stack(
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

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/list.contract.json (ds.list v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './List.module.css';

export interface ListProps extends HTMLAttributes<HTMLUListElement> {
  /** Item spacing density. */
  density?: 'compact' | 'balanced' | 'spacious';
}

/** Vertical collection of items with consistent density. API mirrors industry convention (Astryx List); dividers need sibling-selector styling and marker styles need list-style tokens — documented gaps. */
export const List = forwardRef<HTMLUListElement, ListProps>(function List(
  { density = 'balanced', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`density-${density}`], className].filter(Boolean).join(' ');
  return (
    <ul ref={ref} className={classes} {...rest}>
      <div className={styles.items}>{children}</div>
    </ul>
  );
});

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/two-column.contract.json (ds.two-column v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './TwoColumn.module.css';

export interface TwoColumnProps extends HTMLAttributes<HTMLDivElement> {
  /** Leading column slot. */
  start?: ReactNode;
  /** Trailing column slot. */
  end?: ReactNode;
}

/** Two equal fr columns, each a slot. The simplest declared-track grid: G1 tracks, G2 explicit placement, one row that hugs its content. */
export const TwoColumn = forwardRef<HTMLDivElement, TwoColumnProps>(function TwoColumn(
  { start, end, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles.start}>{start}</div>
      <div className={styles.end}>{end}</div>
    </div>
  );
});

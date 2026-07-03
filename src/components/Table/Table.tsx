/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/table.contract.json (ds.table v1.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { TableHeaderCell } from '../TableHeaderCell';
import styles from './Table.module.css';

export interface TableProps extends HTMLAttributes<HTMLDivElement> {
  /** Vertical rhythm of the whole table; mapped into the fixed header cells. */
  density?: 'comfortable' | 'compact';
}

/** Structured data in rows and columns. Composes header cells (with the Table's density mapped into them), and a body slot of rows. */
export const Table = forwardRef<HTMLDivElement, TableProps>(function Table(
  { density = 'comfortable', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`density-${density}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} role="table" {...rest}>
      <div className={styles.header}>
        <TableHeaderCell density={density}>Name</TableHeaderCell>
        <TableHeaderCell density={density}>Role</TableHeaderCell>
        <TableHeaderCell density={density}>Status</TableHeaderCell>
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
});

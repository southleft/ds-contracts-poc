/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/table-row.contract.json (ds.table-row v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './TableRow.module.css';

export interface TableRowProps extends HTMLAttributes<HTMLDivElement> {
  /** Data state of the row. */
  state?: 'default' | 'selected';
}

/** A selectable row of table cells. */
export const TableRow = forwardRef<HTMLDivElement, TableRowProps>(function TableRow(
  { state = 'default', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`state-${state}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} role="row" {...rest}>
      <div className={styles.cells}>{children}</div>
    </div>
  );
});

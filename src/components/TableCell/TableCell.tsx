/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/table-cell.contract.json (ds.table-cell v1.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './TableCell.module.css';

export interface TableCellProps extends HTMLAttributes<HTMLDivElement> {
  /** Vertical rhythm, normally driven by the owning Table. */
  density?: 'comfortable' | 'compact';
}

/** A single data cell in a table row. */
export const TableCell = forwardRef<HTMLDivElement, TableCellProps>(function TableCell(
  { density = 'comfortable', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`density-${density}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} role="cell" {...rest}>
      {children}
    </div>
  );
});

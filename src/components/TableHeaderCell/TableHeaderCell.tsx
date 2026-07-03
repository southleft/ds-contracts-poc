/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/table-header-cell.contract.json (ds.table-header-cell v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './TableHeaderCell.module.css';

export interface TableHeaderCellProps extends HTMLAttributes<HTMLDivElement> {
  /** Vertical rhythm, normally driven by the owning Table. */
  density?: 'comfortable' | 'compact';
}

/** A column header cell. */
export const TableHeaderCell = forwardRef<HTMLDivElement, TableHeaderCellProps>(
  function TableHeaderCell({ density = 'comfortable', className, children, ...rest }, ref) {
    const classes = [styles.root, styles[`density-${density}`], className]
      .filter(Boolean)
      .join(' ');
    return (
      <div ref={ref} className={classes} role="columnheader" {...rest}>
        {children}
      </div>
    );
  },
);

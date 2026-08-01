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
  // axis-inert (ledgered, not a throw): density — no `.<axis>-*` rule
  // exists in Table.module.css, so no class is composed for it. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever this axis carries rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, className].filter(Boolean).join(' ');
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

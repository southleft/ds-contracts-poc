/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/grid-gallery.contract.json (ds.grid-gallery v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './GridGallery.module.css';

export interface GridGalleryProps extends HTMLAttributes<HTMLDivElement> {
  /** Gallery cell 1 — placed by order, not by anchor. */
  item1?: ReactNode;
  /** Gallery cell 2 — placed by order, not by anchor. */
  item2?: ReactNode;
  /** Gallery cell 3 — placed by order, not by anchor. */
  item3?: ReactNode;
  /** Gallery cell 4 — wraps to the second derived row. */
  item4?: ReactNode;
  /** Gallery cell 5 — wraps to the second derived row. */
  item5?: ReactNode;
  /** Gallery cell 6 — wraps to the second derived row. */
  item6?: ReactNode;
}

/** Three equal fr columns filled by row auto-flow (G5) — the placement fact is CHILD ORDER, not an anchor. Six repeated slots flow into two derived rows. */
export const GridGallery = forwardRef<HTMLDivElement, GridGalleryProps>(function GridGallery(
  { item1, item2, item3, item4, item5, item6, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles.item1}>{item1}</div>
      <div className={styles.item2}>{item2}</div>
      <div className={styles.item3}>{item3}</div>
      <div className={styles.item4}>{item4}</div>
      <div className={styles.item5}>{item5}</div>
      <div className={styles.item6}>{item6}</div>
    </div>
  );
});

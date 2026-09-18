/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/bento-grid.contract.json (ds.bento-grid v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './BentoGrid.module.css';

export interface BentoGridProps extends HTMLAttributes<HTMLDivElement> {
  /** Full-bleed banner region — one row, all four columns. */
  header?: ReactNode;
  /** Stationary 160px rail on the left, spanning both content rows. */
  sidebar?: ReactNode;
  /** Primary region — the 1fr row across the two fr columns. */
  main?: ReactNode;
  /** Stationary 120px rail on the right, spanning both content rows. */
  rail?: ReactNode;
  /** Deep region on the 2fr row, under main. */
  footer?: ReactNode;
}

/** The span matrix (G2) addressed through named areas (G4): a 3x4 bento whose five regions span rows and columns and whose area names ARE the slot anchors. Mixed px/fr tracks on both axes and independent row/column gaps. */
export const BentoGrid = forwardRef<HTMLDivElement, BentoGridProps>(function BentoGrid(
  { header, sidebar, main, rail, footer, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <header className={styles.header}>{header}</header>
      <aside className={styles.sidebar}>{sidebar}</aside>
      <main className={styles.main}>{main}</main>
      <div className={styles.rail}>{rail}</div>
      <footer className={styles.footer}>{footer}</footer>
    </div>
  );
});

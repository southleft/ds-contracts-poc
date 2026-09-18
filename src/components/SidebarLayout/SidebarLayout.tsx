/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/sidebar-layout.contract.json (ds.sidebar-layout v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './SidebarLayout.module.css';

export interface SidebarLayoutProps extends HTMLAttributes<HTMLDivElement> {
  /** Stationary 240px column — a FIXED track, never redistributed. */
  sidebar?: ReactNode;
  /** Fluid main column — the single fr track absorbs all remaining width. */
  main?: ReactNode;
}

/** A stationary px sidebar column beside an fr main column — mixed track kinds in one declared list (G1). The sidebar never reflows; main absorbs the remainder. */
export const SidebarLayout = forwardRef<HTMLDivElement, SidebarLayoutProps>(function SidebarLayout(
  { sidebar, main, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <aside className={styles.sidebar}>{sidebar}</aside>
      <main className={styles.main}>{main}</main>
    </div>
  );
});

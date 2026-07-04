/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tab-list.contract.json (ds.tab-list v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './TabList.module.css';

export interface TabListProps extends HTMLAttributes<HTMLDivElement> {}

/** Tab-style navigation container holding Tab items. API mirrors industry convention (Astryx TabList); roving-tabindex keyboard behavior and controlled selection are declared boundaries. */
export const TabList = forwardRef<HTMLDivElement, TabListProps>(function TabList(
  { className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} role="tablist" {...rest}>
      <div className={styles.tabs}>{children}</div>
    </div>
  );
});

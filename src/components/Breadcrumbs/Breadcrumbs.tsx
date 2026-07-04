/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/breadcrumbs.contract.json (ds.breadcrumbs v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Breadcrumbs.module.css';

export interface BreadcrumbsProps extends HTMLAttributes<HTMLElement> {
  /** Accessible label for the navigation landmark. */
  label: string;
}

/** Navigation trail from root to the current page. API mirrors industry convention (Astryx Breadcrumbs): a nav landmark holding BreadcrumbItems; keep trails to five levels or fewer. */
export const Breadcrumbs = forwardRef<HTMLElement, BreadcrumbsProps>(function Breadcrumbs(
  { label, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <nav ref={ref} className={classes} {...rest}>
      <div className={styles.trail}>{children}</div>
    </nav>
  );
});

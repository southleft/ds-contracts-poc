/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/top-nav.contract.json (ds.top-nav v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './TopNav.module.css';

export interface TopNavProps extends HTMLAttributes<HTMLElement> {
  /** Accessible label for the navigation landmark. */
  label: string;
  /** Logo or brand at the start edge. */
  heading?: ReactNode;
  /** Primary navigation items after the heading. */
  startContent?: ReactNode;
  /** Search, icons, user profile at the end edge. */
  endContent?: ReactNode;
}

/** Horizontal main navigation bar with heading, start, center, and end areas. API mirrors industry convention (Astryx TopNav); hover menus and mega-menus are behavior-layer boundaries. */
export const TopNav = forwardRef<HTMLElement, TopNavProps>(function TopNav(
  { label, heading, startContent, endContent, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <nav ref={ref} className={classes} {...rest}>
      {heading != null ? <div className={styles.heading}>{heading}</div> : null}
      {startContent != null ? <div className={styles.startContent}>{startContent}</div> : null}
      {endContent != null ? <div className={styles.endContent}>{endContent}</div> : null}
    </nav>
  );
});

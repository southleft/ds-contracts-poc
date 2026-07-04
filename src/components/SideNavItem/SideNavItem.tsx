/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/side-nav-item.contract.json (ds.side-nav-item v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import styles from './SideNavItem.module.css';

export interface SideNavItemProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Whether this item is the current page. */
  state?: 'default' | 'selected';
  /** Item text. */
  label: string;
  /** Navigation target URL. */
  href?: string;
  icon?: ReactNode;
  /** Trailing badge or count. */
  endContent?: ReactNode;
}

/** A sidebar navigation row: icon, label, and trailing content, with a selected state. API mirrors industry convention (Astryx SideNavItem); nesting and collapse are behavior-layer boundaries. */
export const SideNavItem = forwardRef<HTMLAnchorElement, SideNavItemProps>(function SideNavItem(
  { state = 'default', label, href = '#', icon, endContent, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`state-${state}`], className].filter(Boolean).join(' ');
  return (
    <a ref={ref} className={classes} {...rest}>
      {icon != null ? <div className={styles.iconSlot}>{icon}</div> : null}
      <span className={styles.labelText}>{label}</span>
      {endContent != null ? <div className={styles.endContent}>{endContent}</div> : null}
    </a>
  );
});

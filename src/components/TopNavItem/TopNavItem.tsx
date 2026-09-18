/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/top-nav-item.contract.json (ds.top-nav-item v1.0.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from AnchorHTMLAttributes<HTMLAnchorElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import styles from './TopNavItem.module.css';

export interface TopNavItemProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> {
  /** Whether this item is the current page. */
  state?: 'default' | 'selected';
  /** Visible item text. */
  label: string;
  /** Navigation target URL. */
  href?: string;
  icon?: ReactNode;
}

/** A navigation item in a TopNav or SideNav context. API mirrors industry convention (Astryx TopNavItem) with selection flattened to a state enum; the selected state applies aria-current. */
export const TopNavItem = forwardRef<HTMLAnchorElement, TopNavItemProps>(function TopNavItem(
  { state = 'default', label, href = '#', icon, className, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`state-${state}`], className].filter(Boolean).join(' ');
  return (
    <a ref={ref} className={classes} href={href} {...rest}>
      {icon != null ? <div className={styles.iconSlot}>{icon}</div> : null}
      <span className={styles.labelText}>{label}</span>
    </a>
  );
});

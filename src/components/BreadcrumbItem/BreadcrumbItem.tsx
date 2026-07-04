/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/breadcrumb-item.contract.json (ds.breadcrumb-item v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './BreadcrumbItem.module.css';

const ICONS: Record<string, string> = {
  'chevron-right':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="7.8,5.5 12.3,10 7.8,14.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export interface BreadcrumbItemProps extends HTMLAttributes<HTMLSpanElement> {
  /** Leading separator — off for the first item in a trail. */
  hasSeparator?: boolean;
  /** The crumb text. */
  label: string;
  /** Navigation target. Current-page items conventionally point at themselves. */
  href?: string;
}

/** One link in a breadcrumb trail with its leading separator. API mirrors industry convention (Astryx BreadcrumbItem); the first item is authored with hasSeparator off (positional part logic is a documented gap), and aria-current needs conditional attributes — also documented. */
export const BreadcrumbItem = forwardRef<HTMLSpanElement, BreadcrumbItemProps>(
  function BreadcrumbItem(
    { hasSeparator = true, label, href = '#', className, children, ...rest },
    ref,
  ) {
    const classes = [styles.root, className].filter(Boolean).join(' ');
    return (
      <span ref={ref} className={classes} data-has-separator={hasSeparator || undefined} {...rest}>
        {hasSeparator ? (
          <span
            className={styles.separatorIcon}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: ICONS['chevron-right'] }}
          />
        ) : null}
        <a className={styles.link} href={href}>
          {label}
        </a>
      </span>
    );
  },
);

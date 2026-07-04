/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/pagination.contract.json (ds.pagination v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Pagination.module.css';

const ICONS: Record<string, string> = {
  'chevron-left':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="12.3,5.5 7.8,10 12.3,14.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'chevron-right':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="7.8,5.5 12.3,10 7.8,14.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export interface PaginationProps extends HTMLAttributes<HTMLElement> {
  /** Numbered trail, compact page label, or dot indicators. */
  variant?: 'pages' | 'compact' | 'dots';
  /** The compact variant's label text. */
  pageLabel?: string;
  /** Accessible label for the navigation landmark. */
  label: string;
}

/** Steps through pages of content, below a table or list. API mirrors industry convention (Astryx Pagination) with three display variants; page math and click behavior are declared boundaries — the pages variant shows a representative trail. */
export const Pagination = forwardRef<HTMLElement, PaginationProps>(function Pagination(
  { variant = 'pages', pageLabel = 'Page 2 of 10', label, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], className].filter(Boolean).join(' ');
  return (
    <nav ref={ref} className={classes} {...rest}>
      <button className={styles.prevButton} aria-label="Previous page" type="button">
        <span
          aria-hidden="true"
          className={styles.prevButtonGlyph}
          dangerouslySetInnerHTML={{ __html: ICONS['chevron-left'] }}
        />
      </button>
      {variant === 'pages' ? (
        <div className={styles.pagesGroup}>
          <button className={styles.pageOne} type="button">
            1
          </button>
          <button className={styles.pageCurrent} type="button" aria-current="page">
            2
          </button>
          <button className={styles.pageThree} type="button">
            3
          </button>
          <span className={styles.ellipsis}>…</span>
          <button className={styles.pageLast} type="button">
            10
          </button>
        </div>
      ) : null}
      {variant === 'compact' ? <span className={styles.compactText}>{pageLabel}</span> : null}
      {variant === 'dots' ? (
        <div className={styles.dotsGroup}>
          <span className={styles.dotActive}></span>
          <span className={styles.dotTwo}></span>
          <span className={styles.dotThree}></span>
        </div>
      ) : null}
      <button className={styles.nextButton} aria-label="Next page" type="button">
        <span
          aria-hidden="true"
          className={styles.nextButtonGlyph}
          dangerouslySetInnerHTML={{ __html: ICONS['chevron-right'] }}
        />
      </button>
    </nav>
  );
});

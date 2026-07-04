/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/citation.contract.json (ds.citation v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { AnchorHTMLAttributes } from 'react';
import styles from './Citation.module.css';

export interface CitationProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Label chip with the source title, or a compact numbered badge. Don't mix both in one paragraph. */
  variant?: 'label' | 'number';
  /** The source's display title (label variant). */
  sourceTitle: string;
  /** Display index (number variant). */
  number?: string;
  /** Source URL. */
  href?: string;
}

/** Inline reference to an external source — attribution in AI-generated responses, articles, anywhere provenance matters. API mirrors industry convention (Astryx Citation): label chips or compact numbered badges. */
export const Citation = forwardRef<HTMLAnchorElement, CitationProps>(function Citation(
  {
    variant = 'label',
    sourceTitle,
    number = '1',
    href = 'https://example.com',
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], className].filter(Boolean).join(' ');
  return (
    <a ref={ref} className={classes} {...rest}>
      {variant === 'label' ? <span className={styles.labelText}>{sourceTitle}</span> : null}
      {variant === 'number' ? <span className={styles.numberText}>{number}</span> : null}
    </a>
  );
});

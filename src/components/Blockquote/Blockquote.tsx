/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/blockquote.contract.json (ds.blockquote v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Blockquote.module.css';

export interface BlockquoteProps extends HTMLAttributes<HTMLQuoteElement> {
  /** Attribution, rendered in a semantic footer. */
  cite?: ReactNode;
}

/** Styled quotation block with an accent left border for quotes, testimonials, and excerpts. API mirrors industry convention (Astryx Blockquote): content plus an optional cite slot rendered in semantic footer/cite markup. */
export const Blockquote = forwardRef<HTMLQuoteElement, BlockquoteProps>(function Blockquote(
  { cite, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <blockquote ref={ref} className={classes} {...rest}>
      <div className={styles.quote}>{children}</div>
      {cite != null ? <footer className={styles.citation}>{cite}</footer> : null}
    </blockquote>
  );
});

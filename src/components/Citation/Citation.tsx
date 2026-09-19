/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/citation.contract.json (ds.citation v1.0.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from AnchorHTMLAttributes<HTMLAnchorElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { AnchorHTMLAttributes } from 'react';
import styles from './Citation.module.css';

export interface CitationProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> {
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
    ...rest
  },
  ref,
) {
  // axis-inert (ledgered, not a throw): variant — no `.<axis>-*` rule
  // exists in Citation.module.css, so no class is composed for it. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever this axis carries rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <a
      ref={ref}
      className={classes}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...rest}
    >
      {variant === 'label' ? <span className={styles.labelText}>{sourceTitle}</span> : null}
      {variant === 'number' ? <span className={styles.numberText}>{number}</span> : null}
    </a>
  );
});

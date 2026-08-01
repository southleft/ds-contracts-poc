/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/chevron-down.contract.json (ds.chevron-down v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './ChevronDown.module.css';

const ICONS: Record<string, string> = {
  'chevron-down':
    '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n<path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n</svg>',
};

export interface ChevronDownProps extends HTMLAttributes<HTMLSpanElement> {}

/** STUB contract auto-proposed for the nested "chevron-down" instances of _Input field base — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry; the root renders the source component's exported vector glyph (SVG, iteration 8) in place of witness paints. Import the child set to replace this stub. */
export const ChevronDown = forwardRef<HTMLSpanElement, ChevronDownProps>(function ChevronDown(
  { className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} {...rest}>
      <span
        className={styles.glyph}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: ICONS['chevron-down'] }}
      />
    </span>
  );
});

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/heading.contract.json (ds.heading v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ElementType } from 'react';
import styles from './Heading.module.css';

const ELEMENT_MAP: Record<string, ElementType> = {
  '1': 'h1',
  '2': 'h2',
  '3': 'h3',
  '4': 'h4',
  '5': 'h5',
  '6': 'h6',
};

export interface HeadingProps extends HTMLAttributes<HTMLElement> {
  /** Document outline level — drives the rendered element (h1–h6) and the size ramp. */
  level?: '1' | '2' | '3' | '4' | '5' | '6';
}

/** Sectioning heading whose rendered HTML element follows the level prop (h1–h6) via semantics.elementByProp, with a token-governed size ramp. The canvas renders the same ramp as a Level variant set — text nodes carry no element semantics, so only code renders the element itself. */
export const Heading = forwardRef<HTMLElement, HeadingProps>(function Heading(
  { level = '2', className, children, ...rest },
  ref,
) {
  const Tag = ELEMENT_MAP[level] ?? 'p';
  const classes = [styles.root, styles[`level-${level}`], className].filter(Boolean).join(' ');
  return (
    <Tag ref={ref} className={classes} {...rest}>
      {children}
    </Tag>
  );
});

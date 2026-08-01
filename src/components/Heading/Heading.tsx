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
  /** Visual size on the control type scale — independent of the document outline level. */
  size?: 'sm' | 'md' | 'lg';
}

/** Sectioning heading whose rendered HTML element follows the level prop (h1–h6) via semantics.elementByProp, with a visual size ramp on the existing control type scale — document outline and visual weight are deliberately independent axes. Text nodes carry no element semantics, so only code renders the element itself. */
export const Heading = forwardRef<HTMLElement, HeadingProps>(function Heading(
  { level = '2', size = 'lg', className, children, ...rest },
  ref,
) {
  const Tag = ELEMENT_MAP[level] ?? 'p';
  // axis-inert (ledgered, not a throw): level — no `.<axis>-*` rule
  // exists in Heading.module.css, so no class is composed for it. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever this axis carries rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <Tag ref={ref} className={classes} {...rest}>
      {children}
    </Tag>
  );
});

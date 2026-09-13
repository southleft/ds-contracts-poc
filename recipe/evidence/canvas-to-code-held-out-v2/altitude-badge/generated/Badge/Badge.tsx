/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/badge.contract.json (ds.badge v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Badge.module.css';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'danger' | 'neutral' | 'info' | 'success' | 'warning';
  shape?: 'label' | 'dot';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const Badge = forwardRef<HTMLDivElement, BadgeProps>(function Badge(
  { variant = 'danger', shape = 'label', className, children, ...rest },
  ref,
) {
  // axis-inert (ledgered, not a throw): shape — no `.<axis>-*` rule
  // exists in Badge.module.css, so no class is composed for it. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever this axis carries rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, styles[`variant-${variant}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      {shape === 'label' ? <span className={styles.Badge}>Badge</span> : null}
    </div>
  );
});

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/badge.contract.json (ds.badge v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLDivElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Badge.module.css';

export interface BadgeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  variant?: 'danger' | 'neutral' | 'info' | 'success' | 'warning';
  shape?: 'label' | 'dot';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const Badge = forwardRef<HTMLDivElement, BadgeProps>(function Badge(
  { variant = 'danger', shape = 'label', className, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], styles[`shape-${shape}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      {shape === 'label' ? <span className={styles.Badge}>Badge</span> : null}
    </div>
  );
});

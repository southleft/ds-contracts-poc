/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/atoms-badge.contract.json (ds.atoms-badge v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { IconsPlaceholder } from '../IconsPlaceholder';
import styles from './AtomsBadge.module.css';

export interface AtomsBadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'accent' | 'info' | 'warning' | 'featured' | 'brand';
  hasIcon?: boolean;
  hasLabel?: boolean;
  label?: string;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const AtomsBadge = forwardRef<HTMLDivElement, AtomsBadgeProps>(function AtomsBadge(
  {
    variant = 'accent',
    hasIcon = true,
    hasLabel = true,
    label = 'Label',
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], className].filter(Boolean).join(' ');
  return (
    <div
      ref={ref}
      className={classes}
      data-has-icon={hasIcon || undefined}
      data-has-label={hasLabel || undefined}
      {...rest}
    >
      {hasIcon ? <IconsPlaceholder size="20" /> : null}
      {hasLabel ? <span className={styles.Label}>{label}</span> : null}
    </div>
  );
});

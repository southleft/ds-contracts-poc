/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/badge.contract.json (ds.badge v0.1.0)
 * Regenerate with: npm run generate
 *
 * DOM attrs OMITTED from HTMLAttributes<HTMLDivElement> — the contract's own props claim these
 * names, so the HTML attribute of the same name cannot be passed through ...rest:
 *   style
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { SizeSmall } from '../SizeSmall';
import styles from './Badge.module.css';

export interface BadgeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style'> {
  type?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'accent';
  style?: 'fill' | 'tonal' | 'outline';
  size?: 'large' | 'small';
  rounded?: boolean;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const Badge = forwardRef<HTMLDivElement, BadgeProps>(function Badge(
  { type = 'brand', style = 'fill', size = 'large', rounded = false, className, children, ...rest },
  ref,
) {
  const classes = [
    styles.root,
    styles[`type-${type}`],
    styles[`style-${style}`],
    styles[`size-${size}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} data-rounded={rounded || undefined} {...rest}>
      <SizeSmall
        iconSwap="187:877"
        size={size === 'large' ? 'small' : size === 'small' ? 'xsmall' : undefined}
      />
      <span className={styles.Label}>Label</span>
      <SizeSmall
        iconSwap="187:877"
        size={size === 'large' ? 'small' : size === 'small' ? 'xsmall' : undefined}
      />
    </div>
  );
});

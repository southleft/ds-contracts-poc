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
  variant?: 'neutral' | 'danger' | 'info' | 'success' | 'warning';
  shape?: 'label' | 'dot';
  text?: string;
}

/** Tag: al-badge

Props
- isDot: boolean — isDot boolean
- variant: info | success | warning | danger — State variant
  - default: Displays a badge with the default state

Slots
- (default) — The badge content

Accessibility
- element: <div>

Docs: https://altitude.pages.dev/docs/components/badge/
 * @see https://altitude.pages.dev/docs/components/badge/ */
export const Badge = forwardRef<HTMLDivElement, BadgeProps>(function Badge(
  { variant = 'neutral', shape = 'label', text = 'Badge', className, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], styles[`shape-${shape}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      {shape === 'label' ? <span className={styles.Badge}>{text}</span> : null}
    </div>
  );
});

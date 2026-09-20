/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/icon.contract.json (ds.icon v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Icon.module.css';

export interface IconProps extends HTMLAttributes<HTMLDivElement> {}

/** Reusable icon glyph component used inside Altitude controls. Choose the glyph for its meaning and inherit semantic content color. In code, use al-icon and the documented icon catalog. Decorative icons should be hidden from assistive technology; meaningful icon-only actions need an accessible label on their control.

Documentation: https://altitude.pages.dev/docs/icons/
 * @see https://altitude.pages.dev/docs/icons/ */
export const Icon = forwardRef<HTMLDivElement, IconProps>(function Icon(
  { className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles.iconContainer}>{children}</div>
    </div>
  );
});

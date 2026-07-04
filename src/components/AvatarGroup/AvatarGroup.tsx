/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/avatar-group.contract.json (ds.avatar-group v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './AvatarGroup.module.css';

export interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** The +N overflow indicator text. */
  overflowLabel?: string;
}

/** Stacked avatars with an overflow count. API mirrors industry convention (Astryx AvatarGroup): overlapping layout — expressed as a negative-margin child rule in CSS and negative item spacing on the canvas. */
export const AvatarGroup = forwardRef<HTMLDivElement, AvatarGroupProps>(function AvatarGroup(
  { overflowLabel = '+3', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles.stack}>{children}</div>
      <span className={styles.overflowText}>{overflowLabel}</span>
    </div>
  );
});

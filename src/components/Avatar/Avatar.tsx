/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/avatar.contract.json (ds.avatar v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Avatar.module.css';

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** Avatar diameter. */
  size?: 'sm' | 'md';
}

/** Represents a person or entity with initials. Non-interactive. */
export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { size = 'sm', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} role="img" {...rest}>
      {children}
    </span>
  );
});

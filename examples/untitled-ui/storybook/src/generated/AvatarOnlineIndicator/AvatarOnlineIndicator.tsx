/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/avatar-online-indicator.contract.json (ds.avatar-online-indicator v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './AvatarOnlineIndicator.module.css';

export interface AvatarOnlineIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'xl' | '2xl' | 'lg' | 'md' | 'sm' | 'xs';
  online?: 'true';
}

/** STUB contract auto-proposed for the nested "_Avatar online indicator" instances of Avatar — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const AvatarOnlineIndicator = forwardRef<HTMLSpanElement, AvatarOnlineIndicatorProps>(
  function AvatarOnlineIndicator(
    { size = 'xl', online = 'true', className, children, ...rest },
    ref,
  ) {
    const classes = [styles.root, styles[`size-${size}`], styles[`online-${online}`], className]
      .filter(Boolean)
      .join(' ');
    return <span ref={ref} className={classes} {...rest}></span>;
  },
);

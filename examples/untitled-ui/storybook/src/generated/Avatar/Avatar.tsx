/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/avatar.contract.json (ds.avatar v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { User } from '../User';
import { AvatarOnlineIndicator } from '../AvatarOnlineIndicator';
import { AvatarCompanyIcon } from '../AvatarCompanyIcon';
import styles from './Avatar.module.css';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'xl' | '2xl' | 'lg' | 'md' | 'sm' | 'xs';
  placeholder?: boolean;
  text?: boolean;
  statusIcon?: 'false' | 'company' | 'onlineIndicator';
  state?: 'default' | 'hover' | 'focused';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(function Avatar(
  {
    size = 'xl',
    statusIcon = 'false',
    state = 'default',
    placeholder = false,
    text = true,
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [
    styles.root,
    styles[`size-${size}`],
    styles[`statusIcon-${statusIcon}`],
    styles[`state-${state}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      ref={ref}
      className={classes}
      data-placeholder={placeholder || undefined}
      data-text={text || undefined}
      {...rest}
    >
      {placeholder ? (
        <div className={styles.user}>
          <User />
        </div>
      ) : null}
      {text ? <span className={styles.Text}>OR</span> : null}
      {statusIcon === 'onlineIndicator' ? (
        <div className={styles.AvatarOnlineIndicator}>
          <AvatarOnlineIndicator size={size} online="true" />
        </div>
      ) : null}
      {statusIcon === 'company' ? (
        <div className={styles.AvatarCompanyIcon}>
          <AvatarCompanyIcon size={size} />
        </div>
      ) : null}
    </div>
  );
});

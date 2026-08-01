/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/avatar-group.contract.json (ds.avatar-group v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { Avatar } from '../Avatar';
import { AvatarAddButton } from '../AvatarAddButton';
import styles from './AvatarGroup.module.css';

export interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'xs' | 'sm' | 'md';
  addUserButton?: boolean;
  moreUsers?: boolean;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const AvatarGroup = forwardRef<HTMLDivElement, AvatarGroupProps>(function AvatarGroup(
  { size = 'xs', addUserButton = true, moreUsers = true, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <div
      ref={ref}
      className={classes}
      data-add-user-button={addUserButton || undefined}
      data-more-users={moreUsers || undefined}
      {...rest}
    >
      <div className={styles.Avatars}>
        <Avatar size={size} text={false} statusIcon="false" state="default" />
        <span className={styles.avatar2}>
          <Avatar size={size} text={false} statusIcon="false" state="default" />
        </span>
        <span className={styles.avatar3}>
          <Avatar size={size} text={false} statusIcon="false" state="default" />
        </span>
        <span className={styles.avatar4}>
          <Avatar size={size} text={false} statusIcon="false" state="default" />
        </span>
        <span className={styles.avatar5}>
          <Avatar size={size} text={false} statusIcon="false" state="default" />
        </span>
        <span className={styles.avatar6}>
          <Avatar size={size} text={false} statusIcon="false" state="default" />
        </span>
        <span className={styles.avatar7}>
          <Avatar size={size} text={false} statusIcon="false" state="default" />
        </span>
        <span className={styles.avatar8}>
          <Avatar size={size} text={false} statusIcon="false" state="default" />
        </span>
        <span className={styles.avatar9}>
          <Avatar size={size} text={false} statusIcon="false" state="default" />
        </span>
        <span className={styles.avatar10}>
          <Avatar size={size} text={false} statusIcon="false" state="default" />
        </span>
        {moreUsers ? (
          <Avatar size={size} text statusIcon="false" state="default" children="+5" />
        ) : null}
      </div>
      {addUserButton ? <AvatarAddButton size={size} /> : null}
    </div>
  );
});

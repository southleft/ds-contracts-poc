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
    children = 'OR',
    ...rest
  },
  ref,
) {
  // axis-inert (ledgered, not a throw): statusIcon — no `.<axis>-*` rule
  // exists in Avatar.module.css, so no class is composed for it. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever this axis carries rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, styles[`size-${size}`], styles[`state-${state}`], className]
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
          <span className={styles.instance}>
            <User />
          </span>
        </div>
      ) : null}
      {text ? <span className={styles.Text}>{children}</span> : null}
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

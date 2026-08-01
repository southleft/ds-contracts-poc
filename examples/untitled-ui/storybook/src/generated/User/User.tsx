/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/user.contract.json (ds.user v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './User.module.css';

const ICONS: Record<string, string> = {
  user: '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n<path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n</svg>',
};

export interface UserProps extends HTMLAttributes<HTMLSpanElement> {}

/** STUB contract auto-proposed for the nested "user" instances of Avatar — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the source component's exported vector glyph (SVG, iteration 8) in place of witness paints. Import the child set to replace this stub. */
export const User = forwardRef<HTMLSpanElement, UserProps>(function User(
  { className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} {...rest}>
      <span
        className={styles.glyph}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: ICONS['user'] }}
      />
    </span>
  );
});

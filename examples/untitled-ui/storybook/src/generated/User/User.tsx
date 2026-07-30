/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/user.contract.json (ds.user v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './User.module.css';

export interface UserProps extends HTMLAttributes<HTMLSpanElement> {}

/** STUB contract auto-proposed for the nested "user" instances of Avatar — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries). Import the child set to replace this stub. */
export const User = forwardRef<HTMLSpanElement, UserProps>(function User(
  { className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return <span ref={ref} className={classes} {...rest}></span>;
});

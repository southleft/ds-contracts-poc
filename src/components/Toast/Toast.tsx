/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/toast.contract.json (ds.toast v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Toast.module.css';

const ROLE_MAP: Record<string, string> = { info: 'status', error: 'alert' };

export interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  /** Info confirms; error persists until dismissed (behavior layer). */
  type?: 'info' | 'error';
  /** Trailing content — an Undo button, a link. */
  endContent?: ReactNode;
}

/** Brief non-blocking notification confirming an action. API mirrors industry convention (Astryx Toast): the visual element — positioning, stacking, and auto-dismiss belong to the behavior layer and are a declared boundary. */
export const Toast = forwardRef<HTMLDivElement, ToastProps>(function Toast(
  { type = 'info', endContent, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`type-${type}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} role={ROLE_MAP[type]} {...rest}>
      <div className={styles.body}>{children}</div>
      {endContent != null ? <div className={styles.endContent}>{endContent}</div> : null}
    </div>
  );
});

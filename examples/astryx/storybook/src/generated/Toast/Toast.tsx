/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/toast.contract.json (astryx.toast v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { Button } from '../Button';
import styles from './Toast.module.css';

export interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  /** The toast's primary message content (vendor anatomy: Body, required). */
  body?: string;
  /** Vendor anatomy: End content (optional trailing action) — a slot accepting composed instances. */
  endContent?: ReactNode;
}

/** PROMOTED from the Phase B composition-tier extraction (round 2, wrapper-ref descent) — the vendor-refereed exhibit: Astryx's own Toast.doc.mjs declares anatomy Body / End content / Dismiss button, and the extraction recovered exactly those three (body slot, endContent slot, ghost dismiss astryx.button with its real props) once the MediaTheme wrapper descended. Curation receipts: (1) the MediaTheme theme-provider ref was dropped and its interior lifted to the root (a theme boundary is a code mechanism, not anatomy); (2) the extracted behavioral props (isAutoHide/autoHideDuration/isExiting) are timing mechanics with no visual projection — dropped from the exhibit, receipted here; (3) root keeps the extracted StyleX token bindings verbatim (padding, radius, shadow, body typography). */
export const Toast = forwardRef<HTMLDivElement, ToastProps>(function Toast(
  { body = 'Saved successfully', endContent, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} aria-atomic="true" role="status" {...rest}>
      <div className={styles.content}>
        <span className={styles.bodyText}>{body}</span>
      </div>
      {endContent != null ? <div className={styles.endContent}>{endContent}</div> : null}
      <Button variant="ghost" label="Dismiss" />
    </div>
  );
});

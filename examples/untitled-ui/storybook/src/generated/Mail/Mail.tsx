/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/mail.contract.json (ds.mail v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Mail.module.css';

const ICONS: Record<string, string> = {
  mail: '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n<path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6M22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6M22 6L12 13L2 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n</svg>',
};

export interface MailProps extends HTMLAttributes<HTMLSpanElement> {}

/** STUB contract auto-proposed for the nested "mail" instances of _Input field base — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry; the root renders the source component's exported vector glyph (SVG, iteration 8) in place of witness paints. Import the child set to replace this stub. */
export const Mail = forwardRef<HTMLSpanElement, MailProps>(function Mail(
  { className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} {...rest}>
      <span
        className={styles.glyph}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: ICONS['mail'] }}
      />
    </span>
  );
});

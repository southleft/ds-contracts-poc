/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/inline-hint.contract.json (ds.inline-hint v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './InlineHint.module.css';

export interface InlineHintProps extends HTMLAttributes<HTMLSpanElement> {
  supportingText?: string;
}

/** STUB contract auto-proposed for the nested ".Inline hint" instances of Atoms/Checkbox — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const InlineHint = forwardRef<HTMLSpanElement, InlineHintProps>(function InlineHint(
  { supportingText = 'Hint text', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} {...rest}>
      <span className={styles.supportingText}>{supportingText}</span>
    </span>
  );
});

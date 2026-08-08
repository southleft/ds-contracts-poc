/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/field-label.contract.json (ds.field-label v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './FieldLabel.module.css';

export interface FieldLabelProps extends HTMLAttributes<HTMLSpanElement> {
  hasTooltip?: boolean;
  labelText?: string;
}

/** STUB contract auto-proposed for the nested ".Field label" instances of Atoms/Input — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const FieldLabel = forwardRef<HTMLSpanElement, FieldLabelProps>(function FieldLabel(
  { hasTooltip = true, labelText = 'Label', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} data-has-tooltip={hasTooltip || undefined} {...rest}>
      <span className={styles.labelText}>{labelText}</span>
    </span>
  );
});

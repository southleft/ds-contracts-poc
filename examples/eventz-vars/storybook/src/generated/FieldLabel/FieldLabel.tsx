/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/field-label.contract.json (ds.field-label v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLSpanElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './FieldLabel.module.css';

export interface FieldLabelProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  hasTooltip?: boolean;
  labelText?: string;
}

/** STUB contract auto-proposed for the nested ".Field label" instances of Atoms/Input — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const FieldLabel = forwardRef<HTMLSpanElement, FieldLabelProps>(function FieldLabel(
  { hasTooltip = true, labelText = 'Label', className, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} data-has-tooltip={hasTooltip || undefined} {...rest}>
      <span className={styles.labelText}>{labelText}</span>
    </span>
  );
});

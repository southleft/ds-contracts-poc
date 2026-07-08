/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/field.contract.json (ds.field v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Field.module.css';

const ICONS: Record<string, string> = {
  asterisk:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="10" y1="4.5" x2="10" y2="15.5" stroke-linecap="round"/><line x1="5.2" y1="7.2" x2="14.8" y2="12.8" stroke-linecap="round"/><line x1="14.8" y1="7.2" x2="5.2" y2="12.8" stroke-linecap="round"/></svg>',
};

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  /** Shows the required indicator beside the label. */
  isRequired?: boolean;
  /** Always rendered — even custom controls need names. */
  label: string;
  /** The wrapped control's id, used for the label's htmlFor association. */
  inputID: string;
  /** Helper text between the label and the control. */
  description?: string;
}

/** Form field wrapper providing a label, description, and required indicator around any control. API mirrors industry convention (Astryx Field): the label targets the control via inputID; validation status needs structured-object props — a documented gap. */
export const Field = forwardRef<HTMLDivElement, FieldProps>(function Field(
  {
    isRequired = false,
    label,
    inputID,
    description = 'Helper text for the wrapped control.',
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} data-is-required={isRequired || undefined} {...rest}>
      <label className={styles.labelRow} htmlFor={String(inputID)}>
        <span className={styles.labelText}>{label}</span>
        {isRequired ? (
          <span
            className={styles.requiredMark}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: ICONS['asterisk'] }}
          />
        ) : null}
      </label>
      <span className={styles.descriptionText}>{description}</span>
      <div className={styles.control}>{children}</div>
    </div>
  );
});

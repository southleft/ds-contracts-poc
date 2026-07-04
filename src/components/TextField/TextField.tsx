/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/text-field.contract.json (ds.text-field v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { LabelHTMLAttributes } from 'react';
import styles from './TextField.module.css';

const ICONS: Record<string, string> = {
  asterisk:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="10" y1="4.5" x2="10" y2="15.5" stroke-linecap="round"/><line x1="5.2" y1="7.2" x2="14.8" y2="12.8" stroke-linecap="round"/><line x1="14.8" y1="7.2" x2="5.2" y2="12.8" stroke-linecap="round"/></svg>',
};

export interface TextFieldProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Control size scale. */
  size?: 'sm' | 'md' | 'lg';
  /** Marks the field required — shows the indicator beside the label. */
  isRequired?: boolean;
  /** Disabled state. */
  isDisabled?: boolean;
  /** Field label — always rendered; placeholders are not labels. */
  label: string;
  /** Helper text between the label and the input. */
  description?: string;
  /** Hint shown when the field is empty. Never a substitute for the label. */
  placeholder?: string;
}

/** Single-line text input for short-form values — names, emails, search queries. API mirrors industry convention (Astryx TextInput): required label, description, size scale. The wrapping-label anatomy gives implicit label association. */
export const TextField = forwardRef<HTMLLabelElement, TextFieldProps>(function TextField(
  {
    size = 'md',
    isRequired = false,
    isDisabled = false,
    label,
    description = 'Helper text that explains the expected value.',
    placeholder = 'Enter a value…',
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <label
      ref={ref}
      className={classes}
      data-is-required={isRequired || undefined}
      data-is-disabled={isDisabled || undefined}
      {...rest}
    >
      <div className={styles.labelRow}>
        <span className={styles.labelText}>{label}</span>
        {isRequired ? (
          <span
            className={styles.requiredMark}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: ICONS['asterisk'] }}
          />
        ) : null}
      </div>
      <span className={styles.descriptionText}>{description}</span>
      <input className={styles.input} type="text" placeholder={placeholder}></input>
    </label>
  );
});

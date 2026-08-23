/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/text-area.contract.json (ds.text-area v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { LabelHTMLAttributes } from 'react';
import styles from './TextArea.module.css';

const ICONS: Record<string, string> = {
  asterisk:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="10" y1="4.5" x2="10" y2="15.5" stroke-linecap="round"/><line x1="5.2" y1="7.2" x2="14.8" y2="12.8" stroke-linecap="round"/><line x1="14.8" y1="7.2" x2="5.2" y2="12.8" stroke-linecap="round"/></svg>',
};

export interface TextAreaProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Control size scale (affects padding and text size). */
  size?: 'sm' | 'md' | 'lg';
  /** Marks the field required. */
  isRequired?: boolean;
  /** Field label — always rendered. */
  label: string;
  /** Helper text between the label and the textarea. */
  description?: string;
  /** Hint shown when empty. */
  placeholder?: string;
}

/** Multi-line text input for longer-form content — comments, descriptions, messages. API mirrors industry convention (Astryx TextArea); wrapping-label anatomy gives implicit association. */
export const TextArea = forwardRef<HTMLLabelElement, TextAreaProps>(function TextArea(
  {
    size = 'md',
    isRequired = false,
    label,
    description = 'Helper text that explains the expected content.',
    placeholder = 'Write something…',
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <label ref={ref} className={classes} data-is-required={isRequired || undefined} {...rest}>
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
      <textarea className={styles.input} rows={3} placeholder={placeholder}></textarea>
    </label>
  );
});

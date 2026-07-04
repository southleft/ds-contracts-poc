/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/checkbox.contract.json (ds.checkbox v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { LabelHTMLAttributes } from 'react';
import styles from './Checkbox.module.css';

const ICONS: Record<string, string> = {
  check:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="4.6,10.4 8.2,14 15.4,6.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dash: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="5.5" y1="10" x2="14.5" y2="10" stroke-linecap="round"/></svg>',
};

export interface CheckboxProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Checked, unchecked, or indeterminate (partial selection in a group). */
  value?: 'unchecked' | 'checked' | 'indeterminate';
  /** Control size. */
  size?: 'sm' | 'md';
  /** Always rendered — users must know what they are toggling. */
  label: string;
  /** Secondary text below the label. */
  description?: string;
}

/** Toggles a single on/off value — settings, terms acceptance, opt-ins. API mirrors industry convention (Astryx CheckboxInput): checked, unchecked, and indeterminate are prop-driven appearance states. */
export const Checkbox = forwardRef<HTMLLabelElement, CheckboxProps>(function Checkbox(
  {
    value = 'unchecked',
    size = 'md',
    label,
    description = 'Supporting detail for this option.',
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [styles.root, styles[`value-${value}`], styles[`size-${size}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <label ref={ref} className={classes} {...rest}>
      <div className={styles.box}>
        {value === 'checked' ? (
          <span
            className={styles.checkGlyph}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: ICONS['check'] }}
          />
        ) : null}
        {value === 'indeterminate' ? (
          <span
            className={styles.dashGlyph}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: ICONS['dash'] }}
          />
        ) : null}
      </div>
      <div className={styles.textCol}>
        <span className={styles.labelText}>{label}</span>
        <span className={styles.descriptionText}>{description}</span>
      </div>
    </label>
  );
});

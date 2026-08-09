/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/text-input.contract.json (astryx.text-input v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './TextInput.module.css';

const ICONS: Record<string, string> = {
  'text-input-user':
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n<path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n</svg>',
  'text-input-mail':
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n<path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6M22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6M22 6L12 13L2 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n</svg>',
  'text-input-lock':
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n<path d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11M5 11H19C20.1046 11 21 11.8954 21 13V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V13C3 11.8954 3.89543 11 5 11Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n</svg>',
};

export interface TextInputProps extends HTMLAttributes<HTMLDivElement> {
  /** The input type. */
  type?: 'text' | 'password' | 'email';
  /** The field label. */
  label: string;
  /** The field size. */
  size?: 'sm' | 'md' | 'lg';
  /** Placeholder text. */
  placeholder?: string;
  /** Whether the field is required. */
  isRequired?: boolean;
  /** Whether the field is disabled. */
  isDisabled?: boolean;
  /** Whether the field shows a clear button. */
  hasClear?: boolean;
}

/** Astryx TextInput — promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/TextInput/TextInput.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). type/label/size/placeholder and the optional/required/disabled/clear/autofocus flags are verbatim (83% facts-carried); description, disabledMessage, labelTooltip, htmlName and isLoading are dropped. value is materialized as a placeholder-backed text field. Wave B.3: showcase width (320px), inputWrapper border (color-border-emphasized), startIcon row (type-mapped 16px glyphs, color-icon-secondary), and placeholder hierarchy (body-size secondary text) from TextInput.tsx + inputStyles.stylex source — not harness-captured. */
export const TextInput = forwardRef<HTMLDivElement, TextInputProps>(function TextInput(
  {
    type = 'text',
    size = 'md',
    isRequired = false,
    isDisabled = false,
    hasClear = false,
    label,
    placeholder = 'you@example.com',
    className,
    children,
    ...rest
  },
  ref,
) {
  // axis-inert (ledgered, not a throw): type — no `.<axis>-*` rule
  // exists in TextInput.module.css, so no class is composed for it. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever this axis carries rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <div
      ref={ref}
      className={classes}
      data-is-required={isRequired || undefined}
      data-is-disabled={isDisabled || undefined}
      data-has-clear={hasClear || undefined}
      {...rest}
    >
      <span className={styles.label}>{label}</span>
      <div className={styles.field}>
        <div className={styles['start-icon']}>
          {type === 'text' ? (
            <span
              className={styles['icon-text']}
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: ICONS['text-input-user'] }}
            />
          ) : null}
          {type === 'email' ? (
            <span
              className={styles['icon-email']}
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: ICONS['text-input-mail'] }}
            />
          ) : null}
          {type === 'password' ? (
            <span
              className={styles['icon-password']}
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: ICONS['text-input-lock'] }}
            />
          ) : null}
        </div>
        <span className={styles['placeholder-text']}>{placeholder}</span>
      </div>
    </div>
  );
});

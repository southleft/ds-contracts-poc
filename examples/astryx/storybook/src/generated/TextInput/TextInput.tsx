/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/text-input.contract.json (astryx.text-input v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './TextInput.module.css';

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

/** Astryx TextInput — promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/TextInput/TextInput.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). type/label/size/placeholder and the optional/required/disabled/clear/autofocus flags are verbatim (83% facts-carried); description, disabledMessage, labelTooltip, htmlName and isLoading are dropped. value is materialized as a placeholder-backed text field. CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2). */
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
  const classes = [styles.root, styles[`type-${type}`], styles[`size-${size}`], className]
    .filter(Boolean)
    .join(' ');
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
      <div className={styles.field}>{placeholder}</div>
    </div>
  );
});

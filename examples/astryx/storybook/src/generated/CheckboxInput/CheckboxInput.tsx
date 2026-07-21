/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/checkbox-input.contract.json (astryx.checkbox-input v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './CheckboxInput.module.css';

export interface CheckboxInputProps extends HTMLAttributes<HTMLDivElement> {
  /** The checkbox label. */
  label: string;
  /** The control size. */
  size?: 'sm' | 'md';
  /** Whether the checkbox is disabled. */
  isDisabled?: boolean;
  /** Whether the checkbox is read-only. */
  isReadOnly?: boolean;
  /** Whether the checkbox is required. */
  isRequired?: boolean;
}

/** Astryx CheckboxInput — promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/CheckboxInput/CheckboxInput.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). label + size + the disabled/readonly/optional/required flags are verbatim; description, disabledMessage, htmlName and isLoading are dropped. STRUCTURAL: the control renders as a styled box (div), not a native <input> — a11y semantics are a Phase A-2 concern. CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2). */
export const CheckboxInput = forwardRef<HTMLDivElement, CheckboxInputProps>(function CheckboxInput(
  {
    size = 'md',
    isDisabled = false,
    isReadOnly = false,
    isRequired = false,
    label,
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <div
      ref={ref}
      className={classes}
      data-is-disabled={isDisabled || undefined}
      data-is-read-only={isReadOnly || undefined}
      data-is-required={isRequired || undefined}
      {...rest}
    >
      <span className={styles.control}></span>
      <span className={styles.label}>{label}</span>
    </div>
  );
});

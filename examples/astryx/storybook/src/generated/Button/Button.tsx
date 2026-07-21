/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (astryx.button v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The visual style variant of the button. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  /** The size of the button. */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the button is disabled. */
  isDisabled?: boolean;
  /** Whether the button is in a loading state. */
  isLoading?: boolean;
  /** Renders as a square icon-only button. */
  isIconOnly?: boolean;
  /** Accessible, visible button label. */
  label: string;
}

/** Astryx Button — promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/Button/Button.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). Visual/structural API is verbatim; HTML passthrough (type, name, form, target, rel), href link-mode, isInterruptible and tooltip are dropped (documented in DEV-JOURNEY.md). CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    isDisabled = false,
    isLoading = false,
    isIconOnly = false,
    label,
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], styles[`size-${size}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      ref={ref}
      className={classes}
      data-is-disabled={isDisabled || undefined}
      data-is-loading={isLoading || undefined}
      data-is-icon-only={isIconOnly || undefined}
      {...rest}
    >
      <span className={styles.label}>{label}</span>
    </button>
  );
});

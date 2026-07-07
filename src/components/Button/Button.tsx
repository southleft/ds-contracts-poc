/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (ds.button v1.3.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

const ICONS: Record<string, string> = {
  spinner:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M 10 2.5 A 7.5 7.5 0 0 1 17.5 10" stroke-linecap="round"/></svg>',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual prominence of the action. */
  variant?: 'primary' | 'secondary' | 'danger';
  /** Control density. */
  size?: 'sm' | 'md' | 'lg';
  /** Prevents interaction and communicates unavailability. */
  disabled?: boolean;
  /** Shows a spinning busy indicator beside the label while an async action resolves. */
  loading?: boolean;
}

/** Triggers an action or event. Use one primary button per context. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
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
      disabled={disabled}
      data-loading={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span
          className={styles.loadingSpinner}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: ICONS['spinner'] }}
        />
      ) : null}
      <span className={styles.label}>{children}</span>
    </button>
  );
});

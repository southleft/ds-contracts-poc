/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/spinner.contract.json (ds.spinner v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Spinner.module.css';

const ICONS: Record<string, string> = {
  spinner:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M 10 2.5 A 7.5 7.5 0 0 1 17.5 10" stroke-linecap="round"/></svg>',
};

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  /** What is loading — announced to screen readers. */
  label: string;
}

/** Animated loading indicator for processes of unknown duration. API mirrors industry convention (Astryx Spinner); the size scale needs per-variant icon sizing and the rotation itself is CSS-only — the canvas shows the static arc. */
export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { label, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} role="status" {...rest}>
      <span
        className={styles.arc}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: ICONS['spinner'] }}
      />
    </span>
  );
});

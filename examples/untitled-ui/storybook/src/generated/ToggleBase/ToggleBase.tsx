/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/toggle-base.contract.json (ds.toggle-base v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from './ToggleBase.module.css';

export interface ToggleBaseProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
  size?: 'md' | 'sm';
  theme?: 'dark' | 'light';
  disabled?: boolean;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const ToggleBase = forwardRef<HTMLButtonElement, ToggleBaseProps>(function ToggleBase(
  { size = 'md', theme = 'dark', pressed = true, disabled = false, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], styles[`theme-${theme}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      ref={ref}
      className={classes}
      disabled={disabled}
      data-pressed={pressed || undefined}
      {...rest}
    >
      <div className={styles.Button}></div>
    </button>
  );
});

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button-brand-primary.contract.json (ds.button-brand-primary v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { Icon } from '../Icon';
import styles from './ButtonBrandPrimary.module.css';

export interface ButtonBrandPrimaryProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'large' | 'medium' | 'small';
  text?: string;
  iconLeft?: boolean;
  iconRight?: boolean;
  disabled?: boolean;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const ButtonBrandPrimary = forwardRef<HTMLButtonElement, ButtonBrandPrimaryProps>(function ButtonBrandPrimary(
  { size = 'large', iconLeft = false, iconRight = false, disabled = false, text = 'Button', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <button ref={ref} className={classes} disabled={disabled} data-icon-left={iconLeft || undefined} data-icon-right={iconRight || undefined} {...rest}>
      <Icon size="large" />
<span className={styles.Button}>{text}</span>
<Icon size="large" />
    </button>
  );
});

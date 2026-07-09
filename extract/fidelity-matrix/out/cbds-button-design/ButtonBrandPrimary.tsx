/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button-brand-primary.contract.json (ds.button-brand-primary v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { Icon } from '../Icon';
import styles from './ButtonBrandPrimary.module.css';

export interface ButtonBrandPrimaryProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'large' | 'medium' | 'small';
  state?: 'default' | 'hover' | 'focus' | 'pressed' | 'disabled';
  text?: string;
  iconLeft?: boolean;
  iconRight?: boolean;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const ButtonBrandPrimary = forwardRef<HTMLDivElement, ButtonBrandPrimaryProps>(function ButtonBrandPrimary(
  { size = 'large', state = 'default', iconLeft = false, iconRight = false, text = 'Button', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], styles[`state-${state}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} data-icon-left={iconLeft || undefined} data-icon-right={iconRight || undefined} {...rest}>
      <Icon size="large" />
<span className={styles.Button}>{text}</span>
<Icon size="large" />
{state === 'disabled' ? (<span className={styles.Tooltip}>This action is currently unavailable</span>) : null}
{state === 'focus' ? (<div className={styles.focusRing}>

</div>) : null}
    </div>
  );
});

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (ds.button v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'primary' | 'knockout' | 'secondary' | 'bare';
  state?: 'default' | 'hover' | 'active' | 'focus';
  isDisabled?: boolean;
  text?: string;
  hasStartIcon?: boolean;
  hasEndIcon?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const Button = forwardRef<HTMLDivElement, ButtonProps>(function Button(
  { variant = 'primary', state = 'default', isDisabled = false, hasStartIcon = true, hasEndIcon = true, text = 'Label', startIcon, endIcon, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], styles[`state-${state}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} data-is-disabled={isDisabled || undefined} data-has-start-icon={hasStartIcon || undefined} data-has-end-icon={hasEndIcon || undefined} {...rest}>
      {state === 'focus' ? (<div className={styles.focusRing}>

</div>) : null}
{hasStartIcon ? (<div className={styles.startIcon}>{startIcon}</div>) : null}
<span className={styles.Label}>{text}</span>
{hasEndIcon ? (<div className={styles.endIcon}>{endIcon}</div>) : null}
    </div>
  );
});

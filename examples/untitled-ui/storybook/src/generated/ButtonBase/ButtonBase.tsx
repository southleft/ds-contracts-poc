/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button-base.contract.json (ds.button-base v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { Dot } from '../Dot';
import { Circle } from '../Circle';
import styles from './ButtonBase.module.css';

export interface ButtonBaseProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'md' | 'lg' | 'xl' | 'sm';
  icon?: 'leading' | 'only' | 'false' | 'trailing' | 'dot';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const ButtonBase = forwardRef<HTMLDivElement, ButtonBaseProps>(function ButtonBase(
  { size = 'md', icon = 'leading', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], styles[`icon-${icon}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      {icon === 'dot' ? (
        <span className={styles.Dot}>
          <Dot />
        </span>
      ) : null}
      {icon === 'leading' || icon === 'only' || icon === 'trailing' ? <Circle /> : null}
      {icon === 'leading' || icon === 'false' || icon === 'trailing' || icon === 'dot' ? (
        <span className={styles.Text}>Button CTA</span>
      ) : null}
    </div>
  );
});

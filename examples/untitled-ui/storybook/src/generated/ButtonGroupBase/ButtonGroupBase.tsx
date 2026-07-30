/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button-group-base.contract.json (ds.button-group-base v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { Dot } from '../Dot';
import { Circle } from '../Circle';
import { Plus } from '../Plus';
import styles from './ButtonGroupBase.module.css';

export interface ButtonGroupBaseProps extends HTMLAttributes<HTMLDivElement> {
  current?: boolean;
  icon?: 'false' | 'only' | 'leading' | 'dot';
  state?: 'default' | 'focused' | 'disabled' | 'hover';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const ButtonGroupBase = forwardRef<HTMLDivElement, ButtonGroupBaseProps>(
  function ButtonGroupBase(
    { icon = 'false', state = 'default', current = false, className, children, ...rest },
    ref,
  ) {
    const classes = [styles.root, styles[`icon-${icon}`], styles[`state-${state}`], className]
      .filter(Boolean)
      .join(' ');
    return (
      <div ref={ref} className={classes} data-current={current || undefined} {...rest}>
        {icon === 'dot' ? <Dot /> : null}
        {icon === 'leading' ? <Circle /> : null}
        {icon === 'only' ? <Plus /> : null}
        {icon === 'false' || icon === 'leading' || icon === 'dot' ? (
          <span className={styles.Text}>Text</span>
        ) : null}
      </div>
    );
  },
);

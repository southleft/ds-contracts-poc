/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/progress-circle.contract.json (ds.progress-circle v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './ProgressCircle.module.css';

export interface ProgressCircleProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'md' | 'lg' | 'sm' | 'xs';
  shape?: 'circle' | 'halfCircle';
  label?: boolean;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const ProgressCircle = forwardRef<HTMLDivElement, ProgressCircleProps>(
  function ProgressCircle(
    { size = 'md', shape = 'circle', label = true, className, children, ...rest },
    ref,
  ) {
    const classes = [styles.root, styles[`size-${size}`], styles[`shape-${shape}`], className]
      .filter(Boolean)
      .join(' ');
    return (
      <div ref={ref} className={classes} data-label={label || undefined} {...rest}>
        <div className={styles.Ring}>
          <div className={styles.Background}></div>
          <div className={styles.Line}></div>
        </div>
        <div className={styles.group3}>
          {label ? <span className={styles.Label}>Active users</span> : null}
          <span className={styles.Number}>40%</span>
        </div>
      </div>
    );
  },
);

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/slider.contract.json (ds.slider v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { Tooltip } from '../Tooltip';
import styles from './Slider.module.css';

export interface SliderProps extends HTMLAttributes<HTMLDivElement> {
  label?: 'bottom' | 'bottomFloating' | 'topFloating' | 'false';
  rightControl?: '25' | '50' | '75' | '100';
  leftControl?: '0' | '25' | '50' | '75';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const Slider = forwardRef<HTMLDivElement, SliderProps>(function Slider(
  { label = 'bottom', rightControl = '25', leftControl = '0', className, children, ...rest },
  ref,
) {
  const classes = [
    styles.root,
    styles[`label-${label}`],
    styles[`rightControl-${rightControl}`],
    styles[`leftControl-${leftControl}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles.Background}></div>
      <div className={styles.Progress}>
        <div className={styles.progressLine}></div>
        <div className={styles.leftControl}>
          <div className={styles.leftControl2}></div>
          {label === 'bottomFloating' || label === 'topFloating' ? (
            <div className={styles.Tooltip}>
              <Tooltip
                supportingText={false}
                theme="light"
                arrow={
                  label === 'bottomFloating'
                    ? 'topCenter'
                    : label === 'topFloating'
                      ? 'bottomCenter'
                      : undefined
                }
              />
            </div>
          ) : null}
          {label === 'bottom' ? (
            <span className={styles.leftNumber}>
              {leftControl === '25'
                ? '25%'
                : leftControl === '50'
                  ? '50%'
                  : leftControl === '75'
                    ? '75%'
                    : '0%'}
            </span>
          ) : null}
        </div>
        <div className={styles.rightControl}>
          <div className={styles.rightControl2}></div>
          {label === 'bottomFloating' || label === 'topFloating' ? (
            <div className={styles.rightControlTooltip}>
              <Tooltip
                supportingText={false}
                theme="light"
                arrow={
                  label === 'bottomFloating'
                    ? 'topCenter'
                    : label === 'topFloating'
                      ? 'bottomCenter'
                      : undefined
                }
              />
            </div>
          ) : null}
          {label === 'bottom' ? (
            <span className={styles.rightNumber}>
              {rightControl === '50'
                ? '50%'
                : rightControl === '75'
                  ? '75%'
                  : rightControl === '100'
                    ? '100%'
                    : '25%'}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
});

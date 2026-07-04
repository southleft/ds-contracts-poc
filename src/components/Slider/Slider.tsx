/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/slider.contract.json (ds.slider v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Slider.module.css';

export interface SliderProps extends HTMLAttributes<HTMLDivElement> {
  /** Current value — positions the thumb. */
  value?: number;
  /** Maximum value. */
  max?: number;
  /** Always rendered. */
  label: string;
}

/** Numeric selection within bounds — the static surface of a slider: label, filled track to the current value, and thumb. API mirrors industry convention (Astryx Slider); drag behavior and range mode are declared boundaries. */
export const Slider = forwardRef<HTMLDivElement, SliderProps>(function Slider(
  { value = 40, max = 100, label, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <span className={styles.labelText}>{label}</span>
      <div className={styles.trackRow}>
        <div
          className={styles.filled}
          style={{ width: `${Math.min(100, Math.max(0, (value / max) * 100))}%` }}
        />
        <span className={styles.thumb}></span>
        <div className={styles.remainder}></div>
      </div>
    </div>
  );
});

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/slider.contract.json (astryx.slider v0.4.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Slider.module.css';

export interface SliderProps extends HTMLAttributes<HTMLDivElement> {
  /** The slider label. */
  label: string;
  /** Slider orientation. */
  orientation?: 'horizontal' | 'vertical';
  /** How the current value is shown. */
  valueDisplay?: 'tooltip' | 'text' | 'none';
  /** Whether the slider is disabled. */
  isDisabled?: boolean;
  /** Whether the slider is required. */
  isRequired?: boolean;
}

/** Astryx Slider — promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/Slider/Slider.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). label/min/max/step/orientation/valueDisplay and the optional/required/disabled flags are verbatim (82%; recovered from a union-of-refs named-skip via the keyof+union adapter fix). value, description, disabledMessage, labelTooltip, htmlName and minStepsBetweenThumbs are dropped. STRUCTURAL: track/thumb render as styled boxes, not a native range input. Wave B.3: showcase width (240px) and thumb/track geometry from Slider.tsx source constants (TRACK_SIZE=4, THUMB_SIZE=20, value≈40%) — not the harness-captured ~49px hug floor. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @astryxdesign/core@0.1.6 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. */
export const Slider = forwardRef<HTMLDivElement, SliderProps>(function Slider(
  {
    orientation = 'horizontal',
    valueDisplay = 'tooltip',
    isDisabled = false,
    isRequired = false,
    label,
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [
    styles.root,
    styles[`orientation-${orientation}`],
    styles[`valueDisplay-${valueDisplay}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      ref={ref}
      className={classes}
      data-is-disabled={isDisabled || undefined}
      data-is-required={isRequired || undefined}
      {...rest}
    >
      <label className={styles.label}>{label}</label>
      <div className={styles.slider}>
        <div className={styles['part-1-0']}>
          <div className={styles['slider-track']}></div>
          <div className={styles['part-1-0-1']}></div>
          <div className={styles['slider-thumb-2']}></div>
          <div className={styles.tooltip}>
            <span className={styles['label-2']}>40</span>
          </div>
        </div>
        <span className={styles['label-3']}>40</span>
      </div>
    </div>
  );
});

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/switch.contract.json (astryx.switch v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Switch.module.css';

export interface SwitchProps extends HTMLAttributes<HTMLDivElement> {
  /** The switch label. */
  label: string;
  /** Whether the switch is on or off. */
  value?: boolean;
  /** Where the label sits relative to the track. */
  labelPosition?: 'start' | 'end';
  /** Whether the switch is disabled. */
  isDisabled?: boolean;
  /** Whether the switch is required. */
  isRequired?: boolean;
}

/** Astryx Switch — promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/Switch/Switch.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). label + labelPosition + labelSpacing and the disabled/optional/required flags are verbatim; description, htmlName, labelTooltip, disabledMessage and isLoading are dropped. Wave B.3: `value` is a VARIANT AXIS (off/on) — FC-MISSING-AXIS. On thumb geometry from Switch.tsx source constants (20×20, travel 14px) — not harness-captured. STRUCTURAL: the track renders as a styled box, not a native role=switch input. */
export const Switch = forwardRef<HTMLDivElement, SwitchProps>(function Switch(
  {
    labelPosition = 'end',
    value = false,
    isDisabled = false,
    isRequired = false,
    label,
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [styles.root, styles[`labelPosition-${labelPosition}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      ref={ref}
      className={classes}
      data-value={value || undefined}
      data-is-disabled={isDisabled || undefined}
      data-is-required={isRequired || undefined}
      {...rest}
    >
      <div className={styles['part-0']}>
        <div className={styles['part-0-0']}>
          <label className={styles['label-2']}>{label}</label>
          <input className={styles['part-0-0-0']}></input>
          <div className={styles.switch}>
            <div className={styles['switch-thumb']}></div>
          </div>
        </div>
        <div className={styles['part-0-1']}>
          <input className={styles['part-0-1-0']}></input>
          <div className={styles['switch-2']}>
            <div className={styles['switch-thumb-2']}></div>
          </div>
          <label className={styles.label}>{label}</label>
        </div>
      </div>
    </div>
  );
});

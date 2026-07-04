/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/switch.contract.json (ds.switch v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { LabelHTMLAttributes } from 'react';
import styles from './Switch.module.css';

export interface SwitchProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** On or off — drives the track color and thumb position. */
  value?: 'off' | 'on';
  /** Always rendered — users must know what they are toggling. */
  label: string;
  /** Secondary text below the label. */
  description?: string;
}

/** Toggle for on/off settings that take effect immediately. API mirrors industry convention (Astryx Switch) with the boolean value flattened to an off/on enum so both surfaces render both states truthfully; toggle behavior is a declared boundary. */
export const Switch = forwardRef<HTMLLabelElement, SwitchProps>(function Switch(
  { value = 'off', label, description = 'Takes effect immediately.', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`value-${value}`], className].filter(Boolean).join(' ');
  return (
    <label ref={ref} className={classes} {...rest}>
      <div className={styles.track}>
        {value === 'on' ? <div className={styles.spacerStart}></div> : null}
        <span className={styles.thumb}></span>
        {value === 'off' ? <div className={styles.spacerEnd}></div> : null}
      </div>
      <div className={styles.textCol}>
        <span className={styles.labelText}>{label}</span>
        <span className={styles.descriptionText}>{description}</span>
      </div>
    </label>
  );
});

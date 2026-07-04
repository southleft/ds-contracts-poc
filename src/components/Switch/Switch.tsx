/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/switch.contract.json (ds.switch v1.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef, useState } from 'react';
import type { LabelHTMLAttributes } from 'react';
import styles from './Switch.module.css';

export interface SwitchProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** On or off — drives the track color and thumb position. */
  value?: 'off' | 'on';
  /** Always rendered — users must know what they are toggling. */
  label: string;
  /** Secondary text below the label. */
  description?: string;
  /** Fires when the track is activated; uncontrolled instances flip value off/on themselves. */
  onToggle?: () => void;
}

/** Toggle for on/off settings that take effect immediately. API mirrors industry convention (Astryx Switch) with the boolean value flattened to an off/on enum so both surfaces render both states truthfully; toggle behavior is a declared boundary. */
export const Switch = forwardRef<HTMLLabelElement, SwitchProps>(function Switch(
  {
    value: valueProp,
    label,
    description = 'Takes effect immediately.',
    onToggle,
    className,
    children,
    ...rest
  },
  ref,
) {
  const [valueUncontrolled, setValueUncontrolled] = useState<'off' | 'on'>('off');
  const value = valueProp ?? valueUncontrolled;
  const handleToggle = () => {
    setValueUncontrolled(value === 'on' ? 'off' : 'on');
    onToggle?.();
  };
  const classes = [styles.root, styles[`value-${value}`], className].filter(Boolean).join(' ');
  return (
    <label ref={ref} className={classes} {...rest}>
      <button
        className={styles.track}
        role="switch"
        type="button"
        onClick={handleToggle}
        aria-checked={value === 'on'}
      >
        {value === 'on' ? <div className={styles.spacerStart}></div> : null}
        <span className={styles.thumb}></span>
        {value === 'off' ? <div className={styles.spacerEnd}></div> : null}
      </button>
      <div className={styles.textCol}>
        <span className={styles.labelText}>{label}</span>
        <span className={styles.descriptionText}>{description}</span>
      </div>
    </label>
  );
});

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/switch.contract.json (ds.switch v2.0.0)
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
  /** Fires when the input is toggled; uncontrolled instances flip value off/on themselves. */
  onToggle?: () => void;
}

/** Toggle for on/off settings that take effect immediately. API mirrors industry convention (Astryx Switch) with the boolean value flattened to an off/on enum so both surfaces render both states truthfully; toggle behavior is a declared boundary. v2.0.0 (breaking, DOM shape): the control is a NATIVE input[type=checkbox] with role=switch (the modern switch pattern) inside the wrapping label — checked is DOM state, not ARIA on a button; track and thumb are presentational. */
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
      <span className={styles.track}>
        <input
          className={styles.input}
          type="checkbox"
          role="switch"
          checked={value === 'on'}
          onChange={handleToggle}
        ></input>
        {value === 'on' ? <div className={styles.spacerStart}></div> : null}
        <span className={styles.thumb}></span>
        {value === 'off' ? <div className={styles.spacerEnd}></div> : null}
      </span>
      <div className={styles.textCol}>
        <span className={styles.labelText}>{label}</span>
        <span className={styles.descriptionText}>{description}</span>
      </div>
    </label>
  );
});

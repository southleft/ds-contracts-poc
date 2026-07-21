/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/switch.contract.json (astryx.switch v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Switch.module.css';

export interface SwitchProps extends HTMLAttributes<HTMLDivElement> {
  /** The switch label. */
  label: string;
  /** Where the label sits relative to the track. */
  labelPosition?: 'start' | 'end';
  /** Whether the switch is disabled. */
  isDisabled?: boolean;
  /** Whether the switch is required. */
  isRequired?: boolean;
}

/** Astryx Switch — promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/Switch/Switch.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). label + labelPosition + labelSpacing and the disabled/optional/required flags are verbatim; value, description, htmlName, labelTooltip, disabledMessage and isLoading are dropped. STRUCTURAL: the track renders as a styled box, not a native role=switch input. CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2). */
export const Switch = forwardRef<HTMLDivElement, SwitchProps>(function Switch(
  {
    labelPosition = 'end',
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
      data-is-disabled={isDisabled || undefined}
      data-is-required={isRequired || undefined}
      {...rest}
    >
      <span className={styles.track}></span>
      <span className={styles.label}>{label}</span>
    </div>
  );
});

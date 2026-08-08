/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/atoms-checkbox.contract.json (ds.atoms-checkbox v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { IconsCheckbox } from '../IconsCheckbox';
import { InlineHint } from '../InlineHint';
import styles from './AtomsCheckbox.module.css';

export interface AtomsCheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  isChecked?: boolean;
  isDisabled?: boolean;
  label?: string;
  hasHint?: boolean;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const AtomsCheckbox = forwardRef<HTMLInputElement, AtomsCheckboxProps>(
  function AtomsCheckbox(
    {
      isChecked = false,
      isDisabled = false,
      hasHint = true,
      label = 'Label',
      className,
      children,
      ...rest
    },
    ref,
  ) {
    const classes = [styles.root, className].filter(Boolean).join(' ');
    return (
      <input
        ref={ref}
        className={classes}
        data-is-checked={isChecked || undefined}
        data-is-disabled={isDisabled || undefined}
        data-has-hint={hasHint || undefined}
        {...rest}
      >
        <IconsCheckbox state="unselected" />
        <div className={styles.content}>
          <span className={styles.Label}>{label}</span>
          {hasHint ? <InlineHint supportingText="Hint text" /> : null}
        </div>
      </input>
    );
  },
);

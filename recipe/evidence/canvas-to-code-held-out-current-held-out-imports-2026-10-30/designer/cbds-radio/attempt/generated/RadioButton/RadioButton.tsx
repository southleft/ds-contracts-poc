/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/radio-button.contract.json (ds.radio-button v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLDivElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { SelectedFalseSizeLargeStateDefaultErrorTrue } from '../SelectedFalseSizeLargeStateDefaultErrorTrue';
import { SizeXsmall } from '../SizeXsmall';
import { SelectedFalseSizeLargeStateDefaultErrorFalse } from '../SelectedFalseSizeLargeStateDefaultErrorFalse';
import styles from './RadioButton.module.css';

export interface RadioButtonProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  alignment?: 'left' | 'right';
  size?: 'large' | 'small';
  state?: 'default' | 'error' | 'disabled' | 'hover' | 'focus';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const RadioButton = forwardRef<HTMLDivElement, RadioButtonProps>(function RadioButton(
  { alignment = 'left', size = 'large', state = 'default', className, ...rest },
  ref,
) {
  const classes = [
    styles.root,
    styles[`alignment-${alignment}`],
    styles[`size-${size}`],
    styles[`state-${state}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      {state === 'error' ? (
        <div className={styles.contentTop}>
          {state === 'error' ? (
            <SelectedFalseSizeLargeStateDefaultErrorTrue
              error
              size={size}
              state="default"
              className={styles.radioButtonIcon}
            />
          ) : null}
          {state === 'error' ? <span className={styles.radioLabel}>Radio label</span> : null}
        </div>
      ) : null}
      {state === 'error' ? (
        <div className={styles.errorText}>
          {state === 'error' ? <SizeXsmall iconSwap="184:89713" size="xsmall" /> : null}
          {state === 'error' ? <span className={styles.errorText2}>error text</span> : null}
        </div>
      ) : null}
      {state === 'default' || state === 'disabled' || state === 'hover' || state === 'focus' ? (
        <SelectedFalseSizeLargeStateDefaultErrorFalse
          size={size}
          state={state}
          className={styles.radioButtonIcon2}
        />
      ) : null}
      {state === 'default' || state === 'disabled' || state === 'hover' || state === 'focus' ? (
        <span className={styles.radioLabel2}>Radio label</span>
      ) : null}
    </div>
  );
});

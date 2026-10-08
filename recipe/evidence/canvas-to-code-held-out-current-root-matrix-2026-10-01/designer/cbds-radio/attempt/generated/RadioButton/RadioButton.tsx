/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/radio-button.contract.json (ds.radio-button v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from ButtonHTMLAttributes<HTMLButtonElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { SelectedFalseSizeLargeStateDefaultErrorFalse } from '../SelectedFalseSizeLargeStateDefaultErrorFalse';
import { SizeXsmall } from '../SizeXsmall';
import styles from './RadioButton.module.css';

export interface RadioButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  alignment?: 'left' | 'right';
  size?: 'large' | 'small';
  state?: 'default' | 'error' | 'disabled' | 'hover' | 'focus';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const RadioButton = forwardRef<HTMLButtonElement, RadioButtonProps>(function RadioButton(
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
    <button ref={ref} className={classes} {...rest}>
      <div className={styles.contentTop}>
        <SelectedFalseSizeLargeStateDefaultErrorFalse
          error={
            state === 'default'
              ? false
              : state === 'error'
                ? true
                : state === 'disabled'
                  ? false
                  : state === 'hover'
                    ? false
                    : state === 'focus'
                      ? false
                      : undefined
          }
          size={size}
          state={
            state === 'default'
              ? 'default'
              : state === 'error'
                ? 'default'
                : state === 'disabled'
                  ? 'disabled'
                  : state === 'hover'
                    ? 'hover'
                    : state === 'focus'
                      ? 'focus'
                      : undefined
          }
        />
        <span className={styles.radioLabel}>Radio label</span>
      </div>
      {state === 'error' ? (
        <div className={styles.errorText}>
          {state === 'error' ? <SizeXsmall iconSwap="184:89713" size="xsmall" /> : null}
          {state === 'error' ? <span className={styles.errorText2}>error text</span> : null}
        </div>
      ) : null}
    </button>
  );
});

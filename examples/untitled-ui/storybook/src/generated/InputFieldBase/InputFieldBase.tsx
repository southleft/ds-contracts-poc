/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/input-field-base.contract.json (ds.input-field-base v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { ChevronDown } from '../ChevronDown';
import { PaymentMethodIcon } from '../PaymentMethodIcon';
import { Mail } from '../Mail';
import styles from './InputFieldBase.module.css';

export interface InputFieldBaseProps extends HTMLAttributes<HTMLDivElement> {
  type?: 'default' | 'paymentInput' | 'leadingDropdown' | 'leadingText' | 'trailingDropdown';
  destructive?: boolean;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const InputFieldBase = forwardRef<HTMLDivElement, InputFieldBaseProps>(
  function InputFieldBase(
    { type = 'default', destructive = false, className, children, ...rest },
    ref,
  ) {
    const classes = [styles.root, styles[`type-${type}`], className].filter(Boolean).join(' ');
    return (
      <div ref={ref} className={classes} data-destructive={destructive || undefined} {...rest}>
        <div className={styles.inputWithLabel}>
          <span className={styles.Label}>
            {type === 'paymentInput'
              ? 'Card number'
              : type === 'leadingDropdown'
                ? 'Phone number'
                : type === 'leadingText'
                  ? 'Website'
                  : type === 'trailingDropdown'
                    ? 'Sale amount'
                    : 'Email'}
          </span>
          <div className={styles.Input}>
            {type === 'leadingText' ? (
              <div className={styles.addOn}>
                {type === 'leadingText' ? <span className={styles.Text}>http://</span> : null}
              </div>
            ) : null}
            {type === 'leadingDropdown' || type === 'trailingDropdown' ? (
              <div className={styles.Dropdown}>
                {type === 'leadingDropdown' || type === 'trailingDropdown' ? (
                  <span className={styles.dropdownText}>
                    {type === 'trailingDropdown' ? 'USD' : 'US'}
                  </span>
                ) : null}
                {type === 'leadingDropdown' || type === 'trailingDropdown' ? (
                  <span className={styles.chevronDown}>
                    <ChevronDown />
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className={styles.Content}>
              {type === 'paymentInput' ? (
                <PaymentMethodIcon size="sm" paymentMethod="mastercard" />
              ) : null}
              {type === 'default' ? (
                <span className={styles.mail}>
                  <Mail />
                </span>
              ) : null}
              <div className={styles.textInput}>
                {type === 'trailingDropdown' ? <span className={styles.leadingText}>$</span> : null}
                <span className={styles.textInputText}>
                  {type === 'paymentInput'
                    ? 'Card number'
                    : type === 'leadingDropdown'
                      ? '+1 (555) 000-0000'
                      : type === 'leadingText'
                        ? 'www.untitledui.com'
                        : type === 'trailingDropdown'
                          ? '1,000.00'
                          : 'olivia@untitledui.com'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <span className={styles.hintText}>This is a hint text to help user.</span>
      </div>
    );
  },
);

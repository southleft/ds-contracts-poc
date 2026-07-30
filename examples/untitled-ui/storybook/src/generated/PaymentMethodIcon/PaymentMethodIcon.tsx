/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/payment-method-icon.contract.json (ds.payment-method-icon v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './PaymentMethodIcon.module.css';

export interface PaymentMethodIconProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'sm';
  paymentMethod?: 'mastercard';
}

/** STUB contract auto-proposed for the nested "Payment method icon" instances of _Input field base — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const PaymentMethodIcon = forwardRef<HTMLSpanElement, PaymentMethodIconProps>(
  function PaymentMethodIcon(
    { size = 'sm', paymentMethod = 'mastercard', className, children, ...rest },
    ref,
  ) {
    const classes = [
      styles.root,
      styles[`size-${size}`],
      styles[`paymentMethod-${paymentMethod}`],
      className,
    ]
      .filter(Boolean)
      .join(' ');
    return <span ref={ref} className={classes} {...rest}></span>;
  },
);

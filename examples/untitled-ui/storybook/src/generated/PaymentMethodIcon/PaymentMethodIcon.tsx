/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/payment-method-icon.contract.json (ds.payment-method-icon v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './PaymentMethodIcon.module.css';

const ICONS: Record<string, string> = {
  'payment-method-icon':
    '<svg width="100%" height="100%" viewBox="0 0 34 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n<rect x="0.5" y="0.5" width="33" height="23" rx="3.5" fill="white"/>\n<rect x="0.5" y="0.5" width="33" height="23" rx="3.5" stroke="#E5E5E5"/>\n<path d="M21.5771 5.02997C25.322 5.02997 28.3584 8.02986 28.3584 11.7302C28.3583 15.4304 25.322 18.4304 21.5771 18.4304C19.8982 18.4303 18.3629 17.8256 17.1787 16.8268C15.9945 17.8254 14.4591 18.4304 12.7803 18.4304C9.03566 18.4301 6.00011 15.4302 6 11.7302C6 8.02999 9.03559 5.03019 12.7803 5.02997C14.459 5.02997 15.9945 5.63405 17.1787 6.63251C18.3628 5.63388 19.8984 5.03007 21.5771 5.02997Z" fill="#ED0006"/>\n<path d="M21.5771 5.02997C25.322 5.02997 28.3584 8.02986 28.3584 11.7302C28.3583 15.4304 25.322 18.4304 21.5771 18.4304C19.8985 18.4303 18.3638 17.8253 17.1797 16.8268C18.6369 15.598 19.5624 13.7715 19.5625 11.7302C19.5625 9.6886 18.6371 7.86141 17.1797 6.63251C18.3637 5.63417 19.8986 5.03007 21.5771 5.02997Z" fill="#F9A000"/>\n<path fill-rule="evenodd" clip-rule="evenodd" d="M17.1787 6.63251C18.6362 7.86141 19.5615 9.6886 19.5615 11.7302C19.5615 13.7715 18.636 15.598 17.1787 16.8268C15.7217 15.598 14.7969 13.7713 14.7969 11.7302C14.7969 9.68882 15.7215 7.8614 17.1787 6.63251Z" fill="#FF5E00"/>\n</svg>',
};

export interface PaymentMethodIconProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'sm';
  paymentMethod?: 'mastercard';
}

/** STUB contract auto-proposed for the nested "Payment method icon" instances of _Input field base — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry; the root renders the source component's exported vector glyph (SVG, iteration 8) in place of witness paints. Import the child set to replace this stub. */
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
    return (
      <span ref={ref} className={classes} {...rest}>
        <span
          className={styles.glyph}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: ICONS['payment-method-icon'] }}
        />
      </span>
    );
  },
);

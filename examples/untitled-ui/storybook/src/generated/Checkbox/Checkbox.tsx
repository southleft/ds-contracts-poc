/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/checkbox.contract.json (ds.checkbox v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends HTMLAttributes<HTMLSpanElement> {
  checked?: 'false';
  indeterminate?: 'false';
  size?: 'sm';
  type?: 'checkbox';
  text?: 'false';
  supportingText?: 'false';
  state?: 'default';
}

/** STUB contract auto-proposed for the nested "Checkbox" instances of _Dropdown list item — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const Checkbox = forwardRef<HTMLSpanElement, CheckboxProps>(function Checkbox(
  {
    checked = 'false',
    indeterminate = 'false',
    size = 'sm',
    type = 'checkbox',
    text = 'false',
    supportingText = 'false',
    state = 'default',
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [
    styles.root,
    styles[`checked-${checked}`],
    styles[`indeterminate-${indeterminate}`],
    styles[`size-${size}`],
    styles[`type-${type}`],
    styles[`text-${text}`],
    styles[`supportingText-${supportingText}`],
    styles[`state-${state}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <span ref={ref} className={classes} {...rest}></span>;
});

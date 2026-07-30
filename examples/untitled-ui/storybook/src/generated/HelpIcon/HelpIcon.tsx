/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/help-icon.contract.json (ds.help-icon v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './HelpIcon.module.css';

export interface HelpIconProps extends HTMLAttributes<HTMLSpanElement> {
  open?: 'false';
  supportingText?: 'false';
  tooltip?: 'topArrow';
}

/** STUB contract auto-proposed for the nested "Help icon" instances of _Input field base — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const HelpIcon = forwardRef<HTMLSpanElement, HelpIconProps>(function HelpIcon(
  { open = 'false', supportingText = 'false', tooltip = 'topArrow', className, children, ...rest },
  ref,
) {
  const classes = [
    styles.root,
    styles[`open-${open}`],
    styles[`supportingText-${supportingText}`],
    styles[`tooltip-${tooltip}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <span ref={ref} className={classes} {...rest}></span>;
});

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/social-icon.contract.json (ds.social-icon v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './SocialIcon.module.css';

export interface SocialIconProps extends HTMLAttributes<HTMLSpanElement> {
  platform?: 'facebook' | 'google' | 'apple' | 'figma' | 'dribbble' | 'xtwitter';
  state?: 'default';
  style?: 'white' | 'brand';
}

/** STUB contract auto-proposed for the nested "Social icon" instances of Social button — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const SocialIcon = forwardRef<HTMLSpanElement, SocialIconProps>(function SocialIcon(
  { platform = 'facebook', state = 'default', style = 'white', className, children, ...rest },
  ref,
) {
  const classes = [
    styles.root,
    styles[`platform-${platform}`],
    styles[`state-${state}`],
    styles[`style-${style}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <span ref={ref} className={classes} {...rest}></span>;
});

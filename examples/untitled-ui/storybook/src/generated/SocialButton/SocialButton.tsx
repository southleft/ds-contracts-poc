/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/social-button.contract.json (ds.social-button v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { SocialIcon } from '../SocialIcon';
import styles from './SocialButton.module.css';

export interface SocialButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  social?: 'facebook' | 'google' | 'apple' | 'figma' | 'dribbble' | 'x';
  supportingText?: boolean;
  theme?: 'brand' | 'colorWithBrand' | 'color';
  state?: 'default' | 'hover' | 'focused';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const SocialButton = forwardRef<HTMLButtonElement, SocialButtonProps>(function SocialButton(
  {
    social = 'facebook',
    theme = 'brand',
    state = 'default',
    supportingText = true,
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [
    styles.root,
    styles[`social-${social}`],
    styles[`theme-${theme}`],
    styles[`state-${state}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      ref={ref}
      className={classes}
      data-supporting-text={supportingText || undefined}
      {...rest}
    >
      <span className={styles.socialIcon}>
        <SocialIcon
          platform={
            social === 'facebook'
              ? 'facebook'
              : social === 'google'
                ? 'google'
                : social === 'apple'
                  ? 'apple'
                  : social === 'figma'
                    ? 'figma'
                    : social === 'dribbble'
                      ? 'dribbble'
                      : social === 'x'
                        ? 'xtwitter'
                        : undefined
          }
          state="default"
          style="white"
        />
      </span>
      {supportingText ? (
        <span className={styles.Text}>
          {social === 'google'
            ? 'Sign in with Google'
            : social === 'apple'
              ? 'Sign in with Apple'
              : social === 'figma'
                ? 'Sign in with Figma'
                : social === 'dribbble'
                  ? 'Sign in with Dribbble'
                  : social === 'x'
                    ? 'Sign in with X'
                    : 'Sign in with Facebook'}
        </span>
      ) : null}
    </button>
  );
});

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (ds.button v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from ButtonHTMLAttributes<HTMLButtonElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { Icon } from '../Icon';
import styles from './Button.module.css';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: 'primary' | 'bare' | 'neutral' | 'secondary' | 'tertiary';
  size?: 'md' | 'sm' | 'lg';
  shape?: 'default' | 'pill';
  text?: string;
  slotBefore?: boolean;
  slotAfter?: boolean;
  disabled?: boolean;
}

/** The system's action control. It renders a real `<button>` — or an `<a role="button">` when `href` is set — so the element the user actually gets, and the keyboard behaviour that comes with it, follows the props rather than the styling. Everything else about a button is ranking: `variant` says how much weight this action carries against the others on screen.

Tag: al-button

Props
- isDisabled: boolean — Disabled attribute
- isPill: boolean — Pill shape
- label — Indicates the aria label to apply to the button.
- size: sm | lg — Size variant
  - omitted: renders the default 40px control with 14px text
- variant: neutral | bare | secondary | tertiary — Style variant — an EMPHASIS axis, strongest to weakest.
  - default: renders the primary button, the strongest emphasis

Slots
- (default) — The button text content.
- after — Content to display after the button text, typically an icon.
- before — Content to display before the button text, typically an icon.

Accessibility
- element: <button>

Docs: https://altitude.pages.dev/docs/components/button/
 * @see https://altitude.pages.dev/docs/components/button/ */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    shape = 'default',
    slotBefore = false,
    slotAfter = false,
    disabled = false,
    text = 'Button',
    className,
    ...rest
  },
  ref,
) {
  const classes = [
    styles.root,
    styles[`variant-${variant}`],
    styles[`size-${size}`],
    styles[`shape-${shape}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      ref={ref}
      className={classes}
      disabled={disabled}
      data-slot-before={slotBefore || undefined}
      data-slot-after={slotAfter || undefined}
      {...rest}
    >
      {slotBefore ? <Icon /> : null}
      <span className={styles.Button}>{text}</span>
      {slotAfter ? <Icon /> : null}
    </button>
  );
});

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/icon-button.contract.json (ds.icon-button v1.0.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from ButtonHTMLAttributes<HTMLButtonElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './IconButton.module.css';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Visual style. Ghost sits on the surface wash (transparent tokens are a documented gap). */
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  /** Square control size. */
  size?: 'sm' | 'md' | 'lg';
  /** Disables the button. */
  isDisabled?: boolean;
  /** Accessible name (aria-label). Be specific: "Delete conversation", not "Delete". */
  label: string;
  /** The icon. Pass an Icon-sized element; it inherits the variant's foreground color. */
  icon?: ReactNode;
}

/** A button showing only an icon, for toolbars, table rows, and compact UI. API mirrors industry convention (Astryx IconButton): the required label is the accessible name and is never rendered visibly. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'secondary', size = 'md', isDisabled = false, label, icon, className, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], styles[`size-${size}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      ref={ref}
      className={classes}
      data-is-disabled={isDisabled || undefined}
      aria-label={label}
      type="button"
      {...rest}
    >
      <div className={styles.iconSlot}>{icon}</div>
    </button>
  );
});

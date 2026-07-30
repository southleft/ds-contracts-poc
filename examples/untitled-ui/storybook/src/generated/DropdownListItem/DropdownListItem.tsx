/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/dropdown-list-item.contract.json (ds.dropdown-list-item v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { Checkbox } from '../Checkbox';
import { Circle } from '../Circle';
import styles from './DropdownListItem.module.css';

export interface DropdownListItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: boolean;
  checkbox?: boolean;
  shortcut?: boolean;
  disabled?: boolean;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const DropdownListItem = forwardRef<HTMLButtonElement, DropdownListItemProps>(
  function DropdownListItem(
    {
      icon = true,
      checkbox = false,
      shortcut = false,
      disabled = false,
      className,
      children,
      ...rest
    },
    ref,
  ) {
    const classes = [styles.root, className].filter(Boolean).join(' ');
    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled}
        data-icon={icon || undefined}
        data-checkbox={checkbox || undefined}
        data-shortcut={shortcut || undefined}
        {...rest}
      >
        <div className={styles.Content}>
          {checkbox ? (
            <Checkbox
              checked="false"
              indeterminate="false"
              size="sm"
              type="checkbox"
              text="false"
              supportingText="false"
              state="default"
            />
          ) : null}
          {icon ? <Circle /> : null}
          <span className={styles.Text}>List item</span>
        </div>
        {shortcut ? <span className={styles.Shortcut}>⌘C</span> : null}
      </button>
    );
  },
);

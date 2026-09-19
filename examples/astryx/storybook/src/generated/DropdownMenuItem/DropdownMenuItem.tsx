/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/dropdown-menu-item.contract.json (astryx.dropdown-menu-item v0.2.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from ButtonHTMLAttributes<HTMLButtonElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from './DropdownMenuItem.module.css';

export interface DropdownMenuItemProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  /** The menu item's label text. */
  label?: string;
  /** Whether the item is disabled. */
  isDisabled?: boolean;
}

/** PROMOTED from the Phase B composition-tier extraction (round 2, StyleX anatomy). One menu row — the repeated item of astryx.dropdown-menu. Curation receipts: the extracted anatomy leaned on the internal <Item> layout component (astryx.item); promotion FLATTENS it to the element row Item renders (a deep-internal contract is not part of the exhibit set), keeping the extracted StyleX token bindings verbatim. The extracted `description`/`endContent`/icon channels are deferred to a later round — this exhibit carries the label row, the composition proof's moving part. */
export const DropdownMenuItem = forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
  function DropdownMenuItem({ isDisabled = false, label = 'Menu item', className, ...rest }, ref) {
    const classes = [styles.root, className].filter(Boolean).join(' ');
    return (
      <button
        ref={ref}
        className={classes}
        data-is-disabled={isDisabled || undefined}
        role="menuitem"
        {...rest}
      >
        <span className={styles.label}>{label}</span>
      </button>
    );
  },
);

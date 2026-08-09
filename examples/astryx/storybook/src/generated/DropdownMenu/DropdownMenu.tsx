/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/dropdown-menu.contract.json (astryx.dropdown-menu v0.2.0)
 * Regenerate with: npm run generate
 *
 * MULTI-ROOT composite — the anatomy declares 2 top-level roots
 * (trigger, menu). They render as SIBLINGS in a
 * Fragment; there is no single wrapping element (a Modal's backdrop + dialog
 * are position-driven siblings). Each root's class is styles.<rootName>.
 */
import type { HTMLAttributes } from 'react';
import { Button } from '../Button';
import { DropdownMenuItem } from '../DropdownMenuItem';
import styles from './DropdownMenu.module.css';

export interface DropdownMenuProps extends HTMLAttributes<HTMLDivElement> {
  /** The menu's item records — one astryx.dropdown-menu-item per record (the extracted repeat channel). */
  items?: Array<{ label: string }>;
  /** Whether the trigger shows the dropdown chevron (extracted, default true). */
  hasChevron?: boolean;
}

/** PROMOTED from the Phase B composition-tier extraction (round 2) — the flagship composition exhibit: a MULTI-ROOT component (trigger + menu overlay) whose menu holds a REPEATED astryx.dropdown-menu-item collection over the `items` prop. The extraction recovered exactly this shape from Meta's source (fragment root → trigger Button ref + popover.render overlay carrying the items repeat AND the children slot). Curation receipts: (1) the DUAL MODE — items-array XOR compound children — is mutually exclusive in code; the contract carries the DATA mode (repeat), the canvas-projectable one; (2) the DropdownMenuContext provider ref was dropped (context is a code mechanism, not anatomy); (3) the popover overlay projects as a sibling root below the trigger — live placement/anchoring is a design-tool behavior outside the contract (same convention as the composite Modal's roots); (4) the repeat sample is authored (design-time values are not decidable from code — the extractor said so by name). */
export function DropdownMenu({
  hasChevron = true,
  items,
  className,
  children,
  ...rest
}: DropdownMenuProps) {
  return (
    <>
      <Button label="Options" />
      <div className={styles.menu} role="menu">
        {items?.map((item, index) => (
          <DropdownMenuItem key={index} label={item.label} />
        ))}
      </div>
    </>
  );
}

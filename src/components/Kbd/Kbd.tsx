/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/kbd.contract.json (ds.kbd v1.0.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Kbd.module.css';

export interface KbdProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** The shortcut text, e.g. "⌘K". */
  keys: string;
}

/** Renders a keyboard shortcut as a styled key badge for tooltips, menus, and help text. API mirrors industry convention (Astryx Kbd); multi-key parsing ("mod+K" into separate badges) is display logic — a documented gap, one badge per component for now. */
export const Kbd = forwardRef<HTMLElement, KbdProps>(function Kbd(
  { keys, className, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <kbd ref={ref} className={classes} {...rest}>
      <span className={styles.keysText}>{keys}</span>
    </kbd>
  );
});

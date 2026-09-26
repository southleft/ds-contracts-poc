/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/toggle.contract.json (ds.toggle v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLDivElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { SwitchOnFalseSizeLargeStateDefault } from '../SwitchOnFalseSizeLargeStateDefault';
import styles from './Toggle.module.css';

export interface ToggleProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  alignment?: 'left' | 'right';
  size?: 'large' | 'small';
  disabled?: boolean;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const Toggle = forwardRef<HTMLDivElement, ToggleProps>(function Toggle(
  { alignment = 'left', size = 'large', disabled = false, className, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`alignment-${alignment}`], styles[`size-${size}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} data-disabled={disabled || undefined} {...rest}>
      <SwitchOnFalseSizeLargeStateDefault size={size} state="default" />
      <span className={styles.toggleLabel}>Toggle label</span>
    </div>
  );
});

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/chip.contract.json (ds.chip v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from ButtonHTMLAttributes<HTMLButtonElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { Icon } from '../Icon';
import styles from './Chip.module.css';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: 'bare' | 'primary' | 'tertiary' | 'secondary' | 'neutral';
  dismissible?: 'no' | 'yes';
  shape?: 'default' | 'squared';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { variant = 'bare', dismissible = 'no', shape = 'default', className, ...rest },
  ref,
) {
  // axis-inert (ledgered, not a throw): dismissible, shape — no `.<axis>-*` rule
  // exists in Chip.module.css, so no class is composed for them. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever these axes carry rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, styles[`variant-${variant}`], className].filter(Boolean).join(' ');
  return (
    <button ref={ref} className={classes} {...rest}>
      <span className={styles.Label}>Chip</span>
      {dismissible === 'yes' ? <Icon icon="3610:1645" /> : null}
    </button>
  );
});

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
  /** Shows one drawn interaction state without the pointer or keyboard, as a
   *  composing parent's design selects it (docs/23 §D.164). The live states still run. */
  statePreview?: 'focus-visible';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { variant = 'bare', dismissible = 'no', shape = 'default', statePreview, className, ...rest },
  ref,
) {
  // axis-inert (ledgered, not a throw): dismissible — no `.<axis>-*` rule
  // exists in Chip.module.css, so no class is composed for it. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever this axis carries rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, styles[`variant-${variant}`], styles[`shape-${shape}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} className={classes} data-state-preview={statePreview} {...rest}>
      <span className={styles.Label}>Chip</span>
      {dismissible === 'yes' ? <Icon icon="3610:1645" /> : null}
    </button>
  );
});

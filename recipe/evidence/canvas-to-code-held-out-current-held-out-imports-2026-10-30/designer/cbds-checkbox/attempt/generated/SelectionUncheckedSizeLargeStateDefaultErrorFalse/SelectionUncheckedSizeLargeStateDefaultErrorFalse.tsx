/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/selection-unchecked-size-large-state-default-error-false.contract.json (ds.selection-unchecked-size-large-state-default-error-false v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLSpanElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './SelectionUncheckedSizeLargeStateDefaultErrorFalse.module.css';

export interface SelectionUncheckedSizeLargeStateDefaultErrorFalseProps extends Omit<
  HTMLAttributes<HTMLSpanElement>,
  'children'
> {
  error?: boolean;
  selection?: 'unchecked';
  size?: 'large' | 'small';
  state?: 'default' | 'disabled' | 'hover' | 'focus';
}

/** STUB contract auto-proposed for the nested "selection=unchecked, size=large, state=default, error=false" instances of Checkbox — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const SelectionUncheckedSizeLargeStateDefaultErrorFalse = forwardRef<
  HTMLSpanElement,
  SelectionUncheckedSizeLargeStateDefaultErrorFalseProps
>(function SelectionUncheckedSizeLargeStateDefaultErrorFalse(
  { selection = 'unchecked', size = 'large', state = 'default', error = false, className, ...rest },
  ref,
) {
  // axis-inert (ledgered, not a throw): selection, state — no `.<axis>-*` rule
  // exists in SelectionUncheckedSizeLargeStateDefaultErrorFalse.module.css, so no class is composed for them. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever these axes carry rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return <span ref={ref} className={classes} data-error={error || undefined} {...rest}></span>;
});

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/state-default-selected-no-role-item.contract.json (ds.state-default-selected-no-role-item v0.1.0)
 * Regenerate with: npm run generate
 *
 * DOM attrs OMITTED from HTMLAttributes<HTMLSpanElement> — the contract's own props claim these
 * names, so the HTML attribute of the same name cannot be passed through ...rest:
 *   role
 *
 * `children` OMITTED from HTMLAttributes<HTMLSpanElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './StateDefaultSelectedNoRoleItem.module.css';

export interface StateDefaultSelectedNoRoleItemProps extends Omit<
  HTMLAttributes<HTMLSpanElement>,
  'children' | 'role'
> {
  role?: 'item';
  selected?: 'no';
  state?: 'default';
  text?: string;
}

/** STUB contract auto-proposed for the nested "State=Default, Selected=No, Role=Item" instances of Menu — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const StateDefaultSelectedNoRoleItem = forwardRef<
  HTMLSpanElement,
  StateDefaultSelectedNoRoleItemProps
>(function StateDefaultSelectedNoRoleItem(
  { role = 'item', selected = 'no', state = 'default', text = 'Menu item', className, ...rest },
  ref,
) {
  // axis-inert (ledgered, not a throw): role, selected, state — no `.<axis>-*` rule
  // exists in StateDefaultSelectedNoRoleItem.module.css, so no class is composed for them. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever these axes carry rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} {...rest}>
      <span className={styles.text}>{text}</span>
    </span>
  );
});

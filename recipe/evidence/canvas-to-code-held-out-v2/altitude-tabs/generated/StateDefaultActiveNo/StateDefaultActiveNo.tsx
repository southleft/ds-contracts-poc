/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/state-default-active-no.contract.json (ds.state-default-active-no v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './StateDefaultActiveNo.module.css';

export interface StateDefaultActiveNoProps extends HTMLAttributes<HTMLSpanElement> {
  active?: 'no';
  state?: 'default';
  text?: string;
}

/** STUB contract auto-proposed for the nested "State=Default, Active=No" instances of Tabs — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const StateDefaultActiveNo = forwardRef<HTMLSpanElement, StateDefaultActiveNoProps>(
  function StateDefaultActiveNo(
    { active = 'no', state = 'default', text = 'Tab label', className, children, ...rest },
    ref,
  ) {
    // axis-inert (ledgered, not a throw): active, state — no `.<axis>-*` rule
    // exists in StateDefaultActiveNo.module.css, so no class is composed for them. A reference
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
  },
);

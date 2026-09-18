/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tab-2.contract.json (ds.tab-2 v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Tab.module.css';

export interface TabProps extends HTMLAttributes<HTMLSpanElement> {
  text?: string;
  state?: 'default';
  active?: 'yes' | 'no';
}

/** STUB contract auto-proposed for the nested "Tab" instances of Tabs — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const Tab = forwardRef<HTMLSpanElement, TabProps>(function Tab(
  { state = 'default', active = 'yes', text = 'Tab label', className, children, ...rest },
  ref,
) {
  // axis-inert (ledgered, not a throw): state — no `.<axis>-*` rule
  // exists in Tab.module.css, so no class is composed for it. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever this axis carries rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, styles[`active-${active}`], className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} {...rest}>
      <span className={styles.text}>{text}</span>
    </span>
  );
});

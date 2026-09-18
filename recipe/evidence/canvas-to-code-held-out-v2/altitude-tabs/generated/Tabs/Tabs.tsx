/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tabs.contract.json (ds.tabs v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLDivElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { StateDefaultActiveYes } from '../StateDefaultActiveYes';
import { StateDefaultActiveNo } from '../StateDefaultActiveNo';
import { StateDefault } from '../StateDefault';
import styles from './Tabs.module.css';

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  variant?: 'default' | 'stretch';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const Tabs = forwardRef<HTMLDivElement, TabsProps>(function Tabs(
  { variant = 'default', className, ...rest },
  ref,
) {
  // axis-inert (ledgered, not a throw): variant — no `.<axis>-*` rule
  // exists in Tabs.module.css, so no class is composed for it. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever this axis carries rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles.alCTabsHeader}>
        <div className={styles.alCTabsList}>
          <StateDefaultActiveYes active="yes" state="default" text="Tab label" />
          <StateDefaultActiveNo active="no" state="default" text="Tab label" />
          <StateDefaultActiveNo active="no" state="default" text="Tab label" />
        </div>
      </div>
      <div className={styles.alCTabsBody}>
        <StateDefault state="default" />
      </div>
    </div>
  );
});

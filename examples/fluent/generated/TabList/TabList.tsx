/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tab-list.contract.json (fluent.tab-list v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './TabList.module.css';

export interface TabListProps extends HTMLAttributes<HTMLDivElement> {
  appearance?: 'transparent' | 'subtle' | 'subtle-circular' | 'filled-circular';
  size?: 'small' | 'medium' | 'large';
  /** Fluent's library prop is `vertical: boolean` (@default false). propSpaceFor refuses a BOOLEAN axis by name ("booleans ride stateProps"), and the presence-prop spelling would push every per-plane token binding into overflow by rule ("presence-prop-driven styling — boolean tokensByProp has no spelling"). Spelled as a 2-value enum axis mapped through axisValueMap to {vertical:false} / {vertical:true}: the library prop mounted is unchanged, the token names survive, and the canvas gets an Orientation variant property. */
  orientation?: 'horizontal' | 'vertical';
}

/** SEED contract for the FLUENT 2 round — props/axes only; anatomy is promoted from captured DOM truth. Subject: @fluentui/react-components@9.74.5 (Griffel CSS-in-JS; 65-package family pinned by the committed lockfile sha256 c3b230dfbd8abd68408fefed9c8abc0e0fd46722faf8652e16e5c038452e0536 — examples/fluent/RECON.md §1). EVERY enum default below is HAND-TRANSCRIBED from the package rollup's own @default/@defaultvalue JSDoc tag: the react-tsx extractor keeps the description prose but emits no `default` field (RECON §3a), so left to the drafter two of twelve components would have captured their whole grid around a base combo the library never renders. @default tags: appearance=transparent, size=medium, vertical=false, reserveSelectedTabSpace=true (pinned), selectTabOnFocus=false (pinned). Controlled selectedValue="tab-1" + onTabSelect stub — the Carbon TabList double-run lesson, and Fluent's selectTabOnFocus makes it mandatory. Tab's own axes ride the child-axis limitation (docs/21 §7.3) — pinned, deferred by name. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @fluentui/react-components@9.74.5 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/fluent/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Fluent's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const TabList = forwardRef<HTMLDivElement, TabListProps>(function TabList(
  {
    appearance = 'transparent',
    size = 'medium',
    orientation = 'horizontal',
    className,
    children,
    ...rest
  },
  ref,
) {
  // axis-inert (ledgered, not a throw): orientation — no `.<axis>-*` rule
  // exists in TabList.module.css, so no class is composed for it. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever this axis carries rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [
    styles.root,
    styles[`appearance-${appearance}`],
    styles[`size-${size}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <button className={styles.tab}>
        <span className={styles.label}>Overview</span>
      </button>
      <button className={styles['tab-2']}>
        <span className={styles['label-2']}>Activity</span>
      </button>
    </div>
  );
});

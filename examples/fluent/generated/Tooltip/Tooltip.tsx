/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tooltip.contract.json (fluent.tooltip v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Tooltip.module.css';

export interface TooltipProps extends HTMLAttributes<HTMLDivElement> {
  appearance?: 'normal' | 'inverted';
  /** Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's `withArrow` (true); the created subtree is carried as parts gated on this prop. */
  withArrow?: boolean;
}

/** SEED contract for the FLUENT 2 round — props/axes only; anatomy is promoted from captured DOM truth. Subject: @fluentui/react-components@9.74.5 (Griffel CSS-in-JS; 65-package family pinned by the committed lockfile sha256 c3b230dfbd8abd68408fefed9c8abc0e0fd46722faf8652e16e5c038452e0536 — examples/fluent/RECON.md §1). EVERY enum default below is HAND-TRANSCRIBED from the package rollup's own @default/@defaultvalue JSDoc tag: the react-tsx extractor keeps the description prose but emits no `default` field (RECON §3a), so left to the drafter two of twelve components would have captured their whole grid around a base combo the library never renders. @default tags: appearance=normal, withArrow=false, visible=false, positioning=above. `relationship` is a REQUIRED prop (no default) pinned to "label"; `positioning` pinned to "after". `withArrow` rides the PRESENCE grammar (MUI Tooltip's exact precedent) — it is structure-creating, so the arrow subtree promotes as a visibleWhen-gated part. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @fluentui/react-components@9.74.5 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/fluent/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Fluent's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(function Tooltip(
  { appearance = 'normal', withArrow = false, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`appearance-${appearance}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} data-with-arrow={withArrow || undefined} {...rest}>
      {withArrow ? <div className={styles['part-0']}></div> : null}
    </div>
  );
});

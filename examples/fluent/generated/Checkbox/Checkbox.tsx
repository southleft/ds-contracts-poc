/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/checkbox.contract.json (fluent.checkbox v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends HTMLAttributes<HTMLDivElement> {
  checked?: 'unchecked' | 'checked' | 'mixed';
  size?: 'medium' | 'large';
  shape?: 'square' | 'circular';
}

/** SEED contract for the FLUENT 2 round — props/axes only; anatomy is promoted from captured DOM truth. Subject: @fluentui/react-components@9.74.5 (Griffel CSS-in-JS; 65-package family pinned by the committed lockfile sha256 c3b230dfbd8abd68408fefed9c8abc0e0fd46722faf8652e16e5c038452e0536 — examples/fluent/RECON.md §1). EVERY enum default below is HAND-TRANSCRIBED from the package rollup's own @default/@defaultvalue JSDoc tag: the react-tsx extractor keeps the description prose but emits no `default` field (RECON §3a), so left to the drafter two of twelve components would have captured their whole grid around a base combo the library never renders. @default tags: checked=false, size=medium, shape=square, labelPosition=after (pinned). TRI-STATE ON ONE AXIS (the MUI/Carbon discipline): Fluent accepts checked="mixed" directly, so the axisValueMap is unchecked→false, checked→true, mixed→"mixed". One axis is not cosmetic — the svg-content promotion carries per-value glyph assets only when the markup is a function of exactly ONE axis. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @fluentui/react-components@9.74.5 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/fluent/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Fluent's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Checkbox = forwardRef<HTMLDivElement, CheckboxProps>(function Checkbox(
  { checked = 'unchecked', size = 'medium', shape = 'square', className, children, ...rest },
  ref,
) {
  const classes = [
    styles.root,
    styles[`checked-${checked}`],
    styles[`size-${size}`],
    styles[`shape-${shape}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <input className={styles.input}></input>
      <div className={styles.indicator}>
        <svg className={styles.icon}>
          <path className={styles['part-1-0-0']}></path>
        </svg>
      </div>
      <label className={styles.label}>Checkbox</label>
    </div>
  );
});

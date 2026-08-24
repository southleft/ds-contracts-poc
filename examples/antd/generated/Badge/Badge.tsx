/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/badge.contract.json (antd.badge v0.2.0)
 * Regenerate with: npm run generate
 *
 * DOM attrs OMITTED from HTMLAttributes<HTMLSpanElement> — the contract's own props claim these
 * names, so the HTML attribute of the same name cannot be passed through ...rest:
 *   color
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Badge.module.css';

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  mode?: 'count' | 'dot';
  color?: 'blue' | 'green' | 'purple';
}

/** Subject: antd@5.29.3 (pinned, examples/antd/PROVENANCE.md). CURATED seed for the antd P2 exam (code→canvas, held out) — props/axes only; anatomy is promoted from captured DOM truth. Every axis value is the library's own declared enum (antd spells them as `readonly [...]` tuples; seed-gen reads them once its declaration lookup ignores directory case — W1, examples/antd/RECON.md §4). MOLECULE WRAPPER (the MUI Badge precedent): the Avatar child is mounted by the config's childrenSpec. `mode` is a synthetic 2-value axis (count|dot) that the config expands through $props into antd's two APIs (`count: 5` vs `dot: true`) — ONE axis so the per-value overlay parts stay a one-axis function. `color` is DEFAULTLESS (unset = antd's red count badge); the 3 presets are a curated slice. NAMED OUT: status mode (a different root composition), overflowCount/showZero, counts other than 5. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of antd@5.29.3 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/antd/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Ant Design's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { mode = 'count', color = 'undefined', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`mode-${mode}`], styles[`color-${color}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <span ref={ref} className={classes} {...rest}>
      <span className={styles.avatar}>
        <span className={styles.label}>A</span>
      </span>
      <sup className={styles['badge-dot']}></sup>
      <sup className={styles['badge-count']}>
        <bdi className={styles['part-1-0']}>
          <span className={styles['scroll-number-only']}>
            <span className={styles['label-2']}>5</span>
          </span>
        </bdi>
      </sup>
    </span>
  );
});

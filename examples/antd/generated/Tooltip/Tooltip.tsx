/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tooltip.contract.json (antd.tooltip v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Tooltip.module.css';

export interface TooltipProps extends HTMLAttributes<HTMLDivElement> {}

/** Subject: antd@5.29.3 (pinned, examples/antd/PROVENANCE.md). CURATED seed for the antd P2 exam (code→canvas, held out) — props/axes only; anatomy is promoted from captured DOM truth. Every axis value is the library's own declared enum (antd spells them as `readonly [...]` tuples; seed-gen reads them once its declaration lookup ignores directory case — W1, examples/antd/RECON.md §4). THE PORTAL LANE (docs/23 §B.1 + §B.2 — expected LEDGERED; the exam measures whether it is NAMED). Portal-aware capture: the popper subtree (div.ant-tooltip) is the component's rendered contribution; the Button anchor (config childWrap) is receipted, never carried. `open`, `title` and `placement: top` are pinned by the config's openDriver; placement is NOT an axis (anchored positioning is not modelled — the MUI Tooltip precedent). `getPopupContainer` takes a function the marker grammar cannot express, so the in-stage route is unreachable from config (W9) and B.1 is MEASURED, not dodged. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of antd@5.29.3 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/antd/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Ant Design's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(function Tooltip(
  { className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles['tooltip-arrow']}>
        <div className={styles['tooltip-arrow-before']}></div>
      </div>
      <div className={styles['tooltip-content']}>
        <span className={styles.label}>Tooltip text</span>
      </div>
    </div>
  );
});

/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/checkbox.contract.json (antd.checkbox v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { LabelHTMLAttributes } from 'react';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends LabelHTMLAttributes<HTMLLabelElement> {
  checked?: 'unchecked' | 'checked' | 'indeterminate';
  disabled?: boolean;
}

/** Subject: antd@5.29.3 (pinned, examples/antd/PROVENANCE.md). CURATED seed for the antd P2 exam (code→canvas, held out) — props/axes only; anatomy is promoted from captured DOM truth. Every axis value is the library's own declared enum (antd spells them as `readonly [...]` tuples; seed-gen reads them once its declaration lookup ignores directory case — W1, examples/antd/RECON.md §4). THE PSEUDO-GLYPH CASE (FC-PSEUDO-STROKE-GLYPH): the tick is `.ant-checkbox-inner::after`, a rotate(45deg)+scale+translate L-stroke. The tri-state rides ONE enum axis (unchecked|checked|indeterminate) expanded by the config through $props into antd's two booleans (`checked` + `indeterminate`) — one axis so per-value glyph carriage stays a single-axis function (the MUI Checkbox precedent). ROOT = label.ant-checkbox-wrapper: antd forwards className/data-* to the hidden INPUT, not the label (RECON S2) — the harness stamps the stage child, so the captured root is the label. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of antd@5.29.3 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/antd/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Ant Design's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Checkbox = forwardRef<HTMLLabelElement, CheckboxProps>(function Checkbox(
  { checked = 'unchecked', disabled = false, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`checked-${checked}`], className].filter(Boolean).join(' ');
  return (
    <label ref={ref} className={classes} data-disabled={disabled || undefined} {...rest}>
      <span className={styles.checkbox}>
        <input className={styles['checkbox-input']}></input>
        <span className={styles['checkbox-inner']}>
          <div className={styles['checkbox-inner-after']}></div>
        </span>
      </span>
      <span className={styles.label}>{children}</span>
    </label>
  );
});

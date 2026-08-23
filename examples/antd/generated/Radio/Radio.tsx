/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/radio.contract.json (antd.radio v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { LabelHTMLAttributes } from 'react';
import styles from './Radio.module.css';

export interface RadioProps extends LabelHTMLAttributes<HTMLLabelElement> {
  checked?: 'unchecked' | 'checked';
  disabled?: boolean;
}

/** Subject: antd@5.29.3 (pinned, examples/antd/PROVENANCE.md). CURATED seed for the antd P2 exam (code→canvas, held out) — props/axes only; anatomy is promoted from captured DOM truth. Every axis value is the library's own declared enum (antd spells them as `readonly [...]` tuples; seed-gen reads them once its declaration lookup ignores directory case — W1, examples/antd/RECON.md §4). THE PSEUDO-DOT CASE: the dot is `.ant-radio-inner::after` revealed by `transform: scale()` — the pseudo-decor v1 grammar carries translate + orthonormal rotate only, so the checked dot is expected to land REFUSED BY NAME (pseudo-decor-outside-grammar), never silent. `checked` is a variant axis (unchecked|checked), controlled with a no-op onChange. NAMED OUT: Radio.Button (dotted importName is not in the harness import grammar — W8), Radio.Group. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of antd@5.29.3 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/antd/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Ant Design's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Radio = forwardRef<HTMLLabelElement, RadioProps>(function Radio(
  { checked = 'unchecked', disabled = false, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`checked-${checked}`], className].filter(Boolean).join(' ');
  return (
    <label ref={ref} className={classes} data-disabled={disabled || undefined} {...rest}>
      <span className={styles.radio}>
        <input className={styles['radio-input']}></input>
        <span className={styles['radio-inner']}></span>
      </span>
      <span className={styles.label}>{children}</span>
    </label>
  );
});

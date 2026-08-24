/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/switch.contract.json (antd.switch v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from './Switch.module.css';

export interface SwitchProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'default' | 'small';
  checked?: 'unchecked' | 'checked';
  disabled?: boolean;
}

/** Subject: antd@5.29.3 (pinned, examples/antd/PROVENANCE.md). CURATED seed for the antd P2 exam (code→canvas, held out) — props/axes only; anatomy is promoted from captured DOM truth. Every axis value is the library's own declared enum (antd spells them as `readonly [...]` tuples; seed-gen reads them once its declaration lookup ignores directory case — W1, examples/antd/RECON.md §4). THE PSEUDO-THUMB CASE (FC-PSEUDO-THUMB / docs/23 §B.4): the visible knob is `.ant-switch-handle::before`, and the handle inset is a size×checked product. `checked` is a VARIANT AXIS (unchecked|checked, the MUI Switch state-plane reclassification), controlled with a no-op onChange. `size` is antd's own 2-value enum (default|small). NAMED OUT: `loading` (forces ant-switch-disabled — the enabled-loading rendering is unobservable, the TablePagination arrow precedent), checkedChildren/unCheckedChildren. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of antd@5.29.3 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/antd/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Ant Design's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { size = 'default', checked = 'unchecked', disabled = false, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], styles[`checked-${checked}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} className={classes} disabled={disabled} {...rest}>
      <div className={styles['switch-handle']}>
        <div className={styles['switch-handle-before']}></div>
      </div>
      <span className={styles['switch-inner']}>
        <span className={styles['switch-inner-checked']}></span>
        <span className={styles['switch-inner-unchecked']}></span>
      </span>
    </button>
  );
});

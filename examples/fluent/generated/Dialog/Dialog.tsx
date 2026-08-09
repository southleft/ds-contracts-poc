/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/dialog.contract.json (fluent.dialog v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Dialog.module.css';

const ICONS: Record<string, string> = {
  'dialog-part-0-1-0':
    '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M 4.09 4.22 L 4.15 4.15 A 0.5 0.5 0 0 1 4.78 4.09 L 4.85 4.15 L 10 9.29 L 15.15 4.15 A 0.5 0.5 0 0 1 15.78 4.09 L 15.85 4.15 C 16.03 4.32 16.05 4.59 15.91 4.78 L 15.85 4.85 L 10.71 10 L 15.85 15.15 C 16.03 15.32 16.05 15.59 15.91 15.78 L 15.85 15.85 A 0.5 0.5 0 0 1 15.22 15.91 L 15.15 15.85 L 10 10.71 L 4.85 15.85 A 0.5 0.5 0 0 1 4.22 15.91 L 4.15 15.85 A 0.5 0.5 0 0 1 4.09 15.22 L 4.15 15.15 L 9.29 10 L 4.15 4.85 A 0.5 0.5 0 0 1 4.09 4.22 L 4.15 4.15 Z" fill="currentColor"/></svg>',
};

export interface DialogProps extends HTMLAttributes<HTMLDivElement> {
  modalType?: 'modal' | 'non-modal' | 'alert';
}

/** SEED contract for the FLUENT 2 round — props/axes only; anatomy is promoted from captured DOM truth. Subject: @fluentui/react-components@9.74.5 (Griffel CSS-in-JS; 65-package family pinned by the committed lockfile sha256 c3b230dfbd8abd68408fefed9c8abc0e0fd46722faf8652e16e5c038452e0536 — examples/fluent/RECON.md §1). EVERY enum default below is HAND-TRANSCRIBED from the package rollup's own @default/@defaultvalue JSDoc tag: the react-tsx extractor keeps the description prose but emits no `default` field (RECON §3a), so left to the drafter two of twelve components would have captured their whole grid around a base combo the library never renders. @default tags: modalType=modal, open=false, inertTrapFocus=false, unmountOnClose=true. Driven open by openDriver {open:true}; portalCapture. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @fluentui/react-components@9.74.5 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/fluent/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Fluent's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Dialog = forwardRef<HTMLDivElement, DialogProps>(function Dialog(
  { modalType = 'modal', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`modalType-${modalType}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles['dialogbody-2']}>
        <h2 className={styles['label-4']}>Dialog title</h2>
        <div className={styles.dialogtitle__action}>
          <button className={styles['part-0-1-0']}>
            <span
              aria-hidden="true"
              className={styles['part-0-1-0Glyph']}
              dangerouslySetInnerHTML={{ __html: ICONS['dialog-part-0-1-0'] }}
            />
          </button>
        </div>
        <span className={styles['label-5']}>Dialog content copy for the Fluent round.</span>
        <div className={styles['dialogactions-2']}>
          <button className={styles['label-6']}>Close</button>
        </div>
      </div>
      <div className={styles.dialogsurface__backdrop}></div>
      <div className={styles.dialogsurface}>
        <div className={styles.dialogbody}>
          <h2 className={styles.label}>Dialog title</h2>
          <span className={styles['label-2']}>Dialog content copy for the Fluent round.</span>
          <div className={styles.dialogactions}>
            <button className={styles['label-3']}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
});

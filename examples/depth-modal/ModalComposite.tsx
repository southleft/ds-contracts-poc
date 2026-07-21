/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/modal-composite.contract.json (ds.modal-composite v1.0.0)
 * Regenerate with: npm run generate
 *
 * MULTI-ROOT composite — the anatomy declares 2 top-level roots
 * (dialog, backdrop). They render as SIBLINGS in a
 * Fragment; there is no single wrapping element (a Modal's backdrop + dialog
 * are position-driven siblings). Each root's class is styles.<rootName>.
 */
import type { HTMLAttributes } from 'react';
import styles from './ModalComposite.module.css';

const ICONS: Record<string, string> = {
  "close": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" width=\"20\" height=\"20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><line x1=\"5\" y1=\"5\" x2=\"15\" y2=\"15\" stroke-linecap=\"round\"/><line x1=\"15\" y1=\"5\" x2=\"5\" y2=\"15\" stroke-linecap=\"round\"/></svg>",
};

export interface ModalCompositeProps extends HTMLAttributes<HTMLDivElement> {

}

/** Advanced-composition receipt — a MULTI-ROOT Modal ({dialog, backdrop}) assembled into a schema-valid composite from the depth-capture promoted anatomy (extract/computed/depth/receipts/modal.anatomy.json). Two top-level roots exercise the multi-root emitter path in ALL FOUR surfaces: HTML/React render the roots as siblings; the Figma script maps them into ONE variant frame. NOT a census component and NOT wired into npm run generate / figma:plan — emitted on demand by examples/depth-modal/emit-modal-receipt.mjs. */
export function ModalComposite({ className, children, ...rest }: ModalCompositeProps) {
  return (
    <>
      <div className={styles.dialog} role="dialog" aria-modal="true">
<div className={styles.header}>
<h2 className={styles.title}>Order details</h2>
<button className={styles.close} type="button" aria-label="Close"><span aria-hidden="true" className={styles.closeGlyph} dangerouslySetInnerHTML={{ __html: ICONS["close"] }} /></button>
</div>
<p className={styles.body}>Body copy inside a sectioned modal.</p>
<div className={styles.footer}>
<button className={styles.cancel} type="button">
<span className={styles["cancel-label"]}>Cancel</span>
</button>
<button className={styles.save} type="button">
<span className={styles["save-label"]}>Save</span>
</button>
</div>
</div>
      <div className={styles.backdrop}>

</div>
    </>
  );
}

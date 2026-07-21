/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/composite-modal.contract.json (ds.composite-modal v1.0.0)
 * Regenerate with: npm run generate
 *
 * MULTI-ROOT composite — the anatomy declares 2 top-level roots
 * (dialog, backdrop). They render as SIBLINGS in a
 * Fragment; there is no single wrapping element (a Modal's backdrop + dialog
 * are position-driven siblings). Each root's class is styles.<rootName>.
 */
import type { HTMLAttributes } from 'react';
import { Card } from '../Card';
import { Badge } from '../Badge';
import styles from './CompositeModal.module.css';

const ICONS: Record<string, string> = {
  "close": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" width=\"20\" height=\"20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><line x1=\"5\" y1=\"5\" x2=\"15\" y2=\"15\" stroke-linecap=\"round\"/><line x1=\"15\" y1=\"5\" x2=\"5\" y2=\"15\" stroke-linecap=\"round\"/></svg>",
};

export interface CompositeModalProps extends HTMLAttributes<HTMLDivElement> {
  /** The dynamic child collection rendered inside the modal body — one ds.badge per record. */
  items?: Array<{ children: string }>;
}

/** Depth Stage C receipt — a MULTI-ROOT Modal ({dialog, backdrop}) whose BODY holds composed children rather than only static leaf parts: (1) a single composed child (a ds.card component-ref) and (2) a DYNAMIC child-collection — a ds.badge item template repeated over the arrayOf `items` prop (the repeat-over-collection channel). Exercises the dynamic child-collection channel on all four surfaces on top of the multi-root emitter path. NOT a census component and NOT wired into npm run generate / figma:plan — emitted on demand by examples/depth-composite/emit-composite-receipt.ts. */
export function CompositeModal({ items, className, children, ...rest }: CompositeModalProps) {
  return (
    <>
      <div className={styles.dialog} role="dialog" aria-modal="true">
<div className={styles.header}>
<h2 className={styles.title}>Order details</h2>
<button className={styles.close} type="button" aria-label="Close"><span aria-hidden="true" className={styles.closeGlyph} dangerouslySetInnerHTML={{ __html: ICONS["close"] }} /></button>
</div>
<div className={styles.body}>
<Card title="Order summary" />
{items?.map((item, index) => (<Badge key={index}>{item.children}</Badge>))}
</div>
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

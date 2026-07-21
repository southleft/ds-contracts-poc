/**
 * GENERATED FILE (inline-styles emitter) — DO NOT EDIT.
 * Source of truth: contracts/modal-composite.contract.json (ds.modal-composite v1.0.0)
 * Emitted by core/emit-react-inline.ts — token references RESOLVED to literals.
 * Resolution mode: light (brand: default).
 * MULTI-ROOT composite — 2 top-level roots (dialog, backdrop)
 * render as SIBLINGS in a Fragment; there is no single wrapping element.
 */
import type { CSSProperties, HTMLAttributes } from 'react';

const ICONS: Record<string, string> = {
  "close": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" width=\"20\" height=\"20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><line x1=\"5\" y1=\"5\" x2=\"15\" y2=\"15\" stroke-linecap=\"round\"/><line x1=\"15\" y1=\"5\" x2=\"5\" y2=\"15\" stroke-linecap=\"round\"/></svg>",
};

const S: Record<string, CSSProperties> = {
  "dialog": {
    "display": "flex",
    "flexDirection": "column",
    "border": 0
  },
  "header": {
    "display": "flex",
    "flexDirection": "row",
    "alignItems": "center",
    "justifyContent": "space-between"
  },
  "title": {},
  "close": {
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "background": "none",
    "border": "none",
    "padding": 0,
    "color": "inherit",
    "cursor": "pointer"
  },
  "body": {},
  "footer": {
    "display": "flex",
    "flexDirection": "row",
    "alignItems": "center",
    "justifyContent": "flex-end"
  },
  "cancel": {
    "display": "flex"
  },
  "cancel-label": {},
  "save": {
    "display": "flex"
  },
  "save-label": {},
  "backdrop": {
    "display": "inline-flex",
    "alignItems": "center",
    "justifyContent": "center",
    "border": 0,
    "position": "absolute"
  }
};

/** Per-variant overrides, resolved per enum value: "prop-value:part" → styles. */
const V: Record<string, CSSProperties> = {};

export interface ModalCompositeProps extends HTMLAttributes<HTMLDivElement> {

}

/** Advanced-composition receipt — a MULTI-ROOT Modal ({dialog, backdrop}) assembled into a schema-valid composite from the depth-capture promoted anatomy (extract/computed/depth/receipts/modal.anatomy.json). Two top-level roots exercise the multi-root emitter path in ALL FOUR surfaces: HTML/React render the roots as siblings; the Figma script maps them into ONE variant frame. NOT a census component and NOT wired into npm run generate / figma:plan — emitted on demand by examples/depth-modal/emit-modal-receipt.mjs. */
export function ModalComposite({ style, children, ...rest }: ModalCompositeProps) {
  return (
    <>
      <div style={{ ...S.dialog }} role="dialog" aria-modal="true">
<div style={{ ...S.header }}>
<h2 style={{ ...S.title }}>Order details</h2>
<button style={{ ...S.close }} type="button" aria-label="Close"><span aria-hidden="true" style={{ display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: ICONS["close"] }} /></button>
</div>
<p style={{ ...S.body }}>Body copy inside a sectioned modal.</p>
<div style={{ ...S.footer }}>
<button style={{ ...S.cancel }} type="button">
<span style={{ ...S["cancel-label"] }}>Cancel</span>
</button>
<button style={{ ...S.save }} type="button">
<span style={{ ...S["save-label"] }}>Save</span>
</button>
</div>
</div>
      <div style={{ ...S.backdrop }}>

</div>
    </>
  );
}

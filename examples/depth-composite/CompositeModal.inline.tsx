/**
 * GENERATED FILE (inline-styles emitter) — DO NOT EDIT.
 * Source of truth: contracts/composite-modal.contract.json (ds.composite-modal v1.0.0)
 * Emitted by core/emit-react-inline.ts — token references RESOLVED to literals.
 * Resolution mode: light (brand: default).
 * MULTI-ROOT composite — 2 top-level roots (dialog, backdrop)
 * render as SIBLINGS in a Fragment; there is no single wrapping element.
 */
import type { CSSProperties, HTMLAttributes } from 'react';
import { Card } from './Card';
import { Badge } from './Badge';

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
  "body": {
    "display": "flex",
    "flexDirection": "column"
  },
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

export interface CompositeModalProps extends HTMLAttributes<HTMLDivElement> {
  /** The dynamic child collection rendered inside the modal body — one ds.badge per record. */
  items?: Array<{ children: string }>;
}

/** Depth Stage C receipt — a MULTI-ROOT Modal ({dialog, backdrop}) whose BODY holds composed children rather than only static leaf parts: (1) a single composed child (a ds.card component-ref) and (2) a DYNAMIC child-collection — a ds.badge item template repeated over the arrayOf `items` prop (the repeat-over-collection channel). Exercises the dynamic child-collection channel on all four surfaces on top of the multi-root emitter path. NOT a census component and NOT wired into npm run generate / figma:plan — emitted on demand by examples/depth-composite/emit-composite-receipt.ts. */
export function CompositeModal({ items, style, children, ...rest }: CompositeModalProps) {
  return (
    <>
      <div style={{ ...S.dialog }} role="dialog" aria-modal="true">
<div style={{ ...S.header }}>
<h2 style={{ ...S.title }}>Order details</h2>
<button style={{ ...S.close }} type="button" aria-label="Close"><span aria-hidden="true" style={{ display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: ICONS["close"] }} /></button>
</div>
<div style={{ ...S.body }}>
<Card title="Order summary" />
<Badge>Shipping</Badge>
<Badge>Gift wrap</Badge>
<Badge>Priority</Badge>
</div>
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

/**
 * GENERATED FILE (inline-styles emitter) — DO NOT EDIT.
 * Source of truth: contracts/card.contract.json (ds.card v1.1.0)
 * Emitted by core/emit-react-inline.ts — the zero-infrastructure output:
 * every token reference was RESOLVED to its literal value from the design
 * tokens at emit time. Resolution mode: light (brand: default). To retheme,
 * re-emit against different tokens — do not edit literals by hand.
 * Fidelity: :hover/:focus-visible state tokens are not expressible as inline
 * styles and are omitted; disabled-state tokens apply via the disabled prop.
 */
import { forwardRef } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { Avatar } from './Avatar';

const S: Record<string, CSSProperties> = {
  "root": {
    "display": "flex",
    "flexDirection": "column",
    "alignItems": "stretch",
    "borderStyle": "solid",
    "width": "100%",
    "minWidth": "fit-content",
    "backgroundColor": "#FFFFFF",
    "borderColor": "#E5E7EB",
    "borderWidth": "1px",
    "borderRadius": "8px",
    "maxWidth": "320px"
  },
  "header": {
    "display": "flex",
    "flexDirection": "row",
    "alignItems": "center",
    "gap": "8px",
    "paddingInline": "16px",
    "paddingBlock": "8px"
  },
  "title": {
    "color": "#111827",
    "fontFamily": "Inter, system-ui, -apple-system, sans-serif",
    "fontSize": "16px",
    "fontWeight": 600
  },
  "body": {
    "display": "flex",
    "flexDirection": "column",
    "alignItems": "stretch",
    "gap": "8px",
    "paddingInline": "16px",
    "paddingBlock": "8px",
    "color": "#111827",
    "fontFamily": "Inter, system-ui, -apple-system, sans-serif",
    "fontSize": "14px"
  },
  "footer": {
    "display": "flex",
    "flexDirection": "row",
    "alignItems": "center",
    "justifyContent": "flex-end",
    "gap": "8px",
    "paddingInline": "16px",
    "paddingBlock": "8px"
  }
};

/** Per-variant overrides, resolved per enum value: "prop-value:part" → styles. */
const V: Record<string, CSSProperties> = {};

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Card heading, bound to the header title part on both surfaces. */
  title: string;
  /** Constrained actions slot — only actions-grade components. */
  actions?: ReactNode;
}

/** Groups related content behind one subject. Composes an Avatar, a bound title, a default body slot, and a constrained actions slot. */
export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { title, actions, style, children, ...rest },
  ref,
) {
  return (
    <article ref={ref} style={{ ...S.root, ...style }} {...rest}>
      <header style={{ ...S.header }}>
<Avatar size="sm">AB</Avatar>
<span style={{ ...S.title }}>{title}</span>
</header>
<div style={{ ...S.body }}>{children}</div>
{actions != null ? <footer style={{ ...S.footer }}>{actions}</footer> : null}
    </article>
  );
});

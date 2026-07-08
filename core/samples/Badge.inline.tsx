/**
 * GENERATED FILE (inline-styles emitter) — DO NOT EDIT.
 * Source of truth: contracts/badge.contract.json (ds.badge v1.1.0)
 * Emitted by core/emit-react-inline.ts — the zero-infrastructure output:
 * every token reference was RESOLVED to its literal value from the design
 * tokens at emit time. Resolution mode: light (brand: default). To retheme,
 * re-emit against different tokens — do not edit literals by hand.
 * Fidelity: :hover/:focus-visible state tokens are not expressible as inline
 * styles and are omitted; disabled-state tokens apply via the disabled prop.
 */
import { forwardRef } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';

const S: Record<string, CSSProperties> = {
  "root": {
    "display": "inline-flex",
    "alignItems": "center",
    "justifyContent": "center",
    "border": 0,
    "paddingInline": "12px",
    "paddingBlock": "4px",
    "borderRadius": "999px",
    "fontFamily": "Inter, system-ui, -apple-system, sans-serif",
    "fontWeight": 500,
    "fontSize": "12px"
  }
};

/** Per-variant overrides, resolved per enum value: "prop-value:part" → styles. */
const V: Record<string, CSSProperties> = {
  "variant-info:root": {
    "backgroundColor": "#DBEAFE",
    "color": "#1D4ED8"
  },
  "variant-success:root": {
    "backgroundColor": "#DCFCE7",
    "color": "#15803D"
  },
  "variant-warning:root": {
    "backgroundColor": "#FEF3C7",
    "color": "#B45309"
  },
  "variant-danger:root": {
    "backgroundColor": "#FEE2E2",
    "color": "#B91C1C"
  },
  "variant-error:root": {
    "backgroundColor": "#FEE2E2",
    "color": "#B91C1C"
  }
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** The feedback tone being communicated. */
  variant?: 'info' | 'success' | 'warning' | 'danger' | 'error';
}

/** Communicates status or categorization at a glance. Non-interactive. */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = 'info', style, children, ...rest },
  ref,
) {
  return (
    <span ref={ref} style={{ ...S.root, ...(V[`variant-${variant}:root`] ?? {}), ...style }} role="status" {...rest}>
      {children}
    </span>
  );
});

/**
 * GENERATED FILE (inline-styles emitter) — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (ds.button v1.5.0)
 * Emitted by core/emit-react-inline.ts — the zero-infrastructure output:
 * every token reference was RESOLVED to its literal value from the design
 * tokens at emit time. Resolution mode: light (brand: default). To retheme,
 * re-emit against different tokens — do not edit literals by hand.
 * Fidelity: :hover/:focus-visible state tokens are not expressible as inline
 * styles and are omitted; ROOT disabled-state tokens apply via the disabled
 * prop; PART-level state overrides (Part.states, v13) are omitted — the same
 * declared limit as the hover states (state-selected descendant styling).
 */
import { forwardRef } from 'react';
import type { CSSProperties, ButtonHTMLAttributes } from 'react';

const ICONS: Record<string, string> = {
  "spinner": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" width=\"20\" height=\"20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M 10 2.5 A 7.5 7.5 0 0 1 17.5 10\" stroke-linecap=\"round\"/></svg>",
};

const KEYFRAMES = "@keyframes ds-inline-spin { to { transform: rotate(360deg); } }";

const S: Record<string, CSSProperties> = {
  "root": {
    "display": "inline-flex",
    "flexDirection": "row",
    "alignItems": "center",
    "justifyContent": "center",
    "border": 0,
    "cursor": "pointer",
    "borderRadius": "8px",
    "gap": "8px",
    "fontFamily": "Inter, system-ui, -apple-system, sans-serif",
    "fontWeight": 500
  },
  "loadingSpinner": {
    "display": "inline-flex",
    "flexShrink": 0,
    "animation": "ds-inline-spin 0.8s linear infinite"
  },
  "label": {}
};

/** Per-variant overrides, resolved per enum value: "prop-value:part" → styles. */
const V: Record<string, CSSProperties> = {
  "variant-primary:root": {
    "backgroundColor": "#2563EB",
    "color": "#FFFFFF"
  },
  "variant-secondary:root": {
    "backgroundColor": "#E5E7EB",
    "color": "#111827"
  },
  "variant-danger:root": {
    "backgroundColor": "#DC2626",
    "color": "#FFFFFF"
  },
  "variant-ghost:root": {
    "backgroundColor": "#F9FAFB",
    "color": "#374151"
  },
  "size-sm:root": {
    "paddingInline": "12px",
    "paddingBlock": "4px",
    "fontSize": "14px"
  },
  "size-md:root": {
    "paddingInline": "16px",
    "paddingBlock": "8px",
    "fontSize": "16px"
  },
  "size-lg:root": {
    "paddingInline": "24px",
    "paddingBlock": "12px",
    "fontSize": "18px"
  }
};

const DISABLED_STYLE: CSSProperties = {"opacity":0.5};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual prominence of the action. */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  /** Control density. */
  size?: 'sm' | 'md' | 'lg';
  /** Prevents interaction and communicates unavailability. */
  disabled?: boolean;
  /** Shows a spinning busy indicator beside the label while an async action resolves. */
  loading?: boolean;
}

/** Triggers an action or event. Use one primary button per context. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', disabled = false, loading = false, style, children, ...rest },
  ref,
) {
  return (
    <button ref={ref} style={{ ...S.root, ...(V[`variant-${variant}:root`] ?? {}), ...(V[`size-${size}:root`] ?? {}), ...(disabled ? DISABLED_STYLE : {}), ...style }} disabled={disabled} data-loading={loading || undefined} {...rest}>
      <style>{KEYFRAMES}</style>
      {loading ? (<span style={{ ...S.loadingSpinner }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS["spinner"] }} />) : null}
<span style={{ ...S.label }}>{children}</span>
    </button>
  );
});

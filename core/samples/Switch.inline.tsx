/**
 * GENERATED FILE (inline-styles emitter) — DO NOT EDIT.
 * Source of truth: contracts/switch.contract.json (ds.switch v1.1.0)
 * Emitted by core/emit-react-inline.ts — the zero-infrastructure output:
 * every token reference was RESOLVED to its literal value from the design
 * tokens at emit time. Resolution mode: light (brand: default). To retheme,
 * re-emit against different tokens — do not edit literals by hand.
 * Fidelity: :hover/:focus-visible state tokens are not expressible as inline
 * styles and are omitted; disabled-state tokens apply via the disabled prop.
 */
import { forwardRef, useState } from 'react';
import type { CSSProperties, LabelHTMLAttributes } from 'react';

const S: Record<string, CSSProperties> = {
  "root": {
    "display": "flex",
    "flexDirection": "row",
    "alignItems": "flex-start",
    "border": 0,
    "gap": "8px",
    "fontFamily": "Inter, system-ui, -apple-system, sans-serif",
    "color": "#111827"
  },
  "track": {
    "display": "flex",
    "flexDirection": "row",
    "alignItems": "center",
    "appearance": "none",
    "background": "none",
    "border": "none",
    "margin": 0,
    "padding": 0,
    "font": "inherit",
    "color": "inherit",
    "textAlign": "inherit",
    "cursor": "pointer",
    "width": "32px",
    "height": "20px",
    "borderRadius": "999px",
    "paddingInline": "2px",
    "paddingBlock": "2px"
  },
  "spacerStart": {
    "display": "flex",
    "flex": "1 1 auto",
    "minWidth": 0
  },
  "thumb": {
    "width": "16px",
    "height": "16px",
    "backgroundColor": "#FFFFFF",
    "borderRadius": "999px"
  },
  "spacerEnd": {
    "display": "flex",
    "flex": "1 1 auto",
    "minWidth": 0
  },
  "textCol": {
    "display": "flex",
    "flexDirection": "column",
    "flex": "1 1 auto",
    "minWidth": 0,
    "gap": "2px"
  },
  "labelText": {
    "fontSize": "14px",
    "fontWeight": 500
  },
  "descriptionText": {
    "fontSize": "14px",
    "color": "#4B5563"
  }
};

/** Per-variant overrides, resolved per enum value: "prop-value:part" → styles. */
const V: Record<string, CSSProperties> = {
  "value-off:track": {
    "backgroundColor": "#D1D5DB"
  },
  "value-on:track": {
    "backgroundColor": "#2563EB"
  }
};

export interface SwitchProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** On or off — drives the track color and thumb position. */
  value?: 'off' | 'on';
  /** Always rendered — users must know what they are toggling. */
  label: string;
  /** Secondary text below the label. */
  description?: string;
  /** Fires when the track is activated; uncontrolled instances flip value off/on themselves. */
  onToggle?: () => void;
}

/** Toggle for on/off settings that take effect immediately. API mirrors industry convention (Astryx Switch) with the boolean value flattened to an off/on enum so both surfaces render both states truthfully; toggle behavior is a declared boundary. */
export const Switch = forwardRef<HTMLLabelElement, SwitchProps>(function Switch(
  { value: valueProp, label, description = 'Takes effect immediately.', onToggle, style, children, ...rest },
  ref,
) {
  const [valueUncontrolled, setValueUncontrolled] = useState<'off' | 'on'>('off');
  const value = valueProp ?? valueUncontrolled;
  const handleToggle = () => { setValueUncontrolled(value === 'on' ? 'off' : 'on'); onToggle?.(); };
  return (
    <label ref={ref} style={{ ...S.root, ...style }} {...rest}>
      <button style={{ ...S.track, ...(V[`value-${value}:track`] ?? {}) }} role="switch" type="button" onClick={handleToggle} aria-checked={value === 'on'}>
{value === 'on' ? (<div style={{ ...S.spacerStart }}>

</div>) : null}
<span style={{ ...S.thumb }}></span>
{value === 'off' ? (<div style={{ ...S.spacerEnd }}>

</div>) : null}
</button>
<div style={{ ...S.textCol }}>
<span style={{ ...S.labelText }}>{label}</span>
<span style={{ ...S.descriptionText }}>{description}</span>
</div>
    </label>
  );
});

import type { ButtonRecipeInstance } from "../recipes/button.js";

const color = (variable: string, fallback: `#${string}`) => ({
  kind: "token" as const,
  variable,
  fallback,
});

const appearance = (
  state: string,
  background: `#${string}`,
  foreground: `#${string}`,
  border: `#${string}`,
  effects: ButtonRecipeInstance["tokens"]["appearance"]["primary"]["default"]["effects"] = [],
) => ({
  background: color(`button.${state}.background`, background),
  foreground: color(`button.${state}.foreground`, foreground),
  border: color(`button.${state}.border`, border),
  effects,
});

const size = (
  name: string,
  values: {
    minWidth: number | null;
    paddingX: number;
    paddingY: number;
    gap: number;
    fontSize: number;
    lineHeight: number;
    iconSize: number;
    fontStyle: string;
  },
) => ({
  height: "hug" as const,
  minWidth:
    values.minWidth === null
      ? null
      : {
          kind: "token" as const,
          variable: `button.${name}.min-width`,
          fallback: values.minWidth,
        },
  paddingX: {
    kind: "token" as const,
    variable: `button.${name}.padding-x`,
    fallback: values.paddingX,
  },
  paddingY: {
    kind: "token" as const,
    variable: `button.${name}.padding-y`,
    fallback: values.paddingY,
  },
  gap: {
    kind: "token" as const,
    variable: `button.${name}.gap`,
    fallback: values.gap,
  },
  fontSize: {
    kind: "token" as const,
    variable: `button.${name}.font-size`,
    fallback: values.fontSize,
  },
  lineHeight: {
    kind: "token" as const,
    variable: `button.${name}.line-height`,
    fallback: values.lineHeight,
  },
  iconSize: {
    kind: "token" as const,
    variable: `button.${name}.icon-size`,
    fallback: values.iconSize,
  },
  fontStyle: values.fontStyle,
});

export const canonicalButtonRecipeInstance = {
  identity: { id: "ds.button", name: "Button" },
  semanticRole: "button",
  axes: {
    variant: {
      name: "Variant",
      values: ["primary", "secondary"],
      default: "primary",
      exposure: "public",
    },
    size: {
      name: "Size",
      values: ["small", "medium", "large"],
      default: "medium",
      exposure: "public",
    },
    state: {
      name: "State",
      values: [
        "default",
        "hover",
        "pressed",
        "focus-visible",
        "disabled",
        "loading",
      ],
      default: "default",
      exposure: "design-state",
    },
    icons: {
      name: "Icons",
      values: ["none", "leading", "trailing", "both"],
      default: "none",
      exposure: "presence",
    },
  },
  label: { property: "Label", default: "Continue" },
  responsiveness: {
    sourceSizing: "hug",
    designerResize: "fixed-width",
    childRole: "button/label",
    response: "recenter",
  },
  slots: {
    leading: {
      property: "Leading icon",
      optional: true,
      accepts: "instance",
      componentRef: "icon@1",
    },
    trailing: {
      property: "Trailing icon",
      optional: true,
      accepts: "instance",
      componentRef: "icon@1",
    },
  },
  loading: {
    state: "loading",
    indicatorComponentRef: "spinner@1",
    indicatorPlacement: "leading",
    labelBehavior: "preserve",
    leadingIconBehavior: "replace",
    trailingIconBehavior: "preserve",
  },
  tokens: {
    appearance: {
      primary: {
        default: appearance(
          "primary.default",
          "#2563ebff",
          "#ffffffff",
          "#2563ebff",
        ),
        hover: appearance(
          "primary.hover",
          "#1d4ed8ff",
          "#ffffffff",
          "#1d4ed8ff",
        ),
        pressed: appearance(
          "primary.pressed",
          "#1e40afff",
          "#ffffffff",
          "#1e40afff",
        ),
        focusVisible: appearance(
          "primary.focus-visible",
          "#2563ebff",
          "#ffffffff",
          "#93c5fdff",
        ),
        disabled: appearance(
          "primary.disabled",
          "#e5e7ebff",
          "#9ca3afff",
          "#d1d5dbff",
        ),
      },
      secondary: {
        default: appearance(
          "secondary.default",
          "#ffffffff",
          "#1f2937ff",
          "#d1d5dbff",
        ),
        hover: appearance(
          "secondary.hover",
          "#f9fafbff",
          "#111827ff",
          "#9ca3afff",
        ),
        pressed: appearance(
          "secondary.pressed",
          "#f3f4f6ff",
          "#111827ff",
          "#6b7280ff",
        ),
        focusVisible: appearance(
          "secondary.focus-visible",
          "#ffffffff",
          "#1f2937ff",
          "#60a5faff",
        ),
        disabled: appearance(
          "secondary.disabled",
          "#e5e7ebff",
          "#9ca3afff",
          "#d1d5dbff",
        ),
      },
    },
    sizes: {
      small: size("small", {
        minWidth: null,
        paddingX: 12,
        paddingY: 6,
        gap: 6,
        fontSize: 14,
        lineHeight: 20,
        iconSize: 16,
        fontStyle: "Semi Bold",
      }),
      medium: size("medium", {
        minWidth: null,
        paddingX: 16,
        paddingY: 8,
        gap: 8,
        fontSize: 14,
        lineHeight: 20,
        iconSize: 18,
        fontStyle: "Semi Bold",
      }),
      large: size("large", {
        minWidth: null,
        paddingX: 20,
        paddingY: 10,
        gap: 8,
        fontSize: 16,
        lineHeight: 24,
        iconSize: 20,
        fontStyle: "Semi Bold",
      }),
    },
    radius: { kind: "token", variable: "button.radius", fallback: 8 },
    borderWidth: {
      kind: "token",
      variable: "button.border-width",
      fallback: 1,
    },
    typography: { fontFamily: "Inter" },
  },
  inputFacts: [
    { path: "root", channel: "activation-behavior" },
    { path: "root", channel: "aria-disabled" },
    { path: "root", channel: "axes" },
    { path: "root", channel: "label" },
    { path: "root", channel: "recipe-selection" },
    { path: "root", channel: "slots" },
    { path: "root", channel: "tokens" },
    { path: "root", channel: "transition-timing-function" },
  ],
  accounting: {
    carried: [
      { path: "root", channel: "axes" },
      { path: "root", channel: "label" },
      { path: "root", channel: "slots" },
      { path: "root", channel: "tokens" },
    ],
  },
  extensions: [
    {
      id: "button/activation",
      kind: "behaviour",
      stated: "activates once for a supported pointer or keyboard gesture",
      why: "interaction dispatch belongs to code, not a static Figma component",
      absorbs: [{ path: "root", channel: "activation-behavior" }],
    },
    {
      id: "button/aria-disabled",
      kind: "a11y",
      stated: "exposes disabled semantics to assistive technology",
      why: "the canvas represents appearance but cannot expose runtime ARIA",
      absorbs: [{ path: "root", channel: "aria-disabled" }],
    },
    {
      id: "button/recipe-selection",
      kind: "data",
      stated: "records the reviewed human/config choice of button@1",
      why: "recipe acquisition provenance is review data, not drawable canvas structure",
      absorbs: [{ path: "root", channel: "recipe-selection" }],
    },
  ],
  receipts: [
    {
      fact: { path: "root", channel: "transition-timing-function" },
      value: "cubic-bezier(0.2, 0, 0, 1)",
      reason: "no-figma-primitive",
      evidence:
        "docs/32-recipe-ir-pivot.md §3 (constructs absent from primitive IR)",
    },
  ],
  provenance: {
    source: "recipe/fixtures/button.ts",
    tool: "button@1",
    generatedAt: "2026-08-26T00:00:00.000Z",
    selection: {
      candidates: [{ id: "button", version: 1 }],
      selectedBy: "recipe-pivot-review",
      mechanism: "human-review",
      source: "docs/32-recipe-ir-pivot.md §6",
      reviewedAt: "2026-08-26T00:00:00.000Z",
      manualCost: {
        value: 1,
        unit: "reviewed-mapping",
        note: "one explicit archetype-to-recipe selection; no name-based inference",
      },
    },
  },
} as const satisfies ButtonRecipeInstance;

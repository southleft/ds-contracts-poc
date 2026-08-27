import type { ReviewedButtonAdapterConfig } from "../adapters/button.js";
import type { ButtonRecipeInstance } from "../recipes/button.js";

const selection = (selectedBy: string, source: string, mappings: number) => ({
  candidates: [{ id: "button", version: 1 }],
  selectedBy,
  mechanism: "reviewed-config" as const,
  source,
  reviewedAt: "2026-08-26T00:00:00.000Z",
  manualCost: {
    value: mappings,
    unit: "reviewed-mapping" as const,
    note: `${mappings} source-to-button@1 decisions reviewed; no recipe inference`,
  },
});

const makeAltitudeButtonAdapterConfig = (): ReviewedButtonAdapterConfig => ({
  sourcePath: "examples/altitude/contracts/button.contract.json",
  generatedAt: "2026-08-26T00:00:00.000Z",
  selection: selection(
    "recipe-pivot-altitude-review",
    "recipe/fixtures/library-buttons.ts#altitudeButtonAdapterConfig",
    24,
  ),
  variant: {
    sourceProp: "variant",
    primarySource: null,
    secondarySource: "secondary",
    default: "secondary",
  },
  size: {
    sourceProp: null,
    sourceValues: null,
    default: "medium",
  },
  labelProp: "children",
  stateMap: {
    hover: "hover",
    pressed: null,
    "focus-visible": "focus-visible",
    disabled: null,
  },
  parameters: {
    appearance: {
      primary: {
        default: {
          background: token(
            "imported.button.root.background-color.unset",
            "#4375ffff",
          ),
          foreground: token("imported.button.root.color.unset", "#000b29ff"),
          border: token(
            "imported.button.root.border-top-color.unset",
            "#000b29ff",
          ),
          effects: [],
        },
        hover: {
          background: token(
            "imported.button.root.background-color-state-hover.unset",
            "#6b93ffff",
          ),
          foreground: token(
            "imported.button.root.color-state-hover.unset",
            "#000b29ff",
          ),
          border: token(
            "imported.button.root.border-top-color-state-hover.unset",
            "#000b29ff",
          ),
          effects: [],
        },
        pressed: {
          background: token(
            "imported.button.root.background-color.unset",
            "#4375ffff",
          ),
          foreground: token("imported.button.root.color.unset", "#000b29ff"),
          border: token(
            "imported.button.root.border-top-color.unset",
            "#000b29ff",
          ),
          effects: [],
        },
        focusVisible: altitudeFocus(
          "imported.button.root.background-color.unset",
          "#4375ffff",
          "imported.button.root.color.unset",
          "#000b29ff",
        ),
        disabled: {
          background: token(
            "imported.button.root.background-color.unset",
            "#4375ffff",
          ),
          foreground: token("imported.button.root.color.unset", "#000b29ff"),
          border: token(
            "imported.button.root.border-top-color.unset",
            "#000b29ff",
          ),
          effects: [],
        },
      },
      secondary: {
        default: {
          background: token(
            "imported.button.root.background-color.secondary",
            "#a49981ff",
          ),
          foreground: token(
            "imported.button.root.color.secondary",
            "#191306ff",
          ),
          border: token(
            "imported.button.root.border-top-color.secondary",
            "#191306ff",
          ),
          effects: [],
        },
        hover: {
          background: token(
            "imported.button.root.background-color-state-hover.secondary",
            "#c0b191ff",
          ),
          foreground: token(
            "imported.button.root.color-state-hover.secondary",
            "#191306ff",
          ),
          border: token(
            "imported.button.root.border-top-color-state-hover.secondary",
            "#191306ff",
          ),
          effects: [],
        },
        pressed: {
          background: token(
            "imported.button.root.background-color.secondary",
            "#a49981ff",
          ),
          foreground: token(
            "imported.button.root.color.secondary",
            "#191306ff",
          ),
          border: token(
            "imported.button.root.border-top-color.secondary",
            "#191306ff",
          ),
          effects: [],
        },
        focusVisible: altitudeFocus(
          "imported.button.root.background-color.secondary",
          "#a49981ff",
          "imported.button.root.color.secondary",
          "#191306ff",
        ),
        disabled: {
          background: token(
            "imported.button.root.background-color.secondary",
            "#a49981ff",
          ),
          foreground: token(
            "imported.button.root.color.secondary",
            "#191306ff",
          ),
          border: token(
            "imported.button.root.border-top-color.secondary",
            "#191306ff",
          ),
          effects: [],
        },
      },
    },
    sizes: {
      small: altitudeSize(),
      medium: altitudeSize(),
      large: altitudeSize(),
    },
    radius: token("imported.shared.size-4", 4),
    borderWidth: token("imported.button.root.border-top-width.unset", 0),
    typography: {
      fontFamily: '"IBM Plex Sans", sans-serif',
    },
  },
  sourceFacts: altitudeFacts,
  manualMappings: [
    "absent variant (the package default)→primary",
    "secondary→secondary",
    "size axis supplied by reviewed button@1 profile",
    "hover→hover",
    "pressed supplied by reviewed button@1 profile",
    "focus-visible→focus-visible",
    "disabled supplied by reviewed button@1 profile",
    ...altitudeFacts.map((fact) => `${fact.fact.channel}→${fact.landing}`),
  ],
});

const makeFluentButtonAdapterConfig = (): ReviewedButtonAdapterConfig => ({
  sourcePath: "examples/fluent/contracts/button.contract.json",
  generatedAt: "2026-08-26T00:00:00.000Z",
  selection: selection(
    "recipe-pivot-fluent-review",
    "recipe/fixtures/library-buttons.ts#fluentButtonAdapterConfig",
    27,
  ),
  variant: {
    sourceProp: "appearance",
    primarySource: "primary",
    secondarySource: "secondary",
    default: "secondary",
  },
  size: {
    sourceProp: "size",
    sourceValues: {
      small: "small",
      medium: "medium",
      large: "large",
    },
    default: "medium",
  },
  labelProp: "children",
  stateMap: {
    hover: "hover",
    pressed: "active",
    "focus-visible": "focus-visible",
    disabled: "disabled",
  },
  parameters: {
    appearance: {
      primary: fluentAppearance("primary"),
      secondary: fluentAppearance("secondary"),
    },
    sizes: {
      small: fluentSize("small", 64, 8, 3, 12, 16, 16, "Regular"),
      medium: fluentSize("medium", 96, 12, 5, 14, 20, 20, "Semi Bold"),
      large: fluentSize("large", 96, 16, 8, 16, 22, 24, "Semi Bold"),
    },
    radius: token("imported.button.root.border-top-left-radius.rounded", 4),
    borderWidth: token("imported.shared.size-1", 1),
    typography: {
      fontFamily:
        '"Segoe UI", "Segoe UI Web (West European)", -apple-system, system-ui, Roboto, "Helvetica Neue", sans-serif',
    },
  },
  sourceFacts: fluentFacts,
  manualMappings: [
    "appearance primary/secondary→button@1 Variant",
    "size small/medium/large→button@1 Size",
    "hover→hover",
    "active→pressed",
    "focus-visible→focus-visible",
    "disabled→disabled",
    ...fluentFacts.map((fact) => `${fact.fact.channel}→${fact.landing}`),
  ],
});

type Tokens = ButtonRecipeInstance["tokens"];
type Appearance = Tokens["appearance"]["primary"]["default"];

const token = <Value extends number | `#${string}`>(
  variable: string,
  fallback: Value,
) => ({ kind: "token" as const, variable, fallback });

const literal = <Value extends number | `#${string}`>(
  value: Value,
  evidence: string,
) => ({
  kind: "literal" as const,
  value,
  receipt: {
    evidence,
    method: "measured from pinned original-source render",
  },
});

const ALTITUDE_REFERENCE_RECEIPT =
  "recipe/evidence/button-comparison/receipt.json#references";
const FLUENT_REFERENCE_RECEIPT =
  "recipe/evidence/button-comparison/receipt.json#references";

const altitudeFocus = (
  backgroundVariable: string,
  background: `#${string}`,
  foregroundVariable: string,
  foreground: `#${string}`,
): Appearance => ({
  background: token(backgroundVariable, background),
  foreground: token(foregroundVariable, foreground),
  border: token(
    foregroundVariable.replace(".color.", ".border-top-color."),
    foreground,
  ),
  effects: [
    {
      kind: "drop-shadow",
      offsetX: 0,
      offsetY: 0,
      blur: 0,
      spread: 2,
      color: literal("#ffffffff", ALTITUDE_REFERENCE_RECEIPT),
    },
    {
      kind: "drop-shadow",
      offsetX: 0,
      offsetY: 0,
      blur: 0,
      spread: 4,
      color: literal("#000b29ff", ALTITUDE_REFERENCE_RECEIPT),
    },
  ],
});

const altitudeSize = (): Tokens["sizes"]["medium"] => ({
  height: "hug",
  minWidth: null,
  paddingX: token("imported.shared.size-16", 16),
  paddingY: token("imported.shared.size-8", 8),
  gap: token("imported.shared.size-8", 8),
  fontSize: token("imported.shared.size-16", 16),
  lineHeight: token("imported.button.root.line-height", 24),
  iconSize: literal(
    16,
    "named Button icon-slot refusal; paired matrix Icons=none",
  ),
  fontStyle: "Semi Bold",
});

const fluentBase = {
  primary: {
    background: ["color-brand-background", "#0f6cbdff"],
    foreground: ["color-neutral-foreground-on-brand", "#ffffffff"],
    border: ["imported.button.root.border-top-color.primary", "#00000000"],
  },
  secondary: {
    background: ["color-neutral-background1", "#ffffffff"],
    foreground: ["color-neutral-foreground1", "#242424ff"],
    border: ["imported.button.root.border-top-color.secondary", "#d1d1d1ff"],
  },
} as const;

const fluentState = (
  variant: "primary" | "secondary",
  state: "default" | "hover" | "pressed" | "disabled",
): Appearance => {
  const base = fluentBase[variant];
  if (state === "default") {
    return {
      background: token(base.background[0], base.background[1]),
      foreground: token(base.foreground[0], base.foreground[1]),
      border: token(base.border[0], base.border[1]),
      effects: [],
    };
  }
  const sourceState = state === "pressed" ? "active" : state;
  const values = {
    primary: {
      hover: ["#115ea3ff", "#ffffffff", "#00000000"],
      active: ["#0c3b5eff", "#ffffffff", "#00000000"],
      disabled: ["#f0f0f0ff", "#bdbdbdff", "#00000000"],
    },
    secondary: {
      hover: ["#f5f5f5ff", "#242424ff", "#c7c7c7ff"],
      active: ["#e0e0e0ff", "#242424ff", "#b3b3b3ff"],
      disabled: ["#f0f0f0ff", "#bdbdbdff", "#e0e0e0ff"],
    },
  } as const;
  const [background, foreground, border] = values[variant][sourceState];
  return {
    background: token(
      `imported.button.root.background-color-state-${sourceState}.${variant}`,
      background,
    ),
    foreground: token(
      sourceState === "disabled"
        ? "imported.button.root.color-state-disabled"
        : `imported.button.root.color-state-${sourceState}.${variant}`,
      foreground,
    ),
    border: token(
      `imported.button.root.border-top-color-state-${sourceState}.${variant}`,
      border,
    ),
    effects: [],
  };
};

const fluentAppearance = (
  variant: "primary" | "secondary",
): Tokens["appearance"]["primary"] => ({
  default: fluentState(variant, "default"),
  hover: fluentState(variant, "hover"),
  pressed: fluentState(variant, "pressed"),
  focusVisible: {
    ...fluentState(variant, "default"),
    background: literal(
      fluentBase[variant].background[1],
      FLUENT_REFERENCE_RECEIPT,
    ),
  },
  disabled: fluentState(variant, "disabled"),
});

const fluentSize = (
  name: "small" | "medium" | "large",
  minWidth: number,
  paddingX: number,
  paddingY: number,
  fontSize: number,
  lineHeight: number,
  iconSize: number,
  fontStyle: string,
): Tokens["sizes"]["medium"] => ({
  height: "hug",
  minWidth: token(`imported.button.root.min-width.${name}`, minWidth),
  paddingX: token(`imported.button.root.padding-left.${name}`, paddingX),
  paddingY: token(`imported.button.root.padding-top.${name}`, paddingY),
  gap: literal(4, "source slot gap measured outside the paired no-icon matrix"),
  fontSize: token(`imported.button.root.font-size.${name}`, fontSize),
  lineHeight: token(`imported.button.root.line-height.${name}`, lineHeight),
  iconSize: literal(
    iconSize,
    "source icon geometry measured outside the paired no-icon matrix",
  ),
  fontStyle,
});

const fact = (
  category: "geometry" | "typography" | "fill" | "state",
  channel: string,
  pointer: string,
  expected: unknown,
  landing: string,
) => ({
  fact: { path: pointer, channel },
  category,
  source: { kind: "contract" as const, pointer, expected },
  disposition: "parameter" as const,
  landing,
});

const measuredFact = (
  category: "geometry" | "typography" | "fill" | "state",
  channel: string,
  evidence: string,
  landing: string,
) => ({
  fact: { path: evidence, channel },
  category,
  source: { kind: "measurement" as const, evidence },
  disposition: "parameter" as const,
  landing,
});

const altitudeFacts = [
  fact(
    "geometry",
    "padding-x",
    "/anatomy/root/tokens/padding-left",
    "{imported.shared.size-16}",
    "tokens.sizes.medium.paddingX",
  ),
  fact(
    "geometry",
    "padding-y",
    "/anatomy/root/tokens/padding-top",
    "{imported.shared.size-8}",
    "tokens.sizes.medium.paddingY",
  ),
  fact(
    "geometry",
    "radius",
    "/anatomy/root/tokens/border-top-left-radius",
    "{imported.shared.size-4}",
    "tokens.radius",
  ),
  fact(
    "geometry",
    "border-width",
    "/anatomy/root/tokens/border-top-width",
    "{imported.button.root.border-top-width.unset}",
    "tokens.borderWidth",
  ),
  fact(
    "typography",
    "font-family",
    "/anatomy/root/declared/font-family",
    '"IBM Plex Sans", sans-serif',
    "tokens.typography.fontFamily",
  ),
  fact(
    "typography",
    "font-size",
    "/anatomy/root/tokens/font-size",
    "{imported.shared.size-16}",
    "tokens.sizes.medium.fontSize",
  ),
  fact(
    "typography",
    "line-height",
    "/anatomy/root/tokens/line-height",
    "{imported.button.root.line-height}",
    "tokens.sizes.medium.lineHeight",
  ),
  fact(
    "typography",
    "font-weight",
    "/anatomy/root/tokens/font-weight",
    "{imported.button.root.font-weight}",
    "tokens.sizes.medium.fontStyle",
  ),
  fact(
    "fill",
    "primary-background",
    "/anatomy/root/tokens/background-color",
    "{imported.button.root.background-color.unset}",
    "tokens.appearance.primary.default.background",
  ),
  fact(
    "fill",
    "secondary-background",
    "/anatomy/root/tokensByProp/0/map/secondary/background-color",
    "{imported.button.root.background-color.secondary}",
    "tokens.appearance.secondary.default.background",
  ),
  fact(
    "state",
    "primary-hover-background",
    "/anatomy/root/states/hover/background-color",
    "{imported.button.root.background-color-state-hover.unset}",
    "tokens.appearance.primary.hover.background",
  ),
  measuredFact(
    "state",
    "focus-gap",
    ALTITUDE_REFERENCE_RECEIPT,
    "tokens.appearance.primary.focusVisible.effects.0.color",
  ),
  measuredFact(
    "state",
    "focus-ring",
    ALTITUDE_REFERENCE_RECEIPT,
    "tokens.appearance.primary.focusVisible.effects.1.color",
  ),
] as const;

const fluentFacts = [
  fact(
    "geometry",
    "min-width",
    "/anatomy/root/tokensByProp/2/map/medium/min-width",
    "{imported.button.root.min-width.medium}",
    "tokens.sizes.medium.minWidth",
  ),
  fact(
    "geometry",
    "padding-x",
    "/anatomy/root/tokensByProp/2/map/medium/padding-left",
    "{imported.button.root.padding-left.medium}",
    "tokens.sizes.medium.paddingX",
  ),
  fact(
    "geometry",
    "padding-y",
    "/anatomy/root/tokensByProp/2/map/medium/padding-top",
    "{imported.button.root.padding-top.medium}",
    "tokens.sizes.medium.paddingY",
  ),
  fact(
    "geometry",
    "radius",
    "/anatomy/root/tokensByProp/1/map/rounded/border-top-left-radius",
    "{imported.button.root.border-top-left-radius.rounded}",
    "tokens.radius",
  ),
  fact(
    "geometry",
    "border-width",
    "/anatomy/root/tokens/border-top-width",
    "{imported.shared.size-1}",
    "tokens.borderWidth",
  ),
  fact(
    "typography",
    "font-family",
    "/anatomy/root/declared/font-family",
    '"Segoe UI", "Segoe UI Web (West European)", -apple-system, "system-ui", Roboto, "Helvetica Neue", sans-serif',
    "tokens.typography.fontFamily",
  ),
  fact(
    "typography",
    "font-size",
    "/anatomy/root/tokensByProp/2/map/medium/font-size",
    "{imported.button.root.font-size.medium}",
    "tokens.sizes.medium.fontSize",
  ),
  fact(
    "typography",
    "line-height",
    "/anatomy/root/tokensByProp/2/map/medium/line-height",
    "{imported.button.root.line-height.medium}",
    "tokens.sizes.medium.lineHeight",
  ),
  fact(
    "typography",
    "font-weight",
    "/anatomy/root/tokensByProp/2/map/medium/font-weight",
    "{imported.button.root.font-weight.medium}",
    "tokens.sizes.medium.fontStyle",
  ),
  fact(
    "fill",
    "primary-background",
    "/anatomy/root/tokensByProp/0/map/primary/background-color",
    "{imported.button.root.background-color.primary}",
    "tokens.appearance.primary.default.background",
  ),
  fact(
    "fill",
    "secondary-background",
    "/anatomy/root/tokensByProp/0/map/secondary/background-color",
    "{imported.button.root.background-color.secondary}",
    "tokens.appearance.secondary.default.background",
  ),
  fact(
    "state",
    "hover-background",
    "/anatomy/root/states/hover/background-color",
    "{imported.button.root.background-color-state-hover.{appearance}}",
    "tokens.appearance.primary.hover.background",
  ),
  measuredFact(
    "state",
    "focus-render-background",
    FLUENT_REFERENCE_RECEIPT,
    "tokens.appearance.primary.focusVisible.background",
  ),
] as const;

export const altitudeButtonAdapterConfig = makeAltitudeButtonAdapterConfig();
export const fluentButtonAdapterConfig = makeFluentButtonAdapterConfig();

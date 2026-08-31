export const BUTTON_COMPARISON_PROTOCOL_VERSION = "button-paired-source-v2";

export const BUTTON_COMPARISON_VARIANTS = ["primary", "secondary"] as const;
export const BUTTON_COMPARISON_STATES = [
  "default",
  "hover",
  "focus-visible",
] as const;

export type ButtonComparisonVariant =
  (typeof BUTTON_COMPARISON_VARIANTS)[number];
export type ButtonComparisonState = (typeof BUTTON_COMPARISON_STATES)[number];
export type ButtonComparisonLibrary = "altitude" | "fluent";

export interface ButtonComparisonCell {
  key: string;
  library: ButtonComparisonLibrary;
  variant: ButtonComparisonVariant;
  state: ButtonComparisonState;
  recipeSize: "medium";
  icons: "none";
  label: "Button";
}

const libraries = ["altitude", "fluent"] as const;

/**
 * Frozen before rendering. Size is held at recipe medium because Altitude has
 * no size API; icon presence is held at none because Altitude has no Button
 * icon slot. Unsupported capabilities remain explicit below.
 */
export const BUTTON_COMPARISON_CELLS: readonly ButtonComparisonCell[] =
  libraries.flatMap((library) =>
    BUTTON_COMPARISON_VARIANTS.flatMap((variant) =>
      BUTTON_COMPARISON_STATES.map((state) => ({
        key: `${library}/variant=${variant}/state=${state}`,
        library,
        variant,
        state,
        recipeSize: "medium" as const,
        icons: "none" as const,
        label: "Button" as const,
      })),
    ),
  );

export interface ReviewedSourceButtonAdapter {
  packageName: string;
  exactVersion: string;
  externalOwner: string;
  component: string;
  sandbox: string;
  recipeSelection: {
    recipe: "button@1";
    mechanism: "manual-human-review";
    selectedBy: string;
    reviewedAt: string;
  };
  sourceApiMap: {
    variant: Record<ButtonComparisonVariant, string>;
    state: Record<ButtonComparisonState, string>;
    recipeSize: string;
    icons: string;
    label: string;
  };
  fixedSourceProps: Record<string, string>;
  unsupportedPairedCells: string[];
  capabilityCoverageOutsidePairedMatrix: string[];
  manualSetupSeconds: number;
  mappingDecisions: string[];
}

export const REVIEWED_SOURCE_BUTTON_ADAPTERS: Record<
  ButtonComparisonLibrary,
  ReviewedSourceButtonAdapter
> = {
  altitude: {
    packageName: "altitude-web-components",
    exactVersion: "1.0.2",
    externalOwner: "Altitude package publisher",
    component: "al-button",
    sandbox: "examples/altitude/.altitude-sandbox",
    recipeSelection: {
      recipe: "button@1",
      mechanism: "manual-human-review",
      selectedBy: "recipe-pivot-button-comparison-review",
      reviewedAt: "2026-08-26T21:06:00-05:00",
    },
    sourceApiMap: {
      variant: {
        primary:
          "omit variant attribute (the package's actual primary default)",
        secondary: 'variant="secondary"',
      },
      state: {
        default: "no interaction",
        hover: "real pointer hover",
        "focus-visible": "sentinel focus followed by keyboard Tab",
      },
      recipeSize:
        "medium is fixed on recipe/legacy only; source has no size API",
      icons: "none; source Button exposes no icon slot",
      label: "light-DOM text child",
    },
    fixedSourceProps: {},
    unsupportedPairedCells: [
      "Size=small",
      "Size=large",
      "State=pressed",
      "State=disabled",
      "State=loading",
      "Icons=leading",
      "Icons=trailing",
      "Icons=both",
    ],
    capabilityCoverageOutsidePairedMatrix: [
      "source variants tertiary, bare, danger",
      "isDisabled sets aria-disabled but shipped :disabled styling is unreachable",
    ],
    manualSetupSeconds: 1560,
    mappingDecisions: [
      "The absent variant is primary; danger is not relabelled as primary.",
      "Secondary maps directly to the source variant of the same meaning.",
      "Only browser-stimulated hover and focus-visible join the paired matrix.",
      "Unsupported source size/icon/loading/disabled cells are excluded by name.",
    ],
  },
  fluent: {
    packageName: "@fluentui/react-components",
    exactVersion: "9.74.5",
    externalOwner: "Microsoft Fluent package publisher",
    component: "Button",
    sandbox: "examples/fluent/.fluent-sandbox",
    recipeSelection: {
      recipe: "button@1",
      mechanism: "manual-human-review",
      selectedBy: "recipe-pivot-button-comparison-review",
      reviewedAt: "2026-08-26T21:06:00-05:00",
    },
    sourceApiMap: {
      variant: {
        primary: 'appearance="primary"',
        secondary: 'appearance="secondary"',
      },
      state: {
        default: "no interaction",
        hover: "real pointer hover",
        "focus-visible": "sentinel focus followed by keyboard Tab",
      },
      recipeSize:
        'source size="medium"; shared matrix excludes size because Altitude has no size API',
      icons: "none; the optional Fluent icon slot is intentionally empty",
      label: "React children",
    },
    fixedSourceProps: {
      size: "medium",
      shape: "rounded",
      iconPosition: "before",
    },
    unsupportedPairedCells: [
      "Size=small",
      "Size=large",
      "State=pressed",
      "State=disabled",
      "State=loading",
      "Icons=leading",
      "Icons=trailing",
      "Icons=both",
    ],
    capabilityCoverageOutsidePairedMatrix: [
      "source size small and large",
      "source appearances outline, subtle, transparent",
      "source active and disabled states",
      "source icon slot",
    ],
    manualSetupSeconds: 1320,
    mappingDecisions: [
      "Primary and secondary map directly to Fluent appearance values.",
      "Size is pinned to medium for the shared denominator.",
      "Shape is pinned to rounded and iconPosition to before.",
      "Only browser-stimulated hover and focus-visible join the paired matrix.",
    ],
  },
};

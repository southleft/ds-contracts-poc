export const INPUT_FIELD_COMPARISON_PROTOCOL_VERSION =
  "input-field-paired-source-v1";

export const INPUT_FIELD_COMPARISON_LIBRARIES = ["mui", "polaris"] as const;
export const INPUT_FIELD_COMPARISON_SIZES = ["small", "medium"] as const;
export const INPUT_FIELD_COMPARISON_STATES = [
  "default",
  "focus-visible",
  "error",
  "disabled",
] as const;
export const INPUT_FIELD_COMPARISON_CONTENT = ["placeholder", "value"] as const;
export const INPUT_FIELD_COMPARISON_REQUIRED = ["false", "true"] as const;
export const INPUT_FIELD_COMPARISON_ADORNMENTS = ["none", "both"] as const;

export type InputFieldComparisonLibrary =
  (typeof INPUT_FIELD_COMPARISON_LIBRARIES)[number];
export type InputFieldComparisonSize =
  (typeof INPUT_FIELD_COMPARISON_SIZES)[number];
export type InputFieldComparisonState =
  (typeof INPUT_FIELD_COMPARISON_STATES)[number];
export type InputFieldComparisonContent =
  (typeof INPUT_FIELD_COMPARISON_CONTENT)[number];
export type InputFieldComparisonRequired =
  (typeof INPUT_FIELD_COMPARISON_REQUIRED)[number];
export type InputFieldComparisonAdornments =
  (typeof INPUT_FIELD_COMPARISON_ADORNMENTS)[number];

export interface InputFieldComparisonCell {
  key: string;
  library: InputFieldComparisonLibrary;
  size: InputFieldComparisonSize;
  state: InputFieldComparisonState;
  content: InputFieldComparisonContent;
  required: InputFieldComparisonRequired;
  adornments: InputFieldComparisonAdornments;
}

const keyFor = (
  library: InputFieldComparisonLibrary,
  size: InputFieldComparisonSize,
  state: InputFieldComparisonState,
  content: InputFieldComparisonContent,
  required: InputFieldComparisonRequired,
  adornments: InputFieldComparisonAdornments,
): string =>
  [
    library,
    `size=${size}`,
    `state=${state}`,
    `content=${content}`,
    `required=${required}`,
    `adornments=${adornments}`,
  ].join("/");

/**
 * Frozen before rendering. The recipe supports four adornment values, but the
 * paired source benchmark deliberately uses the exact reviewed intersection:
 * none and both. That yields 64 cells per source and 128 source cells total.
 */
export const INPUT_FIELD_COMPARISON_CELLS: readonly InputFieldComparisonCell[] =
  INPUT_FIELD_COMPARISON_LIBRARIES.flatMap((library) =>
    INPUT_FIELD_COMPARISON_SIZES.flatMap((size) =>
      INPUT_FIELD_COMPARISON_STATES.flatMap((state) =>
        INPUT_FIELD_COMPARISON_CONTENT.flatMap((content) =>
          INPUT_FIELD_COMPARISON_REQUIRED.flatMap((required) =>
            INPUT_FIELD_COMPARISON_ADORNMENTS.map((adornments) => ({
              key: keyFor(library, size, state, content, required, adornments),
              library,
              size,
              state,
              content,
              required,
              adornments,
            })),
          ),
        ),
      ),
    ),
  );

const expectedProductsPerLibrary =
  INPUT_FIELD_COMPARISON_SIZES.length *
  INPUT_FIELD_COMPARISON_STATES.length *
  INPUT_FIELD_COMPARISON_CONTENT.length *
  INPUT_FIELD_COMPARISON_REQUIRED.length *
  INPUT_FIELD_COMPARISON_ADORNMENTS.length;

export function validateInputFieldComparisonMatrix(
  cells: readonly InputFieldComparisonCell[],
): void {
  const expectedTotal =
    INPUT_FIELD_COMPARISON_LIBRARIES.length * expectedProductsPerLibrary;
  if (cells.length !== expectedTotal) {
    throw new Error(
      `NOT-COMPARABLE: Input/Field matrix requires ${expectedTotal} cells; found ${cells.length}`,
    );
  }
  const keys = new Set<string>();
  const products = new Set<string>();
  for (const cell of cells) {
    if (keys.has(cell.key)) {
      throw new Error(
        `NOT-COMPARABLE: duplicate Input/Field cell key ${cell.key}`,
      );
    }
    keys.add(cell.key);
    const canonicalKey = keyFor(
      cell.library,
      cell.size,
      cell.state,
      cell.content,
      cell.required,
      cell.adornments,
    );
    if (cell.key !== canonicalKey) {
      throw new Error(
        `NOT-COMPARABLE: Input/Field cell key does not match its axis product: ${cell.key}`,
      );
    }
    if (products.has(canonicalKey)) {
      throw new Error(
        `NOT-COMPARABLE: duplicate Input/Field axis product ${canonicalKey}`,
      );
    }
    products.add(canonicalKey);
  }
  for (const library of INPUT_FIELD_COMPARISON_LIBRARIES) {
    const sourceCells = cells.filter((cell) => cell.library === library);
    if (sourceCells.length !== expectedProductsPerLibrary) {
      throw new Error(
        `NOT-COMPARABLE: ${library} maps ${sourceCells.length}/${expectedProductsPerLibrary} Input/Field cells`,
      );
    }
    for (const [axis, values] of [
      ["size", INPUT_FIELD_COMPARISON_SIZES],
      ["state", INPUT_FIELD_COMPARISON_STATES],
      ["content", INPUT_FIELD_COMPARISON_CONTENT],
      ["required", INPUT_FIELD_COMPARISON_REQUIRED],
      ["adornments", INPUT_FIELD_COMPARISON_ADORNMENTS],
    ] as const) {
      for (const value of values) {
        if (
          sourceCells.filter(
            (cell) =>
              cell[axis] === (value as InputFieldComparisonCell[typeof axis]),
          ).length === 0
        ) {
          throw new Error(
            `NOT-COMPARABLE: ${library} has zero coverage for ${axis}=${value}`,
          );
        }
      }
    }
  }
}

export interface ReviewedSourceInputFieldAdapter {
  packageName: string;
  exactVersion: string;
  externalOwner: string;
  component: "TextField";
  sandbox: string;
  wrapper: string;
  manualSetupSeconds: number;
  recipeSelection: {
    recipe: "input-field@1";
    mechanism: "manual-human-review";
    selectedBy: string;
    reviewedAt: string;
  };
  text: {
    label: string;
    placeholder: string;
    value: string;
    helper: string;
    error: string;
    leading: string;
    trailing: string;
  };
  sourceApiMap: {
    size: Record<InputFieldComparisonSize, string>;
    state: Record<InputFieldComparisonState, string>;
    content: Record<InputFieldComparisonContent, string>;
    required: Record<InputFieldComparisonRequired, string>;
    adornments: Record<InputFieldComparisonAdornments, string>;
  };
  fixedSourceProps: Record<string, string>;
  unsupportedAgreedCells: string[];
  unsupportedMappingsOutsideMatrix: string[];
  legacyUnsupportedMappings: string[];
  mappingDecisions: string[];
}

const selection = {
  recipe: "input-field@1",
  mechanism: "manual-human-review",
  selectedBy: "recipe-pivot-input-field-comparison-review",
  reviewedAt: "2026-08-26T23:10:00-05:00",
} as const;

export const REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS: Record<
  InputFieldComparisonLibrary,
  ReviewedSourceInputFieldAdapter
> = {
  mui: {
    packageName: "@mui/material",
    exactVersion: "9.2.0",
    externalOwner: "MUI package publisher",
    component: "TextField",
    sandbox: "recipe/sandboxes/input-field-mui",
    wrapper: "ThemeProvider(createTheme({ cssVariables: true }))",
    manualSetupSeconds: 1860,
    recipeSelection: selection,
    text: {
      label: "Amount",
      placeholder: "Enter an amount",
      value: "125.00",
      helper: "Enter a valid amount",
      error: "Amount is invalid",
      leading: "$",
      trailing: "USD",
    },
    sourceApiMap: {
      size: { small: 'size="small"', medium: 'size="medium"' },
      state: {
        default: "no state prop",
        "focus-visible": "focused=true",
        error: "error=true with error helper text",
        disabled: "disabled=true",
      },
      content: {
        placeholder: 'value="" plus placeholder',
        value: "controlled non-empty value",
      },
      required: { false: "required=false", true: "required=true" },
      adornments: {
        none: "no input adornment",
        both: "slotProps.input.startAdornment and endAdornment mount real InputAdornment components",
      },
    },
    fixedSourceProps: { variant: "outlined", type: "text" },
    unsupportedAgreedCells: [],
    unsupportedMappingsOutsideMatrix: [
      "Adornments=leading",
      "Adornments=trailing",
      "Variant=filled",
      "Variant=standard",
      "multiline",
      "select",
      "non-text input types",
      "hover",
      "pressed",
    ],
    legacyUnsupportedMappings: [
      "State (legacy contract captured error as a fixed source prop)",
      "Content (legacy contract carries no value or placeholder prop)",
      "Required (legacy contract carries no required prop)",
      "Adornments (legacy contract captured both as fixed nested instances)",
    ],
    mappingDecisions: [
      "MUI outlined is the reviewed source shape for input-field@1.",
      "MUI small maps to recipe Size=small.",
      "MUI medium maps to recipe Size=medium.",
      "No state prop maps to State=default.",
      "focused=true maps to State=focus-visible.",
      "error=true maps to State=error.",
      "disabled=true maps to State=disabled.",
      "An empty controlled value maps to Content=placeholder.",
      "A non-empty controlled value maps to Content=value.",
      "required maps directly to Required.",
      "No adornments maps to Adornments=none.",
      "Two real InputAdornment elements map to Adornments=both.",
    ],
  },
  polaris: {
    packageName: "@shopify/polaris",
    exactVersion: "13.9.5",
    externalOwner: "Shopify Polaris package publisher",
    component: "TextField",
    sandbox: "recipe/sandboxes/input-field-polaris",
    wrapper: "AppProvider(i18n=en)",
    manualSetupSeconds: 1740,
    recipeSelection: selection,
    text: {
      label: "Store name",
      placeholder: "Enter a store name",
      value: "Jaded Pixel",
      helper: "Shown to customers.",
      error: "Store name is required",
      leading: "$",
      trailing: "USD",
    },
    sourceApiMap: {
      size: { small: 'size="slim"', medium: 'size="medium"' },
      state: {
        default: "no state prop",
        "focus-visible": "focused=true",
        error: 'error="Store name is required"',
        disabled: "disabled=true",
      },
      content: {
        placeholder: 'value="" plus placeholder',
        value: "controlled non-empty value",
      },
      required: {
        false: "requiredIndicator=false",
        true: "requiredIndicator=true",
      },
      adornments: {
        none: "no prefix or suffix",
        both: "prefix and suffix React text nodes",
      },
    },
    fixedSourceProps: {
      variant: "inherit",
      type: "text",
      autoComplete: "off",
    },
    unsupportedAgreedCells: [],
    unsupportedMappingsOutsideMatrix: [
      "Adornments=leading",
      "Adornments=trailing",
      "Variant=borderless",
      "multiline",
      "suggestion",
      "autoSize",
      "clearButton",
      "loading",
      "hover",
      "active",
    ],
    legacyUnsupportedMappings: [
      "State=error (legacy contract carries no error prop or error message)",
      "Helper text (legacy contract carries no helpText prop)",
    ],
    mappingDecisions: [
      "Polaris inherit is the reviewed source shape for input-field@1.",
      "Polaris slim maps to recipe Size=small.",
      "Polaris medium maps to recipe Size=medium.",
      "No state prop maps to State=default.",
      "focused=true maps to State=focus-visible.",
      "A non-empty error string maps to State=error.",
      "disabled=true maps to State=disabled.",
      "An empty controlled value maps to Content=placeholder.",
      "A non-empty controlled value maps to Content=value.",
      "requiredIndicator maps to Required.",
      "No prefix or suffix maps to Adornments=none.",
      "Both prefix and suffix map to Adornments=both.",
    ],
  },
};

validateInputFieldComparisonMatrix(INPUT_FIELD_COMPARISON_CELLS);

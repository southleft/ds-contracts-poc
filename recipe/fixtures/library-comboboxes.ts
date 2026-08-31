import type {
  ComboboxFactCategory,
  ReviewedComboboxAdapterConfig,
  ReviewedComboboxSource,
  ReviewedComboboxSourceFact,
} from "../adapters/combobox.js";
import { canonicalComboboxRecipeInstance } from "./combobox.js";
import type { ComboboxRecipeInstance } from "../recipes/combobox.js";

export const muiComboboxSource: ReviewedComboboxSource = {
  packageName: "@mui/material",
  version: "9.2.0",
  exportName: "Autocomplete",
  framework: "react",
  sourceRoot: "recipe/sandboxes/input-field-mui/node_modules/@mui/material",
  anatomy: {
    trigger:
      "Autocomplete.js:730-768 renderInput root with startAdornment/endAdornment",
    input: "Autocomplete.d.ts:69-84 AutocompleteRenderInputParams.htmlInput",
    popup: "Autocomplete.js:772-791 Popper > Paper > Listbox",
    listbox: "Autocomplete.d.ts:103-117 listbox, paper, and popper slots",
    option:
      "Autocomplete.js:714-727 getOptionProps + renderOption selected/index/inputValue state",
  },
  api: {
    selection: "value/defaultValue/onChange",
    query: "inputValue/defaultInputValue/onInputChange",
    open: "open/defaultOpen/onOpen/onClose",
    highlighted: "onHighlightChange/renderOption",
    disabledOptions: "getOptionDisabled",
    controls: "clearIcon/popupIcon/forcePopupIcon",
    emptyLoading: "noOptionsText/loading/loadingText",
    sizeAppearance: "size + renderInput(TextField variant)",
    aria: "useAutocomplete getInputProps/getListboxProps/getOptionProps",
    multiple: "multiple",
  },
  styleSources: [
    "Autocomplete.js:330-379 listbox/option padding and option states",
    "Autocomplete.js:308-315 AutocompletePaper styled(Paper) typography+overflow only",
    "Paper/Paper.js:48-70 elevation Paper fill palette.background.paper, no border; default elevation=1",
    "Paper/Paper.js:84 elevation default 1; theme.shadows[1] is three-layer — not a combobox@1 single drop-shadow",
    "examples/mui/tokens/mui.dtcg.json palette-background-paper #fff, shape-border-radius 4px, shadows-1",
    "OutlinedInput/OutlinedInput.js and FilledInput/FilledInput.js via renderInput",
  ],
  fontSources: [
    "styles/createTypography.js:23-30 Roboto, Helvetica, Arial, sans-serif",
  ],
};

export const antdComboboxSource: ReviewedComboboxSource = {
  packageName: "antd",
  version: "5.29.3",
  exportName: "Select",
  framework: "react",
  sourceRoot:
    "antd@5.29.3 package tarball, inspected under temporary npm prefix",
  anatomy: {
    trigger: "antd/es/select/index.js:202-234 RcSelect selector forwarding",
    input: "rc-select BaseSelect editable search input",
    popup:
      "antd/es/select/index.js:174-180 bottomLeft/bottomRight placement and RcSelect popup",
    listbox: "rc-select OptionList role=listbox",
    option: "rc-select option data with disabled/value/label",
  },
  api: {
    selection: "value/defaultValue/onChange",
    query: "showSearch/searchValue/onSearch",
    open: "open/defaultOpen/onOpenChange",
    highlighted: "onActiveValue",
    disabledOptions: "options[].disabled",
    controls: "prefix/allowClear/suffixIcon",
    emptyLoading: "notFoundContent/loading",
    sizeAppearance: "size + variant",
    aria: "rc-select combobox/listbox/option relationships",
    multiple: "mode=multiple",
  },
  styleSources: [
    "antd/es/select/style/token.js:39-59 option and selector component tokens",
    "antd/es/select/style/dropdown padding token.paddingXXS; empty item uses genItemStyle optionPadding",
    "examples/antd/tokens/antd.dtcg.json color-bg-elevated, color-border, border-radius-lg, padding-xxs, control-padding-horizontal, control-padding-horizontal-sm, box-shadow-secondary",
    "antd/es/select/style/variants.js outlined/filled state rules",
  ],
  fontSources: [
    "extract/computed/configs/antd.json mount token.fontFamily pin to Roboto",
  ],
};

const cloneTokens = (
  prefix: string,
  mutate: (path: string, fallback: string | number) => string | number,
): ComboboxRecipeInstance["tokens"] => {
  const tokens = structuredClone(
    canonicalComboboxRecipeInstance.tokens,
  ) as ComboboxRecipeInstance["tokens"];
  const visit = (value: unknown, path: string): void => {
    if (value === null || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (
      typeof record.variable === "string" &&
      (typeof record.fallback === "string" ||
        typeof record.fallback === "number")
    ) {
      record.variable = `${prefix}.${path.replaceAll(".", "-")}`;
      record.fallback = mutate(path, record.fallback);
      return;
    }
    for (const [key, child] of Object.entries(record))
      visit(child, path ? `${path}.${key}` : key);
  };
  visit(tokens, "");
  for (const size of Object.values(tokens.sizes))
    size.overlayGap.variable = `${size.stackGap.variable}.overlay`;
  return tokens;
};

const muiTokens = cloneTokens("mui.autocomplete", (path, fallback) => {
  if (path.endsWith("small.width") || path.endsWith("medium.width")) return 300;
  if (path.endsWith("small.triggerHeight")) return 40;
  if (path.endsWith("medium.triggerHeight")) return 56;
  // Autocomplete.js:342 AutocompleteListbox padding: '8px 0'
  if (path.endsWith("small.listPadding") || path.endsWith("medium.listPadding"))
    return 8;
  // Autocomplete.js:360-361 option paddingLeft/Right 16
  if (
    path.endsWith("small.optionPaddingX") ||
    path.endsWith("medium.optionPaddingX")
  )
    return 16;
  // Paper.js:56 theme.shape.borderRadius; mui.dtcg.json shape-border-radius 4px
  if (path === "overlayRadius") return 4;
  // Paper.js:48 palette.background.paper; mui.dtcg.json palette-background-paper #fff
  if (path === "overlay.background") return "#ffffffff";
  // Paper elevation variant has no border (outlined variant only). Named: unpainted.
  if (path === "overlay.border") return "#00000000";
  // overlay.shadow stays fixture #00000026 — Paper elevation 1 uses theme.shadows[1]
  // (three layers). combobox@1 overlay is one drop-shadow, color-bound,
  // geometry hardcoded offsetY:4 blur:12. Do not invent a collapse.
  if (path.includes("optionStates.highlighted.background")) return "#0000000a";
  if (path.includes("optionStates.selected.background")) return "#1976d214";
  if (path.includes("fieldStates.error.border")) return "#d32f2fff";
  if (path.includes("fieldStates.loading.control")) return "#1976d2ff";
  return fallback;
});
muiTokens.typography = Object.fromEntries(
  Object.entries(muiTokens.typography).map(([role, spec]) => [
    role,
    {
      ...spec,
      requestedFamily: "Roboto",
      requestSource: `recipe/sandboxes/input-field-mui/node_modules/@mui/material/Autocomplete/Autocomplete.js#${role}`,
      fallbackChain: [
        { family: "Roboto", style: spec.requestedStyle },
        { family: "Helvetica", style: spec.requestedStyle },
        { family: "Arial", style: spec.requestedStyle },
      ],
      resolvedFamily: "Roboto",
    },
  ]),
) as ComboboxRecipeInstance["tokens"]["typography"];

const antdTokens = cloneTokens("antd.select", (path, fallback) => {
  if (path.endsWith("small.width") || path.endsWith("medium.width")) return 300;
  if (path.endsWith("small.triggerHeight")) return 24;
  if (path.endsWith("medium.triggerHeight")) return 32;
  if (
    path.endsWith("small.optionHeight") ||
    path.endsWith("medium.optionHeight")
  )
    return 32;
  // antd.dtcg.json padding-xxs 4px — Select dropdown padding
  if (path.endsWith("small.listPadding") || path.endsWith("medium.listPadding"))
    return 4;
  // antd.dtcg.json control-padding-horizontal-sm 8px / control-padding-horizontal 12px
  // Empty-item optionPadding is a computed formula; do not teach that px.
  // Horizontal named tokens land on optionPaddingX. Status-slot 14/16 deferred.
  if (path.endsWith("small.optionPaddingX")) return 8;
  if (path.endsWith("medium.optionPaddingX")) return 12;
  // antd.dtcg.json border-radius-lg 8px
  if (path === "overlayRadius") return 8;
  // antd.dtcg.json color-bg-elevated #ffffff
  if (path === "overlay.background") return "#ffffffff";
  // antd.dtcg.json color-border #d9d9d9
  if (path === "overlay.border") return "#d9d9d9ff";
  // overlay.shadow stays fixture #00000026 — box-shadow-secondary is three-layer.
  if (path.includes("optionStates.highlighted.background")) return "#0000000a";
  if (path.includes("optionStates.selected.background")) return "#e6f4ffff";
  if (path.includes("optionStates.selected.text")) return "#000000e0";
  if (path.includes("fieldStates.error.border")) return "#ff4d4fff";
  if (path.includes("fieldStates.default.border")) return "#d9d9d9ff";
  if (path.includes("appearances.filled.background")) return "#0000000a";
  if (path.includes("fieldStates.loading.control")) return "#1677ffff";
  return fallback;
});
antdTokens.typography = Object.fromEntries(
  Object.entries(antdTokens.typography).map(([role, spec]) => [
    role,
    {
      ...spec,
      requestedFamily: "Roboto",
      requestSource: `extract/computed/configs/antd.json#fonts/${role}`,
      fallbackChain: [
        { family: "Roboto", style: spec.requestedStyle },
        { family: "Helvetica", style: spec.requestedStyle },
        { family: "Arial", style: spec.requestedStyle },
      ],
      resolvedFamily: "Roboto",
    },
  ]),
) as ComboboxRecipeInstance["tokens"]["typography"];

const categoryForToken = (landing: string): ComboboxFactCategory => {
  if (landing.startsWith("tokens.typography")) return "typography";
  if (landing.startsWith("tokens.fieldStates")) return "state";
  if (
    landing.includes("background") ||
    landing.includes("border") ||
    landing.includes("text") ||
    landing.includes("shadow") ||
    landing.includes("control")
  )
    return "fill";
  return "geometry";
};

const tokenFacts = (
  sourceSlug: string,
  evidence: string,
  value: unknown,
  path = "tokens",
  facts: ReviewedComboboxSourceFact[] = [],
): ReviewedComboboxSourceFact[] => {
  if (value === null || typeof value !== "object") {
    if (path.startsWith("tokens.typography")) {
      facts.push({
        occurrenceId: `${sourceSlug}-ir-${facts.length + 1}`,
        category: "typography",
        source: {
          kind: "review",
          evidence: `${evidence}; reviewed font provenance field ${path}=${String(value)}`,
        },
        disposition: "ir",
        target: path,
      });
    }
    return facts;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.variable === "string" &&
    (typeof record.fallback === "string" || typeof record.fallback === "number")
  ) {
    facts.push({
      occurrenceId: `${sourceSlug}-ir-${facts.length + 1}`,
      category: categoryForToken(path),
      source: {
        kind: "review",
        evidence: `${evidence}; reviewed ${record.variable}=${record.fallback}`,
      },
      disposition: "ir",
      target: path,
    });
    return facts;
  }
  for (const [key, child] of Object.entries(record))
    tokenFacts(sourceSlug, evidence, child, `${path}.${key}`, facts);
  return facts;
};

const commonFacts = (
  slug: string,
  source: ReviewedComboboxSource,
  tokens: ComboboxRecipeInstance["tokens"],
): ReviewedComboboxSourceFact[] => {
  const facts = tokenFacts(
    slug,
    `${source.packageName}@${source.version} source/style review`,
    tokens,
  );
  facts.push(
    {
      occurrenceId: `${slug}-anatomy-options`,
      category: "anatomy",
      source: {
        kind: "pointer",
        pointer: "/anatomy/option",
        expected: source.anatomy.option,
      },
      disposition: "ir",
      target: "content.options",
    },
    {
      occurrenceId: `${slug}-semantics-aria`,
      category: "semantics",
      source: {
        kind: "pointer",
        pointer: "/api/aria",
        expected: source.api.aria,
      },
      disposition: "extension",
      target: "combobox/aria",
    },
    {
      occurrenceId: `${slug}-api-events`,
      category: "api",
      source: {
        kind: "pointer",
        pointer: "/api/selection",
        expected: source.api.selection,
      },
      disposition: "extension",
      target: "combobox/events",
    },
    {
      occurrenceId: `${slug}-api-keyboard`,
      category: "api",
      source: {
        kind: "review",
        evidence: `${source.packageName}@${source.version} delegates ArrowUp/ArrowDown/Enter/Escape to its combobox engine`,
      },
      disposition: "extension",
      target: "combobox/keyboard",
    },
    {
      occurrenceId: `${slug}-api-focus`,
      category: "api",
      source: {
        kind: "review",
        evidence: `${source.packageName}@${source.version} retains input focus while active-descendant moves`,
      },
      disposition: "extension",
      target: "combobox/focus-retention",
    },
    {
      occurrenceId: `${slug}-refusal-multiple`,
      category: "refusal",
      source: {
        kind: "pointer",
        pointer: "/api/multiple",
        expected: source.api.multiple,
      },
      disposition: "refusal",
      target:
        "combobox@1 bounded single-selection proof; comparable multiple tags are deferred",
    },
  );
  return facts;
};

const content = (
  label: string,
  placeholder: string,
): ComboboxRecipeInstance["content"] => ({
  ...structuredClone(canonicalComboboxRecipeInstance.content),
  label: { property: "Label", default: label },
  placeholder: { property: "Placeholder", default: placeholder },
});

const slots = (prefix: string): ComboboxRecipeInstance["slots"] => ({
  leading: {
    property: "Leading control",
    componentRef: `${prefix}/prefix`,
  },
  clear: {
    property: "Clear indicator",
    componentRef: `${prefix}/clear`,
  },
  popup: {
    property: "Popup indicator",
    componentRef: `${prefix}/popup`,
  },
  selected: {
    property: "Selected indicator",
    componentRef: `${prefix}/selected`,
  },
});

const selection = (source: string, mappings: number) => ({
  candidates: [{ id: "combobox", version: 1 }],
  selectedBy: "recipe-pivot-combobox-review",
  mechanism: "reviewed-config" as const,
  source,
  reviewedAt: "2026-08-27T00:00:00.000Z",
  manualCost: {
    value: mappings,
    unit: "reviewed-mapping" as const,
    note: `${mappings} explicit occurrence mappings plus source setup; no source-name inference`,
  },
});

const buildConfig = (
  slug: string,
  source: ReviewedComboboxSource,
  sourcePath: string,
  identity: { id: string; name: string },
  sourceContent: ComboboxRecipeInstance["content"],
  sourceSlots: ComboboxRecipeInstance["slots"],
  tokens: ComboboxRecipeInstance["tokens"],
  setupSeconds: number,
  wrapper: string,
  unsupportedCells: string[],
): ReviewedComboboxAdapterConfig => {
  const sourceFacts = commonFacts(slug, source, tokens);
  const manualMappings = sourceFacts.map(
    (fact) => `${fact.occurrenceId}→${fact.disposition}:${fact.target}`,
  );
  return {
    sourcePath,
    generatedAt: "2026-08-27T00:00:00.000Z",
    selection: selection(
      `recipe/fixtures/library-comboboxes.ts#${slug}`,
      manualMappings.length,
    ),
    identity,
    content: sourceContent,
    slots: sourceSlots,
    tokens,
    sourceFacts,
    manualMappings,
    benchmark: {
      packageName: source.packageName,
      version: source.version,
      exportName: source.exportName,
      importPath: source.packageName,
      wrapper,
      setupSeconds,
      sourceHarness: source.sourceRoot,
      sourceMatrixCells: COMBOBOX_PAIRED_PROOF_PROTOCOL.cellsPerSource,
      unsupportedCells,
      captureCommand:
        "deferred: source references must be rendered in a separately authorized matched-benchmark task",
      renderedReferences: false,
      graded: false,
    },
  };
};

export const COMBOBOX_PAIRED_PROOF_PROTOCOL = {
  artifactVersion: "combobox-paired-proof-protocol-v1",
  frozenBeforeResults: true,
  resultStatus: "not-run",
  sources: ["@mui/material@9.2.0#Autocomplete", "antd@5.29.3#Select"],
  cellsPerSource: 12,
  totalCells: 24,
  cells: [
    "small-outlined-closed-default-options",
    "medium-filled-closed-default-options",
    "medium-outlined-open-default-options",
    "small-filled-open-default-options",
    "medium-outlined-open-disabled-options",
    "medium-outlined-open-error-options",
    "medium-filled-open-loading-options",
    "medium-outlined-open-default-empty",
    "small-outlined-closed-error-empty",
    "small-filled-closed-disabled-empty",
    "medium-filled-closed-loading-options",
    "small-outlined-open-error-empty",
  ],
  requiredRoles: [
    "combobox/trigger",
    "combobox/input",
    "combobox/overlay",
    "combobox/listbox",
    "combobox/option-instance/0",
    "combobox/option-instance/1",
    "combobox/option-instance/2",
    "combobox/option-instance/3",
    "combobox/option/small/default",
    "combobox/option/small/highlighted",
    "combobox/option/small/selected",
    "combobox/option/small/disabled",
    "combobox/option/medium/default",
    "combobox/option/medium/highlighted",
    "combobox/option/medium/selected",
    "combobox/option/medium/disabled",
    "combobox/control/leading",
    "combobox/control/clear",
    "combobox/control/popup",
    "combobox/label",
    "combobox/message/helper",
    "combobox/message/error",
    "combobox/listbox/empty",
    "combobox/listbox/loading",
  ],
  expected: {
    axes: 6,
    comboboxVariants: 64,
    optionVariants: 8,
    components: 72,
    optionOccurrencesInIr: 48,
    instances: 242,
  },
  performanceBoundsMs: {
    adaptCompileCollapseTwoCyclesPerSource: 1500,
    outputEmissionPerSource: 750,
  },
  comparison: {
    legacyContext:
      "4/4 sets over six weak variants; context only, never the target",
    matchedLegacyFixtureRequiredBeforeBenchmark: true,
    sourceReferencesRendered: false,
    aiGrading: false,
    liveFigma: false,
  },
} as const;

export const muiComboboxAdapterConfig = buildConfig(
  "mui-combobox",
  muiComboboxSource,
  "examples/mui/contracts/autocomplete.contract.json + @mui/material@9.2.0 source",
  {
    id: "mui.autocomplete.recipe-combobox",
    name: "MUI Autocomplete / combobox@1 offline fixture",
  },
  content("Assignee", "Choose a person"),
  slots("source/mui-autocomplete"),
  muiTokens,
  1080,
  "ThemeProvider(createTheme({ cssVariables: true })) + renderInput(TextField)",
  [
    "multiple/tag rendering is deferred from combobox@1 despite source support",
    "freeSolo, grouping, virtualization tuning, and custom renderers are outside the bounded proof",
    "source screenshots, grading, and live Figma are not performed in this offline task",
  ],
);

export const antdComboboxAdapterConfig = buildConfig(
  "antd-combobox",
  antdComboboxSource,
  "extract/computed/configs/antd.json + antd@5.29.3 Select source",
  {
    id: "antd.select.recipe-combobox",
    name: "AntD Select / combobox@1 offline fixture",
  },
  content("Assignee", "Choose a person"),
  slots("source/antd-select"),
  antdTokens,
  900,
  "ConfigProvider(theme cssVar key=antd, hashed=false, wave disabled)",
  [
    "multiple/tags mode is deferred from combobox@1 despite source support",
    "tags, custom popup render, virtualization tuning, and secret combobox mode are outside the bounded proof",
    "source screenshots, grading, and live Figma are not performed in this offline task",
  ],
);

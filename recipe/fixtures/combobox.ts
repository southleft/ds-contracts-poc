import type {
  ComboboxColorParameter,
  ComboboxFontSpec,
  ComboboxNumberParameter,
  ComboboxRecipeInstance,
} from "../recipes/combobox.js";

const number = (
  variable: string,
  fallback: number,
): ComboboxNumberParameter => ({ variable, fallback });
const color = (
  variable: string,
  fallback: `#${string}`,
): ComboboxColorParameter => ({ variable, fallback });
const font = (role: string, style = "Regular"): ComboboxFontSpec => ({
  requestedFamily: "Inter",
  requestedStyle: style,
  requestSource: `recipe/fixtures/combobox.ts#${role}`,
  fallbackChain: [
    { family: "Inter", style },
    { family: "Arial", style: style === "Medium" ? "Bold" : "Regular" },
  ],
  resolvedFamily: "Inter",
  resolvedStyle: style,
  resolution: "requested",
});
const size = (name: "small" | "medium", scale: number) => ({
  width: number(`combobox.${name}.width`, name === "small" ? 280 : 320),
  triggerHeight: number(`combobox.${name}.trigger-height`, 36 + scale * 8),
  paddingX: number(`combobox.${name}.padding-x`, 10 + scale * 2),
  gap: number(`combobox.${name}.gap`, 6 + scale * 2),
  controlSize: number(`combobox.${name}.control-size`, 16 + scale * 4),
  optionHeight: number(`combobox.${name}.option-height`, 32 + scale * 4),
  optionPaddingX: number(`combobox.${name}.option-padding-x`, 10 + scale * 2),
  overlayGap: number(`combobox.${name}.stack-gap.overlay`, 4),
  listPadding: number(`combobox.${name}.list-padding`, 4),
  stackGap: number(`combobox.${name}.stack-gap`, 4 + scale * 2),
  inputFontSize: number(`combobox.${name}.input-font-size`, 14 + scale * 2),
  inputLineHeight: number(`combobox.${name}.input-line-height`, 20 + scale * 4),
  labelFontSize: number(`combobox.${name}.label-font-size`, 12 + scale * 2),
  labelLineHeight: number(`combobox.${name}.label-line-height`, 16 + scale * 4),
  helperFontSize: number(`combobox.${name}.helper-font-size`, 12),
  helperLineHeight: number(`combobox.${name}.helper-line-height`, 16),
});
const field = (
  name: string,
  values: {
    border: `#${string}`;
    text: `#${string}`;
    placeholder: `#${string}`;
    label: `#${string}`;
    helper: `#${string}`;
    control: `#${string}`;
  },
) => ({
  border: color(`combobox.${name}.border`, values.border),
  text: color(`combobox.${name}.text`, values.text),
  placeholder: color(`combobox.${name}.placeholder`, values.placeholder),
  label: color(`combobox.${name}.label`, values.label),
  helper: color(`combobox.${name}.helper`, values.helper),
  control: color(`combobox.${name}.control`, values.control),
});
const option = (
  name: string,
  background: `#${string}`,
  textColor: `#${string}`,
) => ({
  background: color(`combobox.option.${name}.background`, background),
  text: color(`combobox.option.${name}.text`, textColor),
});

export const canonicalComboboxRecipeInstance = {
  identity: { id: "ds.combobox", name: "Combobox" },
  semantic: {
    control: "editable-input",
    selection: "single",
    popup: "listbox",
    activeOption: "aria-activedescendant",
    label: "explicit-id",
    description: "aria-describedby",
  },
  axes: {
    size: { name: "Size", values: ["small", "medium"], default: "medium" },
    appearance: {
      name: "Appearance",
      values: ["outlined", "filled"],
      default: "outlined",
    },
    open: { name: "Open", values: ["false", "true"], default: "false" },
    fieldState: {
      name: "Field state",
      values: ["default", "disabled", "error", "loading"],
      default: "default",
    },
    content: {
      name: "Content",
      values: ["options", "empty"],
      default: "options",
    },
    optionState: {
      name: "Option state",
      values: ["default", "highlighted", "selected", "disabled"],
      default: "default",
    },
  },
  content: {
    label: { property: "Label", default: "Assignee" },
    placeholder: { property: "Placeholder", default: "Choose a person" },
    helper: { property: "Helper text", default: "Type to filter people." },
    error: { property: "Error text", default: "Choose an available person." },
    empty: { property: "Empty text", default: "No options" },
    loading: { property: "Loading text", default: "Loading…" },
    options: [
      { value: "ada", label: "Ada Lovelace", disabled: false },
      { value: "grace", label: "Grace Hopper", disabled: false },
      { value: "linus", label: "Linus Torvalds", disabled: true },
      { value: "margaret", label: "Margaret Hamilton", disabled: false },
    ],
    selectedValue: "ada",
    query: "",
  },
  slots: {
    leading: {
      property: "Leading control",
      componentRef: "combobox-leading@1",
    },
    clear: {
      property: "Clear indicator",
      componentRef: "combobox-clear@1",
    },
    popup: {
      property: "Popup indicator",
      componentRef: "combobox-popup@1",
    },
    selected: {
      property: "Selected indicator",
      componentRef: "combobox-selected@1",
    },
  },
  designerEditSurface: {
    textProperties: [
      "Label",
      "Placeholder",
      "Helper text",
      "Error text",
      "Empty text",
      "Loading text",
    ],
    variantProperties: [
      "Size",
      "Appearance",
      "Open",
      "Field state",
      "Content",
      "Option state",
    ],
    instanceSwapProperties: [
      "Leading control",
      "Clear indicator",
      "Popup indicator",
      "Selected indicator",
    ],
    optionCollection: {
      componentRef: "combobox@1/option",
      repeatedAs: "instances",
      editableProperties: ["Label", "Value", "Disabled"],
    },
    resize: {
      root: "fixed-width",
      trigger: "fill-container",
      overlay: "match-trigger-width",
      vertical: "hug-contents",
    },
    structuralEdits: "refuse",
  },
  publicApi: {
    controlled: ["open", "value", "inputValue"],
    uncontrolled: ["defaultOpen", "defaultValue", "defaultInputValue"],
    events: ["onOpenChange", "onInputChange", "onChange", "onHighlightChange"],
    keyboard: ["ArrowDown", "ArrowUp", "Enter", "Escape"],
  },
  tokens: {
    sizes: { small: size("small", 0), medium: size("medium", 1) },
    appearances: {
      outlined: {
        background: color("combobox.outlined.background", "#ffffffff"),
      },
      filled: {
        background: color("combobox.filled.background", "#f3f4f6ff"),
      },
    },
    fieldStates: {
      default: field("default", {
        border: "#8a8a8aff",
        text: "#202020ff",
        placeholder: "#6b7280ff",
        label: "#202020ff",
        helper: "#5f6368ff",
        control: "#5f6368ff",
      }),
      disabled: field("disabled", {
        border: "#d1d5dbff",
        text: "#9ca3afff",
        placeholder: "#9ca3afff",
        label: "#9ca3afff",
        helper: "#9ca3afff",
        control: "#9ca3afff",
      }),
      error: field("error", {
        border: "#c62828ff",
        text: "#202020ff",
        placeholder: "#6b7280ff",
        label: "#c62828ff",
        helper: "#c62828ff",
        control: "#5f6368ff",
      }),
      loading: field("loading", {
        border: "#8a8a8aff",
        text: "#202020ff",
        placeholder: "#6b7280ff",
        label: "#202020ff",
        helper: "#5f6368ff",
        control: "#2563ebff",
      }),
    },
    optionStates: {
      default: option("default", "#ffffffff", "#202020ff"),
      highlighted: option("highlighted", "#e8f0feff", "#202020ff"),
      selected: option("selected", "#dbeafeff", "#1d4ed8ff"),
      disabled: option("disabled", "#ffffffff", "#9ca3afff"),
    },
    overlay: {
      background: color("combobox.overlay.background", "#ffffffff"),
      border: color("combobox.overlay.border", "#d1d5dbff"),
      shadow: color("combobox.overlay.shadow", "#00000026"),
    },
    radius: number("combobox.radius", 6),
    overlayRadius: number("combobox.overlay-radius", 6),
    typography: {
      input: font("input"),
      label: font("label", "Medium"),
      helper: font("helper"),
      option: font("option"),
    },
  },
  inputFacts: [
    { path: "root", channel: "structure" },
    { path: "root", channel: "options" },
    { path: "root", channel: "tokens" },
    { path: "root", channel: "designer-edit-surface" },
    { path: "root", channel: "aria-model" },
    { path: "root", channel: "events" },
    { path: "root", channel: "keyboard" },
    { path: "root", channel: "focus-retention" },
    { path: "root", channel: "recipe-selection" },
  ],
  accounting: {
    carried: [
      { path: "root", channel: "structure" },
      { path: "root", channel: "options" },
      { path: "root", channel: "tokens" },
      { path: "root", channel: "designer-edit-surface" },
    ],
  },
  extensions: [
    {
      id: "combobox/aria",
      kind: "a11y",
      stated:
        "relates combobox, listbox, active option, label, helper, and error ids",
      why: "runtime ARIA relationships are not drawable Figma properties",
      absorbs: [{ path: "root", channel: "aria-model" }],
    },
    {
      id: "combobox/events",
      kind: "behaviour",
      stated: "dispatches open, query, highlight, and selection changes",
      why: "events require executable code",
      absorbs: [{ path: "root", channel: "events" }],
    },
    {
      id: "combobox/keyboard",
      kind: "keyboard",
      stated: "supports ArrowUp/Down, Enter, and Escape",
      why: "keyboard interaction requires executable code",
      absorbs: [{ path: "root", channel: "keyboard" }],
    },
    {
      id: "combobox/focus-retention",
      kind: "behaviour",
      stated: "keeps focus and caret on the editable input while navigating",
      why: "focus ownership is a runtime behavior",
      absorbs: [{ path: "root", channel: "focus-retention" }],
    },
    {
      id: "combobox/recipe-selection",
      kind: "data",
      stated: "records the reviewed combobox@1 selection and setup cost",
      why: "selection provenance is review data",
      absorbs: [{ path: "root", channel: "recipe-selection" }],
    },
  ],
  receipts: [],
  provenance: {
    source: "recipe/fixtures/combobox.ts",
    tool: "combobox@1",
    generatedAt: "2026-08-27T00:00:00.000Z",
    selection: {
      candidates: [{ id: "combobox", version: 1 }],
      selectedBy: "recipe-pivot-combobox-review",
      mechanism: "human-review",
      source: "docs/32-recipe-ir-pivot.md §7",
      reviewedAt: "2026-08-27T00:00:00.000Z",
      manualCost: {
        value: 1,
        unit: "reviewed-mapping",
        note: "one explicit select / combobox to combobox@1 selection",
      },
    },
  },
} as const satisfies ComboboxRecipeInstance;

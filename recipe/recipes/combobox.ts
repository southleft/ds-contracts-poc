import * as z from "zod";

import {
  ENVELOPE_VERSION,
  RecipeEnvelopeSchema,
  checkTotality,
  factId,
  isTotal,
  totalityLines,
  type CodeOnlyExtension,
  type FactRef,
  type LossReceipt,
  type RecipeEnvelope,
} from "../envelope.js";
import {
  ColorSchema,
  type ComponentNode,
  type ComponentSetNode,
  type FrameNode,
  type IRNode,
  type TextNode,
  type VariableBinding,
} from "../figma-ir.js";
import { deriveRecipeIntegrity, hashRecipeEnvelope } from "../hash.js";
import { canonicalJson } from "../normalize.js";
import {
  RecipeRefusal,
  RecipeSelectionSchema,
  requireExactRecipeSelection,
  type Recipe,
  type RecipeRef,
  type RecipeSelection,
} from "../recipe.js";

export const COMBOBOX_RECIPE_REF = {
  id: "combobox",
  version: 1,
} as const satisfies RecipeRef;

export const COMBOBOX_SIZES = ["small", "medium"] as const;
export const COMBOBOX_APPEARANCES = ["outlined", "filled"] as const;
export const COMBOBOX_OPEN = ["false", "true"] as const;
export const COMBOBOX_FIELD_STATES = [
  "default",
  "disabled",
  "error",
  "loading",
] as const;
export const COMBOBOX_CONTENT = ["options", "empty"] as const;
export const COMBOBOX_OPTION_STATES = [
  "default",
  "highlighted",
  "selected",
  "disabled",
] as const;

export type ComboboxSize = (typeof COMBOBOX_SIZES)[number];
export type ComboboxAppearance = (typeof COMBOBOX_APPEARANCES)[number];
export type ComboboxOpen = (typeof COMBOBOX_OPEN)[number];
export type ComboboxFieldState = (typeof COMBOBOX_FIELD_STATES)[number];
export type ComboboxContent = (typeof COMBOBOX_CONTENT)[number];
export type ComboboxOptionState = (typeof COMBOBOX_OPTION_STATES)[number];

export interface ComboboxNumberParameter {
  variable: string;
  fallback: number;
}
export interface ComboboxColorParameter {
  variable: string;
  fallback: string;
}
export interface ComboboxFontSpec {
  requestedFamily: string;
  requestedStyle: string;
  requestSource: string;
  fallbackChain: Array<{ family: string; style: string }>;
  resolvedFamily: string;
  resolvedStyle: string;
  resolution: "requested" | "fallback";
  degradation?: string;
}
export interface ComboboxOption {
  value: string;
  label: string;
  disabled: boolean;
}
interface SizeTokens {
  width: ComboboxNumberParameter;
  triggerHeight: ComboboxNumberParameter;
  paddingX: ComboboxNumberParameter;
  gap: ComboboxNumberParameter;
  controlSize: ComboboxNumberParameter;
  optionHeight: ComboboxNumberParameter;
  optionPaddingX: ComboboxNumberParameter;
  overlayGap: ComboboxNumberParameter;
  listPadding: ComboboxNumberParameter;
  stackGap: ComboboxNumberParameter;
  inputFontSize: ComboboxNumberParameter;
  inputLineHeight: ComboboxNumberParameter;
  labelFontSize: ComboboxNumberParameter;
  labelLineHeight: ComboboxNumberParameter;
  helperFontSize: ComboboxNumberParameter;
  helperLineHeight: ComboboxNumberParameter;
}
interface FieldStateTokens {
  border: ComboboxColorParameter;
  text: ComboboxColorParameter;
  placeholder: ComboboxColorParameter;
  label: ComboboxColorParameter;
  helper: ComboboxColorParameter;
  control: ComboboxColorParameter;
}
interface SurfaceTokens {
  background: ComboboxColorParameter;
}
interface OptionStateTokens {
  background: ComboboxColorParameter;
  text: ComboboxColorParameter;
}

export interface ComboboxRecipeInstance {
  identity: { id: string; name: string };
  semantic: {
    control: "editable-input";
    selection: "single";
    popup: "listbox";
    activeOption: "aria-activedescendant";
    label: "explicit-id";
    description: "aria-describedby";
  };
  axes: {
    size: { name: "Size"; values: ComboboxSize[]; default: ComboboxSize };
    appearance: {
      name: "Appearance";
      values: ComboboxAppearance[];
      default: ComboboxAppearance;
    };
    open: { name: "Open"; values: ComboboxOpen[]; default: "false" };
    fieldState: {
      name: "Field state";
      values: ComboboxFieldState[];
      default: "default";
    };
    content: {
      name: "Content";
      values: ComboboxContent[];
      default: "options";
    };
    optionState: {
      name: "Option state";
      values: ComboboxOptionState[];
      default: "default";
    };
  };
  content: {
    label: { property: "Label"; default: string };
    placeholder: { property: "Placeholder"; default: string };
    helper: { property: "Helper text"; default: string };
    error: { property: "Error text"; default: string };
    empty: { property: "Empty text"; default: string };
    loading: { property: "Loading text"; default: string };
    options: ComboboxOption[];
    selectedValue: string;
    query: string;
  };
  slots: {
    leading: { property: "Leading control"; componentRef: string };
    clear: { property: "Clear indicator"; componentRef: string };
    popup: { property: "Popup indicator"; componentRef: string };
    selected: { property: "Selected indicator"; componentRef: string };
  };
  designerEditSurface: {
    textProperties: string[];
    variantProperties: string[];
    instanceSwapProperties: string[];
    optionCollection: {
      componentRef: "combobox@1/option";
      repeatedAs: "instances";
      editableProperties: ["Label", "Value", "Disabled"];
    };
    resize: {
      root: "fixed-width";
      trigger: "fill-container";
      overlay: "match-trigger-width";
      vertical: "hug-contents";
    };
    structuralEdits: "refuse";
  };
  publicApi: {
    controlled: string[];
    uncontrolled: string[];
    events: string[];
    keyboard: string[];
  };
  tokens: {
    sizes: Record<ComboboxSize, SizeTokens>;
    appearances: Record<ComboboxAppearance, SurfaceTokens>;
    fieldStates: Record<ComboboxFieldState, FieldStateTokens>;
    optionStates: Record<ComboboxOptionState, OptionStateTokens>;
    overlay: {
      background: ComboboxColorParameter;
      border: ComboboxColorParameter;
      shadow: ComboboxColorParameter;
    };
    radius: ComboboxNumberParameter;
    overlayRadius: ComboboxNumberParameter;
    typography: {
      input: ComboboxFontSpec;
      label: ComboboxFontSpec;
      helper: ComboboxFontSpec;
      option: ComboboxFontSpec;
    };
  };
  inputFacts: FactRef[];
  accounting: { carried: FactRef[] };
  extensions: CodeOnlyExtension[];
  receipts: LossReceipt[];
  provenance: {
    source: string;
    tool: "combobox@1";
    generatedAt: string;
    selection: RecipeSelection;
  };
}

const valueList = (actual: readonly string[], expected: readonly string[]) =>
  canonicalJson(actual) === canonicalJson(expected);
const positiveParameter = (value: unknown): value is ComboboxNumberParameter =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as ComboboxNumberParameter).variable === "string" &&
  (value as ComboboxNumberParameter).variable.length > 0 &&
  Number.isFinite((value as ComboboxNumberParameter).fallback) &&
  (value as ComboboxNumberParameter).fallback > 0;
const colorParameter = (value: unknown): value is ComboboxColorParameter =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as ComboboxColorParameter).variable === "string" &&
  (value as ComboboxColorParameter).variable.length > 0 &&
  ColorSchema.safeParse((value as ComboboxColorParameter).fallback).success;

export const ComboboxRecipeInstanceSchema = z
  .custom<ComboboxRecipeInstance>(
    (value) =>
      typeof value === "object" && value !== null && !Array.isArray(value),
    "combobox@1 instance must be an object",
  )
  .superRefine((instance, context) => {
    const fail = (message: string) =>
      context.addIssue({ code: "custom", message });
    if (!instance.identity?.id || !instance.identity?.name)
      fail("identity is required");
    if (
      instance.semantic?.control !== "editable-input" ||
      instance.semantic.selection !== "single" ||
      instance.semantic.popup !== "listbox" ||
      instance.semantic.activeOption !== "aria-activedescendant"
    )
      fail(
        "invalid ARIA/data model: combobox@1 is an editable single-select listbox",
      );
    if (!valueList(instance.axes?.size?.values ?? [], COMBOBOX_SIZES))
      fail("Size axis is not combobox@1");
    if (
      !valueList(instance.axes?.appearance?.values ?? [], COMBOBOX_APPEARANCES)
    )
      fail("Appearance axis is not combobox@1");
    if (!valueList(instance.axes?.open?.values ?? [], COMBOBOX_OPEN))
      fail("Open axis is not combobox@1");
    if (
      !valueList(instance.axes?.fieldState?.values ?? [], COMBOBOX_FIELD_STATES)
    )
      fail("Field state axis is not combobox@1");
    if (!valueList(instance.axes?.content?.values ?? [], COMBOBOX_CONTENT))
      fail("Content axis is not combobox@1");
    if (
      !valueList(
        instance.axes?.optionState?.values ?? [],
        COMBOBOX_OPTION_STATES,
      )
    )
      fail("Option state axis is not combobox@1");
    if (
      !Array.isArray(instance.content?.options) ||
      instance.content.options.length !== 4 ||
      new Set(instance.content.options.map((option) => option.value)).size !== 4
    )
      fail("combobox@1 requires four options with unique values");
    if (
      !instance.content?.options?.some(
        (option) => option.value === instance.content.selectedValue,
      )
    )
      fail("selectedValue must name one option");
    for (const size of COMBOBOX_SIZES)
      for (const value of Object.values(instance.tokens?.sizes?.[size] ?? {}))
        if (!positiveParameter(value)) fail(`${size} size token is invalid`);
    const colors: unknown[] = [
      ...COMBOBOX_APPEARANCES.flatMap((name) =>
        Object.values(instance.tokens?.appearances?.[name] ?? {}),
      ),
      ...COMBOBOX_FIELD_STATES.flatMap((name) =>
        Object.values(instance.tokens?.fieldStates?.[name] ?? {}),
      ),
      ...COMBOBOX_OPTION_STATES.flatMap((name) =>
        Object.values(instance.tokens?.optionStates?.[name] ?? {}),
      ),
      ...Object.values(instance.tokens?.overlay ?? {}).filter(
        (_, index) => index < 3,
      ),
    ];
    if (colors.some((value) => !colorParameter(value)))
      fail("color token is invalid");
    if (
      !positiveParameter(instance.tokens?.radius) ||
      !positiveParameter(instance.tokens?.overlayRadius)
    )
      fail("radius tokens are invalid");
    if (!Array.isArray(instance.inputFacts)) fail("inputFacts are required");
    if (!Array.isArray(instance.accounting?.carried))
      fail("accounting is required");
    if (
      !Array.isArray(instance.extensions) ||
      !Array.isArray(instance.receipts)
    )
      fail("extensions and receipts are required");
    const selection = RecipeSelectionSchema.safeParse(
      instance.provenance?.selection,
    );
    if (!selection.success) fail("reviewed recipe selection is required");
  });

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const sortFacts = (facts: readonly FactRef[]): FactRef[] =>
  [...facts].sort((left, right) => compareText(factId(left), factId(right)));

export function normalizeComboboxRecipeInstance(
  input: unknown,
): ComboboxRecipeInstance {
  const candidate = structuredClone(input) as ComboboxRecipeInstance;
  requireExactRecipeSelection(
    candidate?.provenance?.selection,
    COMBOBOX_RECIPE_REF,
  );
  const parsed = ComboboxRecipeInstanceSchema.parse(candidate);
  return {
    ...parsed,
    inputFacts: sortFacts(parsed.inputFacts),
    accounting: { carried: sortFacts(parsed.accounting.carried) },
    extensions: [...parsed.extensions]
      .map((extension) => ({
        ...extension,
        absorbs: sortFacts(extension.absorbs),
      }))
      .sort((left, right) => compareText(left.id, right.id)),
    receipts: [...parsed.receipts].sort((left, right) =>
      compareText(factId(left.fact), factId(right.fact)),
    ),
  };
}

const hug = { mode: "hug" } as const;
const fill = { mode: "fill" } as const;
const fixed = (value: number) => ({ mode: "fixed", value }) as const;
const solid = (color: string) => ({ kind: "solid", color }) as const;
const bind = (
  field: string,
  parameter: ComboboxNumberParameter | ComboboxColorParameter,
): VariableBinding => ({
  field,
  type: field.endsWith(".color") ? "COLOR" : "FLOAT",
  variable: parameter.variable,
});
const corners = (value: number) => ({
  topLeft: value,
  topRight: value,
  bottomRight: value,
  bottomLeft: value,
});
const fontFacts = (
  font: ComboboxFontSpec,
  size: ComboboxNumberParameter,
  lineHeight: ComboboxNumberParameter,
) => ({
  fontFamily: font.resolvedFamily,
  fontStyle: font.resolvedStyle,
  fontProvenance: font,
  fontSize: size.fallback,
  lineHeight: { unit: "px" as const, value: lineHeight.fallback },
});
const text = (
  role: string,
  characters: string,
  font: ComboboxFontSpec,
  size: ComboboxNumberParameter,
  lineHeight: ComboboxNumberParameter,
  color: ComboboxColorParameter,
  width: typeof hug | typeof fill = hug,
): TextNode => ({
  kind: "text",
  role,
  label: role,
  characters,
  type: fontFacts(font, size, lineHeight),
  align: "left",
  verticalAlign: "center",
  fills: [solid(color.fallback)],
  width,
  height: hug,
  bindings: [
    bind("type.fontSize", size),
    bind("type.lineHeight.value", lineHeight),
    bind("fills.0.color", color),
  ],
});
const controlInstance = (
  role: string,
  componentRef: string,
  size: SizeTokens,
  color: ComboboxColorParameter,
  visible = true,
): IRNode => ({
  kind: "instance",
  role,
  label: role,
  componentRef,
  properties: {},
  fills: [solid(color.fallback)],
  width: fixed(size.controlSize.fallback),
  height: fixed(size.controlSize.fallback),
  visible,
  bindings: [
    bind("width.value", size.controlSize),
    bind("height.value", size.controlSize),
    bind("fills.0.color", color),
  ],
});
const variantRole = (
  size: ComboboxSize,
  appearance: ComboboxAppearance,
  open: ComboboxOpen,
  state: ComboboxFieldState,
  content: ComboboxContent,
) => `combobox/variant/${size}/${appearance}/${open}/${state}/${content}`;

const optionComponent = (
  instance: ComboboxRecipeInstance,
  sizeName: ComboboxSize,
  state: ComboboxOptionState,
): ComponentNode => {
  const size = instance.tokens.sizes[sizeName];
  const colors = instance.tokens.optionStates[state];
  return {
    kind: "component",
    role: `combobox/option/${sizeName}/${state}`,
    label: `Size=${sizeName}, Option state=${state}`,
    variantProperties: { Size: sizeName, "Option state": state },
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "center",
      itemSpacing: size.gap.fallback,
      padding: {
        top: 0,
        right: size.optionPaddingX.fallback,
        bottom: 0,
        left: size.optionPaddingX.fallback,
      },
      width: fixed(size.width.fallback),
      height: fixed(size.optionHeight.fallback),
      minWidth: size.width.fallback,
      minHeight: size.optionHeight.fallback,
    },
    fills: [solid(colors.background.fallback)],
    bindings: [
      bind("layout.itemSpacing", size.gap),
      bind("layout.padding.left", size.optionPaddingX),
      bind("layout.padding.right", size.optionPaddingX),
      bind("layout.width.value", size.width),
      bind("layout.height.value", size.optionHeight),
      bind("fills.0.color", colors.background),
    ],
    children: [
      text(
        "combobox/option/label",
        instance.content.options[0]!.label,
        instance.tokens.typography.option,
        size.inputFontSize,
        size.inputLineHeight,
        colors.text,
        fill,
      ),
      ...(state === "selected"
        ? [
            controlInstance(
              "combobox/option/selected-indicator",
              instance.slots.selected.componentRef,
              size,
              colors.text,
            ),
          ]
        : []),
    ],
  };
};

const comboboxVariant = (
  instance: ComboboxRecipeInstance,
  sizeName: ComboboxSize,
  appearance: ComboboxAppearance,
  open: ComboboxOpen,
  stateName: ComboboxFieldState,
  contentName: ComboboxContent,
): ComponentNode => {
  const size = instance.tokens.sizes[sizeName];
  const field = instance.tokens.fieldStates[stateName];
  const surface = instance.tokens.appearances[appearance];
  const label = text(
    "combobox/label",
    instance.content.label.default,
    instance.tokens.typography.label,
    size.labelFontSize,
    size.labelLineHeight,
    field.label,
    fill,
  );
  const trailing: FrameNode = {
    kind: "frame",
    role: "combobox/trailing-controls",
    label: "Trailing controls",
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "center",
      itemSpacing: size.gap.fallback,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: fill,
    },
    fills: [],
    bindings: [bind("layout.itemSpacing", size.gap)],
    children: [
      controlInstance(
        "combobox/control/clear",
        instance.slots.clear.componentRef,
        size,
        field.control,
        stateName !== "disabled",
      ),
      controlInstance(
        "combobox/control/popup",
        instance.slots.popup.componentRef,
        size,
        field.control,
      ),
    ],
  };
  const trigger: FrameNode = {
    kind: "frame",
    role: "combobox/trigger",
    label: "Combobox input",
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "center",
      itemSpacing: size.gap.fallback,
      padding: {
        top: 0,
        right: size.paddingX.fallback,
        bottom: 0,
        left: size.paddingX.fallback,
      },
      width: fill,
      height: fixed(size.triggerHeight.fallback),
      minWidth: size.width.fallback,
      minHeight: size.triggerHeight.fallback,
    },
    fills: [solid(surface.background.fallback)],
    strokes: [
      { weight: 1, align: "inside", paint: solid(field.border.fallback) },
    ],
    cornerRadius: corners(instance.tokens.radius.fallback),
    clipsContent: false,
    bindings: [
      bind("layout.itemSpacing", size.gap),
      bind("layout.padding.left", size.paddingX),
      bind("layout.padding.right", size.paddingX),
      bind("layout.height.value", size.triggerHeight),
      bind("fills.0.color", surface.background),
      bind("strokes.0.paint.color", field.border),
      ...(["topLeft", "topRight", "bottomRight", "bottomLeft"] as const).map(
        (corner) => bind(`cornerRadius.${corner}`, instance.tokens.radius),
      ),
    ],
    children: [
      controlInstance(
        "combobox/control/leading",
        instance.slots.leading.componentRef,
        size,
        field.control,
      ),
      text(
        "combobox/input",
        contentName === "empty"
          ? instance.content.placeholder.default
          : (instance.content.options.find(
              (option) => option.value === instance.content.selectedValue,
            )?.label ?? instance.content.placeholder.default),
        instance.tokens.typography.input,
        size.inputFontSize,
        size.inputLineHeight,
        contentName === "empty" ? field.placeholder : field.text,
        fill,
      ),
      trailing,
    ],
  };
  const helper = text(
    stateName === "error"
      ? "combobox/message/error"
      : "combobox/message/helper",
    stateName === "error"
      ? instance.content.error.default
      : instance.content.helper.default,
    instance.tokens.typography.helper,
    size.helperFontSize,
    size.helperLineHeight,
    field.helper,
    fill,
  );
  const overlayChildren: IRNode[] =
    stateName === "loading"
      ? [
          text(
            "combobox/listbox/loading",
            instance.content.loading.default,
            instance.tokens.typography.option,
            size.inputFontSize,
            size.inputLineHeight,
            field.text,
            fill,
          ),
        ]
      : contentName === "empty"
        ? [
            text(
              "combobox/listbox/empty",
              instance.content.empty.default,
              instance.tokens.typography.option,
              size.inputFontSize,
              size.inputLineHeight,
              field.placeholder,
              fill,
            ),
          ]
        : instance.content.options.map((option, index) => ({
            kind: "instance" as const,
            role: `combobox/option-instance/${index}`,
            label: option.label,
            componentRef: "combobox@1/option",
            properties: {
              Label: option.label,
              Value: option.value,
              Disabled: option.disabled,
              Size: sizeName,
              "Option state": option.disabled
                ? "disabled"
                : option.value === instance.content.selectedValue
                  ? "selected"
                  : index === 1
                    ? "highlighted"
                    : "default",
            },
            width: fill,
            height: fixed(size.optionHeight.fallback),
            bindings: [bind("height.value", size.optionHeight)],
          }));
  const listbox: FrameNode = {
    kind: "frame",
    role: "combobox/listbox",
    label: "Listbox",
    layout: {
      mode: "vertical",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: 0,
      padding: {
        top: size.listPadding.fallback,
        right: 0,
        bottom: size.listPadding.fallback,
        left: 0,
      },
      width: fill,
      height: hug,
      minWidth: size.width.fallback,
    },
    fills: [],
    bindings: [
      bind("layout.padding.top", size.listPadding),
      bind("layout.padding.bottom", size.listPadding),
    ],
    children: overlayChildren,
  };
  const overlay: FrameNode = {
    kind: "frame",
    role: "combobox/overlay",
    label: "Anchored listbox overlay",
    layout: {
      mode: "vertical",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: fixed(size.width.fallback),
      height: hug,
      minWidth: size.width.fallback,
      positioning: "absolute",
      offset: {
        x: 0,
        y:
          size.labelLineHeight.fallback +
          size.stackGap.fallback +
          size.triggerHeight.fallback +
          size.overlayGap.fallback,
      },
      constraints: { horizontal: "left", vertical: "top" },
    },
    fills: [solid(instance.tokens.overlay.background.fallback)],
    strokes: [
      {
        weight: 1,
        align: "inside",
        paint: solid(instance.tokens.overlay.border.fallback),
      },
    ],
    effects: [
      {
        kind: "drop-shadow",
        offsetX: 0,
        offsetY: 4,
        blur: 12,
        spread: 0,
        color: instance.tokens.overlay.shadow.fallback,
      },
    ],
    cornerRadius: corners(instance.tokens.overlayRadius.fallback),
    clipsContent: true,
    bindings: [
      bind("layout.width.value", size.width),
      bind("fills.0.color", instance.tokens.overlay.background),
      bind("strokes.0.paint.color", instance.tokens.overlay.border),
      bind("effects.0.color", instance.tokens.overlay.shadow),
      ...(["topLeft", "topRight", "bottomRight", "bottomLeft"] as const).map(
        (corner) =>
          bind(`cornerRadius.${corner}`, instance.tokens.overlayRadius),
      ),
    ],
    children: [listbox],
  };

  return {
    kind: "component",
    role: variantRole(sizeName, appearance, open, stateName, contentName),
    label: `Size=${sizeName}, Appearance=${appearance}, Open=${open}, Field state=${stateName}, Content=${contentName}`,
    variantProperties: {
      Size: sizeName,
      Appearance: appearance,
      Open: open,
      "Field state": stateName,
      Content: contentName,
    },
    layout: {
      mode: "vertical",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: size.stackGap.fallback,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: fixed(size.width.fallback),
      height: hug,
      minWidth: size.width.fallback,
    },
    fills: [],
    clipsContent: false,
    bindings: [
      bind("layout.itemSpacing", size.stackGap),
      bind("layout.width.value", size.width),
    ],
    children: [label, trigger, helper, ...(open === "true" ? [overlay] : [])],
  };
};

export function compileComboboxIr(instance: ComboboxRecipeInstance): FrameNode {
  const variants = COMBOBOX_SIZES.flatMap((size) =>
    COMBOBOX_APPEARANCES.flatMap((appearance) =>
      COMBOBOX_OPEN.flatMap((open) =>
        COMBOBOX_FIELD_STATES.flatMap((state) =>
          COMBOBOX_CONTENT.map((content) =>
            comboboxVariant(instance, size, appearance, open, state, content),
          ),
        ),
      ),
    ),
  );
  const comboboxSet: ComponentSetNode = {
    kind: "component-set",
    role: "combobox/set",
    label: instance.identity.name,
    variantAxes: [
      { name: "Size", values: [...COMBOBOX_SIZES] },
      { name: "Appearance", values: [...COMBOBOX_APPEARANCES] },
      { name: "Open", values: [...COMBOBOX_OPEN] },
      { name: "Field state", values: [...COMBOBOX_FIELD_STATES] },
      { name: "Content", values: [...COMBOBOX_CONTENT] },
    ],
    layout: {
      mode: "vertical",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: 24,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
    },
    fills: [],
    children: variants,
  };
  const optionSet: ComponentSetNode = {
    kind: "component-set",
    role: "combobox/option-set",
    label: "Combobox option",
    variantAxes: [
      { name: "Size", values: [...COMBOBOX_SIZES] },
      { name: "Option state", values: [...COMBOBOX_OPTION_STATES] },
    ],
    layout: {
      mode: "vertical",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: 8,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
    },
    fills: [],
    children: COMBOBOX_SIZES.flatMap((size) =>
      COMBOBOX_OPTION_STATES.map((state) =>
        optionComponent(instance, size, state),
      ),
    ),
  };
  return {
    kind: "frame",
    role: "combobox/library",
    label: `${instance.identity.name} / recipe library`,
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: 48,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
    },
    fills: [],
    children: [comboboxSet, optionSet],
  };
}

export function compileComboboxRecipe(input: unknown): RecipeEnvelope {
  const instance = normalizeComboboxRecipeInstance(input);
  const totality = checkTotality(instance.inputFacts, instance);
  if (!isTotal(totality))
    throw new RecipeRefusal(
      COMBOBOX_RECIPE_REF,
      totalityLines(instance.identity.id, totality),
    );
  const unsigned = {
    envelope: ENVELOPE_VERSION,
    id: instance.identity.id,
    name: instance.identity.name,
    archetype: "select / combobox",
    recipe: COMBOBOX_RECIPE_REF,
    ir: compileComboboxIr(instance),
    accounting: instance.accounting,
    extensions: instance.extensions,
    receipts: instance.receipts,
    provenance: instance.provenance,
  } as const;
  return RecipeEnvelopeSchema.parse({
    ...unsigned,
    integrity: deriveRecipeIntegrity(unsigned),
  });
}

const walk = (node: IRNode, visit: (candidate: IRNode) => void): void => {
  visit(node);
  if (
    node.kind === "frame" ||
    node.kind === "component" ||
    node.kind === "component-set"
  )
    for (const child of node.children) walk(child, visit);
};
const direct = <Kind extends IRNode["kind"]>(
  parent: { role?: string; children: IRNode[] },
  role: string,
  kind: Kind,
): Extract<IRNode, { kind: Kind }> => {
  const found = parent.children.filter((node) => node.role === role);
  if (found.length !== 1 || found[0]!.kind !== kind)
    throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
      `${parent.role ?? "root"}: required ${role} must appear exactly once as ${kind}`,
    ]);
  return found[0] as Extract<IRNode, { kind: Kind }>;
};
const descendant = <Kind extends IRNode["kind"]>(
  parent: IRNode,
  role: string,
  kind: Kind,
): Extract<IRNode, { kind: Kind }> => {
  const found: IRNode[] = [];
  walk(parent, (node) => {
    if (node !== parent && node.role === role) found.push(node);
  });
  if (found.length !== 1 || found[0]!.kind !== kind)
    throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
      `${parent.role ?? "root"}: required ${role} must appear exactly once as ${kind}`,
    ]);
  return found[0] as Extract<IRNode, { kind: Kind }>;
};
const setByRole = (root: FrameNode, role: string): ComponentSetNode =>
  direct(root, role, "component-set");
const componentFor = (
  set: ComponentSetNode,
  properties: Record<string, string>,
): ComponentNode => {
  const found = set.children.filter((component) =>
    Object.entries(properties).every(
      ([name, value]) => component.variantProperties[name] === value,
    ),
  );
  if (found.length !== 1)
    throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
      `${set.role}: expected exactly one component for ${JSON.stringify(properties)}`,
    ]);
  return found[0]!;
};
const binding = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
): string => {
  const found = (node.bindings ?? []).filter((entry) => entry.field === field);
  if (found.length !== 1)
    throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
      `${node.role ?? "node"}: required binding ${field} must appear exactly once`,
    ]);
  return found[0]!.variable;
};
const numberFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: number,
): ComboboxNumberParameter => ({ variable: binding(node, field), fallback });
const colorFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: string,
): ComboboxColorParameter => ({ variable: binding(node, field), fallback });
const fixedValue = (
  sizing: { mode: string; value?: number },
  role: string,
): number => {
  if (sizing.mode !== "fixed" || sizing.value === undefined)
    throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
      `${role}: fixed Figma sizing is required`,
    ]);
  return sizing.value;
};
const solidColor = (
  paint: { kind: string; color?: string } | undefined,
  role: string,
): string => {
  if (paint?.kind !== "solid" || !paint.color)
    throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
      `${role}: visible solid paint is required`,
    ]);
  return paint.color;
};
const fontFrom = (node: TextNode): ComboboxFontSpec => {
  if (!node.type.fontProvenance)
    throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
      `${node.role}: explicit font provenance is required`,
    ]);
  return node.type.fontProvenance;
};

const expectedAxes = [
  ["Size", COMBOBOX_SIZES],
  ["Appearance", COMBOBOX_APPEARANCES],
  ["Open", COMBOBOX_OPEN],
  ["Field state", COMBOBOX_FIELD_STATES],
  ["Content", COMBOBOX_CONTENT],
] as const;
const renderFingerprint = (component: ComponentNode): string => {
  const clone = structuredClone(component) as unknown as Record<
    string,
    unknown
  >;
  delete clone.role;
  delete clone.label;
  delete clone.variantProperties;
  return canonicalJson(clone);
};

function validateComboboxStructure(root: FrameNode): void {
  if (
    root.role !== "combobox/library" ||
    root.layout.mode !== "horizontal" ||
    root.children.length !== 2
  )
    throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
      "missing combobox/library with exactly combobox and option component sets",
    ]);
  const set = setByRole(root, "combobox/set");
  const optionSet = setByRole(root, "combobox/option-set");
  if (set.children.length !== 64)
    throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
      `combobox@1 requires 64 nonzero variants; found ${set.children.length}`,
    ]);
  if (
    canonicalJson(set.variantAxes.map((axis) => [axis.name, axis.values])) !==
    canonicalJson(expectedAxes)
  )
    throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
      "dead or unknown combobox axis; the exact five-axis surface is required",
    ]);
  const combinations = new Set<string>();
  for (const component of set.children) {
    const key = expectedAxes
      .map(([name]) => `${name}=${component.variantProperties[name]}`)
      .join("|");
    if (combinations.has(key))
      throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
        `duplicate combobox variant ${key}`,
      ]);
    combinations.add(key);
    if (
      component.layout.mode !== "vertical" ||
      component.layout.width.mode !== "fixed" ||
      component.layout.height.mode !== "hug" ||
      component.layout.positioning === "absolute"
    )
      throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
        `${component.role}: fake layout; variant must use vertical auto-layout`,
      ]);
    const trigger = direct(component, "combobox/trigger", "frame");
    direct(component, "combobox/label", "text");
    if (
      trigger.layout.mode !== "horizontal" ||
      trigger.layout.width.mode !== "fill" ||
      trigger.layout.height.mode !== "fixed"
    )
      throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
        `${component.role}: trigger must be a fill-width horizontal input row`,
      ]);
    descendant(trigger, "combobox/input", "text");
    descendant(trigger, "combobox/control/leading", "instance");
    descendant(trigger, "combobox/control/clear", "instance");
    descendant(trigger, "combobox/control/popup", "instance");
    const open = component.variantProperties.Open;
    const overlays = component.children.filter(
      (node) => node.role === "combobox/overlay",
    );
    if (overlays.length !== (open === "true" ? 1 : 0))
      throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
        `${component.role}: Open axis disagrees with overlay presence`,
      ]);
    if (open === "true") {
      const overlay = direct(component, "combobox/overlay", "frame");
      if (
        overlay.layout.positioning !== "absolute" ||
        overlay.layout.offset?.x !== 0 ||
        (overlay.layout.offset?.y ?? 0) <=
          fixedValue(trigger.layout.height, trigger.role!) ||
        overlay.layout.constraints?.horizontal !== "left" ||
        overlay.layout.constraints.vertical !== "top" ||
        overlay.layout.width.mode !== "fixed"
      )
        throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
          `${component.role}: broken anchor/overlay; listbox must genuinely overlap below the trigger`,
        ]);
      const listbox = direct(overlay, "combobox/listbox", "frame");
      if (
        listbox.layout.mode !== "vertical" ||
        listbox.layout.width.mode !== "fill"
      )
        throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
          `${component.role}: listbox must be a fill-width vertical stack`,
        ]);
      const normal =
        component.variantProperties["Field state"] !== "loading" &&
        component.variantProperties.Content === "options";
      const optionInstances = listbox.children.filter(
        (node) =>
          node.kind === "instance" &&
          node.role?.startsWith("combobox/option-instance/"),
      );
      if (
        normal &&
        (optionInstances.length !== 4 ||
          optionInstances.some(
            (node) =>
              node.kind !== "instance" ||
              node.componentRef !== "combobox@1/option",
          ))
      )
        throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
          `${component.role}: non-instance repetition; four option instances are required`,
        ]);
    }
  }
  if (combinations.size !== 64)
    throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
      "combobox variant matrix is incomplete",
    ]);
  if (
    optionSet.children.length !== 8 ||
    canonicalJson(optionSet.variantAxes) !==
      canonicalJson([
        { name: "Size", values: [...COMBOBOX_SIZES] },
        { name: "Option state", values: [...COMBOBOX_OPTION_STATES] },
      ])
  )
    throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
      "option component set must declare four live states",
    ]);
  const fingerprints = optionSet.children.map(renderFingerprint);
  if (new Set(fingerprints).size !== 8)
    throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
      "selected/highlighted collapse: every option state must render distinctly",
    ]);
  const allowed =
    /^(?:combobox\/(?:library|set|option-set|label|trigger|input|trailing-controls|control\/(?:leading|clear|popup)|message\/(?:helper|error)|overlay|listbox|listbox\/(?:empty|loading)|option\/(?:(?:small|medium)\/(?:default|highlighted|selected|disabled)|label|selected-indicator)|option-instance\/[0-3]))$/;
  walk(root, (node) => {
    if (
      !node.role ||
      (!allowed.test(node.role) && !node.role.startsWith("combobox/variant/"))
    )
      throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
        `unknown structural edit by role ${node.role ?? "(missing role)"}`,
      ]);
    if (
      (node.kind === "frame" ||
        node.kind === "component" ||
        node.kind === "component-set") &&
      node.layout.mode === "none"
    )
      throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
        `${node.role}: fake layout mode none is forbidden`,
      ]);
  });
}

const firstDifference = (
  left: unknown,
  right: unknown,
  path = "$",
): string | undefined => {
  if (Object.is(left, right)) return undefined;
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  )
    return path;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return path;
    if (left.length !== right.length) return `${path}.length`;
    for (let index = 0; index < left.length; index += 1) {
      const found = firstDifference(
        left[index],
        right[index],
        `${path}[${index}]`,
      );
      if (found) return found;
    }
    return undefined;
  }
  const l = left as Record<string, unknown>;
  const r = right as Record<string, unknown>;
  for (const key of [
    ...new Set([...Object.keys(l), ...Object.keys(r)]),
  ].sort()) {
    if (!(key in l) || !(key in r)) return `${path}.${key}`;
    const found = firstDifference(l[key], r[key], `${path}.${key}`);
    if (found) return found;
  }
  return undefined;
};

export function collapseComboboxRecipe(
  envelopeInput: unknown,
  selectionInput: unknown,
): ComboboxRecipeInstance {
  requireExactRecipeSelection(selectionInput, COMBOBOX_RECIPE_REF);
  const envelope = RecipeEnvelopeSchema.parse(envelopeInput);
  if (
    envelope.recipe.id !== "combobox" ||
    envelope.recipe.version !== 1 ||
    envelope.archetype !== "select / combobox"
  )
    throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
      "selected envelope is not combobox@1",
    ]);
  if (hashRecipeEnvelope(envelope) !== envelope.integrity.canonicalHash)
    throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
      "integrity.canonicalHash does not match the selected envelope",
    ]);
  if (envelope.ir.kind !== "frame")
    throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
      "missing combobox/library frame",
    ]);
  const root = envelope.ir;
  validateComboboxStructure(root);
  const set = setByRole(root, "combobox/set");
  const optionSet = setByRole(root, "combobox/option-set");
  const getVariant = (
    size: ComboboxSize,
    appearance: ComboboxAppearance,
    open: ComboboxOpen,
    state: ComboboxFieldState,
    content: ComboboxContent,
  ) =>
    componentFor(set, {
      Size: size,
      Appearance: appearance,
      Open: open,
      "Field state": state,
      Content: content,
    });
  const baseline = getVariant(
    "medium",
    "outlined",
    "false",
    "default",
    "options",
  );
  const label = direct(baseline, "combobox/label", "text");
  const trigger = direct(baseline, "combobox/trigger", "frame");
  const input = descendant(trigger, "combobox/input", "text");
  const placeholderInput = descendant(
    direct(
      getVariant("medium", "outlined", "false", "default", "empty"),
      "combobox/trigger",
      "frame",
    ),
    "combobox/input",
    "text",
  );
  const helper = direct(baseline, "combobox/message/helper", "text");
  const leading = descendant(trigger, "combobox/control/leading", "instance");
  const clear = descendant(trigger, "combobox/control/clear", "instance");
  const popup = descendant(trigger, "combobox/control/popup", "instance");
  const error = direct(
    getVariant("medium", "outlined", "false", "error", "options"),
    "combobox/message/error",
    "text",
  );
  const openBaseline = getVariant(
    "medium",
    "outlined",
    "true",
    "default",
    "options",
  );
  const overlay = direct(openBaseline, "combobox/overlay", "frame");
  const listbox = direct(overlay, "combobox/listbox", "frame");
  const firstOption = listbox.children[0];
  if (firstOption?.kind !== "instance")
    throw new RecipeRefusal(COMBOBOX_RECIPE_REF, ["missing option instances"]);
  const options = listbox.children.map((node, index): ComboboxOption => {
    if (
      node.kind !== "instance" ||
      typeof node.properties.Label !== "string" ||
      typeof node.properties.Value !== "string" ||
      typeof node.properties.Disabled !== "boolean"
    )
      throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
        `invalid ARIA/data model at option occurrence ${index}`,
      ]);
    return {
      label: node.properties.Label,
      value: node.properties.Value,
      disabled: node.properties.Disabled,
    };
  });
  const selected = listbox.children.find(
    (node) =>
      node.kind === "instance" &&
      node.properties["Option state"] === "selected",
  );
  if (
    selected?.kind !== "instance" ||
    typeof selected.properties.Value !== "string"
  )
    throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
      "selected option occurrence is missing",
    ]);
  const emptyNode = descendant(
    getVariant("medium", "outlined", "true", "default", "empty"),
    "combobox/listbox/empty",
    "text",
  );
  const loadingNode = descendant(
    getVariant("medium", "outlined", "true", "loading", "options"),
    "combobox/listbox/loading",
    "text",
  );
  const selectedIndicator = descendant(
    componentFor(optionSet, { Size: "medium", "Option state": "selected" }),
    "combobox/option/selected-indicator",
    "instance",
  );
  const sizeFrom = (sizeName: ComboboxSize): SizeTokens => {
    const component = getVariant(
      sizeName,
      "outlined",
      "true",
      "default",
      "options",
    );
    const surfaceNode = direct(component, "combobox/trigger", "frame");
    const inputNode = descendant(surfaceNode, "combobox/input", "text");
    const labelNode = direct(component, "combobox/label", "text");
    const helperNode = direct(component, "combobox/message/helper", "text");
    const leadingNode = descendant(
      surfaceNode,
      "combobox/control/leading",
      "instance",
    );
    const overlayNode = direct(component, "combobox/overlay", "frame");
    const listNode = direct(overlayNode, "combobox/listbox", "frame");
    const option = listNode.children[0];
    if (option?.kind !== "instance")
      throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
        `${component.role}: missing option instance`,
      ]);
    if (
      inputNode.type.lineHeight.unit !== "px" ||
      labelNode.type.lineHeight.unit !== "px" ||
      helperNode.type.lineHeight.unit !== "px"
    )
      throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
        `${component.role}: text line heights must use px`,
      ]);
    const width = fixedValue(component.layout.width, component.role!);
    const triggerHeight = fixedValue(
      surfaceNode.layout.height,
      surfaceNode.role!,
    );
    const optionHeight = fixedValue(option.height, option.role!);
    const overlayY = overlayNode.layout.offset?.y;
    if (overlayY === undefined)
      throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
        `${component.role}: overlay offset is missing`,
      ]);
    return {
      width: numberFrom(component, "layout.width.value", width),
      triggerHeight: numberFrom(
        surfaceNode,
        "layout.height.value",
        triggerHeight,
      ),
      paddingX: numberFrom(
        surfaceNode,
        "layout.padding.left",
        surfaceNode.layout.padding.left,
      ),
      gap: numberFrom(
        surfaceNode,
        "layout.itemSpacing",
        surfaceNode.layout.itemSpacing,
      ),
      controlSize: numberFrom(
        leadingNode,
        "width.value",
        fixedValue(leadingNode.width, leadingNode.role!),
      ),
      optionHeight: numberFrom(option, "height.value", optionHeight),
      optionPaddingX: numberFrom(
        componentFor(optionSet, {
          Size: sizeName,
          "Option state": "default",
        }),
        "layout.padding.left",
        componentFor(optionSet, {
          Size: sizeName,
          "Option state": "default",
        }).layout.padding.left,
      ),
      overlayGap: {
        variable: `${binding(component, "layout.itemSpacing")}.overlay`,
        fallback:
          overlayY -
          labelNode.type.lineHeight.value -
          component.layout.itemSpacing -
          triggerHeight,
      },
      listPadding: numberFrom(
        listNode,
        "layout.padding.top",
        listNode.layout.padding.top,
      ),
      stackGap: numberFrom(
        component,
        "layout.itemSpacing",
        component.layout.itemSpacing,
      ),
      inputFontSize: numberFrom(
        inputNode,
        "type.fontSize",
        inputNode.type.fontSize,
      ),
      inputLineHeight: numberFrom(
        inputNode,
        "type.lineHeight.value",
        inputNode.type.lineHeight.value,
      ),
      labelFontSize: numberFrom(
        labelNode,
        "type.fontSize",
        labelNode.type.fontSize,
      ),
      labelLineHeight: numberFrom(
        labelNode,
        "type.lineHeight.value",
        labelNode.type.lineHeight.value,
      ),
      helperFontSize: numberFrom(
        helperNode,
        "type.fontSize",
        helperNode.type.fontSize,
      ),
      helperLineHeight: numberFrom(
        helperNode,
        "type.lineHeight.value",
        helperNode.type.lineHeight.value,
      ),
    };
  };
  const fieldStateFrom = (state: ComboboxFieldState): FieldStateTokens => {
    const component = getVariant(
      "medium",
      "outlined",
      "false",
      state,
      "options",
    );
    const surfaceNode = direct(component, "combobox/trigger", "frame");
    const inputNode = descendant(surfaceNode, "combobox/input", "text");
    const placeholderNode = descendant(
      direct(
        getVariant("medium", "outlined", "false", state, "empty"),
        "combobox/trigger",
        "frame",
      ),
      "combobox/input",
      "text",
    );
    const labelNode = direct(component, "combobox/label", "text");
    const messageNode = direct(
      component,
      state === "error" ? "combobox/message/error" : "combobox/message/helper",
      "text",
    );
    const controlNode = descendant(
      surfaceNode,
      "combobox/control/popup",
      "instance",
    );
    const borderPaint = surfaceNode.strokes?.[0]?.paint;
    return {
      border: colorFrom(
        surfaceNode,
        "strokes.0.paint.color",
        solidColor(borderPaint, surfaceNode.role!),
      ),
      text: colorFrom(
        inputNode,
        "fills.0.color",
        solidColor(inputNode.fills[0], inputNode.role!),
      ),
      placeholder: colorFrom(
        placeholderNode,
        "fills.0.color",
        solidColor(placeholderNode.fills[0], placeholderNode.role!),
      ),
      label: colorFrom(
        labelNode,
        "fills.0.color",
        solidColor(labelNode.fills[0], labelNode.role!),
      ),
      helper: colorFrom(
        messageNode,
        "fills.0.color",
        solidColor(messageNode.fills[0], messageNode.role!),
      ),
      control: colorFrom(
        controlNode,
        "fills.0.color",
        solidColor(controlNode.fills?.[0], controlNode.role!),
      ),
    };
  };
  const optionStateFrom = (state: ComboboxOptionState): OptionStateTokens => {
    const component = componentFor(optionSet, {
      Size: "medium",
      "Option state": state,
    });
    const labelNode = direct(component, "combobox/option/label", "text");
    return {
      background: colorFrom(
        component,
        "fills.0.color",
        solidColor(component.fills[0], component.role!),
      ),
      text: colorFrom(
        labelNode,
        "fills.0.color",
        solidColor(labelNode.fills[0], labelNode.role!),
      ),
    };
  };
  const overlayBackground = solidColor(overlay.fills[0], overlay.role!);
  const overlayBorder = solidColor(overlay.strokes?.[0]?.paint, overlay.role!);
  const shadow = overlay.effects?.[0];
  if (shadow?.kind !== "drop-shadow")
    throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
      "overlay requires one drop shadow",
    ]);
  const instance = normalizeComboboxRecipeInstance({
    identity: { id: envelope.id, name: envelope.name },
    semantic: {
      control: "editable-input",
      selection: "single",
      popup: "listbox",
      activeOption: "aria-activedescendant",
      label: "explicit-id",
      description: "aria-describedby",
    },
    axes: {
      size: { name: "Size", values: [...COMBOBOX_SIZES], default: "medium" },
      appearance: {
        name: "Appearance",
        values: [...COMBOBOX_APPEARANCES],
        default: "outlined",
      },
      open: { name: "Open", values: [...COMBOBOX_OPEN], default: "false" },
      fieldState: {
        name: "Field state",
        values: [...COMBOBOX_FIELD_STATES],
        default: "default",
      },
      content: {
        name: "Content",
        values: [...COMBOBOX_CONTENT],
        default: "options",
      },
      optionState: {
        name: "Option state",
        values: [...COMBOBOX_OPTION_STATES],
        default: "default",
      },
    },
    content: {
      label: { property: "Label", default: label.characters },
      placeholder: {
        property: "Placeholder",
        default: placeholderInput.characters,
      },
      helper: { property: "Helper text", default: helper.characters },
      error: { property: "Error text", default: error.characters },
      empty: { property: "Empty text", default: emptyNode.characters },
      loading: { property: "Loading text", default: loadingNode.characters },
      options,
      selectedValue: selected.properties.Value,
      query: "",
    },
    slots: {
      leading: {
        property: "Leading control",
        componentRef: leading.componentRef,
      },
      clear: { property: "Clear indicator", componentRef: clear.componentRef },
      popup: { property: "Popup indicator", componentRef: popup.componentRef },
      selected: {
        property: "Selected indicator",
        componentRef: selectedIndicator.componentRef,
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
      events: [
        "onOpenChange",
        "onInputChange",
        "onChange",
        "onHighlightChange",
      ],
      keyboard: ["ArrowDown", "ArrowUp", "Enter", "Escape"],
    },
    tokens: {
      sizes: { small: sizeFrom("small"), medium: sizeFrom("medium") },
      appearances: {
        outlined: (() => {
          const node = direct(
            getVariant("medium", "outlined", "false", "default", "options"),
            "combobox/trigger",
            "frame",
          );
          return {
            background: colorFrom(
              node,
              "fills.0.color",
              solidColor(node.fills[0], node.role!),
            ),
          };
        })(),
        filled: (() => {
          const node = direct(
            getVariant("medium", "filled", "false", "default", "options"),
            "combobox/trigger",
            "frame",
          );
          return {
            background: colorFrom(
              node,
              "fills.0.color",
              solidColor(node.fills[0], node.role!),
            ),
          };
        })(),
      },
      fieldStates: {
        default: fieldStateFrom("default"),
        disabled: fieldStateFrom("disabled"),
        error: fieldStateFrom("error"),
        loading: fieldStateFrom("loading"),
      },
      optionStates: {
        default: optionStateFrom("default"),
        highlighted: optionStateFrom("highlighted"),
        selected: optionStateFrom("selected"),
        disabled: optionStateFrom("disabled"),
      },
      overlay: {
        background: colorFrom(overlay, "fills.0.color", overlayBackground),
        border: colorFrom(overlay, "strokes.0.paint.color", overlayBorder),
        shadow: colorFrom(overlay, "effects.0.color", shadow.color),
      },
      radius: numberFrom(
        trigger,
        "cornerRadius.topLeft",
        trigger.cornerRadius?.topLeft ?? 0,
      ),
      overlayRadius: numberFrom(
        overlay,
        "cornerRadius.topLeft",
        overlay.cornerRadius?.topLeft ?? 0,
      ),
      typography: {
        input: fontFrom(input),
        label: fontFrom(label),
        helper: fontFrom(helper),
        option: fontFrom(
          direct(
            componentFor(optionSet, {
              Size: "medium",
              "Option state": "default",
            }),
            "combobox/option/label",
            "text",
          ),
        ),
      },
    },
    inputFacts: [
      ...envelope.accounting.carried,
      ...envelope.extensions.flatMap((extension) => extension.absorbs),
      ...envelope.receipts.map((receipt) => receipt.fact),
    ],
    accounting: envelope.accounting,
    extensions: envelope.extensions,
    receipts: envelope.receipts,
    provenance: envelope.provenance,
  });
  const recompiled = compileComboboxRecipe(instance);
  const difference = firstDifference(recompiled.ir, envelope.ir);
  if (difference)
    throw new RecipeRefusal(COMBOBOX_RECIPE_REF, [
      `unsupported structural edit at ${difference}; combobox@1 accepts only the declared designer edit surface`,
    ]);
  return instance;
}

export const comboboxRecipe: Recipe<ComboboxRecipeInstance> = {
  ref: COMBOBOX_RECIPE_REF,
  normalize: normalizeComboboxRecipeInstance,
  compile: compileComboboxRecipe,
  collapse: collapseComboboxRecipe,
};

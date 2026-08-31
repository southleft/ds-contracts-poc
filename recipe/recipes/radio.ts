import * as z from "zod";

import {
  CodeOnlyExtensionSchema,
  ENVELOPE_VERSION,
  LossReceiptSchema,
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
  type ComponentNode,
  type ComponentSetNode,
  type FrameNode,
  type IRNode,
  type TextNode,
  type VariableBinding,
} from "../figma-ir.js";
import { deriveRecipeIntegrity } from "../hash.js";
import { canonicalJson } from "../normalize.js";
import {
  RecipeRefusal,
  RecipeSelectionSchema,
  requireExactRecipeSelection,
  type Recipe,
  type RecipeRef,
  type RecipeSelection,
} from "../recipe.js";

export const RADIO_RECIPE_REF = {
  id: "radio",
  version: 1,
} as const satisfies RecipeRef;

/**
 * Astryx ships RadioList + RadioListItem, not a standalone Radio.
 * The recipe is therefore list-shaped: a group of two items, not a
 * single control. Axes every library actually shares on that group:
 * which item is selected, plus disabled. Size is NOT an axis.
 * Orientation is each library's default (token), not a picker.
 */
export const RADIO_SELECTED = ["a", "b"] as const;
export const RADIO_DISABLED = ["false", "true"] as const;

export type RadioSelected = (typeof RADIO_SELECTED)[number];
export type RadioDisabled = (typeof RADIO_DISABLED)[number];

export interface RadioNumberParameter {
  variable: string;
  fallback: number;
}
export interface RadioColorParameter {
  variable: string;
  fallback: string;
}
export interface RadioFontSpec {
  requestedFamily: string;
  requestedStyle: string;
  requestSource: string;
  fallbackChain: Array<{ family: string; style: string }>;
  resolvedFamily: string;
  resolvedStyle: string;
  resolution: "requested" | "fallback";
  degradation?: string;
}

interface StateCell {
  circleFill: RadioColorParameter;
  circleBorder: RadioColorParameter;
  circleOpacity: RadioNumberParameter;
  label: RadioColorParameter;
  dotFill: RadioColorParameter;
}

export interface RadioRecipeInstance {
  identity: { id: string; name: string };
  semantic: {
    root: "radio";
    control: "radio";
    label: "label";
  };
  axes: {
    selected: {
      name: "Selected";
      values: RadioSelected[];
      default: RadioSelected;
    };
    disabled: {
      name: "Disabled";
      values: RadioDisabled[];
      default: RadioDisabled;
    };
  };
  content: {
    /**
     * Shared fixture labels. Astryx RadioListItem.tsx example uses
     * "Email". Second item is "Phone" — a named pairing, not a
     * per-library invention. Group Field chrome is receipted.
     */
    items: Array<{ id: RadioSelected; label: string }>;
  };
  tokens: {
    /**
     * Library default orientation. Astryx RadioList vertical.
     * MUI RadioGroup / FormGroup column. AntD Radio.Group
     * inline-block (horizontal siblings). Not a picker.
     */
    listMode: "vertical" | "horizontal";
    list: { gap: RadioNumberParameter };
    item: { gap: RadioNumberParameter };
    itemAlign: "center" | "baseline";
    /**
     * `auto` keeps Astryx/MUI hug text. AntD `px` is
     * fontSize × lineHeight (14 × 1.5714285714 = 22) from resetComponent.
     */
    labelLineHeightUnit: "auto" | "px";
    labelLineHeight: RadioNumberParameter;
    wrapper: { size: RadioNumberParameter };
    circle: {
      size: RadioNumberParameter;
      /**
       * Half of circle.size — CSS borderRadius 50%. Named per
       * library from measured size, not an invented radius primitive.
       */
      radius: RadioNumberParameter;
      borderWidth: RadioNumberParameter;
      padding: RadioNumberParameter;
    };
    dot: {
      size: RadioNumberParameter;
      radius: RadioNumberParameter;
    };
    states: Record<
      "selected" | "unselected",
      Record<"enabled" | "disabled", StateCell>
    >;
    labelFontSize: RadioNumberParameter;
    typography: { label: RadioFontSpec };
  };
  inputFacts: FactRef[];
  accounting: { carried: FactRef[] };
  extensions: CodeOnlyExtension[];
  receipts: LossReceipt[];
  provenance: {
    source: string;
    tool: string;
    generatedAt: string;
    selection: RecipeSelection;
    [key: string]: unknown;
  };
}

const FactRefSchema = z.strictObject({
  path: z.string().min(1),
  channel: z.string().min(1),
});
const NumberParameterSchema = z.strictObject({
  variable: z.string().min(1),
  fallback: z.number().finite(),
});
const ColorParameterSchema = z.strictObject({
  variable: z.string().min(1),
  fallback: z.string().min(1),
});
const FontSpecSchema = z.strictObject({
  requestedFamily: z.string().min(1),
  requestedStyle: z.string().min(1),
  requestSource: z.string().min(1),
  fallbackChain: z
    .array(
      z.strictObject({ family: z.string().min(1), style: z.string().min(1) }),
    )
    .min(1),
  resolvedFamily: z.string().min(1),
  resolvedStyle: z.string().min(1),
  resolution: z.enum(["requested", "fallback"]),
  degradation: z.string().min(1).optional(),
});
const StateCellSchema = z.strictObject({
  circleFill: ColorParameterSchema,
  circleBorder: ColorParameterSchema,
  circleOpacity: NumberParameterSchema,
  label: ColorParameterSchema,
  dotFill: ColorParameterSchema,
});

export const RadioRecipeInstanceSchema = z.strictObject({
  identity: z.strictObject({ id: z.string().min(1), name: z.string().min(1) }),
  semantic: z.strictObject({
    root: z.literal("radio"),
    control: z.literal("radio"),
    label: z.literal("label"),
  }),
  axes: z.strictObject({
    selected: z.strictObject({
      name: z.literal("Selected"),
      values: z.array(z.enum(RADIO_SELECTED)).min(1),
      default: z.enum(RADIO_SELECTED),
    }),
    disabled: z.strictObject({
      name: z.literal("Disabled"),
      values: z.array(z.enum(RADIO_DISABLED)).min(1),
      default: z.enum(RADIO_DISABLED),
    }),
  }),
  content: z.strictObject({
    items: z
      .array(
        z.strictObject({
          id: z.enum(RADIO_SELECTED),
          label: z.string().min(1),
        }),
      )
      .length(2),
  }),
  tokens: z.strictObject({
    listMode: z.enum(["vertical", "horizontal"]),
    list: z.strictObject({ gap: NumberParameterSchema }),
    item: z.strictObject({ gap: NumberParameterSchema }),
    itemAlign: z.enum(["center", "baseline"]),
    labelLineHeightUnit: z.enum(["auto", "px"]),
    labelLineHeight: NumberParameterSchema,
    wrapper: z.strictObject({ size: NumberParameterSchema }),
    circle: z.strictObject({
      size: NumberParameterSchema,
      radius: NumberParameterSchema,
      borderWidth: NumberParameterSchema,
      padding: NumberParameterSchema,
    }),
    dot: z.strictObject({
      size: NumberParameterSchema,
      radius: NumberParameterSchema,
    }),
    states: z.strictObject({
      selected: z.strictObject({
        enabled: StateCellSchema,
        disabled: StateCellSchema,
      }),
      unselected: z.strictObject({
        enabled: StateCellSchema,
        disabled: StateCellSchema,
      }),
    }),
    labelFontSize: NumberParameterSchema,
    typography: z.strictObject({ label: FontSpecSchema }),
  }),
  inputFacts: z.array(FactRefSchema),
  accounting: z.strictObject({ carried: z.array(FactRefSchema) }),
  extensions: z.array(CodeOnlyExtensionSchema),
  receipts: z.array(LossReceiptSchema),
  provenance: z.looseObject({
    source: z.string().min(1),
    tool: z.string().min(1),
    generatedAt: z.string().min(1),
    selection: RecipeSelectionSchema,
  }),
});

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export function normalizeRadioRecipeInstance(
  input: unknown,
): RadioRecipeInstance {
  requireExactRecipeSelection(
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as { provenance?: { selection?: unknown } }).provenance
          ?.selection
      : undefined,
    RADIO_RECIPE_REF,
  );
  const instance = RadioRecipeInstanceSchema.parse(input) as RadioRecipeInstance;
  const ids = instance.content.items.map((item) => item.id);
  if (canonicalJson(ids) !== canonicalJson([...RADIO_SELECTED]))
    throw new RecipeRefusal(RADIO_RECIPE_REF, [
      "content.items must be exactly Selected=a then Selected=b",
    ]);
  return {
    ...instance,
    inputFacts: [...instance.inputFacts].sort((left, right) =>
      compareText(factId(left), factId(right)),
    ),
    accounting: {
      carried: [...instance.accounting.carried].sort((left, right) =>
        compareText(factId(left), factId(right)),
      ),
    },
    extensions: [...instance.extensions].sort((left, right) =>
      compareText(left.id, right.id),
    ),
    receipts: [...instance.receipts].sort((left, right) =>
      compareText(factId(left.fact), factId(right.fact)),
    ),
  };
}

const hug = { mode: "hug" } as const;
const fixed = (value: number) => ({ mode: "fixed" as const, value });
const solid = (color: string) => ({ kind: "solid" as const, color });
const bind = (
  field: string,
  parameter: RadioNumberParameter | RadioColorParameter,
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

const cellOf = (
  instance: RadioRecipeInstance,
  selected: boolean,
  disabled: RadioDisabled,
): StateCell =>
  instance.tokens.states[selected ? "selected" : "unselected"][
    disabled === "true" ? "disabled" : "enabled"
  ];

const labelText = (
  instance: RadioRecipeInstance,
  itemId: RadioSelected,
  cell: StateCell,
): TextNode => {
  const item = instance.content.items.find((candidate) => candidate.id === itemId);
  if (!item)
    throw new RecipeRefusal(RADIO_RECIPE_REF, [`missing content item ${itemId}`]);
  return {
    kind: "text",
    role: "radio/label",
    label: "radio/label",
    characters: item.label,
    type: {
      fontFamily: instance.tokens.typography.label.resolvedFamily,
      fontStyle: instance.tokens.typography.label.resolvedStyle,
      fontProvenance: instance.tokens.typography.label,
      fontSize: instance.tokens.labelFontSize.fallback,
      lineHeight:
        instance.tokens.labelLineHeightUnit === "px"
          ? {
              unit: "px" as const,
              value: instance.tokens.labelLineHeight.fallback,
            }
          : { unit: "auto" as const },
    },
    align: "left",
    verticalAlign: "center",
    fills: [solid(cell.label.fallback)],
    width: hug,
    height: hug,
    bindings: [
      bind("type.fontSize", instance.tokens.labelFontSize),
      ...(instance.tokens.labelLineHeightUnit === "px"
        ? [bind("type.lineHeight.value", instance.tokens.labelLineHeight)]
        : []),
      bind("fills.0.color", cell.label),
    ],
  };
};

const dotNode = (
  instance: RadioRecipeInstance,
  cell: StateCell,
  visible: boolean,
): FrameNode => ({
  kind: "frame",
  role: "radio/glyph/dot",
  label: "radio/glyph/dot",
  visible,
  layout: {
    mode: "horizontal",
    primaryAxisAlign: "center",
    counterAxisAlign: "center",
    itemSpacing: 0,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    width: fixed(instance.tokens.dot.size.fallback),
    height: fixed(instance.tokens.dot.size.fallback),
  },
  fills: [solid(cell.dotFill.fallback)],
  cornerRadius: corners(instance.tokens.dot.radius.fallback),
  bindings: [
    bind("layout.width.value", instance.tokens.dot.size),
    bind("layout.height.value", instance.tokens.dot.size),
    bind("fills.0.color", cell.dotFill),
    bind("cornerRadius.topLeft", instance.tokens.dot.radius),
    bind("cornerRadius.topRight", instance.tokens.dot.radius),
    bind("cornerRadius.bottomRight", instance.tokens.dot.radius),
    bind("cornerRadius.bottomLeft", instance.tokens.dot.radius),
  ],
  children: [],
});

const circleNode = (
  instance: RadioRecipeInstance,
  cell: StateCell,
  selected: boolean,
): FrameNode => ({
  kind: "frame",
  role: "radio/circle",
  label: "radio/circle",
  opacity: cell.circleOpacity.fallback,
  layout: {
    mode: "horizontal",
    primaryAxisAlign: "center",
    counterAxisAlign: "center",
    itemSpacing: 0,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    width: fixed(instance.tokens.circle.size.fallback),
    height: fixed(instance.tokens.circle.size.fallback),
  },
  fills: [solid(cell.circleFill.fallback)],
  strokes: [
    {
      weight: instance.tokens.circle.borderWidth.fallback,
      align: "inside",
      paint: solid(cell.circleBorder.fallback),
    },
  ],
  cornerRadius: corners(instance.tokens.circle.radius.fallback),
  bindings: [
    bind("layout.width.value", instance.tokens.circle.size),
    bind("layout.height.value", instance.tokens.circle.size),
    bind("fills.0.color", cell.circleFill),
    bind("strokes.0.weight", instance.tokens.circle.borderWidth),
    bind("strokes.0.paint.color", cell.circleBorder),
    bind("cornerRadius.topLeft", instance.tokens.circle.radius),
    bind("cornerRadius.topRight", instance.tokens.circle.radius),
    bind("cornerRadius.bottomRight", instance.tokens.circle.radius),
    bind("cornerRadius.bottomLeft", instance.tokens.circle.radius),
  ],
  children: [dotNode(instance, cell, selected)],
});

const hitNode = (
  instance: RadioRecipeInstance,
  cell: StateCell,
  selected: boolean,
): FrameNode => {
  const pad = instance.tokens.circle.padding.fallback;
  return {
    kind: "frame",
    role: "radio/hit",
    label: "radio/hit",
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "center",
      counterAxisAlign: "center",
      itemSpacing: 0,
      padding: { top: pad, right: pad, bottom: pad, left: pad },
      width: fixed(instance.tokens.wrapper.size.fallback),
      height: fixed(instance.tokens.wrapper.size.fallback),
    },
    fills: [],
    bindings: [
      bind("layout.width.value", instance.tokens.wrapper.size),
      bind("layout.height.value", instance.tokens.wrapper.size),
      bind("layout.padding.top", instance.tokens.circle.padding),
      bind("layout.padding.right", instance.tokens.circle.padding),
      bind("layout.padding.bottom", instance.tokens.circle.padding),
      bind("layout.padding.left", instance.tokens.circle.padding),
    ],
    children: [circleNode(instance, cell, selected)],
  };
};

const itemNode = (
  instance: RadioRecipeInstance,
  itemId: RadioSelected,
  selectedValue: RadioSelected,
  disabled: RadioDisabled,
): FrameNode => {
  const selected = itemId === selectedValue;
  const cell = cellOf(instance, selected, disabled);
  return {
    kind: "frame",
    role: `radio/item/${itemId}`,
    label: `radio/item/${itemId}`,
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: instance.tokens.itemAlign,
      itemSpacing: instance.tokens.item.gap.fallback,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
    },
    fills: [],
    bindings: [bind("layout.itemSpacing", instance.tokens.item.gap)],
    children: [hitNode(instance, cell, selected), labelText(instance, itemId, cell)],
  };
};

const variantComponent = (
  instance: RadioRecipeInstance,
  selected: RadioSelected,
  disabled: RadioDisabled,
): ComponentNode => ({
  kind: "component",
  role: `radio/variant/${selected}/${disabled}`,
  label: `Selected=${selected}, Disabled=${disabled}`,
  variantProperties: {
    Selected: selected,
    Disabled: disabled,
  },
  layout: {
    mode: instance.tokens.listMode,
    primaryAxisAlign: "min",
    counterAxisAlign: "min",
    itemSpacing: instance.tokens.list.gap.fallback,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    width: hug,
    height: hug,
  },
  fills: [],
  bindings: [bind("layout.itemSpacing", instance.tokens.list.gap)],
  children: RADIO_SELECTED.map((itemId) =>
    itemNode(instance, itemId, selected, disabled),
  ),
});

export function compileRadioIr(instance: RadioRecipeInstance): ComponentSetNode {
  const children = RADIO_SELECTED.flatMap((selected) =>
    RADIO_DISABLED.map((disabled) =>
      variantComponent(instance, selected, disabled),
    ),
  );
  return {
    kind: "component-set",
    role: "radio/set",
    label: instance.identity.name,
    variantAxes: [
      { name: "Selected", values: [...RADIO_SELECTED] },
      { name: "Disabled", values: [...RADIO_DISABLED] },
    ],
    layout: {
      mode: "vertical",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: 16,
      padding: { top: 16, right: 16, bottom: 16, left: 16 },
      width: hug,
      height: hug,
    },
    fills: [],
    bindings: [],
    children,
  };
}

export function compileRadioRecipe(input: unknown): RecipeEnvelope {
  const instance = normalizeRadioRecipeInstance(input);
  const totality = checkTotality(instance.inputFacts, instance);
  if (!isTotal(totality))
    throw new RecipeRefusal(
      RADIO_RECIPE_REF,
      totalityLines(instance.identity.id, totality),
    );
  const unsigned = {
    envelope: ENVELOPE_VERSION,
    id: instance.identity.id,
    name: instance.identity.name,
    archetype: "checkbox / radio",
    recipe: RADIO_RECIPE_REF,
    ir: compileRadioIr(instance),
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

const setByRole = (root: IRNode, role: string): ComponentSetNode => {
  if (root.kind === "component-set" && root.role === role) return root;
  throw new RecipeRefusal(RADIO_RECIPE_REF, [`missing required set ${role}`]);
};
const componentFor = (
  set: ComponentSetNode,
  properties: Record<string, string>,
): ComponentNode => {
  const found = set.children.filter(
    (child) =>
      child.kind === "component" &&
      Object.entries(properties).every(
        ([name, value]) => child.variantProperties?.[name] === value,
      ),
  );
  if (found.length !== 1)
    throw new RecipeRefusal(RADIO_RECIPE_REF, [
      `${set.role}: expected exactly one component for ${JSON.stringify(properties)}`,
    ]);
  return found[0]!;
};
const direct = <Kind extends IRNode["kind"]>(
  parent: { children?: IRNode[] },
  role: string,
  kind: Kind,
): Extract<IRNode, { kind: Kind }> => {
  const found = (parent.children ?? []).filter(
    (child) => child.role === role && child.kind === kind,
  );
  if (found.length !== 1)
    throw new RecipeRefusal(RADIO_RECIPE_REF, [
      `expected exactly one ${role} of kind ${kind}`,
    ]);
  return found[0] as Extract<IRNode, { kind: Kind }>;
};
const binding = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
): string => {
  const found = (node.bindings ?? []).filter((entry) => entry.field === field);
  if (found.length !== 1)
    throw new RecipeRefusal(RADIO_RECIPE_REF, [
      `${node.role ?? "node"}: required binding ${field} must appear exactly once`,
    ]);
  return found[0]!.variable;
};
const numberFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: number,
): RadioNumberParameter => ({ variable: binding(node, field), fallback });
const colorFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: string,
): RadioColorParameter => ({ variable: binding(node, field), fallback });
const solidColor = (paint: unknown, role: string): string => {
  const candidate = paint as { kind?: string; color?: string } | undefined;
  if (candidate?.kind !== "solid" || typeof candidate.color !== "string")
    throw new RecipeRefusal(RADIO_RECIPE_REF, [
      `${role}: expected a solid fill`,
    ]);
  return candidate.color;
};
const fontFrom = (node: TextNode): RadioFontSpec => {
  const provenance = node.type.fontProvenance;
  if (!provenance)
    throw new RecipeRefusal(RADIO_RECIPE_REF, [
      `${node.role ?? "text"}: font provenance is required`,
    ]);
  return provenance as RadioFontSpec;
};

export function validateRadioStructure(root: IRNode): void {
  const set = setByRole(root, "radio/set");
  if (set.children.length !== RADIO_SELECTED.length * RADIO_DISABLED.length)
    throw new RecipeRefusal(RADIO_RECIPE_REF, [
      "radio/set must carry every Selected × Disabled variant",
    ]);
  const modes = new Set<string>();
  const aligns = new Set<string>();
  for (const selected of RADIO_SELECTED) {
    for (const disabled of RADIO_DISABLED) {
      const variant = componentFor(set, {
        Selected: selected,
        Disabled: disabled,
      });
      if (variant.layout.mode !== "vertical" && variant.layout.mode !== "horizontal")
        throw new RecipeRefusal(RADIO_RECIPE_REF, [
          `${variant.role}: radio list mode must be vertical or horizontal`,
        ]);
      modes.add(variant.layout.mode);
      if (variant.children.length !== RADIO_SELECTED.length)
        throw new RecipeRefusal(RADIO_RECIPE_REF, [
          `${variant.role}: list must carry both items`,
        ]);
      for (const itemId of RADIO_SELECTED) {
        const item = direct(variant, `radio/item/${itemId}`, "frame");
        aligns.add(item.layout.counterAxisAlign);
        const hit = direct(item, "radio/hit", "frame");
        if (hit.layout.width.mode !== "fixed" || hit.layout.height.mode !== "fixed")
          throw new RecipeRefusal(RADIO_RECIPE_REF, [
            `${variant.role}: hit target must be a measured box`,
          ]);
        const circle = direct(hit, "radio/circle", "frame");
        if (
          circle.layout.width.mode !== "fixed" ||
          circle.layout.height.mode !== "fixed"
        )
          throw new RecipeRefusal(RADIO_RECIPE_REF, [
            `${variant.role}: the radio circle must carry a named size`,
          ]);
        const dot = direct(circle, "radio/glyph/dot", "frame");
        const shouldShow = itemId === selected;
        if (shouldShow && dot.visible === false)
          throw new RecipeRefusal(RADIO_RECIPE_REF, [
            `${variant.role}: selected item ${itemId} must show the dot`,
          ]);
        if (!shouldShow && dot.visible !== false)
          throw new RecipeRefusal(RADIO_RECIPE_REF, [
            `${variant.role}: unselected item ${itemId} must hide the dot`,
          ]);
        direct(item, "radio/label", "text");
      }
    }
  }
  if (modes.size !== 1)
    throw new RecipeRefusal(RADIO_RECIPE_REF, [
      "listMode must be one value for the whole instance — not per-variant cosmetics",
    ]);
  if (aligns.size !== 1)
    throw new RecipeRefusal(RADIO_RECIPE_REF, [
      "itemAlign must be one value for the whole instance — not per-variant cosmetics",
    ]);
}

const firstDifference = (
  left: unknown,
  right: unknown,
  path = "$",
): string | undefined => {
  if (canonicalJson(left) === canonicalJson(right)) return undefined;
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  )
    return path;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return path;
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      const found = firstDifference(
        left[index],
        right[index],
        `${path}[${index}]`,
      );
      if (found) return found;
    }
    return path;
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

const cellFromItem = (item: FrameNode): StateCell => {
  const label = direct(item, "radio/label", "text");
  const hit = direct(item, "radio/hit", "frame");
  const circle = direct(hit, "radio/circle", "frame");
  const dot = direct(circle, "radio/glyph/dot", "frame");
  const stroke = circle.strokes?.[0];
  if (!stroke)
    throw new RecipeRefusal(RADIO_RECIPE_REF, [
      `${item.role}: circle stroke missing`,
    ]);
  return {
    circleFill: colorFrom(
      circle,
      "fills.0.color",
      solidColor(circle.fills[0], circle.role!),
    ),
    circleBorder: colorFrom(
      circle,
      "strokes.0.paint.color",
      solidColor(stroke.paint, `${circle.role} stroke`),
    ),
    circleOpacity: {
      variable: "radio.circleOpacity",
      fallback: circle.opacity ?? 1,
    },
    label: colorFrom(
      label,
      "fills.0.color",
      solidColor(label.fills[0], label.role!),
    ),
    dotFill: colorFrom(
      dot,
      "fills.0.color",
      solidColor(dot.fills[0], dot.role!),
    ),
  };
};

export function collapseRadioRecipe(
  envelopeInput: unknown,
  selection: unknown,
): RadioRecipeInstance {
  requireExactRecipeSelection(selection, RADIO_RECIPE_REF);
  const envelope = RecipeEnvelopeSchema.parse(envelopeInput);
  if (envelope.recipe.id !== RADIO_RECIPE_REF.id)
    throw new RecipeRefusal(RADIO_RECIPE_REF, ["envelope recipe mismatch"]);
  validateRadioStructure(envelope.ir);
  const set = setByRole(envelope.ir, "radio/set");
  const baseline = componentFor(set, {
    Selected: "a",
    Disabled: "false",
  });
  const itemA = direct(baseline, "radio/item/a", "frame");
  const itemB = direct(baseline, "radio/item/b", "frame");
  const hit = direct(itemA, "radio/hit", "frame");
  const circle = direct(hit, "radio/circle", "frame");
  const dot = direct(circle, "radio/glyph/dot", "frame");
  const label = direct(itemA, "radio/label", "text");
  const labelB = direct(itemB, "radio/label", "text");
  const disabledBaseline = componentFor(set, {
    Selected: "a",
    Disabled: "true",
  });
  const instance = normalizeRadioRecipeInstance({
    identity: { id: envelope.id, name: envelope.name },
    semantic: { root: "radio", control: "radio", label: "label" },
    axes: {
      selected: {
        name: "Selected",
        values: [...RADIO_SELECTED],
        default: "a",
      },
      disabled: {
        name: "Disabled",
        values: [...RADIO_DISABLED],
        default: "false",
      },
    },
    content: {
      items: [
        { id: "a", label: label.characters },
        { id: "b", label: labelB.characters },
      ],
    },
    tokens: {
      listMode:
        baseline.layout.mode === "horizontal" ? "horizontal" : "vertical",
      list: {
        gap: numberFrom(
          baseline,
          "layout.itemSpacing",
          baseline.layout.itemSpacing,
        ),
      },
      item: {
        gap: numberFrom(itemA, "layout.itemSpacing", itemA.layout.itemSpacing),
      },
      itemAlign:
        itemA.layout.counterAxisAlign === "baseline" ? "baseline" : "center",
      wrapper: {
        size: numberFrom(
          hit,
          "layout.width.value",
          hit.layout.width.mode === "fixed" ? hit.layout.width.value : 0,
        ),
      },
      circle: {
        size: numberFrom(
          circle,
          "layout.width.value",
          circle.layout.width.mode === "fixed" ? circle.layout.width.value : 0,
        ),
        radius: numberFrom(
          circle,
          "cornerRadius.topLeft",
          circle.cornerRadius?.topLeft ?? 0,
        ),
        borderWidth: numberFrom(
          circle,
          "strokes.0.weight",
          circle.strokes?.[0]?.weight ?? 0,
        ),
        padding: numberFrom(
          hit,
          "layout.padding.top",
          hit.layout.padding.top,
        ),
      },
      dot: {
        size: numberFrom(
          dot,
          "layout.width.value",
          dot.layout.width.mode === "fixed" ? dot.layout.width.value : 0,
        ),
        radius: numberFrom(
          dot,
          "cornerRadius.topLeft",
          dot.cornerRadius?.topLeft ?? 0,
        ),
      },
      states: {
        selected: {
          enabled: cellFromItem(itemA),
          disabled: cellFromItem(
            direct(disabledBaseline, "radio/item/a", "frame"),
          ),
        },
        unselected: {
          enabled: cellFromItem(itemB),
          disabled: cellFromItem(
            direct(disabledBaseline, "radio/item/b", "frame"),
          ),
        },
      },
      labelFontSize: numberFrom(label, "type.fontSize", label.type.fontSize),
      labelLineHeightUnit:
        label.type.lineHeight.unit === "px" ? "px" : "auto",
      labelLineHeight:
        label.type.lineHeight.unit === "px"
          ? numberFrom(
              label,
              "type.lineHeight.value",
              label.type.lineHeight.value,
            )
          : {
              variable: `${envelope.id}.labelLineHeight`,
              fallback: 0,
            },
      typography: { label: fontFrom(label) },
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
  const opacityVariable = instance.tokens.states.selected.enabled.circleOpacity
    .variable;
  for (const arm of ["selected", "unselected"] as const) {
    for (const state of ["enabled", "disabled"] as const)
      instance.tokens.states[arm][state].circleOpacity = {
        variable: `${instance.id}.states-${arm}-${state}-circleOpacity`,
        fallback: instance.tokens.states[arm][state].circleOpacity.fallback,
      };
  }
  void opacityVariable;
  const recompiled = compileRadioRecipe(instance);
  const difference = firstDifference(recompiled.ir, envelope.ir);
  if (difference)
    throw new RecipeRefusal(RADIO_RECIPE_REF, [
      `unsupported structural edit at ${difference}; radio@1 accepts only the declared designer edit surface`,
    ]);
  return instance;
}

export const radioRecipe: Recipe<RadioRecipeInstance> = {
  ref: RADIO_RECIPE_REF,
  normalize: normalizeRadioRecipeInstance,
  compile: compileRadioRecipe,
  collapse: collapseRadioRecipe,
};

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
  type VectorNode,
} from "../figma-ir.js";
import { toFigmaVectorPath } from "../figma-vector-path.js";
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

export const CHECKBOX_RECIPE_REF = {
  id: "checkbox",
  version: 1,
} as const satisfies RecipeRef;

/**
 * Axes all three Phase 1 libraries actually declare on the standalone
 * control: a tri-state check plus disabled. Size is NOT an axis —
 * Astryx has sm/md, MUI has small/medium, AntD Checkbox has no size.
 * Each library's default size is named geometry, not a picker.
 */
export const CHECKBOX_CHECKED = [
  "unchecked",
  "checked",
  "indeterminate",
] as const;
export const CHECKBOX_DISABLED = ["false", "true"] as const;

export type CheckboxChecked = (typeof CHECKBOX_CHECKED)[number];
export type CheckboxDisabled = (typeof CHECKBOX_DISABLED)[number];

export interface CheckboxNumberParameter {
  variable: string;
  fallback: number;
}
export interface CheckboxColorParameter {
  variable: string;
  fallback: string;
}
export interface CheckboxFontSpec {
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
  boxFill: CheckboxColorParameter;
  boxBorder: CheckboxColorParameter;
  boxOpacity: CheckboxNumberParameter;
  label: CheckboxColorParameter;
  dashFill: CheckboxColorParameter;
  checkFill: CheckboxColorParameter;
}

export interface CheckboxRecipeInstance {
  identity: { id: string; name: string };
  semantic: {
    root: "checkbox";
    control: "checkbox";
    label: "label";
  };
  axes: {
    checked: {
      name: "Checked";
      values: CheckboxChecked[];
      default: CheckboxChecked;
    };
    disabled: {
      name: "Disabled";
      values: CheckboxDisabled[];
      default: CheckboxDisabled;
    };
  };
  content: {
    /**
     * Shared fixture label. Astryx CheckboxInput.tsx example is
     * "Accept terms". MUI Checkbox has no label (FormControlLabel is a
     * reviewed pairing). AntD uses children. Named as recipe content,
     * not a library-invented string per root.
     */
    label: string;
  };
  tokens: {
    wrapper: { size: CheckboxNumberParameter };
    box: {
      size: CheckboxNumberParameter;
      radius: CheckboxNumberParameter;
      borderWidth: CheckboxNumberParameter;
      padding: CheckboxNumberParameter;
    };
    row: { gap: CheckboxNumberParameter };
    /**
     * Source align-items. Astryx/MUI `center`; AntD wrapper `baseline`.
     * Not a number token — compile reads the string.
     */
    rowAlign: "center" | "baseline";
    dash: {
      width: CheckboxNumberParameter;
      height: CheckboxNumberParameter;
      radius: CheckboxNumberParameter;
    };
    /**
     * Named glyph from package SVG / CSS. `path` is SVG `d` in the
     * vector's local space. `placement` `absolute` is the AntD
     * `::after` 25%/50% + translate(-50%,-50%); `center` is auto-layout
     * centering (Astryx/MUI).
     */
    check: {
      path: string;
      width: CheckboxNumberParameter;
      height: CheckboxNumberParameter;
      strokeWidth: CheckboxNumberParameter;
      winding: "nonzero" | "evenodd";
      paint: "stroke" | "fill";
      strokeCap: "none" | "round" | "square";
      strokeJoin: "miter" | "bevel" | "round";
      rotation: number;
      offsetX: CheckboxNumberParameter;
      offsetY: CheckboxNumberParameter;
      placement: "center" | "absolute";
    };
    states: Record<CheckboxChecked, Record<"enabled" | "disabled", StateCell>>;
    labelFontSize: CheckboxNumberParameter;
    typography: { label: CheckboxFontSpec };
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
  boxFill: ColorParameterSchema,
  boxBorder: ColorParameterSchema,
  boxOpacity: NumberParameterSchema,
  label: ColorParameterSchema,
  dashFill: ColorParameterSchema,
  checkFill: ColorParameterSchema,
});

export const CheckboxRecipeInstanceSchema = z.strictObject({
  identity: z.strictObject({ id: z.string().min(1), name: z.string().min(1) }),
  semantic: z.strictObject({
    root: z.literal("checkbox"),
    control: z.literal("checkbox"),
    label: z.literal("label"),
  }),
  axes: z.strictObject({
    checked: z.strictObject({
      name: z.literal("Checked"),
      values: z.array(z.enum(CHECKBOX_CHECKED)).min(1),
      default: z.enum(CHECKBOX_CHECKED),
    }),
    disabled: z.strictObject({
      name: z.literal("Disabled"),
      values: z.array(z.enum(CHECKBOX_DISABLED)).min(1),
      default: z.enum(CHECKBOX_DISABLED),
    }),
  }),
  content: z.strictObject({
    label: z.string().min(1),
  }),
  tokens: z.strictObject({
    wrapper: z.strictObject({ size: NumberParameterSchema }),
    box: z.strictObject({
      size: NumberParameterSchema,
      radius: NumberParameterSchema,
      borderWidth: NumberParameterSchema,
      padding: NumberParameterSchema,
    }),
    row: z.strictObject({ gap: NumberParameterSchema }),
    rowAlign: z.enum(["center", "baseline"]),
    dash: z.strictObject({
      width: NumberParameterSchema,
      height: NumberParameterSchema,
      radius: NumberParameterSchema,
    }),
    check: z.strictObject({
      path: z.string().min(1),
      width: NumberParameterSchema,
      height: NumberParameterSchema,
      strokeWidth: NumberParameterSchema,
      winding: z.enum(["nonzero", "evenodd"]),
      paint: z.enum(["stroke", "fill"]),
      strokeCap: z.enum(["none", "round", "square"]),
      strokeJoin: z.enum(["miter", "bevel", "round"]),
      rotation: z.number().finite(),
      offsetX: NumberParameterSchema,
      offsetY: NumberParameterSchema,
      placement: z.enum(["center", "absolute"]),
    }),
    states: z.strictObject({
      unchecked: z.strictObject({
        enabled: StateCellSchema,
        disabled: StateCellSchema,
      }),
      checked: z.strictObject({
        enabled: StateCellSchema,
        disabled: StateCellSchema,
      }),
      indeterminate: z.strictObject({
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

export function normalizeCheckboxRecipeInstance(
  input: unknown,
): CheckboxRecipeInstance {
  requireExactRecipeSelection(
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as { provenance?: { selection?: unknown } }).provenance
          ?.selection
      : undefined,
    CHECKBOX_RECIPE_REF,
  );
  const instance = CheckboxRecipeInstanceSchema.parse(
    input,
  ) as CheckboxRecipeInstance;
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
  parameter: CheckboxNumberParameter | CheckboxColorParameter,
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
  instance: CheckboxRecipeInstance,
  checked: CheckboxChecked,
  disabled: CheckboxDisabled,
): StateCell =>
  instance.tokens.states[checked][disabled === "true" ? "disabled" : "enabled"];

const labelText = (
  instance: CheckboxRecipeInstance,
  cell: StateCell,
): TextNode => ({
  kind: "text",
  role: "checkbox/label",
  label: "checkbox/label",
  characters: instance.content.label,
  type: {
    fontFamily: instance.tokens.typography.label.resolvedFamily,
    fontStyle: instance.tokens.typography.label.resolvedStyle,
    fontProvenance: instance.tokens.typography.label,
    fontSize: instance.tokens.labelFontSize.fallback,
    lineHeight: { unit: "auto" },
  },
  align: "left",
  verticalAlign: "center",
  fills: [solid(cell.label.fallback)],
  width: hug,
  height: hug,
  bindings: [
    bind("type.fontSize", instance.tokens.labelFontSize),
    bind("fills.0.color", cell.label),
  ],
});

const dashNode = (
  instance: CheckboxRecipeInstance,
  cell: StateCell,
  visible: boolean,
): FrameNode => ({
  kind: "frame",
  role: "checkbox/glyph/dash",
  label: "checkbox/glyph/dash",
  visible,
  layout: {
    mode: "horizontal",
    primaryAxisAlign: "center",
    counterAxisAlign: "center",
    itemSpacing: 0,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    width: fixed(instance.tokens.dash.width.fallback),
    height: fixed(instance.tokens.dash.height.fallback),
  },
  fills: [solid(cell.dashFill.fallback)],
  cornerRadius: corners(instance.tokens.dash.radius.fallback),
  bindings: [
    bind("layout.width.value", instance.tokens.dash.width),
    bind("layout.height.value", instance.tokens.dash.height),
    bind("fills.0.color", cell.dashFill),
    bind("cornerRadius.topLeft", instance.tokens.dash.radius),
    bind("cornerRadius.topRight", instance.tokens.dash.radius),
    bind("cornerRadius.bottomRight", instance.tokens.dash.radius),
    bind("cornerRadius.bottomLeft", instance.tokens.dash.radius),
  ],
  children: [],
});

const checkVector = (
  instance: CheckboxRecipeInstance,
  cell: StateCell,
  visible: boolean,
): VectorNode => {
  const check = instance.tokens.check;
  const strokePaint = check.paint === "stroke";
  return {
    kind: "vector",
    role: "checkbox/glyph/check",
    label: "checkbox/glyph/check",
    visible,
    // Lower the library's shipped path into the subset Figma accepts.
    // recipe/figma-vector-path.ts documents the probed grammar (M L C Q Z
    // absolute; H, V, A and every relative command refused). MUI ships
    // "M19 3H5c-1.11…", which Figma rejects outright, so without this the
    // archetype cannot mint at all.
    assetRef: toFigmaVectorPath(check.path),
    width: fixed(check.width.fallback),
    height: fixed(check.height.fallback),
    fills: strokePaint ? [] : [solid(cell.checkFill.fallback)],
    ...(strokePaint
      ? {
          strokes: [
            {
              weight: check.strokeWidth.fallback,
              align: "center" as const,
              paint: solid(cell.checkFill.fallback),
            },
          ],
        }
      : {}),
    windingRule: check.winding,
    strokeCap: check.strokeCap,
    strokeJoin: check.strokeJoin,
    rotation: check.rotation,
    bindings: [
      bind("width.value", check.width),
      bind("height.value", check.height),
      ...(strokePaint
        ? [
            bind("strokes.0.weight", check.strokeWidth),
            bind("strokes.0.paint.color", cell.checkFill),
          ]
        : [bind("fills.0.color", cell.checkFill)]),
    ],
  };
};

const checkChild = (
  instance: CheckboxRecipeInstance,
  cell: StateCell,
  visible: boolean,
): FrameNode | VectorNode => {
  const vector = checkVector(instance, cell, visible);
  const check = instance.tokens.check;
  if (check.placement !== "absolute") return vector;
  return {
    kind: "frame",
    role: "checkbox/glyph/check-host",
    label: "checkbox/glyph/check-host",
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "center",
      counterAxisAlign: "center",
      itemSpacing: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: fixed(check.width.fallback),
      height: fixed(check.height.fallback),
      positioning: "absolute",
      offset: {
        x: check.offsetX.fallback,
        y: check.offsetY.fallback,
      },
      constraints: { horizontal: "left", vertical: "top" },
    },
    fills: [],
    clipsContent: false,
    bindings: [
      bind("layout.width.value", check.width),
      bind("layout.height.value", check.height),
    ],
    children: [vector],
  };
};

const boxNode = (
  instance: CheckboxRecipeInstance,
  checked: CheckboxChecked,
  cell: StateCell,
): FrameNode => {
  return {
    kind: "frame",
    role: "checkbox/box",
    label: "checkbox/box",
    opacity: cell.boxOpacity.fallback,
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "center",
      counterAxisAlign: "center",
      itemSpacing: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: fixed(instance.tokens.box.size.fallback),
      height: fixed(instance.tokens.box.size.fallback),
    },
    fills: [solid(cell.boxFill.fallback)],
    strokes: [
      {
        weight: instance.tokens.box.borderWidth.fallback,
        align: "inside",
        paint: solid(cell.boxBorder.fallback),
      },
    ],
    clipsContent: instance.tokens.check.placement !== "absolute",
    cornerRadius: corners(instance.tokens.box.radius.fallback),
    bindings: [
      bind("layout.width.value", instance.tokens.box.size),
      bind("layout.height.value", instance.tokens.box.size),
      bind("fills.0.color", cell.boxFill),
      bind("strokes.0.weight", instance.tokens.box.borderWidth),
      bind("strokes.0.paint.color", cell.boxBorder),
      bind("cornerRadius.topLeft", instance.tokens.box.radius),
      bind("cornerRadius.topRight", instance.tokens.box.radius),
      bind("cornerRadius.bottomRight", instance.tokens.box.radius),
      bind("cornerRadius.bottomLeft", instance.tokens.box.radius),
    ],
    children: [
      dashNode(instance, cell, checked === "indeterminate"),
      checkChild(instance, cell, checked === "checked"),
    ],
  };
};

const hitNode = (
  instance: CheckboxRecipeInstance,
  checked: CheckboxChecked,
  cell: StateCell,
): FrameNode => {
  const pad = instance.tokens.box.padding.fallback;
  return {
    kind: "frame",
    role: "checkbox/hit",
    label: "checkbox/hit",
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
      bind("layout.padding.top", instance.tokens.box.padding),
      bind("layout.padding.right", instance.tokens.box.padding),
      bind("layout.padding.bottom", instance.tokens.box.padding),
      bind("layout.padding.left", instance.tokens.box.padding),
    ],
    children: [boxNode(instance, checked, cell)],
  };
};

const variantComponent = (
  instance: CheckboxRecipeInstance,
  checked: CheckboxChecked,
  disabled: CheckboxDisabled,
): ComponentNode => {
  const cell = cellOf(instance, checked, disabled);
  return {
    kind: "component",
    role: `checkbox/variant/${checked}/${disabled}`,
    label: `Checked=${checked}, Disabled=${disabled}`,
    variantProperties: {
      Checked: checked,
      Disabled: disabled,
    },
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: instance.tokens.rowAlign,
      itemSpacing: instance.tokens.row.gap.fallback,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
    },
    fills: [],
    bindings: [bind("layout.itemSpacing", instance.tokens.row.gap)],
    children: [hitNode(instance, checked, cell), labelText(instance, cell)],
  };
};

export function compileCheckboxIr(
  instance: CheckboxRecipeInstance,
): ComponentSetNode {
  const children = CHECKBOX_CHECKED.flatMap((checked) =>
    CHECKBOX_DISABLED.map((disabled) =>
      variantComponent(instance, checked, disabled),
    ),
  );
  return {
    kind: "component-set",
    role: "checkbox/set",
    label: instance.identity.name,
    variantAxes: [
      { name: "Checked", values: [...CHECKBOX_CHECKED] },
      { name: "Disabled", values: [...CHECKBOX_DISABLED] },
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

export function compileCheckboxRecipe(input: unknown): RecipeEnvelope {
  const instance = normalizeCheckboxRecipeInstance(input);
  const totality = checkTotality(instance.inputFacts, instance);
  if (!isTotal(totality))
    throw new RecipeRefusal(
      CHECKBOX_RECIPE_REF,
      totalityLines(instance.identity.id, totality),
    );
  const unsigned = {
    envelope: ENVELOPE_VERSION,
    id: instance.identity.id,
    name: instance.identity.name,
    archetype: "checkbox / radio",
    recipe: CHECKBOX_RECIPE_REF,
    ir: compileCheckboxIr(instance),
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
  throw new RecipeRefusal(CHECKBOX_RECIPE_REF, [
    `missing required set ${role}`,
  ]);
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
    throw new RecipeRefusal(CHECKBOX_RECIPE_REF, [
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
    throw new RecipeRefusal(CHECKBOX_RECIPE_REF, [
      `expected exactly one ${role} of kind ${kind}`,
    ]);
  return found[0] as Extract<IRNode, { kind: Kind }>;
};
const checkVectorFrom = (box: FrameNode): VectorNode => {
  const host = (box.children ?? []).find(
    (child) => child.role === "checkbox/glyph/check-host" && child.kind === "frame",
  );
  if (host && host.kind === "frame")
    return direct(host, "checkbox/glyph/check", "vector");
  return direct(box, "checkbox/glyph/check", "vector");
};
const checkHostFrom = (box: FrameNode): FrameNode | undefined => {
  const host = (box.children ?? []).find(
    (child) => child.role === "checkbox/glyph/check-host" && child.kind === "frame",
  );
  return host && host.kind === "frame" ? host : undefined;
};
const binding = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
): string => {
  const found = (node.bindings ?? []).filter((entry) => entry.field === field);
  if (found.length !== 1)
    throw new RecipeRefusal(CHECKBOX_RECIPE_REF, [
      `${node.role ?? "node"}: required binding ${field} must appear exactly once`,
    ]);
  return found[0]!.variable;
};
const numberFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: number,
): CheckboxNumberParameter => ({ variable: binding(node, field), fallback });
const colorFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: string,
): CheckboxColorParameter => ({ variable: binding(node, field), fallback });
const solidColor = (paint: unknown, role: string): string => {
  const candidate = paint as { kind?: string; color?: string } | undefined;
  if (candidate?.kind !== "solid" || typeof candidate.color !== "string")
    throw new RecipeRefusal(CHECKBOX_RECIPE_REF, [
      `${role}: expected a solid fill`,
    ]);
  return candidate.color;
};
const fontFrom = (node: TextNode): CheckboxFontSpec => {
  const provenance = node.type.fontProvenance;
  if (!provenance)
    throw new RecipeRefusal(CHECKBOX_RECIPE_REF, [
      `${node.role ?? "text"}: font provenance is required`,
    ]);
  return provenance as CheckboxFontSpec;
};

export function validateCheckboxStructure(root: IRNode): void {
  const set = setByRole(root, "checkbox/set");
  if (set.children.length !== CHECKBOX_CHECKED.length * CHECKBOX_DISABLED.length)
    throw new RecipeRefusal(CHECKBOX_RECIPE_REF, [
      "checkbox/set must carry every Checked × Disabled variant",
    ]);
  const aligns = new Set<string>();
  for (const checked of CHECKBOX_CHECKED) {
    for (const disabled of CHECKBOX_DISABLED) {
      const variant = componentFor(set, {
        Checked: checked,
        Disabled: disabled,
      });
      if (variant.layout.mode !== "horizontal")
        throw new RecipeRefusal(CHECKBOX_RECIPE_REF, [
          `${variant.role}: checkbox root is a horizontal label row`,
        ]);
      aligns.add(variant.layout.counterAxisAlign);
      const hit = direct(variant, "checkbox/hit", "frame");
      if (hit.layout.width.mode !== "fixed" || hit.layout.height.mode !== "fixed")
        throw new RecipeRefusal(CHECKBOX_RECIPE_REF, [
          `${variant.role}: hit target must be a measured box`,
        ]);
      const box = direct(hit, "checkbox/box", "frame");
      if (box.layout.width.mode !== "fixed" || box.layout.height.mode !== "fixed")
        throw new RecipeRefusal(CHECKBOX_RECIPE_REF, [
          `${variant.role}: the control box must carry a named size`,
        ]);
      const dash = direct(box, "checkbox/glyph/dash", "frame");
      if (checked === "indeterminate" && dash.visible === false)
        throw new RecipeRefusal(CHECKBOX_RECIPE_REF, [
          `${variant.role}: indeterminate must show the dash`,
        ]);
      if (checked !== "indeterminate" && dash.visible !== false)
        throw new RecipeRefusal(CHECKBOX_RECIPE_REF, [
          `${variant.role}: dash is only for indeterminate`,
        ]);
      const check = checkVectorFrom(box);
      if (checked === "checked" && check.visible === false)
        throw new RecipeRefusal(CHECKBOX_RECIPE_REF, [
          `${variant.role}: checked must show the check glyph`,
        ]);
      if (checked !== "checked" && check.visible !== false)
        throw new RecipeRefusal(CHECKBOX_RECIPE_REF, [
          `${variant.role}: check glyph is only for checked`,
        ]);
      direct(variant, "checkbox/label", "text");
    }
  }
  if (aligns.size !== 1)
    throw new RecipeRefusal(CHECKBOX_RECIPE_REF, [
      "rowAlign must be one value for the whole instance — not per-variant cosmetics",
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

const cellFromVariant = (variant: ComponentNode): StateCell => {
  const label = direct(variant, "checkbox/label", "text");
  const hit = direct(variant, "checkbox/hit", "frame");
  const box = direct(hit, "checkbox/box", "frame");
  const dash = direct(box, "checkbox/glyph/dash", "frame");
  const check = checkVectorFrom(box);
  const stroke = box.strokes?.[0];
  if (!stroke)
    throw new RecipeRefusal(CHECKBOX_RECIPE_REF, [
      `${variant.role}: box stroke missing`,
    ]);
  const checkStroke = check.strokes?.[0];
  const checkFillFallback = checkStroke
    ? solidColor(checkStroke.paint, `${check.role} stroke`)
    : solidColor(check.fills[0], check.role!);
  const checkFillField = checkStroke
    ? "strokes.0.paint.color"
    : "fills.0.color";
  return {
    boxFill: colorFrom(box, "fills.0.color", solidColor(box.fills[0], box.role!)),
    boxBorder: colorFrom(
      box,
      "strokes.0.paint.color",
      solidColor(stroke.paint, `${box.role} stroke`),
    ),
    boxOpacity: {
      variable: "checkbox.boxOpacity",
      fallback: box.opacity ?? 1,
    },
    label: colorFrom(
      label,
      "fills.0.color",
      solidColor(label.fills[0], label.role!),
    ),
    dashFill: colorFrom(
      dash,
      "fills.0.color",
      solidColor(dash.fills[0], dash.role!),
    ),
    checkFill: colorFrom(check, checkFillField, checkFillFallback),
  };
};

export function collapseCheckboxRecipe(
  envelopeInput: unknown,
  selection: unknown,
): CheckboxRecipeInstance {
  requireExactRecipeSelection(selection, CHECKBOX_RECIPE_REF);
  const envelope = RecipeEnvelopeSchema.parse(envelopeInput);
  if (envelope.recipe.id !== CHECKBOX_RECIPE_REF.id)
    throw new RecipeRefusal(CHECKBOX_RECIPE_REF, ["envelope recipe mismatch"]);
  validateCheckboxStructure(envelope.ir);
  const set = setByRole(envelope.ir, "checkbox/set");
  const baseline = componentFor(set, {
    Checked: "unchecked",
    Disabled: "false",
  });
  const hit = direct(baseline, "checkbox/hit", "frame");
  const box = direct(hit, "checkbox/box", "frame");
  const dash = direct(box, "checkbox/glyph/dash", "frame");
  const checkedBox = direct(
    direct(
      componentFor(set, { Checked: "checked", Disabled: "false" }),
      "checkbox/hit",
      "frame",
    ),
    "checkbox/box",
    "frame",
  );
  const check = checkVectorFrom(checkedBox);
  const checkHost = checkHostFrom(checkedBox);
  const checkStroke = check.strokes?.[0];
  const label = direct(baseline, "checkbox/label", "text");
  const stateOf = (checked: CheckboxChecked, disabled: CheckboxDisabled) =>
    cellFromVariant(componentFor(set, { Checked: checked, Disabled: disabled }));
  const enabledUnchecked = stateOf("unchecked", "false");
  const instance = normalizeCheckboxRecipeInstance({
    identity: { id: envelope.id, name: envelope.name },
    semantic: { root: "checkbox", control: "checkbox", label: "label" },
    axes: {
      checked: {
        name: "Checked",
        values: [...CHECKBOX_CHECKED],
        default: "unchecked",
      },
      disabled: {
        name: "Disabled",
        values: [...CHECKBOX_DISABLED],
        default: "false",
      },
    },
    content: { label: label.characters },
    tokens: {
      wrapper: {
        size: numberFrom(
          hit,
          "layout.width.value",
          hit.layout.width.mode === "fixed" ? hit.layout.width.value : 0,
        ),
      },
      box: {
        size: numberFrom(
          box,
          "layout.width.value",
          box.layout.width.mode === "fixed" ? box.layout.width.value : 0,
        ),
        radius: numberFrom(
          box,
          "cornerRadius.topLeft",
          box.cornerRadius?.topLeft ?? 0,
        ),
        borderWidth: numberFrom(
          box,
          "strokes.0.weight",
          box.strokes?.[0]?.weight ?? 0,
        ),
        padding: numberFrom(hit, "layout.padding.top", hit.layout.padding.top),
      },
      row: {
        gap: numberFrom(
          baseline,
          "layout.itemSpacing",
          baseline.layout.itemSpacing,
        ),
      },
      rowAlign:
        baseline.layout.counterAxisAlign === "baseline" ? "baseline" : "center",
      dash: {
        width: numberFrom(
          dash,
          "layout.width.value",
          dash.layout.width.mode === "fixed" ? dash.layout.width.value : 0,
        ),
        height: numberFrom(
          dash,
          "layout.height.value",
          dash.layout.height.mode === "fixed" ? dash.layout.height.value : 0,
        ),
        radius: numberFrom(
          dash,
          "cornerRadius.topLeft",
          dash.cornerRadius?.topLeft ?? 0,
        ),
      },
      check: {
        path: check.assetRef,
        width: numberFrom(
          check,
          "width.value",
          check.width.mode === "fixed" ? check.width.value : 0,
        ),
        height: numberFrom(
          check,
          "height.value",
          check.height.mode === "fixed" ? check.height.value : 0,
        ),
        strokeWidth: checkStroke
          ? numberFrom(check, "strokes.0.weight", checkStroke.weight)
          : {
              variable: `${envelope.id}.check-strokeWidth`,
              fallback: 0,
            },
        winding: check.windingRule === "evenodd" ? "evenodd" : "nonzero",
        paint: checkStroke ? "stroke" : "fill",
        strokeCap: check.strokeCap ?? "none",
        strokeJoin: check.strokeJoin ?? "miter",
        rotation: check.rotation ?? 0,
        offsetX: checkHost?.layout.offset
          ? {
              variable: `${envelope.id}.check-offsetX`,
              fallback: checkHost.layout.offset.x,
            }
          : {
              variable: `${envelope.id}.check-offsetX`,
              fallback: 0,
            },
        offsetY: checkHost?.layout.offset
          ? {
              variable: `${envelope.id}.check-offsetY`,
              fallback: checkHost.layout.offset.y,
            }
          : {
              variable: `${envelope.id}.check-offsetY`,
              fallback: 0,
            },
        placement: checkHost ? "absolute" : "center",
      },
      states: {
        unchecked: {
          enabled: enabledUnchecked,
          disabled: stateOf("unchecked", "true"),
        },
        checked: {
          enabled: stateOf("checked", "false"),
          disabled: stateOf("checked", "true"),
        },
        indeterminate: {
          enabled: stateOf("indeterminate", "false"),
          disabled: stateOf("indeterminate", "true"),
        },
      },
      labelFontSize: numberFrom(
        label,
        "type.fontSize",
        label.type.fontSize,
      ),
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
  // Collapse cannot recover per-cell boxOpacity variable names from IR
  // (opacity is a node field, not a bound variable). Re-bind the enabled
  // unchecked opacity variable onto every cell so the token leaf set
  // matches compile input; fallbacks stay the measured node opacity.
  const opacityVariable = enabledUnchecked.boxOpacity.variable;
  for (const checked of CHECKBOX_CHECKED) {
    for (const arm of ["enabled", "disabled"] as const)
      instance.tokens.states[checked][arm].boxOpacity = {
        variable: `${instance.id}.states-${checked}-${arm}-boxOpacity`,
        fallback: instance.tokens.states[checked][arm].boxOpacity.fallback,
      };
  }
  void opacityVariable;
  const recompiled = compileCheckboxRecipe(instance);
  const difference = firstDifference(recompiled.ir, envelope.ir);
  if (difference)
    throw new RecipeRefusal(CHECKBOX_RECIPE_REF, [
      `unsupported structural edit at ${difference}; checkbox@1 accepts only the declared designer edit surface`,
    ]);
  return instance;
}

export const checkboxRecipe: Recipe<CheckboxRecipeInstance> = {
  ref: CHECKBOX_RECIPE_REF,
  normalize: normalizeCheckboxRecipeInstance,
  compile: compileCheckboxRecipe,
  collapse: collapseCheckboxRecipe,
};

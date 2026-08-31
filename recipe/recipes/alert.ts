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

export const ALERT_RECIPE_REF = {
  id: "alert",
  version: 1,
} as const satisfies RecipeRef;

/**
 * In-page banner/alert. Astryx Banner (status required). MUI Alert
 * (severity default success, variant standard). AntD Alert (type
 * default info). Do not invent a shared default status. AlertDialog
 * and Toast/Snackbar wait.
 */
export const ALERT_STATUS = ["info", "success", "warning", "error"] as const;
export type AlertStatus = (typeof ALERT_STATUS)[number];

export interface AlertNumberParameter {
  variable: string;
  fallback: number;
}
export interface AlertColorParameter {
  variable: string;
  fallback: string;
}
export interface AlertFontSpec {
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
  boxFill: AlertColorParameter;
  boxBorder: AlertColorParameter;
  title: AlertColorParameter;
  iconFill: AlertColorParameter;
  iconOpacity: AlertNumberParameter;
}

export interface AlertRecipeInstance {
  identity: { id: string; name: string };
  semantic: {
    root: "alert";
    control: "alert";
    title: "title";
  };
  axes: {
    status: {
      name: "Status";
      values: AlertStatus[];
      default: AlertStatus;
    };
  };
  content: { title: string };
  tokens: {
    box: {
      height: AlertNumberParameter;
      paddingX: AlertNumberParameter;
      paddingY: AlertNumberParameter;
      radius: AlertNumberParameter;
      borderWidth: AlertNumberParameter;
      gap: AlertNumberParameter;
    };
    icon: { size: AlertNumberParameter };
    titleFontSize: AlertNumberParameter;
    titleLineHeight: AlertNumberParameter;
    strokeAlign: "inside" | "outside";
    states: Record<AlertStatus, StateCell>;
    typography: { title: AlertFontSpec };
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
  title: ColorParameterSchema,
  iconFill: ColorParameterSchema,
  iconOpacity: NumberParameterSchema,
});

export const AlertRecipeInstanceSchema = z.strictObject({
  identity: z.strictObject({ id: z.string().min(1), name: z.string().min(1) }),
  semantic: z.strictObject({
    root: z.literal("alert"),
    control: z.literal("alert"),
    title: z.literal("title"),
  }),
  axes: z.strictObject({
    status: z.strictObject({
      name: z.literal("Status"),
      values: z.array(z.enum(ALERT_STATUS)).min(1),
      default: z.enum(ALERT_STATUS),
    }),
  }),
  content: z.strictObject({ title: z.string().min(1) }),
  tokens: z.strictObject({
    box: z.strictObject({
      height: NumberParameterSchema,
      paddingX: NumberParameterSchema,
      paddingY: NumberParameterSchema,
      radius: NumberParameterSchema,
      borderWidth: NumberParameterSchema,
      gap: NumberParameterSchema,
    }),
    icon: z.strictObject({ size: NumberParameterSchema }),
    titleFontSize: NumberParameterSchema,
    titleLineHeight: NumberParameterSchema,
    strokeAlign: z.enum(["inside", "outside"]),
    states: z.strictObject({
      info: StateCellSchema,
      success: StateCellSchema,
      warning: StateCellSchema,
      error: StateCellSchema,
    }),
    typography: z.strictObject({ title: FontSpecSchema }),
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

export function normalizeAlertRecipeInstance(
  input: unknown,
): AlertRecipeInstance {
  requireExactRecipeSelection(
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as { provenance?: { selection?: unknown } }).provenance
          ?.selection
      : undefined,
    ALERT_RECIPE_REF,
  );
  const instance = AlertRecipeInstanceSchema.parse(input) as AlertRecipeInstance;
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
  parameter: AlertNumberParameter | AlertColorParameter,
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

const titleText = (
  instance: AlertRecipeInstance,
  cell: StateCell,
): TextNode => ({
  kind: "text",
  role: "alert/title",
  label: "alert/title",
  characters: instance.content.title,
  type: {
    fontFamily: instance.tokens.typography.title.resolvedFamily,
    fontStyle: instance.tokens.typography.title.resolvedStyle,
    fontProvenance: instance.tokens.typography.title,
    fontSize: instance.tokens.titleFontSize.fallback,
    lineHeight: {
      unit: "px",
      value: instance.tokens.titleLineHeight.fallback,
    },
  },
  align: "left",
  verticalAlign: "center",
  fills: [solid(cell.title.fallback)],
  width: hug,
  height: hug,
  bindings: [
    bind("type.fontSize", instance.tokens.titleFontSize),
    bind("type.lineHeight.value", instance.tokens.titleLineHeight),
    bind("fills.0.color", cell.title),
  ],
});

const iconNode = (
  instance: AlertRecipeInstance,
  cell: StateCell,
): FrameNode => ({
  kind: "frame",
  role: "alert/icon",
  label: "alert/icon",
  opacity: cell.iconOpacity.fallback,
  layout: {
    mode: "horizontal",
    primaryAxisAlign: "center",
    counterAxisAlign: "center",
    itemSpacing: 0,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    width: fixed(instance.tokens.icon.size.fallback),
    height: fixed(instance.tokens.icon.size.fallback),
  },
  fills: [solid(cell.iconFill.fallback)],
  cornerRadius: corners(instance.tokens.icon.size.fallback / 2),
  bindings: [
    bind("layout.width.value", instance.tokens.icon.size),
    bind("layout.height.value", instance.tokens.icon.size),
    bind("fills.0.color", cell.iconFill),
  ],
  children: [],
});

const variantComponent = (
  instance: AlertRecipeInstance,
  status: AlertStatus,
): ComponentNode => {
  const cell = instance.tokens.states[status];
  const strokes = [
    {
      weight: instance.tokens.box.borderWidth.fallback,
      align: instance.tokens.strokeAlign,
      paint: solid(cell.boxBorder.fallback),
    },
  ];
  return {
    kind: "component",
    role: `alert/variant/${status}`,
    label: `Status=${status}`,
    variantProperties: { Status: status },
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "center",
      itemSpacing: instance.tokens.box.gap.fallback,
      padding: {
        top: instance.tokens.box.paddingY.fallback,
        right: instance.tokens.box.paddingX.fallback,
        bottom: instance.tokens.box.paddingY.fallback,
        left: instance.tokens.box.paddingX.fallback,
      },
      width: hug,
      height: fixed(instance.tokens.box.height.fallback),
    },
    fills: [solid(cell.boxFill.fallback)],
    strokes,
    cornerRadius: corners(instance.tokens.box.radius.fallback),
    bindings: [
      bind("layout.height.value", instance.tokens.box.height),
      bind("layout.itemSpacing", instance.tokens.box.gap),
      bind("layout.padding.top", instance.tokens.box.paddingY),
      bind("layout.padding.right", instance.tokens.box.paddingX),
      bind("layout.padding.bottom", instance.tokens.box.paddingY),
      bind("layout.padding.left", instance.tokens.box.paddingX),
      bind("fills.0.color", cell.boxFill),
      bind("strokes.0.weight", instance.tokens.box.borderWidth),
      bind("strokes.0.paint.color", cell.boxBorder),
      bind("cornerRadius.topLeft", instance.tokens.box.radius),
      bind("cornerRadius.topRight", instance.tokens.box.radius),
      bind("cornerRadius.bottomRight", instance.tokens.box.radius),
      bind("cornerRadius.bottomLeft", instance.tokens.box.radius),
    ],
    children: [iconNode(instance, cell), titleText(instance, cell)],
  };
};

export function compileAlertIr(instance: AlertRecipeInstance): ComponentSetNode {
  return {
    kind: "component-set",
    role: "alert/set",
    label: instance.identity.name,
    variantAxes: [{ name: "Status", values: [...ALERT_STATUS] }],
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
    children: ALERT_STATUS.map((status) => variantComponent(instance, status)),
  };
}

export function compileAlertRecipe(input: unknown): RecipeEnvelope {
  const instance = normalizeAlertRecipeInstance(input);
  const totality = checkTotality(instance.inputFacts, instance);
  if (!isTotal(totality))
    throw new RecipeRefusal(
      ALERT_RECIPE_REF,
      totalityLines(instance.identity.id, totality),
    );
  const unsigned = {
    envelope: ENVELOPE_VERSION,
    id: instance.identity.id,
    name: instance.identity.name,
    archetype: "banner / alert / toast",
    recipe: ALERT_RECIPE_REF,
    ir: compileAlertIr(instance),
    accounting: instance.accounting,
    extensions: [
      ...instance.extensions.filter(
        (extension) => !extension.id.startsWith("alert/status-default/"),
      ),
      {
        id: `alert/status-default/${instance.axes.status.default}`,
        kind: "data",
        stated:
          "Per-library Status default. Not a shared IR default. MUI severity defaults to success; AntD type and the Astryx Banner example default to info.",
        why: "The component-set IR has no default-variant field; inventing one shared default would lie about the three libraries.",
        absorbs: [],
      },
    ],
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
  throw new RecipeRefusal(ALERT_RECIPE_REF, [`missing required set ${role}`]);
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
    throw new RecipeRefusal(ALERT_RECIPE_REF, [
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
    throw new RecipeRefusal(ALERT_RECIPE_REF, [
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
    throw new RecipeRefusal(ALERT_RECIPE_REF, [
      `${node.role ?? "node"}: required binding ${field} must appear exactly once`,
    ]);
  return found[0]!.variable;
};
const numberFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: number,
): AlertNumberParameter => ({ variable: binding(node, field), fallback });
const colorFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: string,
): AlertColorParameter => ({ variable: binding(node, field), fallback });
const solidColor = (paint: unknown, role: string): string => {
  const candidate = paint as { kind?: string; color?: string } | undefined;
  if (candidate?.kind !== "solid" || typeof candidate.color !== "string")
    throw new RecipeRefusal(ALERT_RECIPE_REF, [`${role}: expected a solid fill`]);
  return candidate.color;
};
const fontFrom = (node: TextNode): AlertFontSpec => {
  const provenance = node.type.fontProvenance;
  if (!provenance)
    throw new RecipeRefusal(ALERT_RECIPE_REF, [
      `${node.role ?? "text"}: font provenance is required`,
    ]);
  return provenance as AlertFontSpec;
};

export function validateAlertStructure(root: IRNode): void {
  const set = setByRole(root, "alert/set");
  if (set.children.length !== ALERT_STATUS.length)
    throw new RecipeRefusal(ALERT_RECIPE_REF, [
      "alert/set must carry every Status variant",
    ]);
  for (const status of ALERT_STATUS) {
    const variant = componentFor(set, { Status: status });
    if (variant.layout.mode !== "horizontal")
      throw new RecipeRefusal(ALERT_RECIPE_REF, [
        `${variant.role}: alert root is a horizontal icon + title row`,
      ]);
    if (variant.layout.height.mode !== "fixed")
      throw new RecipeRefusal(ALERT_RECIPE_REF, [
        `${variant.role}: the banner must carry a named height`,
      ]);
    if (variant.layout.width.mode !== "hug")
      throw new RecipeRefusal(ALERT_RECIPE_REF, [
        `${variant.role}: width hugs content — no invented default px width`,
      ]);
    if ((variant.strokes?.length ?? 0) !== 1)
      throw new RecipeRefusal(ALERT_RECIPE_REF, [
        `${variant.role}: every banner carries a named stroke (weight may be 0)`,
      ]);
    const icon = direct(variant, "alert/icon", "frame");
    if (icon.layout.width.mode !== "fixed" || icon.layout.height.mode !== "fixed")
      throw new RecipeRefusal(ALERT_RECIPE_REF, [
        `${variant.role}: icon must carry a named size`,
      ]);
    direct(variant, "alert/title", "text");
  }
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
  const title = direct(variant, "alert/title", "text");
  const icon = direct(variant, "alert/icon", "frame");
  return {
    boxFill: colorFrom(
      variant,
      "fills.0.color",
      solidColor(variant.fills[0], variant.role!),
    ),
    boxBorder: colorFrom(
      variant,
      "strokes.0.paint.color",
      solidColor(variant.strokes?.[0]?.paint, variant.role!),
    ),
    title: colorFrom(
      title,
      "fills.0.color",
      solidColor(title.fills[0], title.role!),
    ),
    iconFill: colorFrom(
      icon,
      "fills.0.color",
      solidColor(icon.fills[0], icon.role!),
    ),
    iconOpacity: {
      variable: `${variant.role}-iconOpacity`,
      fallback: icon.opacity ?? 1,
    },
  };
};

export function collapseAlertRecipe(
  envelopeInput: unknown,
  selection: unknown,
): AlertRecipeInstance {
  requireExactRecipeSelection(selection, ALERT_RECIPE_REF);
  const envelope = RecipeEnvelopeSchema.parse(envelopeInput);
  if (envelope.recipe.id !== ALERT_RECIPE_REF.id)
    throw new RecipeRefusal(ALERT_RECIPE_REF, ["envelope recipe mismatch"]);
  validateAlertStructure(envelope.ir);
  const set = setByRole(envelope.ir, "alert/set");
  const info = componentFor(set, { Status: "info" });
  const title = direct(info, "alert/title", "text");
  const icon = direct(info, "alert/icon", "frame");
  const strokeAlign = info.strokes?.[0]?.align;
  if (strokeAlign !== "inside" && strokeAlign !== "outside")
    throw new RecipeRefusal(ALERT_RECIPE_REF, [
      "alert stroke align must be inside or outside",
    ]);
  const statusDefaultExtension = envelope.extensions.find((extension) =>
    extension.id.startsWith("alert/status-default/"),
  );
  const statusDefault = statusDefaultExtension?.id.slice(
    "alert/status-default/".length,
  );
  if (
    statusDefault !== "info" &&
    statusDefault !== "success" &&
    statusDefault !== "warning" &&
    statusDefault !== "error"
  )
    throw new RecipeRefusal(ALERT_RECIPE_REF, [
      "alert@1 collapse needs the per-library Status default from the alert/status-default extension — do not invent one",
    ]);
  const height =
    info.layout.height.mode === "fixed" ? info.layout.height.value : 0;
  const instance = normalizeAlertRecipeInstance({
    identity: { id: envelope.id, name: envelope.name },
    semantic: { root: "alert", control: "alert", title: "title" },
    axes: {
      status: {
        name: "Status",
        values: [...ALERT_STATUS],
        default: statusDefault,
      },
    },
    content: { title: title.characters },
    tokens: {
      box: {
        height: numberFrom(info, "layout.height.value", height),
        paddingX: numberFrom(info, "layout.padding.left", info.layout.padding.left),
        paddingY: numberFrom(info, "layout.padding.top", info.layout.padding.top),
        radius: numberFrom(
          info,
          "cornerRadius.topLeft",
          info.cornerRadius?.topLeft ?? 0,
        ),
        borderWidth: numberFrom(
          info,
          "strokes.0.weight",
          info.strokes?.[0]?.weight ?? 0,
        ),
        gap: numberFrom(info, "layout.itemSpacing", info.layout.itemSpacing),
      },
      icon: {
        size: numberFrom(
          icon,
          "layout.width.value",
          icon.layout.width.mode === "fixed" ? icon.layout.width.value : 0,
        ),
      },
      titleFontSize: numberFrom(title, "type.fontSize", title.type.fontSize),
      titleLineHeight: numberFrom(
        title,
        "type.lineHeight.value",
        title.type.lineHeight.unit === "px" ? title.type.lineHeight.value : 0,
      ),
      strokeAlign,
      states: {
        info: cellFromVariant(info),
        success: cellFromVariant(componentFor(set, { Status: "success" })),
        warning: cellFromVariant(componentFor(set, { Status: "warning" })),
        error: cellFromVariant(componentFor(set, { Status: "error" })),
      },
      typography: { title: fontFrom(title) },
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
  for (const status of ALERT_STATUS)
    instance.tokens.states[status].iconOpacity = {
      variable: `${instance.identity.id}.states-${status}-iconOpacity`,
      fallback: instance.tokens.states[status].iconOpacity.fallback,
    };
  const recompiled = compileAlertRecipe(instance);
  const difference = firstDifference(recompiled.ir, envelope.ir);
  if (difference)
    throw new RecipeRefusal(ALERT_RECIPE_REF, [
      `unsupported structural edit at ${difference}; alert@1 accepts only the declared designer edit surface`,
    ]);
  return instance;
}

export const alertRecipe: Recipe<AlertRecipeInstance> = {
  ref: ALERT_RECIPE_REF,
  normalize: normalizeAlertRecipeInstance,
  compile: compileAlertRecipe,
  collapse: collapseAlertRecipe,
};

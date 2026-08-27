import * as z from "zod";

import {
  CodeOnlyExtensionSchema,
  ENVELOPE_VERSION,
  FactRefSchema,
  LossReceiptSchema,
  RecipeEnvelopeSchema,
  checkTotality,
  factId,
  isTotal,
  totalityLines,
  type FactRef,
  type RecipeEnvelope,
} from "../envelope.js";
import {
  ColorSchema,
  type ComponentNode,
  type ComponentSetNode,
  type IRNode,
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
} from "../recipe.js";

export const BUTTON_RECIPE_REF = {
  id: "button",
  version: 1,
} as const satisfies RecipeRef;

export const BUTTON_VARIANTS = ["primary", "secondary"] as const;
export const BUTTON_SIZES = ["small", "medium", "large"] as const;
export const BUTTON_STATES = [
  "default",
  "hover",
  "pressed",
  "focus-visible",
  "disabled",
  "loading",
] as const;
export const BUTTON_ICON_PRESENCE = [
  "none",
  "leading",
  "trailing",
  "both",
] as const;

type ButtonVariant = (typeof BUTTON_VARIANTS)[number];
type ButtonSize = (typeof BUTTON_SIZES)[number];
type ButtonState = (typeof BUTTON_STATES)[number];
type ButtonIconPresence = (typeof BUTTON_ICON_PRESENCE)[number];

const LiteralReceiptSchema = z.strictObject({
  evidence: z.string().min(1),
  method: z.string().min(1),
});
const NumberTokenSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("token"),
    variable: z.string().min(1),
    fallback: z.number().finite().nonnegative(),
  }),
  z.strictObject({
    kind: z.literal("literal"),
    value: z.number().finite().nonnegative(),
    receipt: LiteralReceiptSchema,
  }),
]);
const ColorTokenSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("token"),
    variable: z.string().min(1),
    fallback: ColorSchema,
  }),
  z.strictObject({
    kind: z.literal("literal"),
    value: ColorSchema,
    receipt: LiteralReceiptSchema,
  }),
]);
const ShadowSchema = z.strictObject({
  kind: z.enum(["drop-shadow", "inner-shadow"]),
  offsetX: z.number().finite(),
  offsetY: z.number().finite(),
  blur: z.number().finite().nonnegative(),
  spread: z.number().finite(),
  color: ColorTokenSchema,
});
const AppearanceSchema = z.strictObject({
  background: ColorTokenSchema,
  foreground: ColorTokenSchema,
  border: ColorTokenSchema,
  effects: z.array(ShadowSchema),
});
const InteractiveAppearanceSchema = z.strictObject({
  default: AppearanceSchema,
  hover: AppearanceSchema,
  pressed: AppearanceSchema,
  focusVisible: AppearanceSchema,
  disabled: AppearanceSchema,
});
const SizeTokensSchema = z.strictObject({
  height: z.literal("hug"),
  minWidth: NumberTokenSchema.nullable(),
  paddingX: NumberTokenSchema,
  paddingY: NumberTokenSchema,
  gap: NumberTokenSchema,
  fontSize: NumberTokenSchema,
  lineHeight: NumberTokenSchema,
  iconSize: NumberTokenSchema,
  fontStyle: z.string().trim().min(1),
});

export const ButtonRecipeInstanceSchema = z.strictObject({
  identity: z.strictObject({
    id: z.string().min(1),
    name: z.string().min(1),
  }),
  semanticRole: z.literal("button"),
  axes: z.strictObject({
    variant: z.strictObject({
      name: z.literal("Variant"),
      values: z.tuple([z.literal("primary"), z.literal("secondary")]),
      default: z.enum(BUTTON_VARIANTS),
      exposure: z.literal("public"),
    }),
    size: z.strictObject({
      name: z.literal("Size"),
      values: z.tuple([
        z.literal("small"),
        z.literal("medium"),
        z.literal("large"),
      ]),
      default: z.enum(BUTTON_SIZES),
      exposure: z.literal("public"),
    }),
    state: z.strictObject({
      name: z.literal("State"),
      values: z.tuple([
        z.literal("default"),
        z.literal("hover"),
        z.literal("pressed"),
        z.literal("focus-visible"),
        z.literal("disabled"),
        z.literal("loading"),
      ]),
      default: z.literal("default"),
      exposure: z.literal("design-state"),
    }),
    icons: z.strictObject({
      name: z.literal("Icons"),
      values: z.tuple([
        z.literal("none"),
        z.literal("leading"),
        z.literal("trailing"),
        z.literal("both"),
      ]),
      default: z.literal("none"),
      exposure: z.literal("presence"),
    }),
  }),
  label: z.strictObject({
    property: z.literal("Label"),
    default: z.string().trim().min(1),
  }),
  responsiveness: z.strictObject({
    sourceSizing: z.literal("hug"),
    designerResize: z.literal("fixed-width"),
    childRole: z.literal("button/label"),
    response: z.literal("recenter"),
  }),
  slots: z.strictObject({
    leading: z.strictObject({
      property: z.literal("Leading icon"),
      optional: z.literal(true),
      accepts: z.literal("instance"),
      componentRef: z.string().min(1),
    }),
    trailing: z.strictObject({
      property: z.literal("Trailing icon"),
      optional: z.literal(true),
      accepts: z.literal("instance"),
      componentRef: z.string().min(1),
    }),
  }),
  loading: z.strictObject({
    state: z.literal("loading"),
    indicatorComponentRef: z.string().min(1),
    indicatorPlacement: z.literal("leading"),
    labelBehavior: z.literal("preserve"),
    leadingIconBehavior: z.literal("replace"),
    trailingIconBehavior: z.literal("preserve"),
  }),
  tokens: z.strictObject({
    appearance: z.strictObject({
      primary: InteractiveAppearanceSchema,
      secondary: InteractiveAppearanceSchema,
    }),
    sizes: z.strictObject({
      small: SizeTokensSchema,
      medium: SizeTokensSchema,
      large: SizeTokensSchema,
    }),
    radius: NumberTokenSchema,
    borderWidth: NumberTokenSchema,
    typography: z.strictObject({
      fontFamily: z.string().trim().min(1),
    }),
  }),
  inputFacts: z.array(FactRefSchema),
  accounting: z.strictObject({
    carried: z.array(FactRefSchema),
  }),
  extensions: z.array(CodeOnlyExtensionSchema),
  receipts: z.array(LossReceiptSchema),
  provenance: z.strictObject({
    source: z.string().min(1),
    tool: z.literal("button@1"),
    generatedAt: z.string().min(1),
    selection: RecipeSelectionSchema,
  }),
});
export type ButtonRecipeInstance = z.infer<typeof ButtonRecipeInstanceSchema>;
export type ButtonNumberParameter =
  ButtonRecipeInstance["tokens"]["sizes"]["small"]["paddingX"];
export type ButtonColorParameter =
  ButtonRecipeInstance["tokens"]["appearance"]["primary"]["default"]["background"];

export const buttonParameterValue = (
  parameter: ButtonNumberParameter | ButtonColorParameter,
): number | string =>
  parameter.kind === "token" ? parameter.fallback : parameter.value;

export const buttonParameterVariable = (
  parameter: ButtonNumberParameter | ButtonColorParameter,
): string | undefined =>
  parameter.kind === "token" ? parameter.variable : undefined;

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const sortFacts = (facts: readonly FactRef[]): FactRef[] =>
  [...facts].sort((left, right) => compareText(factId(left), factId(right)));

export function normalizeButtonRecipeInstance(
  input: unknown,
): ButtonRecipeInstance {
  const selection =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as { provenance?: { selection?: unknown } }).provenance
          ?.selection
      : undefined;
  requireExactRecipeSelection(selection, BUTTON_RECIPE_REF);
  const parsed = ButtonRecipeInstanceSchema.parse(input);
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
const fixed = (value: number) => ({ mode: "fixed", value }) as const;
const solid = (color: string) => ({ kind: "solid", color }) as const;
const bind = (field: string, variable: string): VariableBinding => ({
  field,
  type: field.endsWith(".color") ? "COLOR" : "FLOAT",
  variable,
});
const bindParameter = (
  field: string,
  parameter: ButtonNumberParameter | ButtonColorParameter,
): VariableBinding[] => {
  const variable = buttonParameterVariable(parameter);
  return variable ? [bind(field, variable)] : [];
};
const numberValue = (parameter: ButtonNumberParameter): number =>
  buttonParameterValue(parameter) as number;
const colorValue = (parameter: ButtonColorParameter): string =>
  buttonParameterValue(parameter) as string;

const axisOrder = <Value extends string>(
  values: readonly Value[],
  defaultValue: Value,
): Value[] => [
  defaultValue,
  ...values.filter((value) => value !== defaultValue),
];

const roleForVariant = (
  variant: ButtonVariant,
  size: ButtonSize,
  state: ButtonState,
  icons: ButtonIconPresence,
): string => `button/variant/${variant}/${size}/${state}/${icons}`;

const componentLabel = (
  instance: ButtonRecipeInstance,
  variant: ButtonVariant,
  size: ButtonSize,
  state: ButtonState,
  icons: ButtonIconPresence,
): string =>
  [
    `${instance.axes.variant.name}=${variant}`,
    `${instance.axes.size.name}=${size}`,
    `${instance.axes.state.name}=${state}`,
    `${instance.axes.icons.name}=${icons}`,
  ].join(", ");

const appearanceFor = (
  instance: ButtonRecipeInstance,
  variant: ButtonVariant,
  state: ButtonState,
) => {
  const interactive = instance.tokens.appearance[variant];
  if (state === "disabled") return interactive.disabled;
  if (state === "loading") return interactive.default;
  if (state === "focus-visible") return interactive.focusVisible;
  return interactive[state];
};

const iconInstance = (
  role: "button/slot/leading" | "button/slot/trailing",
  componentRef: string,
  size: ButtonRecipeInstance["tokens"]["sizes"][ButtonSize],
): IRNode => ({
  kind: "instance",
  role,
  label: role === "button/slot/leading" ? "Leading icon" : "Trailing icon",
  componentRef,
  properties: {},
  width: fixed(numberValue(size.iconSize)),
  height: fixed(numberValue(size.iconSize)),
  bindings: [
    ...bindParameter("width.value", size.iconSize),
    ...bindParameter("height.value", size.iconSize),
  ],
});

const loadingInstance = (
  instance: ButtonRecipeInstance,
  size: ButtonRecipeInstance["tokens"]["sizes"][ButtonSize],
): IRNode => ({
  kind: "instance",
  role: "button/loading-indicator",
  label: "Loading indicator",
  componentRef: instance.loading.indicatorComponentRef,
  properties: {},
  width: fixed(numberValue(size.iconSize)),
  height: fixed(numberValue(size.iconSize)),
  bindings: [
    ...bindParameter("width.value", size.iconSize),
    ...bindParameter("height.value", size.iconSize),
  ],
});

const variantComponent = (
  instance: ButtonRecipeInstance,
  variant: ButtonVariant,
  sizeName: ButtonSize,
  state: ButtonState,
  icons: ButtonIconPresence,
): ComponentNode => {
  const size = instance.tokens.sizes[sizeName];
  const appearance = appearanceFor(instance, variant, state);
  const children: IRNode[] = [];
  const hasLeading = icons === "leading" || icons === "both";
  const hasTrailing = icons === "trailing" || icons === "both";

  if (state === "loading") {
    children.push(loadingInstance(instance, size));
  } else if (hasLeading) {
    children.push(
      iconInstance(
        "button/slot/leading",
        instance.slots.leading.componentRef,
        size,
      ),
    );
  }

  children.push({
    kind: "text",
    role: "button/label",
    label: instance.label.property,
    characters: instance.label.default,
    type: {
      fontFamily: instance.tokens.typography.fontFamily,
      fontStyle: size.fontStyle,
      fontSize: numberValue(size.fontSize),
      lineHeight: { unit: "px", value: numberValue(size.lineHeight) },
    },
    align: "center",
    verticalAlign: "center",
    fills: [solid(colorValue(appearance.foreground))],
    width: hug,
    height: hug,
    bindings: [
      ...bindParameter("type.fontSize", size.fontSize),
      ...bindParameter("type.lineHeight.value", size.lineHeight),
      ...bindParameter("fills.0.color", appearance.foreground),
    ],
  });

  if (hasTrailing) {
    children.push(
      iconInstance(
        "button/slot/trailing",
        instance.slots.trailing.componentRef,
        size,
      ),
    );
  }

  return {
    kind: "component",
    role: roleForVariant(variant, sizeName, state, icons),
    label: componentLabel(instance, variant, sizeName, state, icons),
    variantProperties: {
      [instance.axes.variant.name]: variant,
      [instance.axes.size.name]: sizeName,
      [instance.axes.state.name]: state,
      [instance.axes.icons.name]: icons,
    },
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "center",
      counterAxisAlign: "center",
      itemSpacing: numberValue(size.gap),
      padding: {
        top: numberValue(size.paddingY),
        right: numberValue(size.paddingX),
        bottom: numberValue(size.paddingY),
        left: numberValue(size.paddingX),
      },
      width: hug,
      height: hug,
      ...(size.minWidth === null
        ? {}
        : { minWidth: numberValue(size.minWidth) }),
    },
    fills: [solid(colorValue(appearance.background))],
    strokes: [
      {
        weight: numberValue(instance.tokens.borderWidth),
        align: "inside",
        paint: solid(colorValue(appearance.border)),
      },
    ],
    effects: appearance.effects.map((effect) => ({
      kind: effect.kind,
      offsetX: effect.offsetX,
      offsetY: effect.offsetY,
      blur: effect.blur,
      spread: effect.spread,
      color: colorValue(effect.color),
    })),
    cornerRadius: {
      topLeft: numberValue(instance.tokens.radius),
      topRight: numberValue(instance.tokens.radius),
      bottomRight: numberValue(instance.tokens.radius),
      bottomLeft: numberValue(instance.tokens.radius),
    },
    clipsContent: true,
    bindings: [
      ...bindParameter("layout.itemSpacing", size.gap),
      ...bindParameter("layout.padding.top", size.paddingY),
      ...bindParameter("layout.padding.right", size.paddingX),
      ...bindParameter("layout.padding.bottom", size.paddingY),
      ...bindParameter("layout.padding.left", size.paddingX),
      ...(size.minWidth === null
        ? []
        : bindParameter("layout.minWidth", size.minWidth)),
      ...bindParameter("fills.0.color", appearance.background),
      ...bindParameter("strokes.0.weight", instance.tokens.borderWidth),
      ...bindParameter("strokes.0.paint.color", appearance.border),
      ...bindParameter("cornerRadius.topLeft", instance.tokens.radius),
      ...bindParameter("cornerRadius.topRight", instance.tokens.radius),
      ...bindParameter("cornerRadius.bottomRight", instance.tokens.radius),
      ...bindParameter("cornerRadius.bottomLeft", instance.tokens.radius),
      ...appearance.effects.flatMap((effect, index) =>
        bindParameter(`effects.${index}.color`, effect.color),
      ),
    ],
    children,
  };
};

function compileButtonIr(instance: ButtonRecipeInstance): ComponentSetNode {
  const variants = axisOrder(
    BUTTON_VARIANTS,
    instance.axes.variant.default,
  ).flatMap((variant) =>
    axisOrder(BUTTON_SIZES, instance.axes.size.default).flatMap((size) =>
      BUTTON_STATES.flatMap((state) =>
        BUTTON_ICON_PRESENCE.map((icons) =>
          variantComponent(instance, variant, size, state, icons),
        ),
      ),
    ),
  );

  return {
    kind: "component-set",
    role: "button/set",
    label: instance.identity.name,
    variantAxes: [
      {
        name: instance.axes.variant.name,
        values: [...instance.axes.variant.values],
      },
      {
        name: instance.axes.size.name,
        values: [...instance.axes.size.values],
      },
      {
        name: instance.axes.state.name,
        values: [...instance.axes.state.values],
      },
      {
        name: instance.axes.icons.name,
        values: [...instance.axes.icons.values],
      },
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
    clipsContent: false,
    children: variants,
  };
}

export function compileButtonRecipe(input: unknown): RecipeEnvelope {
  const instance = normalizeButtonRecipeInstance(input);
  const totality = checkTotality(instance.inputFacts, {
    accounting: instance.accounting,
    extensions: instance.extensions,
    receipts: instance.receipts,
  });
  if (!isTotal(totality)) {
    throw new RecipeRefusal(
      BUTTON_RECIPE_REF,
      totalityLines(instance.identity.id, totality),
    );
  }

  const unsigned = {
    envelope: ENVELOPE_VERSION,
    id: instance.identity.id,
    name: instance.identity.name,
    archetype: "button",
    recipe: BUTTON_RECIPE_REF,
    ir: compileButtonIr(instance),
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

const expectedAxes = [
  ["Variant", BUTTON_VARIANTS],
  ["Size", BUTTON_SIZES],
  ["State", BUTTON_STATES],
  ["Icons", BUTTON_ICON_PRESENCE],
] as const;

const bindingFor = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
): string | undefined => {
  const matching = (node.bindings ?? []).filter(
    (binding) => binding.field === field,
  );
  if (matching.length > 1) {
    throw new RecipeRefusal(BUTTON_RECIPE_REF, [
      `${node.role ?? "(unroled node)"}: token binding ${field} must appear at most once`,
    ]);
  }
  return matching[0]?.variable;
};

const recoveredReceipt = {
  evidence: "canonical button@1 IR literal",
  method: "recovered from unbound Figma-representable field",
} as const;

const numberParameterFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  value: number,
): ButtonNumberParameter => {
  const variable = bindingFor(node, field);
  return variable
    ? { kind: "token", variable, fallback: value }
    : { kind: "literal", value, receipt: recoveredReceipt };
};

const colorParameterFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  value: string,
): ButtonColorParameter => {
  const variable = bindingFor(node, field);
  return variable
    ? { kind: "token", variable, fallback: value }
    : { kind: "literal", value, receipt: recoveredReceipt };
};

const nodeByRole = <Kind extends IRNode["kind"]>(
  component: ComponentNode,
  role: string,
  kind: Kind,
): Extract<IRNode, { kind: Kind }> => {
  const matching = component.children.filter((child) => child.role === role);
  if (matching.length !== 1) {
    throw new RecipeRefusal(BUTTON_RECIPE_REF, [
      `${component.role}: required role ${role} must appear exactly once`,
    ]);
  }
  const node = matching[0]!;
  if (node.kind !== kind) {
    throw new RecipeRefusal(BUTTON_RECIPE_REF, [
      `${component.role}: role ${role} must be ${kind}, found ${node.kind}`,
    ]);
  }
  return node as Extract<IRNode, { kind: Kind }>;
};

const walk = (node: IRNode, visit: (candidate: IRNode) => void): void => {
  visit(node);
  if (
    node.kind === "frame" ||
    node.kind === "component" ||
    node.kind === "component-set"
  ) {
    for (const child of node.children) walk(child, visit);
  }
};

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
  ) {
    return path;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return path;
    if (left.length !== right.length) return `${path}.length`;
    for (let index = 0; index < left.length; index += 1) {
      const difference = firstDifference(
        left[index],
        right[index],
        `${path}[${index}]`,
      );
      if (difference) return difference;
    }
    return undefined;
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = [
    ...new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]),
  ].sort(compareText);
  for (const key of keys) {
    if (!(key in leftRecord) || !(key in rightRecord)) return `${path}.${key}`;
    const difference = firstDifference(
      leftRecord[key],
      rightRecord[key],
      `${path}.${key}`,
    );
    if (difference) return difference;
  }
  return undefined;
};

const asFixed = (
  value: { mode: string; value?: number },
  role: string,
  field: string,
): number => {
  if (value.mode !== "fixed" || value.value === undefined) {
    throw new RecipeRefusal(BUTTON_RECIPE_REF, [
      `${role}: ${field} must use fixed Figma sizing`,
    ]);
  }
  return value.value;
};

function validateButtonStructure(root: ComponentSetNode): void {
  if (root.role !== "button/set") {
    throw new RecipeRefusal(BUTTON_RECIPE_REF, [
      `missing required role button/set; found ${root.role ?? "(none)"}`,
    ]);
  }

  const declaredAxes = new Map(
    root.variantAxes.map((axis) => [axis.name, axis.values]),
  );
  for (const [name, values] of expectedAxes) {
    const actual = declaredAxes.get(name);
    if (!actual) {
      throw new RecipeRefusal(BUTTON_RECIPE_REF, [
        `missing required axis ${name}`,
      ]);
    }
    const dead = actual.filter((value) =>
      root.children.every(
        (component) => component.variantProperties[name] !== value,
      ),
    );
    if (dead.length > 0) {
      throw new RecipeRefusal(BUTTON_RECIPE_REF, [
        `dead axis ${name}: ${dead.join(", ")} has no component`,
      ]);
    }
    if (canonicalJson(actual) !== canonicalJson(values)) {
      throw new RecipeRefusal(BUTTON_RECIPE_REF, [
        `axis ${name} has unsupported values; expected ${values.join(", ")}`,
      ]);
    }
  }
  for (const name of declaredAxes.keys()) {
    if (!expectedAxes.some(([expected]) => expected === name)) {
      throw new RecipeRefusal(BUTTON_RECIPE_REF, [
        `unexpected axis ${name}; button@1 does not infer edit surfaces`,
      ]);
    }
  }

  const combinations = new Set<string>();
  for (const component of root.children) {
    const properties = component.variantProperties;
    for (const [name, values] of expectedAxes) {
      if (!(name in properties)) {
        throw new RecipeRefusal(BUTTON_RECIPE_REF, [
          `${component.role ?? "(unroled component)"}: missing axis property ${name}`,
        ]);
      }
      if (!(values as readonly string[]).includes(properties[name]!)) {
        throw new RecipeRefusal(BUTTON_RECIPE_REF, [
          `${component.role ?? "(unroled component)"}: axis ${name} has unsupported value ${properties[name]}`,
        ]);
      }
    }
    for (const name of Object.keys(properties)) {
      if (!declaredAxes.has(name)) {
        throw new RecipeRefusal(BUTTON_RECIPE_REF, [
          `${component.role ?? "(unroled component)"}: unexpected axis property ${name}`,
        ]);
      }
    }
    const key = expectedAxes
      .map(([name]) => `${name}=${properties[name]}`)
      .join("\0");
    if (combinations.has(key)) {
      throw new RecipeRefusal(BUTTON_RECIPE_REF, [
        `duplicate variant combination ${key.replaceAll("\0", ", ")}`,
      ]);
    }
    combinations.add(key);

    const variant = properties.Variant as ButtonVariant;
    const size = properties.Size as ButtonSize;
    const state = properties.State as ButtonState;
    const icons = properties.Icons as ButtonIconPresence;
    const expectedRole = roleForVariant(variant, size, state, icons);
    if (component.role !== expectedRole) {
      throw new RecipeRefusal(BUTTON_RECIPE_REF, [
        `missing required role ${expectedRole}; found ${component.role ?? "(none)"}`,
      ]);
    }

    const expectedChildRoles = [
      ...(state === "loading"
        ? ["button/loading-indicator"]
        : icons === "leading" || icons === "both"
          ? ["button/slot/leading"]
          : []),
      "button/label",
      ...(icons === "trailing" || icons === "both"
        ? ["button/slot/trailing"]
        : []),
    ];
    for (const child of component.children) {
      if (child.role && !expectedChildRoles.includes(child.role)) {
        throw new RecipeRefusal(BUTTON_RECIPE_REF, [
          `${expectedRole}: unexpected role ${child.role}`,
        ]);
      }
    }
    for (const role of expectedChildRoles) {
      const count = component.children.filter(
        (child) => child.role === role,
      ).length;
      if (count !== 1) {
        throw new RecipeRefusal(BUTTON_RECIPE_REF, [
          `${expectedRole}: required role ${role} must appear exactly once`,
        ]);
      }
    }
    const label = nodeByRole(component, "button/label", "text");
    const labelFill = label.fills[0];
    if (
      component.layout.width.mode !== "hug" ||
      component.layout.primaryAxisAlign !== "center"
    ) {
      throw new RecipeRefusal(BUTTON_RECIPE_REF, [
        `${expectedRole}: Button source intent must be HUG with centered responsive content`,
      ]);
    }
    if (
      label.width.mode !== "hug" ||
      label.height.mode !== "hug" ||
      label.align !== "center" ||
      label.verticalAlign !== "center"
    ) {
      throw new RecipeRefusal(BUTTON_RECIPE_REF, [
        `${expectedRole}: responsive label must HUG and remain centered`,
      ]);
    }
    if (
      label.characters.trim().length === 0 ||
      label.type.fontFamily.trim().length === 0 ||
      label.type.fontStyle.trim().length === 0 ||
      label.type.fontSize <= 0 ||
      label.type.lineHeight.unit !== "px" ||
      label.type.lineHeight.value <= 0
    ) {
      throw new RecipeRefusal(BUTTON_RECIPE_REF, [
        `${expectedRole}: label text, font, and dimensions must be visible and positive`,
      ]);
    }
    if (
      labelFill?.kind !== "solid" ||
      Number.parseInt(labelFill.color.slice(7, 9), 16) <= 0
    ) {
      throw new RecipeRefusal(BUTTON_RECIPE_REF, [
        `${expectedRole}: label fill must be a visible solid paint`,
      ]);
    }
  }

  const expectedCount =
    BUTTON_VARIANTS.length *
    BUTTON_SIZES.length *
    BUTTON_STATES.length *
    BUTTON_ICON_PRESENCE.length;
  if (combinations.size !== expectedCount) {
    throw new RecipeRefusal(BUTTON_RECIPE_REF, [
      `button@1 requires the complete ${expectedCount}-variant matrix; found ${combinations.size}`,
    ]);
  }

  const allowedSharedRoles = new Set([
    "button/set",
    "button/label",
    "button/slot/leading",
    "button/slot/trailing",
    "button/loading-indicator",
  ]);
  walk(root, (node) => {
    if (
      (node.kind === "frame" ||
        node.kind === "component" ||
        node.kind === "component-set") &&
      node.layout.mode === "none"
    ) {
      throw new RecipeRefusal(BUTTON_RECIPE_REF, [
        `${node.role ?? node.label ?? node.kind}: fake layout mode none is unsupported; button@1 requires auto-layout`,
      ]);
    }
    if (!node.role) {
      throw new RecipeRefusal(BUTTON_RECIPE_REF, [
        `${node.label ?? node.kind}: missing recipe role`,
      ]);
    }
    if (
      !allowedSharedRoles.has(node.role) &&
      !node.role.startsWith("button/variant/")
    ) {
      throw new RecipeRefusal(BUTTON_RECIPE_REF, [
        `unexpected role ${node.role}; button@1 does not infer structural edits`,
      ]);
    }
  });
}

const componentFor = (
  root: ComponentSetNode,
  variant: ButtonVariant,
  size: ButtonSize,
  state: ButtonState,
  icons: ButtonIconPresence,
): ComponentNode => {
  const role = roleForVariant(variant, size, state, icons);
  const matching = root.children.filter((component) => component.role === role);
  if (matching.length !== 1) {
    throw new RecipeRefusal(BUTTON_RECIPE_REF, [
      `required role ${role} must appear exactly once`,
    ]);
  }
  return matching[0]!;
};

const appearanceFrom = (
  component: ComponentNode,
): ButtonRecipeInstance["tokens"]["appearance"]["primary"]["default"] => {
  const label = nodeByRole(component, "button/label", "text");
  const background = component.fills[0];
  const foreground = label.fills[0];
  const border = component.strokes?.[0]?.paint;
  if (
    background?.kind !== "solid" ||
    foreground?.kind !== "solid" ||
    border?.kind !== "solid"
  ) {
    throw new RecipeRefusal(BUTTON_RECIPE_REF, [
      `${component.role}: background, foreground, and border must be solid token paints`,
    ]);
  }
  return {
    background: colorParameterFrom(
      component,
      "fills.0.color",
      background.color,
    ),
    foreground: colorParameterFrom(label, "fills.0.color", foreground.color),
    border: colorParameterFrom(
      component,
      "strokes.0.paint.color",
      border.color,
    ),
    effects: (component.effects ?? []).map((effect, index) => {
      if (effect.kind !== "drop-shadow" && effect.kind !== "inner-shadow") {
        throw new RecipeRefusal(BUTTON_RECIPE_REF, [
          `${component.role}: Button effects must be drop-shadow or inner-shadow`,
        ]);
      }
      return {
        ...effect,
        color: colorParameterFrom(
          component,
          `effects.${index}.color`,
          effect.color,
        ),
      };
    }),
  };
};

const sizeFrom = (
  component: ComponentNode,
): ButtonRecipeInstance["tokens"]["sizes"]["small"] => {
  const label = nodeByRole(component, "button/label", "text");
  const icon =
    component.children.find(
      (node) =>
        node.role === "button/slot/leading" ||
        node.role === "button/loading-indicator",
    ) ??
    component.children.find((node) => node.role === "button/slot/trailing");
  if (!icon || icon.kind !== "instance") {
    throw new RecipeRefusal(BUTTON_RECIPE_REF, [
      `${component.role}: a slot/loading instance is required to recover icon size tokens`,
    ]);
  }
  if (label.type.lineHeight.unit !== "px") {
    throw new RecipeRefusal(BUTTON_RECIPE_REF, [
      `${component.role}: button line height must use px`,
    ]);
  }
  return {
    height: "hug",
    minWidth:
      component.layout.minWidth === undefined
        ? null
        : numberParameterFrom(
            component,
            "layout.minWidth",
            component.layout.minWidth,
          ),
    paddingX: numberParameterFrom(
      component,
      "layout.padding.left",
      component.layout.padding.left,
    ),
    paddingY: numberParameterFrom(
      component,
      "layout.padding.top",
      component.layout.padding.top,
    ),
    gap: numberParameterFrom(
      component,
      "layout.itemSpacing",
      component.layout.itemSpacing,
    ),
    fontSize: numberParameterFrom(label, "type.fontSize", label.type.fontSize),
    lineHeight: numberParameterFrom(
      label,
      "type.lineHeight.value",
      label.type.lineHeight.value,
    ),
    iconSize: numberParameterFrom(
      icon,
      "width.value",
      asFixed(icon.width, icon.role!, "width"),
    ),
    fontStyle: label.type.fontStyle,
  };
};

export function collapseButtonRecipe(
  envelopeInput: unknown,
  selectionInput: unknown,
): ButtonRecipeInstance {
  requireExactRecipeSelection(selectionInput, BUTTON_RECIPE_REF);
  const envelope = RecipeEnvelopeSchema.parse(envelopeInput);
  if (
    envelope.recipe.id !== BUTTON_RECIPE_REF.id ||
    envelope.recipe.version !== BUTTON_RECIPE_REF.version
  ) {
    throw new RecipeRefusal(BUTTON_RECIPE_REF, [
      `selected envelope is ${envelope.recipe.id}@${envelope.recipe.version}; explicit button@1 selection is required`,
    ]);
  }
  if (envelope.archetype !== "button") {
    throw new RecipeRefusal(BUTTON_RECIPE_REF, [
      `selected envelope archetype is ${envelope.archetype}, expected button`,
    ]);
  }
  if (hashRecipeEnvelope(envelope) !== envelope.integrity.canonicalHash) {
    throw new RecipeRefusal(BUTTON_RECIPE_REF, [
      "integrity.canonicalHash does not match the selected envelope",
    ]);
  }
  if (envelope.ir.kind !== "component-set") {
    throw new RecipeRefusal(BUTTON_RECIPE_REF, [
      `missing required role button/set: root is ${envelope.ir.kind}, expected component-set`,
    ]);
  }

  const root = envelope.ir;
  validateButtonStructure(root);
  const first = root.children[0]!;
  const defaultVariant = first.variantProperties.Variant as ButtonVariant;
  const defaultSize = first.variantProperties.Size as ButtonSize;
  if (!BUTTON_VARIANTS.includes(defaultVariant)) {
    throw new RecipeRefusal(BUTTON_RECIPE_REF, [
      `default Variant ${defaultVariant} is unsupported`,
    ]);
  }
  if (!BUTTON_SIZES.includes(defaultSize)) {
    throw new RecipeRefusal(BUTTON_RECIPE_REF, [
      `default Size ${defaultSize} is unsupported`,
    ]);
  }

  const baseline = componentFor(
    root,
    defaultVariant,
    defaultSize,
    "default",
    "none",
  );
  const label = nodeByRole(baseline, "button/label", "text");
  const leading = nodeByRole(
    componentFor(root, defaultVariant, defaultSize, "default", "leading"),
    "button/slot/leading",
    "instance",
  );
  const trailing = nodeByRole(
    componentFor(root, defaultVariant, defaultSize, "default", "trailing"),
    "button/slot/trailing",
    "instance",
  );
  const loading = nodeByRole(
    componentFor(root, defaultVariant, defaultSize, "loading", "none"),
    "button/loading-indicator",
    "instance",
  );

  const interactiveAppearance = (variant: ButtonVariant) => ({
    default: appearanceFrom(
      componentFor(root, variant, defaultSize, "default", "none"),
    ),
    hover: appearanceFrom(
      componentFor(root, variant, defaultSize, "hover", "none"),
    ),
    pressed: appearanceFrom(
      componentFor(root, variant, defaultSize, "pressed", "none"),
    ),
    focusVisible: appearanceFrom(
      componentFor(root, variant, defaultSize, "focus-visible", "none"),
    ),
    disabled: appearanceFrom(
      componentFor(root, variant, defaultSize, "disabled", "none"),
    ),
  });
  const sizeTokens = (size: ButtonSize) =>
    sizeFrom(componentFor(root, defaultVariant, size, "default", "leading"));

  const instance = normalizeButtonRecipeInstance({
    identity: { id: envelope.id, name: envelope.name },
    semanticRole: "button",
    axes: {
      variant: {
        name: "Variant",
        values: [...BUTTON_VARIANTS],
        default: defaultVariant,
        exposure: "public",
      },
      size: {
        name: "Size",
        values: [...BUTTON_SIZES],
        default: defaultSize,
        exposure: "public",
      },
      state: {
        name: "State",
        values: [...BUTTON_STATES],
        default: "default",
        exposure: "design-state",
      },
      icons: {
        name: "Icons",
        values: [...BUTTON_ICON_PRESENCE],
        default: "none",
        exposure: "presence",
      },
    },
    label: { property: "Label", default: label.characters },
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
        componentRef: leading.componentRef,
      },
      trailing: {
        property: "Trailing icon",
        optional: true,
        accepts: "instance",
        componentRef: trailing.componentRef,
      },
    },
    loading: {
      state: "loading",
      indicatorComponentRef: loading.componentRef,
      indicatorPlacement: "leading",
      labelBehavior: "preserve",
      leadingIconBehavior: "replace",
      trailingIconBehavior: "preserve",
    },
    tokens: {
      appearance: {
        primary: interactiveAppearance("primary"),
        secondary: interactiveAppearance("secondary"),
      },
      sizes: {
        small: sizeTokens("small"),
        medium: sizeTokens("medium"),
        large: sizeTokens("large"),
      },
      radius: numberParameterFrom(
        baseline,
        "cornerRadius.topLeft",
        baseline.cornerRadius?.topLeft ?? 0,
      ),
      borderWidth: numberParameterFrom(
        baseline,
        "strokes.0.weight",
        baseline.strokes?.[0]?.weight ?? 0,
      ),
      typography: {
        fontFamily: label.type.fontFamily,
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

  const recompiled = compileButtonRecipe(instance);
  const difference = firstDifference(recompiled.ir, envelope.ir);
  if (difference) {
    throw new RecipeRefusal(BUTTON_RECIPE_REF, [
      `unsupported structural edit at ${difference}; button@1 accepts only its declared axes, content, slots, loading behavior, and token parameters`,
    ]);
  }
  return instance;
}

export const buttonRecipe: Recipe<ButtonRecipeInstance> = {
  ref: BUTTON_RECIPE_REF,
  normalize: normalizeButtonRecipeInstance,
  compile: compileButtonRecipe,
  collapse: collapseButtonRecipe,
};

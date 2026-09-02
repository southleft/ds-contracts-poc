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
import {
  cssBoxShadowFromEffects,
  parseCssBoxShadow,
} from "../css-box-shadow.js";
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

export const SWITCH_RECIPE_REF = {
  id: "switch",
  version: 1,
} as const satisfies RecipeRef;

/**
 * All three Phase 1 libraries ship a standalone Switch. Axes they
 * share: checked plus disabled. Size is NOT an axis — Astryx is a
 * fixed 40×24, MUI has small|medium (default medium), AntD has a
 * default plus SM. Thumb on/off size change is named geometry, not
 * a picker.
 */
export const SWITCH_CHECKED = ["false", "true"] as const;
export const SWITCH_DISABLED = ["false", "true"] as const;

export type SwitchChecked = (typeof SWITCH_CHECKED)[number];
export type SwitchDisabled = (typeof SWITCH_DISABLED)[number];

export interface SwitchNumberParameter {
  variable: string;
  fallback: number;
}
export interface SwitchColorParameter {
  variable: string;
  fallback: string;
}
export interface SwitchFontSpec {
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
  trackFill: SwitchColorParameter;
  thumbFill: SwitchColorParameter;
  trackOpacity: SwitchNumberParameter;
  label: SwitchColorParameter;
}

export interface SwitchRecipeInstance {
  identity: { id: string; name: string };
  semantic: {
    root: "switch";
    control: "switch";
    label: "label";
  };
  axes: {
    checked: {
      name: "Checked";
      values: SwitchChecked[];
      default: SwitchChecked;
    };
    disabled: {
      name: "Disabled";
      values: SwitchDisabled[];
      default: SwitchDisabled;
    };
  };
  content: {
    /**
     * Shared fixture label. Astryx Switch.tsx example is
     * "Enable notifications". MUI FormControlLabel is a reviewed
     * pairing. AntD children are optional inner text (receipted).
     */
    label: string | null;
  };
  tokens: {
    wrapper: {
      width: SwitchNumberParameter;
      height: SwitchNumberParameter;
      padding: SwitchNumberParameter;
    };
    track: {
      width: SwitchNumberParameter;
      height: SwitchNumberParameter;
      radius: SwitchNumberParameter;
      padding: SwitchNumberParameter;
    };
    thumb: {
      offSize: SwitchNumberParameter;
      onSize: SwitchNumberParameter;
      travel: SwitchNumberParameter;
    };
    row: { gap: SwitchNumberParameter };
    rowAlign: "center" | "baseline";
    /**
     * The thumb's CSS `box-shadow`, verbatim from the library, or "none".
     *
     * Carried as the library's own declaration so the reader can check it
     * against the capture's computed channel; lowered to Figma effects at
     * compile by recipe/css-box-shadow.ts. This was a named refusal
     * (`refusal-thumb-shadow`) until recipe/evidence/fidelity-v1 measured what
     * the refusal cost: MUI's thumb is WHITE, and with no elevation on a white
     * ground the control renders as a grey blob (35.04% AA against the real
     * render). A named loss is honest; it is not automatically acceptable.
     */
    thumbShadow: string;
    /**
     * MUI SwitchRoot sets overflow:hidden on the 58×38 hit box.
     * Astryx and AntD do not clip the control wrapper.
     */
    hitClips: boolean;
    /**
     * Thumb may overhang the track (MUI 20×20 on a 14-tall track).
     * Nested-thumb IR keeps the track unclipped so that overhang paints.
     */
    trackClips: boolean;
    states: Record<SwitchChecked, Record<"enabled" | "disabled", StateCell>>;
    labelFontSize: SwitchNumberParameter;
    typography: { label: SwitchFontSpec };
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
  trackFill: ColorParameterSchema,
  thumbFill: ColorParameterSchema,
  trackOpacity: NumberParameterSchema,
  label: ColorParameterSchema,
});

export const SwitchRecipeInstanceSchema = z.strictObject({
  identity: z.strictObject({ id: z.string().min(1), name: z.string().min(1) }),
  semantic: z.strictObject({
    root: z.literal("switch"),
    control: z.literal("switch"),
    label: z.literal("label"),
  }),
  axes: z.strictObject({
    checked: z.strictObject({
      name: z.literal("Checked"),
      values: z.array(z.enum(SWITCH_CHECKED)).min(1),
      default: z.enum(SWITCH_CHECKED),
    }),
    disabled: z.strictObject({
      name: z.literal("Disabled"),
      values: z.array(z.enum(SWITCH_DISABLED)).min(1),
      default: z.enum(SWITCH_DISABLED),
    }),
  }),
  content: z.strictObject({
    label: z.string().min(1).nullable(),
  }),
  tokens: z.strictObject({
    wrapper: z.strictObject({
      width: NumberParameterSchema,
      height: NumberParameterSchema,
      padding: NumberParameterSchema,
    }),
    track: z.strictObject({
      width: NumberParameterSchema,
      height: NumberParameterSchema,
      radius: NumberParameterSchema,
      padding: NumberParameterSchema,
    }),
    thumb: z.strictObject({
      offSize: NumberParameterSchema,
      onSize: NumberParameterSchema,
      travel: NumberParameterSchema,
    }),
    row: z.strictObject({ gap: NumberParameterSchema }),
    rowAlign: z.enum(["center", "baseline"]),
    thumbShadow: z.string().min(1),
    hitClips: z.boolean(),
    trackClips: z.boolean(),
    states: z.strictObject({
      false: z.strictObject({
        enabled: StateCellSchema,
        disabled: StateCellSchema,
      }),
      true: z.strictObject({
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

export function normalizeSwitchRecipeInstance(
  input: unknown,
): SwitchRecipeInstance {
  requireExactRecipeSelection(
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as { provenance?: { selection?: unknown } }).provenance
          ?.selection
      : undefined,
    SWITCH_RECIPE_REF,
  );
  const instance = SwitchRecipeInstanceSchema.parse(input) as SwitchRecipeInstance;
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
  parameter: SwitchNumberParameter | SwitchColorParameter,
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
  instance: SwitchRecipeInstance,
  checked: SwitchChecked,
  disabled: SwitchDisabled,
): StateCell =>
  instance.tokens.states[checked][disabled === "true" ? "disabled" : "enabled"];

const thumbSizeOf = (
  instance: SwitchRecipeInstance,
  checked: SwitchChecked,
): number =>
  checked === "true"
    ? instance.tokens.thumb.onSize.fallback
    : instance.tokens.thumb.offSize.fallback;

const thumbSizeParam = (
  instance: SwitchRecipeInstance,
  checked: SwitchChecked,
): SwitchNumberParameter =>
  checked === "true"
    ? instance.tokens.thumb.onSize
    : instance.tokens.thumb.offSize;

const labelText = (
  instance: SwitchRecipeInstance,
  cell: StateCell,
): TextNode => ({
  kind: "text",
  role: "switch/label",
  label: "switch/label",
  characters: instance.content.label ?? "",
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

const thumbNode = (
  instance: SwitchRecipeInstance,
  checked: SwitchChecked,
  cell: StateCell,
): FrameNode => {
  const size = thumbSizeOf(instance, checked);
  const sizeParam = thumbSizeParam(instance, checked);
  const radius = size / 2;
  return {
    kind: "frame",
    role: "switch/thumb",
    label: "switch/thumb",
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "center",
      counterAxisAlign: "center",
      itemSpacing: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: fixed(size),
      height: fixed(size),
    },
    fills: [solid(cell.thumbFill.fallback)],
    // Lower the library's own box-shadow declaration into Figma effects.
    // MUI's thumb is white; without its elevation it disappears on a white
    // ground. "none" yields no effects, so libraries that paint none are
    // unaffected.
    effects: parseCssBoxShadow(instance.tokens.thumbShadow),
    cornerRadius: corners(radius),
    bindings: [
      bind("layout.width.value", sizeParam),
      bind("layout.height.value", sizeParam),
      bind("fills.0.color", cell.thumbFill),
    ],
    children: [],
  };
};

const trackNode = (
  instance: SwitchRecipeInstance,
  checked: SwitchChecked,
  cell: StateCell,
): FrameNode => {
  const inset = instance.tokens.track.padding.fallback;
  const travel =
    checked === "true" ? instance.tokens.thumb.travel.fallback : 0;
  const thumb = thumbSizeOf(instance, checked);
  const vertical = Math.max(
    0,
    (instance.tokens.track.height.fallback - thumb) / 2,
  );
  return {
    kind: "frame",
    role: "switch/track",
    label: "switch/track",
    opacity: cell.trackOpacity.fallback,
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "center",
      itemSpacing: 0,
      padding: {
        top: vertical,
        right: inset,
        bottom: vertical,
        left: inset + travel,
      },
      width: fixed(instance.tokens.track.width.fallback),
      height: fixed(instance.tokens.track.height.fallback),
    },
    fills: [solid(cell.trackFill.fallback)],
    clipsContent: instance.tokens.trackClips,
    cornerRadius: corners(instance.tokens.track.radius.fallback),
    bindings: [
      bind("layout.width.value", instance.tokens.track.width),
      bind("layout.height.value", instance.tokens.track.height),
      ...(checked === "false"
        ? [bind("layout.padding.left", instance.tokens.track.padding)]
        : []),
      bind("fills.0.color", cell.trackFill),
      bind("cornerRadius.topLeft", instance.tokens.track.radius),
      bind("cornerRadius.topRight", instance.tokens.track.radius),
      bind("cornerRadius.bottomRight", instance.tokens.track.radius),
      bind("cornerRadius.bottomLeft", instance.tokens.track.radius),
    ],
    children: [thumbNode(instance, checked, cell)],
  };
};

const hitNode = (
  instance: SwitchRecipeInstance,
  checked: SwitchChecked,
  cell: StateCell,
): FrameNode => {
  const pad = instance.tokens.wrapper.padding.fallback;
  return {
    kind: "frame",
    role: "switch/hit",
    label: "switch/hit",
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "center",
      counterAxisAlign: "center",
      itemSpacing: 0,
      padding: { top: pad, right: pad, bottom: pad, left: pad },
      width: fixed(instance.tokens.wrapper.width.fallback),
      height: fixed(instance.tokens.wrapper.height.fallback),
    },
    fills: [],
    clipsContent: instance.tokens.hitClips,
    bindings: [
      bind("layout.width.value", instance.tokens.wrapper.width),
      bind("layout.height.value", instance.tokens.wrapper.height),
      bind("layout.padding.top", instance.tokens.wrapper.padding),
      bind("layout.padding.right", instance.tokens.wrapper.padding),
      bind("layout.padding.bottom", instance.tokens.wrapper.padding),
      bind("layout.padding.left", instance.tokens.wrapper.padding),
    ],
    children: [trackNode(instance, checked, cell)],
  };
};

const variantComponent = (
  instance: SwitchRecipeInstance,
  checked: SwitchChecked,
  disabled: SwitchDisabled,
): ComponentNode => {
  const cell = cellOf(instance, checked, disabled);
  return {
    kind: "component",
    role: `switch/variant/${checked}/${disabled}`,
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
    // The bare cell (content.label null) compiles no label node at all.
    children:
      instance.content.label === null
        ? [hitNode(instance, checked, cell)]
        : [hitNode(instance, checked, cell), labelText(instance, cell)],
  };
};

export function compileSwitchIr(instance: SwitchRecipeInstance): ComponentSetNode {
  const children = SWITCH_CHECKED.flatMap((checked) =>
    SWITCH_DISABLED.map((disabled) =>
      variantComponent(instance, checked, disabled),
    ),
  );
  return {
    kind: "component-set",
    role: "switch/set",
    label: instance.identity.name,
    variantAxes: [
      { name: "Checked", values: [...SWITCH_CHECKED] },
      { name: "Disabled", values: [...SWITCH_DISABLED] },
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

export function compileSwitchRecipe(input: unknown): RecipeEnvelope {
  const instance = normalizeSwitchRecipeInstance(input);
  const totality = checkTotality(instance.inputFacts, instance);
  if (!isTotal(totality))
    throw new RecipeRefusal(
      SWITCH_RECIPE_REF,
      totalityLines(instance.identity.id, totality),
    );
  const unsigned = {
    envelope: ENVELOPE_VERSION,
    id: instance.identity.id,
    name: instance.identity.name,
    archetype: "toggle / switch",
    recipe: SWITCH_RECIPE_REF,
    ir: compileSwitchIr(instance),
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
  throw new RecipeRefusal(SWITCH_RECIPE_REF, [`missing required set ${role}`]);
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
    throw new RecipeRefusal(SWITCH_RECIPE_REF, [
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
    throw new RecipeRefusal(SWITCH_RECIPE_REF, [
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
    throw new RecipeRefusal(SWITCH_RECIPE_REF, [
      `${node.role ?? "node"}: required binding ${field} must appear exactly once`,
    ]);
  return found[0]!.variable;
};
const numberFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: number,
): SwitchNumberParameter => ({ variable: binding(node, field), fallback });
const colorFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: string,
): SwitchColorParameter => ({ variable: binding(node, field), fallback });
const solidColor = (paint: unknown, role: string): string => {
  const candidate = paint as { kind?: string; color?: string } | undefined;
  if (candidate?.kind !== "solid" || typeof candidate.color !== "string")
    throw new RecipeRefusal(SWITCH_RECIPE_REF, [
      `${role}: expected a solid fill`,
    ]);
  return candidate.color;
};
const fontFrom = (node: TextNode): SwitchFontSpec => {
  const provenance = node.type.fontProvenance;
  if (!provenance)
    throw new RecipeRefusal(SWITCH_RECIPE_REF, [
      `${node.role ?? "text"}: font provenance is required`,
    ]);
  return provenance as SwitchFontSpec;
};

export function validateSwitchStructure(root: IRNode): void {
  const set = setByRole(root, "switch/set");
  if (set.children.length !== SWITCH_CHECKED.length * SWITCH_DISABLED.length)
    throw new RecipeRefusal(SWITCH_RECIPE_REF, [
      "switch/set must carry every Checked × Disabled variant",
    ]);
  const aligns = new Set<string>();
  const labelled = new Set<boolean>();
  const hitClips = new Set<string>();
  const trackClips = new Set<string>();
  for (const checked of SWITCH_CHECKED) {
    for (const disabled of SWITCH_DISABLED) {
      const variant = componentFor(set, {
        Checked: checked,
        Disabled: disabled,
      });
      if (variant.layout.mode !== "horizontal")
        throw new RecipeRefusal(SWITCH_RECIPE_REF, [
          `${variant.role}: switch root is a horizontal label row`,
        ]);
      aligns.add(variant.layout.counterAxisAlign);
      const hit = direct(variant, "switch/hit", "frame");
      hitClips.add(String(hit.clipsContent === true));
      if (hit.layout.width.mode !== "fixed" || hit.layout.height.mode !== "fixed")
        throw new RecipeRefusal(SWITCH_RECIPE_REF, [
          `${variant.role}: hit target must be a measured box`,
        ]);
      const track = direct(hit, "switch/track", "frame");
      trackClips.add(String(track.clipsContent === true));
      if (
        track.layout.width.mode !== "fixed" ||
        track.layout.height.mode !== "fixed"
      )
        throw new RecipeRefusal(SWITCH_RECIPE_REF, [
          `${variant.role}: the track must carry a named size`,
        ]);
      const thumb = direct(track, "switch/thumb", "frame");
      if (
        thumb.layout.width.mode !== "fixed" ||
        thumb.layout.height.mode !== "fixed"
      )
        throw new RecipeRefusal(SWITCH_RECIPE_REF, [
          `${variant.role}: the thumb must carry a named size`,
        ]);
      labelled.add(hasLabel(variant));
    }
  }
  if (labelled.size !== 1)
    throw new RecipeRefusal(SWITCH_RECIPE_REF, [
      "every variant carries a label, or none does (the bare cell) — not a mix",
    ]);
  if (aligns.size !== 1)
    throw new RecipeRefusal(SWITCH_RECIPE_REF, [
      "rowAlign must be one value for the whole instance — not per-variant cosmetics",
    ]);
  if (hitClips.size !== 1 || trackClips.size !== 1)
    throw new RecipeRefusal(SWITCH_RECIPE_REF, [
      "hitClips and trackClips are instance geometry, not per-variant cosmetics",
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

export const BARE_LABEL_FONT_SIZE = 0;
export const BARE_LABEL_COLOR = "#00000000";
export const bareLabelFont = (): SwitchFontSpec => ({
  requestedFamily: "Arial",
  requestedStyle: "Regular",
  requestSource: "bare cell — no label is compiled; this spec is inert",
  fallbackChain: [{ family: "Arial", style: "Regular" }],
  resolvedFamily: "Arial",
  resolvedStyle: "Regular",
  resolution: "requested",
});
const hasLabel = (variant: ComponentNode): boolean =>
  (variant.children ?? []).some((c) => c.role === "switch/label" && c.kind === "text");

const cellFromVariant = (variant: ComponentNode): StateCell => {
  const label = hasLabel(variant) ? direct(variant, "switch/label", "text") : null;
  const hit = direct(variant, "switch/hit", "frame");
  const track = direct(hit, "switch/track", "frame");
  const thumb = direct(track, "switch/thumb", "frame");
  return {
    trackFill: colorFrom(
      track,
      "fills.0.color",
      solidColor(track.fills[0], track.role!),
    ),
    thumbFill: colorFrom(
      thumb,
      "fills.0.color",
      solidColor(thumb.fills[0], thumb.role!),
    ),
    trackOpacity: {
      variable: "switch.trackOpacity",
      fallback: track.opacity ?? 1,
    },
    label: label
      ? colorFrom(label, "fills.0.color", solidColor(label.fills[0], label.role!))
      : { variable: `${variant.role}-label`, fallback: BARE_LABEL_COLOR },
  };
};

export function collapseSwitchRecipe(
  envelopeInput: unknown,
  selection: unknown,
): SwitchRecipeInstance {
  requireExactRecipeSelection(selection, SWITCH_RECIPE_REF);
  const envelope = RecipeEnvelopeSchema.parse(envelopeInput);
  if (envelope.recipe.id !== SWITCH_RECIPE_REF.id)
    throw new RecipeRefusal(SWITCH_RECIPE_REF, ["envelope recipe mismatch"]);
  validateSwitchStructure(envelope.ir);
  const set = setByRole(envelope.ir, "switch/set");
  const off = componentFor(set, { Checked: "false", Disabled: "false" });
  const on = componentFor(set, { Checked: "true", Disabled: "false" });
  const hit = direct(off, "switch/hit", "frame");
  const track = direct(hit, "switch/track", "frame");
  const thumbOff = direct(track, "switch/thumb", "frame");
  const trackOn = direct(direct(on, "switch/hit", "frame"), "switch/track", "frame");
  const thumbOn = direct(trackOn, "switch/thumb", "frame");
  const label = hasLabel(off) ? direct(off, "switch/label", "text") : null;
  const offPad = track.layout.padding.left;
  const onPad = trackOn.layout.padding.left;
  const instance = normalizeSwitchRecipeInstance({
    identity: { id: envelope.id, name: envelope.name },
    semantic: { root: "switch", control: "switch", label: "label" },
    axes: {
      checked: {
        name: "Checked",
        values: [...SWITCH_CHECKED],
        default: "false",
      },
      disabled: {
        name: "Disabled",
        values: [...SWITCH_DISABLED],
        default: "false",
      },
    },
    content: { label: label ? label.characters : null },
    tokens: {
      wrapper: {
        width: numberFrom(
          hit,
          "layout.width.value",
          hit.layout.width.mode === "fixed" ? hit.layout.width.value : 0,
        ),
        height: numberFrom(
          hit,
          "layout.height.value",
          hit.layout.height.mode === "fixed" ? hit.layout.height.value : 0,
        ),
        padding: numberFrom(hit, "layout.padding.top", hit.layout.padding.top),
      },
      track: {
        width: numberFrom(
          track,
          "layout.width.value",
          track.layout.width.mode === "fixed" ? track.layout.width.value : 0,
        ),
        height: numberFrom(
          track,
          "layout.height.value",
          track.layout.height.mode === "fixed" ? track.layout.height.value : 0,
        ),
        radius: numberFrom(
          track,
          "cornerRadius.topLeft",
          track.cornerRadius?.topLeft ?? 0,
        ),
        padding: numberFrom(track, "layout.padding.left", offPad),
      },
      thumb: {
        offSize: numberFrom(
          thumbOff,
          "layout.width.value",
          thumbOff.layout.width.mode === "fixed" ? thumbOff.layout.width.value : 0,
        ),
        onSize: numberFrom(
          thumbOn,
          "layout.width.value",
          thumbOn.layout.width.mode === "fixed" ? thumbOn.layout.width.value : 0,
        ),
        travel: {
          variable: `${envelope.id}.thumb-travel`,
          fallback: Math.max(0, onPad - offPad),
        },
      },
      row: {
        gap: numberFrom(off, "layout.itemSpacing", off.layout.itemSpacing),
      },
      rowAlign: off.layout.counterAxisAlign === "baseline" ? "baseline" : "center",
      // Recover the thumb's shadow from the minted effects, back into the CSS
      // spelling the fixture carries. Round-tripping the library's own
      // declaration is what keeps compile a fixed point; recovering a Figma-only
      // shape here would make the instance uninvertible.
      thumbShadow: cssBoxShadowFromEffects(
        (thumbOff.effects ?? []) as Parameters<typeof cssBoxShadowFromEffects>[0],
      ),
      hitClips: hit.clipsContent === true,
      trackClips: track.clipsContent === true,
      states: {
        false: {
          enabled: cellFromVariant(off),
          disabled: cellFromVariant(
            componentFor(set, { Checked: "false", Disabled: "true" }),
          ),
        },
        true: {
          enabled: cellFromVariant(on),
          disabled: cellFromVariant(
            componentFor(set, { Checked: "true", Disabled: "true" }),
          ),
        },
      },
      labelFontSize: label
        ? numberFrom(label, "type.fontSize", label.type.fontSize)
        : { variable: `${envelope.id}.labelFontSize`, fallback: BARE_LABEL_FONT_SIZE },
      typography: { label: label ? fontFrom(label) : bareLabelFont() },
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
  for (const checked of SWITCH_CHECKED) {
    for (const arm of ["enabled", "disabled"] as const)
      instance.tokens.states[checked][arm].trackOpacity = {
        variable: `${instance.identity.id}.states-${checked}-${arm}-trackOpacity`,
        fallback: instance.tokens.states[checked][arm].trackOpacity.fallback,
      };
  }
  const recompiled = compileSwitchRecipe(instance);
  const difference = firstDifference(recompiled.ir, envelope.ir);
  if (difference)
    throw new RecipeRefusal(SWITCH_RECIPE_REF, [
      `unsupported structural edit at ${difference}; switch@1 accepts only the declared designer edit surface`,
    ]);
  return instance;
}

export const switchRecipe: Recipe<SwitchRecipeInstance> = {
  ref: SWITCH_RECIPE_REF,
  normalize: normalizeSwitchRecipeInstance,
  compile: compileSwitchRecipe,
  collapse: collapseSwitchRecipe,
};

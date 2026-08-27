/**
 * THE PRIMITIVE FIGMA IR — the closed vocabulary of what the canvas can draw.
 *
 * EXPERIMENTAL. Phase 0 of the pivot in docs/32-recipe-ir-pivot.md. Nothing
 * here is wired into the legacy engine, exported from a published package, or
 * consulted by any existing gate. It is types and schema only.
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE: every field below corresponds to a
 * named Figma Plugin API assignment. A CSS property name may not appear in the
 * IR at all — not as a key, not as a value, not in an escape hatch. There is
 * deliberately no free-form property bag: if a construct has no primitive
 * here, it is not drawable, and the envelope's `receipts` (envelope.ts) is
 * where it gets named instead of silently dropped.
 *
 * That closure is the whole premise, and it is also the pivot's first hard
 * stop (docs/32 §11.1): the moment one archetype forces a passthrough, the
 * premise is dead and the finding is worth more than the workaround.
 *
 * WHY THE VOCABULARY IS THIS SMALL. Seven node kinds and four paint kinds are
 * not a simplification of Figma — they are the primitives the recipe path
 * currently needs, gathered into one place where they can be counted. The
 * engine's per-property classification (spec/channel-table.json) says which
 * CSS channels are CARRIED; this file says what they are carried AS.
 */
import * as z from "zod";

// ---------------------------------------------------------------------------
// Scalars — canonical spellings, so two trees that draw alike compare alike
// ---------------------------------------------------------------------------

/**
 * A length in device-independent pixels. Figma's geometry is px and nothing
 * else: rem, em, %, ch, vw and `calc()` have no primitive and are resolved
 * before the IR or receipted. `finite` refuses NaN/Infinity, which is how a
 * failed unit conversion arrives.
 */
export const SignedDimensionSchema = z.number().finite();
export const DimensionSchema = SignedDimensionSchema.nonnegative();
export type Dimension = z.infer<typeof DimensionSchema>;

/**
 * `#rrggbbaa`, lowercase, always eight digits. One spelling on purpose:
 * `#FFF`, `#ffffff` and `rgb(255 255 255)` are the same paint, and a canonical
 * hash (docs/32 §4) that treats them as three is worthless.
 */
export const ColorSchema = z
  .string()
  .regex(/^#[0-9a-f]{8}$/, "color must be canonical lowercase #rrggbbaa");
export type Color = z.infer<typeof ColorSchema>;

/** A normalized position along a gradient. */
export const UnitIntervalSchema = z.number().min(0).max(1);

// ---------------------------------------------------------------------------
// Paint
// ---------------------------------------------------------------------------

export const GradientStopSchema = z.strictObject({
  position: UnitIntervalSchema,
  color: ColorSchema,
});
export type GradientStop = z.infer<typeof GradientStopSchema>;

export const SolidPaintSchema = z.strictObject({
  kind: z.literal("solid"),
  color: ColorSchema,
});

export const LinearGradientPaintSchema = z.strictObject({
  kind: z.literal("linear-gradient"),
  /** Degrees clockwise from the positive x-axis. */
  angle: z.number().finite(),
  stops: z.array(GradientStopSchema).min(2),
});

export const RadialGradientPaintSchema = z.strictObject({
  kind: z.literal("radial-gradient"),
  stops: z.array(GradientStopSchema).min(2),
});

export const ImagePaintSchema = z.strictObject({
  kind: z.literal("image"),
  /** An asset the interpreter must already hold; never a URL to fetch. */
  assetRef: z.string().min(1),
  scaleMode: z.enum(["fill", "fit", "tile", "stretch"]),
});

export const PaintSchema = z.discriminatedUnion("kind", [
  SolidPaintSchema,
  LinearGradientPaintSchema,
  RadialGradientPaintSchema,
  ImagePaintSchema,
]);
export type Paint = z.infer<typeof PaintSchema>;

// ---------------------------------------------------------------------------
// Stroke and effect
// ---------------------------------------------------------------------------

export const StrokeSchema = z.strictObject({
  weight: DimensionSchema,
  /** Figma's three; CSS has no equivalent choice and always means `inside`. */
  align: z.enum(["inside", "outside", "center"]),
  paint: PaintSchema,
  /** Omitted is solid. A dash pattern in px, as Figma takes it. */
  dashPattern: z.array(DimensionSchema).optional(),
});
export type Stroke = z.infer<typeof StrokeSchema>;

export const ShadowEffectSchema = z.strictObject({
  kind: z.enum(["drop-shadow", "inner-shadow"]),
  offsetX: SignedDimensionSchema,
  offsetY: SignedDimensionSchema,
  blur: DimensionSchema,
  spread: SignedDimensionSchema,
  color: ColorSchema,
});

export const BlurEffectSchema = z.strictObject({
  kind: z.enum(["layer-blur", "background-blur"]),
  blur: DimensionSchema,
});

export const EffectSchema = z.discriminatedUnion("kind", [
  ShadowEffectSchema,
  BlurEffectSchema,
]);
export type Effect = z.infer<typeof EffectSchema>;

// ---------------------------------------------------------------------------
// Geometry and layout
// ---------------------------------------------------------------------------

/**
 * Figma's three sizing behaviours, named as Figma names them. `hug` with no
 * content is the 30px sliver this repo keeps rejecting; the recipe is what
 * refuses it, not the IR.
 */
export const SizingSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("fixed"), value: DimensionSchema }),
  z.strictObject({ mode: z.literal("hug") }),
  z.strictObject({ mode: z.literal("fill") }),
]);
export type Sizing = z.infer<typeof SizingSchema>;

export const PaddingSchema = z.strictObject({
  top: DimensionSchema,
  right: DimensionSchema,
  bottom: DimensionSchema,
  left: DimensionSchema,
});
export type Padding = z.infer<typeof PaddingSchema>;

/** Per-corner, because Figma is per-corner and the shorthand loses cases. */
export const CornerRadiusSchema = z.strictObject({
  topLeft: DimensionSchema,
  topRight: DimensionSchema,
  bottomRight: DimensionSchema,
  bottomLeft: DimensionSchema,
});
export type CornerRadius = z.infer<typeof CornerRadiusSchema>;

export const FrameLayoutSchema = z
  .strictObject({
    /** `none` is an absolutely-positioned frame: legal, and a recipe smell. */
    mode: z.enum(["horizontal", "vertical", "none"]),
    primaryAxisAlign: z.enum(["min", "center", "max", "space-between"]),
    counterAxisAlign: z.enum(["min", "center", "max", "baseline"]),
    itemSpacing: DimensionSchema,
    padding: PaddingSchema,
    width: SizingSchema,
    height: SizingSchema,
    /** Figma minimum constraints; omitted means no minimum. */
    minWidth: DimensionSchema.nonnegative().optional(),
    minHeight: DimensionSchema.nonnegative().optional(),
    /**
     * An explicitly declared overlay remains part of an auto-layout parent but
     * is taken out of flow through Figma's layoutPositioning API. Recipes must
     * provide offsets and constraints; writers may never infer this from names.
     */
    positioning: z.enum(["auto", "absolute"]).optional(),
    offset: z
      .strictObject({ x: SignedDimensionSchema, y: SignedDimensionSchema })
      .optional(),
    constraints: z
      .strictObject({
        horizontal: z.enum(["left", "right", "center", "scale", "stretch"]),
        vertical: z.enum(["top", "bottom", "center", "scale", "stretch"]),
      })
      .optional(),
  })
  .superRefine((layout, context) => {
    const absolute = layout.positioning === "absolute";
    if (
      absolute !==
      (layout.offset !== undefined && layout.constraints !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "absolute positioning requires explicit offset and constraints; in-flow layout must omit both",
      });
    }
  });
export type FrameLayout = z.infer<typeof FrameLayoutSchema>;

// ---------------------------------------------------------------------------
// Type facts
// ---------------------------------------------------------------------------

export const TypeFactsSchema = z.strictObject({
  fontFamily: z.string().min(1),
  fontStyle: z.string().min(1),
  fontProvenance: z
    .strictObject({
      requestedFamily: z.string().min(1),
      requestedStyle: z.string().min(1),
      requestSource: z.string().min(1),
      fallbackChain: z
        .array(
          z.strictObject({
            family: z.string().min(1),
            style: z.string().min(1),
          }),
        )
        .min(1),
      resolvedFamily: z.string().min(1),
      resolvedStyle: z.string().min(1),
      resolution: z.enum(["requested", "fallback"]),
      degradation: z.string().min(1).optional(),
    })
    .superRefine((font, context) => {
      if (
        font.resolution === "requested" &&
        (font.resolvedFamily !== font.requestedFamily ||
          font.resolvedStyle !== font.requestedStyle ||
          font.degradation !== undefined)
      ) {
        context.addIssue({
          code: "custom",
          message:
            "requested font resolution must preserve family/style and omit degradation",
        });
      }
      if (font.resolution === "fallback" && font.degradation === undefined) {
        context.addIssue({
          code: "custom",
          message: "fallback font resolution requires a named degradation",
        });
      }
      if (
        !font.fallbackChain.some(
          (candidate) =>
            candidate.family === font.resolvedFamily &&
            candidate.style === font.resolvedStyle,
        )
      ) {
        context.addIssue({
          code: "custom",
          message: "resolved font must occur in the declared fallback chain",
        });
      }
    })
    .optional(),
  fontSize: DimensionSchema,
  /** px or a unitless ratio expressed as percent — Figma's two spellings. */
  lineHeight: z.discriminatedUnion("unit", [
    z.strictObject({ unit: z.literal("px"), value: DimensionSchema }),
    z.strictObject({ unit: z.literal("percent"), value: z.number().finite() }),
    z.strictObject({ unit: z.literal("auto") }),
  ]),
  letterSpacing: SignedDimensionSchema.optional(),
  textCase: z.enum(["original", "upper", "lower", "title"]).optional(),
  textDecoration: z.enum(["none", "underline", "strikethrough"]).optional(),
});
export type TypeFacts = z.infer<typeof TypeFactsSchema>;

// ---------------------------------------------------------------------------
// Variable bindings
// ---------------------------------------------------------------------------

/**
 * A bound field carries BOTH a literal and a variable identity, which is why
 * this is a list beside the node rather than a value type inside it: the
 * canvas needs the binding, and every other reader needs the resolved value.
 */
const COLOR_BINDING_PATH =
  /^(?:fills\.\d+\.color|strokes\.\d+\.paint\.color|effects\.\d+\.color)$/;
const FLOAT_BINDING_PATH =
  /^(?:width\.value|height\.value|layout\.(?:itemSpacing|minWidth|minHeight|width\.value|height\.value|padding\.(?:top|right|bottom|left))|cornerRadius\.(?:topLeft|topRight|bottomRight|bottomLeft)|strokes\.\d+\.weight|type\.(?:fontSize|lineHeight\.value|letterSpacing))$/;
const STRING_BINDING_PATH = /^(?:characters|type\.(?:fontFamily|fontStyle))$/;
const BOOLEAN_BINDING_PATH = /^(?:clipsContent|visible)$/;

export const VariableBindingSchema = z
  .strictObject({
    /** A validated dot path into this node's own fields. */
    field: z.string().min(1),
    /** Figma variable type required by the addressed property. */
    type: z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]),
    /** The variable's name in the target collection, not a session node id. */
    variable: z.string().min(1),
  })
  .superRefine((binding, context) => {
    const compatible =
      (binding.type === "COLOR" && COLOR_BINDING_PATH.test(binding.field)) ||
      (binding.type === "FLOAT" && FLOAT_BINDING_PATH.test(binding.field)) ||
      (binding.type === "STRING" && STRING_BINDING_PATH.test(binding.field)) ||
      (binding.type === "BOOLEAN" && BOOLEAN_BINDING_PATH.test(binding.field));
    if (!compatible) {
      context.addIssue({
        code: "custom",
        message: `${binding.field} is not compatible with ${binding.type}`,
      });
    }
  });
export type VariableBinding = z.infer<typeof VariableBindingSchema>;

// ---------------------------------------------------------------------------
// Nodes — five kinds, closed
// ---------------------------------------------------------------------------

export const NODE_KINDS = [
  "frame",
  "text",
  "shape",
  "vector",
  "instance",
  "component",
  "component-set",
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

const nodeBase = {
  /**
   * A human-facing label only. Node IDENTITY is the structural path assigned
   * by normalization (docs/32 §4.1) — captured names are not stable and must
   * never be load-bearing.
   */
  label: z.string().optional(),
  /**
   * Stable recipe-owned meaning, persisted through Figma plugin data. Unlike
   * `label`, this is load-bearing and is what inverse validators address.
   */
  role: z.string().min(1).optional(),
  bindings: z.array(VariableBindingSchema).optional(),
  visible: z.boolean().optional(),
  opacity: UnitIntervalSchema.optional(),
};

export const TextNodeSchema = z.strictObject({
  ...nodeBase,
  kind: z.literal("text"),
  characters: z.string(),
  type: TypeFactsSchema,
  align: z.enum(["left", "center", "right", "justified"]),
  verticalAlign: z.enum(["top", "center", "bottom"]),
  fills: z.array(PaintSchema),
  width: SizingSchema,
  height: SizingSchema,
});
export type TextNode = z.infer<typeof TextNodeSchema>;

export const ShapeNodeSchema = z.strictObject({
  ...nodeBase,
  kind: z.literal("shape"),
  shape: z.enum(["rectangle", "ellipse"]),
  width: SizingSchema,
  height: SizingSchema,
  cornerRadius: CornerRadiusSchema.optional(),
  fills: z.array(PaintSchema),
  strokes: z.array(StrokeSchema).optional(),
  effects: z.array(EffectSchema).optional(),
});
export type ShapeNode = z.infer<typeof ShapeNodeSchema>;

export const VectorNodeSchema = z.strictObject({
  ...nodeBase,
  kind: z.literal("vector"),
  /** An asset the interpreter already holds — an SVG string or a keyed ref. */
  assetRef: z.string().min(1),
  width: SizingSchema,
  height: SizingSchema,
  fills: z.array(PaintSchema),
});
export type VectorNode = z.infer<typeof VectorNodeSchema>;

export const InstanceNodeSchema = z.strictObject({
  ...nodeBase,
  kind: z.literal("instance"),
  /** The component's stable contract/recipe id, never a session node id. */
  componentRef: z.string().min(1),
  properties: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean()]),
  ),
  payload: z
    .strictObject({
      content: z.discriminatedUnion("kind", [
        z.strictObject({ kind: z.literal("text"), text: z.string().min(1) }),
        z.strictObject({
          kind: z.literal("glyph"),
          text: z.string().min(1),
          assetRef: z.string().min(1),
        }),
        z.strictObject({
          kind: z.literal("instance"),
          componentRef: z.string().min(1),
          properties: z.record(
            z.string(),
            z.union([z.string(), z.number(), z.boolean()]),
          ),
        }),
      ]),
      typography: TypeFactsSchema.optional(),
      fills: z.array(PaintSchema).min(1),
      opacity: UnitIntervalSchema,
      intrinsicSize: z.strictObject({
        width: DimensionSchema.positive(),
        height: DimensionSchema.positive(),
      }),
      padding: PaddingSchema,
      alignment: z.strictObject({
        horizontal: z.enum(["start", "center", "end"]),
        vertical: z.enum(["start", "center", "end"]),
      }),
      accessibility: z.strictObject({
        relation: z.enum(["none", "labelledby-control"]),
        decorative: z.boolean(),
        label: z.string().min(1).optional(),
      }),
      source: z.string().min(1),
    })
    .optional(),
  /** Explicit instance-root paints, available through Figma's GeometryMixin. */
  fills: z.array(PaintSchema).optional(),
  width: SizingSchema,
  height: SizingSchema,
});
export type InstanceNode = z.infer<typeof InstanceNodeSchema>;

export const VariantAxisSchema = z.strictObject({
  /** Figma component-property name, kept case-sensitive. */
  name: z.string().min(1),
  /** Declared picker order. Every value must be exercised by a child. */
  values: z.array(z.string().min(1)).min(2),
});
export type VariantAxis = z.infer<typeof VariantAxisSchema>;

export interface FrameNode {
  kind: "frame";
  layout: FrameLayout;
  fills: Paint[];
  label?: string;
  role?: string;
  bindings?: VariableBinding[];
  visible?: boolean;
  opacity?: number;
  strokes?: Stroke[];
  effects?: Effect[];
  cornerRadius?: CornerRadius;
  clipsContent?: boolean;
  children: IRNode[];
}

/** A Figma ComponentNode. Its own contents must use real auto-layout. */
export interface ComponentNode {
  kind: "component";
  layout: FrameLayout;
  fills: Paint[];
  label?: string;
  role?: string;
  bindings?: VariableBinding[];
  visible?: boolean;
  opacity?: number;
  strokes?: Stroke[];
  effects?: Effect[];
  cornerRadius?: CornerRadius;
  clipsContent?: boolean;
  /** The properties encoded in the component's Figma variant name. */
  variantProperties: Record<string, string>;
  children: IRNode[];
}

/** A Figma ComponentSetNode produced from component children. */
export interface ComponentSetNode {
  kind: "component-set";
  layout: FrameLayout;
  fills: Paint[];
  label?: string;
  role?: string;
  bindings?: VariableBinding[];
  visible?: boolean;
  opacity?: number;
  clipsContent?: boolean;
  variantAxes: VariantAxis[];
  children: ComponentNode[];
}

export type IRNode =
  | FrameNode
  | TextNode
  | ShapeNode
  | VectorNode
  | InstanceNode
  | ComponentNode
  | ComponentSetNode;

/** The recursion point. `children` is the only cycle in the vocabulary. */
export const FrameNodeSchema = z.strictObject({
  ...nodeBase,
  kind: z.literal("frame"),
  layout: FrameLayoutSchema,
  fills: z.array(PaintSchema),
  strokes: z.array(StrokeSchema).optional(),
  effects: z.array(EffectSchema).optional(),
  cornerRadius: CornerRadiusSchema.optional(),
  clipsContent: z.boolean().optional(),
  children: z.array(z.lazy((): z.ZodType<IRNode> => IRNodeSchema)),
});

export const ComponentNodeSchema = z.strictObject({
  ...nodeBase,
  kind: z.literal("component"),
  layout: FrameLayoutSchema,
  fills: z.array(PaintSchema),
  strokes: z.array(StrokeSchema).optional(),
  effects: z.array(EffectSchema).optional(),
  cornerRadius: CornerRadiusSchema.optional(),
  clipsContent: z.boolean().optional(),
  variantProperties: z.record(z.string(), z.string()),
  children: z.array(z.lazy((): z.ZodType<IRNode> => IRNodeSchema)),
});

export const ComponentSetNodeSchema = z.strictObject({
  ...nodeBase,
  kind: z.literal("component-set"),
  layout: FrameLayoutSchema,
  fills: z.array(PaintSchema),
  clipsContent: z.boolean().optional(),
  variantAxes: z.array(VariantAxisSchema).min(1),
  children: z.array(ComponentNodeSchema).min(1),
});

export const IRNodeSchema: z.ZodType<IRNode> = z.discriminatedUnion("kind", [
  FrameNodeSchema,
  TextNodeSchema,
  ShapeNodeSchema,
  VectorNodeSchema,
  InstanceNodeSchema,
  ComponentNodeSchema,
  ComponentSetNodeSchema,
]);

/**
 * Every field name the IR can present, gathered once. `recipe:ir:closed:check`
 * (docs/32 §10) will hold this set against the interpreter's assignment table,
 * so a field with no named Figma Plugin API call cannot enter the vocabulary
 * unnoticed. Listed by hand rather than derived: a derivation shared with the
 * checker would make a bug in the derivation invisible to both.
 */
export const IR_DRAWABLE_FIELDS = [
  "align",
  "assetRef",
  "bindings",
  "characters",
  "children",
  "clipsContent",
  "componentRef",
  "cornerRadius",
  "effects",
  "fills",
  "height",
  "kind",
  "label",
  "layout",
  "opacity",
  "payload",
  "properties",
  "role",
  "shape",
  "strokes",
  "type",
  "verticalAlign",
  "visible",
  "variantAxes",
  "variantProperties",
  "width",
] as const;

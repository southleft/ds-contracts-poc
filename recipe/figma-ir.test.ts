/**
 * The IR's two load-bearing properties, tested adversarially: the vocabulary
 * is CLOSED (an unknown key is refused, not passed through) and the scalars
 * have ONE canonical spelling (so a canonical hash means something).
 *
 * docs/32-recipe-ir-pivot.md §3, §4.3, §11.1.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ColorSchema,
  ComponentNodeSchema,
  ComponentSetNodeSchema,
  DimensionSchema,
  FrameNodeSchema,
  IRNodeSchema,
  IR_DRAWABLE_FIELDS,
  InstanceNodeSchema,
  NODE_KINDS,
  PaintSchema,
  ShapeNodeSchema,
  SignedDimensionSchema,
  SizingSchema,
  TextNodeSchema,
  VariableBindingSchema,
  VectorNodeSchema,
  type IRNode,
} from "./figma-ir.js";

const hug = { mode: "hug" } as const;
const zeroPadding = { top: 0, right: 0, bottom: 0, left: 0 };

const label: IRNode = {
  kind: "text",
  characters: "Save",
  type: {
    fontFamily: "Inter",
    fontStyle: "Semi Bold",
    fontSize: 14,
    lineHeight: { unit: "px", value: 20 },
  },
  align: "center",
  verticalAlign: "center",
  fills: [{ kind: "solid", color: "#ffffffff" }],
  width: hug,
  height: hug,
};

const frame: IRNode = {
  kind: "frame",
  layout: {
    mode: "horizontal",
    primaryAxisAlign: "center",
    counterAxisAlign: "center",
    itemSpacing: 8,
    padding: { top: 8, right: 16, bottom: 8, left: 16 },
    width: hug,
    height: hug,
  },
  fills: [{ kind: "solid", color: "#2563ebff" }],
  children: [label],
};

test("a canonical color is the only accepted spelling", () => {
  assert.equal(ColorSchema.parse("#2563ebff"), "#2563ebff");
  for (const wrong of ["#fff", "#ffffff", "#FFFFFFFF", "rgb(0 0 0)", ""]) {
    assert.equal(
      ColorSchema.safeParse(wrong).success,
      false,
      `${wrong} must be refused — two spellings of one paint break the hash`,
    );
  }
});

test("a dimension refuses the shapes a failed unit conversion arrives as", () => {
  assert.equal(DimensionSchema.parse(0), 0);
  assert.equal(SignedDimensionSchema.parse(-1.5), -1.5);
  for (const wrong of [
    -1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    "16px",
    null,
  ]) {
    assert.equal(DimensionSchema.safeParse(wrong).success, false);
  }
});

test("variable bindings accept only typed compatible node paths", () => {
  assert.equal(
    VariableBindingSchema.safeParse({
      field: "fills.0.color",
      type: "COLOR",
      variable: "field.background",
    }).success,
    true,
  );
  assert.equal(
    VariableBindingSchema.safeParse({
      field: "layout.padding.left",
      type: "FLOAT",
      variable: "field.padding",
    }).success,
    true,
  );
  for (const field of [
    "strokes.0.weight",
    "strokes.0.weight.top",
    "strokes.0.weight.right",
    "strokes.0.weight.bottom",
    "strokes.0.weight.left",
  ]) {
    assert.equal(
      VariableBindingSchema.safeParse({
        field,
        type: "FLOAT",
        variable: "field.border-width",
      }).success,
      true,
      field,
    );
    assert.equal(
      VariableBindingSchema.safeParse({
        field,
        type: "COLOR",
        variable: "wrong.type",
      }).success,
      false,
      `${field} COLOR`,
    );
  }
  for (const binding of [
    {
      field: "fills.0.color",
      type: "FLOAT",
      variable: "wrong.type",
    },
    {
      field: "layout.padding.sideways",
      type: "FLOAT",
      variable: "wrong.path",
    },
    {
      field: "layout.offset.x",
      type: "FLOAT",
      variable: "figma.cannot-bind-position",
    },
    { field: "constructor.prototype", type: "STRING", variable: "unsafe" },
  ]) {
    assert.equal(
      VariableBindingSchema.safeParse(binding).success,
      false,
      JSON.stringify(binding),
    );
  }
});

test("the paint vocabulary is closed", () => {
  assert.equal(
    PaintSchema.safeParse({ kind: "solid", color: "#000000ff" }).success,
    true,
  );
  assert.equal(
    PaintSchema.safeParse({ kind: "conic-gradient", stops: [] }).success,
    false,
    "a paint kind with no Figma primitive must be refused, not carried",
  );
  assert.equal(
    PaintSchema.safeParse({
      kind: "linear-gradient",
      angle: 90,
      stops: [{ position: 0, color: "#000000ff" }],
    }).success,
    false,
    "a one-stop gradient is not a gradient",
  );
});

test("sizing is Figma's three modes and nothing else", () => {
  assert.equal(
    SizingSchema.safeParse({ mode: "fixed", value: 40 }).success,
    true,
  );
  assert.equal(SizingSchema.safeParse({ mode: "hug" }).success, true);
  assert.equal(SizingSchema.safeParse({ mode: "fill" }).success, true);
  assert.equal(SizingSchema.safeParse({ mode: "auto" }).success, false);
  assert.equal(
    SizingSchema.safeParse({ mode: "fixed", value: "40px" }).success,
    false,
  );
});

test("NO ESCAPE HATCH — an unknown key is refused at every node kind", () => {
  // docs/32 §11.1: the moment a passthrough is needed, the premise is dead.
  // This is the test that would have to be deleted to smuggle one in.
  const smuggled = { ...frame, style: { "backdrop-filter": "blur(4px)" } };
  assert.equal(
    FrameNodeSchema.safeParse(smuggled).success,
    false,
    "a CSS property bag must not survive on a frame",
  );
  assert.equal(
    TextNodeSchema.safeParse({ ...label, css: "text-wrap: balance" }).success,
    false,
  );
  assert.equal(
    ShapeNodeSchema.safeParse({
      kind: "shape",
      shape: "rectangle",
      width: hug,
      height: hug,
      fills: [],
      extra: 1,
    }).success,
    false,
  );
  assert.equal(
    VectorNodeSchema.safeParse({
      kind: "vector",
      assetRef: "check",
      width: hug,
      height: hug,
      fills: [],
      viewBox: "0 0 16 16",
    }).success,
    false,
  );
  assert.equal(
    InstanceNodeSchema.safeParse({
      kind: "instance",
      componentRef: "ds.icon",
      properties: {},
      width: hug,
      height: hug,
      overrides: {},
    }).success,
    false,
  );
});

test("the tree recurses, and a defect in a grandchild is still a defect", () => {
  const parsed = IRNodeSchema.parse(frame);
  assert.equal(parsed.kind, "frame");

  const nested: IRNode = {
    ...(frame as Extract<IRNode, { kind: "frame" }>),
    children: [frame],
  };
  assert.equal(IRNodeSchema.safeParse(nested).success, true);

  const rotten = {
    ...frame,
    children: [{ ...label, fills: [{ kind: "solid", color: "#fff" }] }],
  };
  assert.equal(
    IRNodeSchema.safeParse(rotten).success,
    false,
    "a bad color two levels down must not pass",
  );
});

test("an unknown node kind is refused", () => {
  assert.equal(
    IRNodeSchema.safeParse({ kind: "boolean-operation", children: [] }).success,
    false,
  );
  assert.equal(NODE_KINDS.length, 7);
});

test("component sets carry Figma-native axes and component variants", () => {
  const component = {
    ...frame,
    kind: "component",
    role: "button/variant/primary",
    variantProperties: { Variant: "primary" },
  } as const;
  const componentSet = {
    ...frame,
    kind: "component-set",
    role: "button/set",
    variantAxes: [{ name: "Variant", values: ["primary", "secondary"] }],
    children: [component],
  } as const;

  assert.equal(ComponentNodeSchema.safeParse(component).success, true);
  assert.equal(ComponentSetNodeSchema.safeParse(componentSet).success, true);
  assert.equal(IRNodeSchema.safeParse(componentSet).success, true);
  assert.equal(
    ComponentSetNodeSchema.safeParse({
      ...componentSet,
      variantAxes: [{ name: "Variant", values: ["primary"] }],
    }).success,
    false,
    "a one-value component-set axis is dead structure, not a variant axis",
  );
});

test("IR_DRAWABLE_FIELDS is exactly the fields the node schemas present", () => {
  // The list is hand-maintained on purpose (figma-ir.ts). This is what keeps
  // it true: a field added to a node schema without being declared drawable
  // reds here instead of arriving in the vocabulary unnoticed.
  const declared = new Set<string>(IR_DRAWABLE_FIELDS);
  const actual = new Set<string>();
  for (const schema of [
    FrameNodeSchema,
    TextNodeSchema,
    ShapeNodeSchema,
    VectorNodeSchema,
    InstanceNodeSchema,
    ComponentNodeSchema,
    ComponentSetNodeSchema,
  ]) {
    for (const key of Object.keys(schema.shape)) actual.add(key);
  }
  assert.deepEqual(
    [...actual].filter((key) => !declared.has(key)),
    [],
    "a node schema presents a field IR_DRAWABLE_FIELDS does not declare",
  );
  assert.deepEqual(
    [...declared].filter((key) => !actual.has(key)),
    [],
    "IR_DRAWABLE_FIELDS declares a field no node schema presents",
  );
});

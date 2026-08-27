import assert from "node:assert/strict";
import test from "node:test";

import type {
  ComponentNode,
  Effect,
  FrameLayout,
  IRNode,
  Paint,
  Sizing,
  Stroke,
} from "./figma-ir.js";
import {
  compareSceneToExpectedPlan,
  compileExpectedScenePlan,
  createSceneGeneratedDescendantIdentity,
  resolveSceneOwnershipIdentities,
  sceneToNormalizedIr,
  verifySceneDerivedFixedPoint,
  type SceneGeneratedIdentitySegment,
  type SceneIdentityNode,
  type SceneEffect,
  type SceneNodeSnapshot,
  type ScenePaint,
  type SceneVariableBinding,
} from "./scene-readback.js";
import { canonicalButtonRecipeInstance } from "./fixtures/button.js";
import { collapseButtonRecipe, compileButtonRecipe } from "./recipes/button.js";
import { buildFigmaSceneReadbackRuntime } from "./scene-readback-runtime.js";

const scenePaint = (paint: Paint): ScenePaint => {
  if (paint.kind === "solid") return { type: "SOLID", color: paint.color };
  if (paint.kind === "linear-gradient")
    return {
      type: "GRADIENT_LINEAR",
      angle: paint.angle,
      gradientStops: paint.stops,
    };
  if (paint.kind === "radial-gradient")
    return { type: "GRADIENT_RADIAL", gradientStops: paint.stops };
  return {
    type: "IMAGE",
    assetRef: paint.assetRef,
    scaleMode: paint.scaleMode.toUpperCase() as ScenePaint["scaleMode"],
  };
};

const sceneEffect = (effect: Effect): SceneEffect =>
  effect.kind === "drop-shadow" || effect.kind === "inner-shadow"
    ? {
        type: effect.kind === "drop-shadow" ? "DROP_SHADOW" : "INNER_SHADOW",
        offset: { x: effect.offsetX, y: effect.offsetY },
        radius: effect.blur,
        spread: effect.spread,
        color: effect.color,
        visible: true,
      }
    : {
        type: effect.kind === "layer-blur" ? "LAYER_BLUR" : "BACKGROUND_BLUR",
        radius: effect.blur,
        visible: true,
      };

const sceneBindingField = (field: string): string =>
  ({
    "layout.padding.top": "paddingTop",
    "layout.padding.right": "paddingRight",
    "layout.padding.bottom": "paddingBottom",
    "layout.padding.left": "paddingLeft",
    "layout.itemSpacing": "itemSpacing",
    "layout.minWidth": "minWidth",
    "layout.minHeight": "minHeight",
    "cornerRadius.topLeft": "topLeftRadius",
    "cornerRadius.topRight": "topRightRadius",
    "cornerRadius.bottomRight": "bottomRightRadius",
    "cornerRadius.bottomLeft": "bottomLeftRadius",
    "strokes.0.weight": "strokeWeight",
    "type.fontSize": "fontSize",
    "type.lineHeight.value": "lineHeight",
    "type.letterSpacing.value": "letterSpacing",
    "width.value": "width",
    "height.value": "height",
  })[field] ?? field;

const sceneBindings = (node: IRNode): SceneVariableBinding[] =>
  (node.bindings ?? []).map((binding) => ({
    field: sceneBindingField(binding.field),
    variableName: binding.variable,
    resolvedType: binding.type,
  }));

const sizing = (
  value: Sizing,
  fallback: number,
): { mode: "FIXED" | "HUG" | "FILL"; value: number } => ({
  mode: value.mode.toUpperCase() as "FIXED" | "HUG" | "FILL",
  value: value.mode === "fixed" ? value.value : fallback,
});

const align = {
  min: "MIN",
  center: "CENTER",
  max: "MAX",
  "space-between": "SPACE_BETWEEN",
  baseline: "BASELINE",
} as const;

const constraints = {
  left: "MIN",
  right: "MAX",
  top: "MIN",
  bottom: "MAX",
  center: "CENTER",
  scale: "SCALE",
  stretch: "STRETCH",
} as const;

const applyLayout = (target: SceneNodeSnapshot, layout: FrameLayout): void => {
  const width = sizing(layout.width, 100);
  const height = sizing(layout.height, 40);
  Object.assign(target, {
    width: width.value,
    height: height.value,
    layoutMode: layout.mode.toUpperCase(),
    layoutSizingHorizontal: width.mode,
    layoutSizingVertical: height.mode,
    primaryAxisAlignItems: align[layout.primaryAxisAlign],
    counterAxisAlignItems: align[layout.counterAxisAlign],
    itemSpacing: layout.itemSpacing,
    paddingTop: layout.padding.top,
    paddingRight: layout.padding.right,
    paddingBottom: layout.padding.bottom,
    paddingLeft: layout.padding.left,
    minWidth: layout.minWidth ?? null,
    minHeight: layout.minHeight ?? null,
    layoutPositioning: layout.positioning === "absolute" ? "ABSOLUTE" : "AUTO",
    ...(layout.positioning === "absolute"
      ? {
          x: layout.offset?.x,
          y: layout.offset?.y,
          constraints: {
            horizontal: constraints[layout.constraints!.horizontal],
            vertical: constraints[layout.constraints!.vertical],
          },
        }
      : {}),
  });
};

const strokePaints = (
  strokes: Stroke[] | undefined,
): ScenePaint[] | undefined =>
  strokes?.map((stroke) => scenePaint(stroke.paint));

const mockScene = (
  node: IRNode,
  ownershipKey = "root",
  payloadByRole: Record<string, SceneNodeSnapshot["instancePayload"]> = {},
): SceneNodeSnapshot => {
  const type =
    node.kind === "shape"
      ? node.shape === "rectangle"
        ? "RECTANGLE"
        : "ELLIPSE"
      : (
          {
            frame: "FRAME",
            text: "TEXT",
            vector: "VECTOR",
            instance: "INSTANCE",
            component: "COMPONENT",
            "component-set": "COMPONENT_SET",
          } as const
        )[node.kind];
  const name =
    node.kind === "component"
      ? Object.entries(node.variantProperties)
          .map(([axis, value]) => `${axis}=${value}`)
          .join(", ")
      : node.role !== undefined &&
          node.label !== undefined &&
          node.role !== node.label
        ? `${node.role} :: ${node.label}`
        : (node.label ?? node.role ?? node.kind);
  const scene: SceneNodeSnapshot = {
    ownershipKey,
    type,
    name,
    semanticRole: node.role,
    width: 100,
    height: 40,
    visible: node.visible ?? true,
    opacity: node.opacity ?? 1,
    boundVariables: sceneBindings(node),
    children: [],
  };
  if ("fills" in node && node.fills !== undefined)
    scene.fills = node.fills.map(scenePaint);
  if ("strokes" in node && node.strokes !== undefined) {
    scene.strokes = strokePaints(node.strokes);
    scene.strokeWeight = node.strokes[0]?.weight;
    scene.strokeAlign = node.strokes[0]?.align.toUpperCase() as
      "INSIDE" | "OUTSIDE" | "CENTER";
    scene.dashPattern = node.strokes[0]?.dashPattern;
  }
  if ("effects" in node && node.effects !== undefined)
    scene.effects = node.effects.map(sceneEffect);
  if ("cornerRadius" in node) scene.cornerRadius = node.cornerRadius;
  if (
    node.kind === "frame" ||
    node.kind === "component" ||
    node.kind === "component-set"
  ) {
    applyLayout(scene, node.layout);
    scene.clipsContent = node.clipsContent ?? false;
    scene.children = node.children.map((child, index) =>
      mockScene(child, `${ownershipKey}/children/${index}`, payloadByRole),
    );
  } else {
    const width = sizing(node.width, 24);
    const height = sizing(node.height, 20);
    scene.width = width.value;
    scene.height = height.value;
    scene.layoutSizingHorizontal = width.mode;
    scene.layoutSizingVertical = height.mode;
  }
  if (node.kind === "component")
    scene.variantProperties = node.variantProperties;
  if (node.kind === "component-set")
    scene.variantGroupProperties = Object.fromEntries(
      node.variantAxes.map((axis) => [axis.name, { values: axis.values }]),
    );
  if (node.kind === "text") {
    scene.characters = node.characters;
    scene.fontName = {
      family: node.type.fontFamily,
      style: node.type.fontStyle,
    };
    scene.fontSize = node.type.fontSize;
    scene.lineHeight =
      node.type.lineHeight.unit === "auto"
        ? { unit: "AUTO" }
        : {
            unit: node.type.lineHeight.unit === "px" ? "PIXELS" : "PERCENT",
            value: node.type.lineHeight.value,
          };
    scene.letterSpacing =
      node.type.letterSpacing === undefined
        ? undefined
        : {
            unit:
              node.type.letterSpacing.unit === "px" ? "PIXELS" : "PERCENT",
            value: node.type.letterSpacing.value,
          };
    scene.textCase = node.type.textCase?.toUpperCase() as
      "ORIGINAL" | "UPPER" | "LOWER" | "TITLE" | undefined;
    scene.textDecoration = node.type.textDecoration?.toUpperCase() as
      "NONE" | "UNDERLINE" | "STRIKETHROUGH" | undefined;
    scene.textAlignHorizontal = node.align.toUpperCase() as
      "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
    scene.textAlignVertical = node.verticalAlign.toUpperCase() as
      "TOP" | "CENTER" | "BOTTOM";
  }
  if (node.kind === "instance") {
    scene.componentRef = node.componentRef;
    scene.componentProperties = node.properties;
    scene.instancePayload =
      payloadByRole[node.role ?? ""] ??
      (node.payload === undefined
        ? undefined
        : {
            text:
              node.payload.content.kind === "text" ||
              node.payload.content.kind === "glyph"
                ? [node.payload.content.text]
                : [],
            assets:
              node.payload.content.kind === "glyph"
                ? [node.payload.content.assetRef]
                : [],
            content: node.payload.content,
            typography: node.payload.typography,
            fills: node.payload.fills,
            opacity: node.payload.opacity,
            intrinsicSize: node.payload.intrinsicSize,
            padding: node.payload.padding,
            alignment: node.payload.alignment,
            accessibility: node.payload.accessibility,
            source: node.payload.source,
          });
  }
  if (node.kind === "vector")
    scene.instancePayload = { text: [], assets: [node.assetRef] };
  return scene;
};

const twoCellIr = (): IRNode => {
  const component = (value: string): ComponentNode => ({
    kind: "component",
    role: `test/variant/${value}`,
    variantProperties: { State: value },
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "center",
      counterAxisAlign: "center",
      itemSpacing: 8,
      padding: { top: 4, right: 8, bottom: 4, left: 8 },
      width: { mode: "hug" },
      height: { mode: "hug" },
    },
    fills: [
      { kind: "solid", color: "#ffffffff" },
      { kind: "solid", color: "#ffffffff" },
    ],
    clipsContent: false,
    children: [
      {
        kind: "text",
        role: "test/label",
        characters: value,
        type: {
          fontFamily: "Inter",
          fontStyle: "Regular",
          fontSize: 14,
          lineHeight: { unit: "px", value: 20 },
        },
        align: "left",
        verticalAlign: "center",
        fills: [{ kind: "solid", color: "#111111ff" }],
        width: { mode: "hug" },
        height: { mode: "hug" },
        bindings: [
          {
            field: "type.fontSize",
            type: "FLOAT",
            variable: "test.font-size",
          },
        ],
      },
      {
        kind: "instance",
        role: "test/adornment",
        componentRef: "test.currency",
        properties: { Side: "leading" },
        payload: {
          content: { kind: "text", text: "$" },
          typography: {
            fontFamily: "Inter",
            fontStyle: "Regular",
            fontSize: 14,
            lineHeight: { unit: "px", value: 20 },
          },
          fills: [{ kind: "solid", color: "#111111ff" }],
          opacity: 1,
          intrinsicSize: { width: 8, height: 20 },
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          alignment: { horizontal: "center", vertical: "center" },
          accessibility: { relation: "none", decorative: true },
          source: "fixture-source",
        },
        width: { mode: "fixed", value: 16 },
        height: { mode: "fixed", value: 16 },
      },
    ],
  });
  return {
    kind: "component-set",
    role: "test/set",
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: 24,
      padding: { top: 32, right: 32, bottom: 32, left: 32 },
      width: { mode: "fixed", value: 400 },
      height: { mode: "hug" },
    },
    fills: [{ kind: "solid", color: "#f7f7f8ff" }],
    clipsContent: false,
    variantAxes: [{ name: "State", values: ["default", "focus"] }],
    children: [component("default"), component("focus")],
  };
};

const planAndScene = () => {
  const ir = twoCellIr();
  return {
    ir,
    plan: compileExpectedScenePlan(ir),
    scene: mockScene(ir),
  };
};

test("scene-derived accounting is total only when every planned fact is observed", () => {
  const { plan, scene } = planAndScene();
  const comparison = compareSceneToExpectedPlan(plan, scene);
  assert.equal(comparison.ok, true);
  assert.equal(comparison.denominator, plan.facts.length);
  assert.equal(comparison.matched, plan.facts.length);
  assert.equal(comparison.silent, 0);
});

test("layout, binding, text, payload, axis, duplicate, and child mutations fail", () => {
  const plants: Array<{
    name: string;
    mutate: (scene: SceneNodeSnapshot) => void;
    pattern: RegExp;
  }> = [
    {
      name: "layout",
      mutate: (scene) => {
        scene.children[0]!.itemSpacing = 99;
      },
      pattern: /mismatched .*layout\.itemSpacing/,
    },
    {
      name: "binding",
      mutate: (scene) => {
        scene.children[0]!.children[0]!.boundVariables[0]!.variableName =
          "wrong.variable";
      },
      pattern: /mismatched .*binding/,
    },
    {
      name: "text",
      mutate: (scene) => {
        scene.children[0]!.children[0]!.characters = "tampered";
      },
      pattern: /mismatched .*characters/,
    },
    {
      name: "adornment payload",
      mutate: (scene) => {
        const current = scene.children[0]!.children[1]!.instancePayload!;
        scene.children[0]!.children[1]!.instancePayload = {
          ...current,
          text: [],
          assets: ["gray-block"],
          content: { kind: "glyph", text: "■", assetRef: "gray-block" },
        };
      },
      pattern: /mismatched .*instancePayload/,
    },
    {
      name: "adornment visual payload",
      mutate: (scene) => {
        scene.children[0]!.children[1]!.instancePayload!.intrinsicSize = {
          width: 99,
          height: 20,
        };
      },
      pattern: /mismatched .*instancePayload/,
    },
    {
      name: "adornment accessibility",
      mutate: (scene) => {
        scene.children[0]!.children[1]!.instancePayload!.accessibility = {
          relation: "labelledby-control",
          decorative: false,
        };
      },
      pattern: /mismatched .*instancePayload/,
    },
    {
      name: "axis",
      mutate: (scene) => {
        scene.variantGroupProperties!.State!.values[1] = "pressed";
      },
      pattern: /mismatched .*variantAxis/,
    },
    {
      name: "duplicate collapsed",
      mutate: (scene) => {
        scene.children[0]!.fills!.pop();
      },
      pattern: /duplicate-collapsed .*fill/,
    },
    {
      name: "missing child",
      mutate: (scene) => {
        scene.children[0]!.children.pop();
      },
      pattern: /missing .*child/,
    },
  ];
  for (const plant of plants) {
    const { plan, scene } = planAndScene();
    plant.mutate(scene);
    const result = compareSceneToExpectedPlan(plan, scene);
    assert.equal(result.ok, false, plant.name);
    assert.match(result.failures.join("\n"), plant.pattern, plant.name);
    assert.ok(result.silent > 0, plant.name);
  }
});

test("forged plugin-data source IR cannot mask a changed scene property", () => {
  const { ir, plan, scene } = planAndScene();
  scene.children[0]!.itemSpacing = 999;
  scene.pluginData = { sourceIr: JSON.stringify(ir) };
  scene.children[0]!.pluginData = { irNode: JSON.stringify(ir) };
  const result = compareSceneToExpectedPlan(plan, scene);
  assert.equal(result.ok, false);
  assert.match(result.failures.join("\n"), /layout\.itemSpacing/);
});

test("a planned fact without an independent scene mapping is unobserved and red", () => {
  const { plan, scene } = planAndScene();
  const planted = structuredClone(plan);
  const source = planted.facts[0]!;
  planted.facts.push({
    ...source,
    id: "root#expected-only@0000",
    baseId: "root#expected-only",
    channel: "expected-only",
    occurrence: 0,
  });
  const result = compareSceneToExpectedPlan(planted, scene);
  assert.equal(result.ok, false);
  assert.equal(result.unobserved.length, 1);
  assert.match(result.failures.join("\n"), /unobserved/);
});

test("fixed point starts from scene-derived IR and stabilizes on cycle two", () => {
  const envelope = compileButtonRecipe(canonicalButtonRecipeInstance);
  const scene = mockScene(envelope.ir);
  assert.deepEqual(sceneToNormalizedIr(scene), sceneToNormalizedIr(scene));
  const result = verifySceneDerivedFixedPoint(
    scene,
    envelope,
    canonicalButtonRecipeInstance.provenance.selection,
    collapseButtonRecipe,
    compileButtonRecipe,
  );
  assert.equal(result.comparison.ok, true);
  assert.equal(result.stable, true);
  assert.equal(result.cycle1, result.cycle2);

  scene.children[0]!.itemSpacing = (scene.children[0]!.itemSpacing ?? 0) + 1;
  scene.pluginData = { sourceIr: JSON.stringify(envelope.ir) };
  assert.throws(
    () =>
      verifySceneDerivedFixedPoint(
        scene,
        envelope,
        canonicalButtonRecipeInstance.provenance.selection,
        collapseButtonRecipe,
        compileButtonRecipe,
      ),
    /canonicalHash|structure|fixed|parameter|variant|integrity/i,
  );
});

const identityOwner = () => ({
  ownershipKey: "root/children/7",
  runIdentity: "run",
  adapterIdentity: "adapter",
  recipeHash: "recipe",
  envelopeHash: "envelope",
});

const identityTree = (): SceneIdentityNode => ({
  type: "INSTANCE",
  ...identityOwner(),
  mainComponentRef: "source/adornment",
  children: [
    { type: "TEXT", children: [] },
    { type: "TEXT", children: [] },
    {
      type: "INSTANCE",
      mainComponentRef: "source/nested",
      children: [{ type: "TEXT", children: [] }],
    },
  ],
});

const identityPlan = () => {
  const lineages: SceneGeneratedIdentitySegment[][] = [
    [{ type: "TEXT", childIndex: 0, occurrence: 0 }],
    [{ type: "TEXT", childIndex: 1, occurrence: 1 }],
    [
      {
        type: "INSTANCE",
        childIndex: 2,
        occurrence: 0,
        mainComponentRef: "source/nested",
      },
    ],
    [
      {
        type: "INSTANCE",
        childIndex: 2,
        occurrence: 0,
        mainComponentRef: "source/nested",
      },
      { type: "TEXT", childIndex: 0, occurrence: 0 },
    ],
  ];
  return lineages.map((lineage) =>
    createSceneGeneratedDescendantIdentity(
      identityOwner().ownershipKey,
      "source/adornment",
      lineage,
    ),
  );
};

test("generated descendant identity preserves nested and repeated occurrences", () => {
  const tree = identityTree();
  const resolved = resolveSceneOwnershipIdentities(
    tree,
    identityPlan(),
    identityOwner(),
  );
  assert.equal(resolved.size, 5);
  assert.notEqual(
    resolved.get(tree.children[0]!),
    resolved.get(tree.children[1]!),
  );
  assert.match(
    resolved.get(tree.children[2]!.children[0]!)!,
    /source~2Fnested/,
  );
});

test("host and Figma runtime derive the same source-neutral key", async () => {
  const lineage: SceneGeneratedIdentitySegment[] = [
    {
      type: "INSTANCE",
      childIndex: 2,
      occurrence: 0,
      mainComponentRef: "source/nested",
    },
    { type: "TEXT", childIndex: 0, occurrence: 0 },
  ];
  const execute = new (
    Object.getPrototypeOf(async function () {}).constructor as new (
      ...arguments_: string[]
    ) => (...values: unknown[]) => Promise<string>
  )(
    "figma",
    `${buildFigmaSceneReadbackRuntime("test.scene")}
return sceneDerivedOwnershipKey("root/children/7","source/adornment",${JSON.stringify(lineage)});`,
  );
  assert.equal(
    await execute({}),
    createSceneGeneratedDescendantIdentity(
      "root/children/7",
      "source/adornment",
      lineage,
    ).ownershipKey,
  );
});

test("generated descendant identity refuses structural and ownership attacks", () => {
  const plants: Array<{
    name: string;
    pattern: RegExp;
    mutate: (
      tree: SceneIdentityNode,
      plan: ReturnType<typeof identityPlan>,
      owner: ReturnType<typeof identityOwner>,
    ) => void;
  }> = [
    {
      name: "swapped order",
      pattern: /DERIVED-IDENTITY-UNEXPECTED/,
      mutate: (tree) => {
        [tree.children[1], tree.children[2]] = [
          tree.children[2]!,
          tree.children[1]!,
        ];
      },
    },
    {
      name: "unexpected extra descendant",
      pattern: /DERIVED-IDENTITY-UNEXPECTED/,
      mutate: (tree) => {
        tree.children.push({ type: "FRAME", children: [] });
      },
    },
    {
      name: "missing main component",
      pattern: /INSTANCE-MAIN-COMPONENT-ABSENT/,
      mutate: (tree) => {
        tree.children[2]!.mainComponentRef = null;
      },
    },
    {
      name: "detached foreign instance",
      pattern: /DERIVED-IDENTITY-UNEXPECTED/,
      mutate: (tree) => {
        tree.children[2]!.mainComponentRef = "foreign/component";
      },
    },
    {
      name: "unexpected component descendant",
      pattern: /GENERATED-COMPONENT-DESCENDANT/,
      mutate: (tree) => {
        tree.children.push({ type: "COMPONENT", children: [] });
      },
    },
    {
      name: "duplicate expected identity",
      pattern: /PLAN-DUPLICATE/,
      mutate: (_tree, plan) => {
        plan.push(structuredClone(plan[0]!));
      },
    },
    {
      name: "forged ancestor plugin data",
      pattern: /OWNED-INSTANCE-IDENTITY-MISMATCH/,
      mutate: (tree) => {
        tree.runIdentity = "forged";
      },
    },
    {
      name: "direct key on read-only child",
      pattern: /GENERATED-DESCENDANT-DIRECT-KEY/,
      mutate: (tree) => {
        tree.children[0]!.ownershipKey = "forged";
      },
    },
  ];
  for (const plant of plants) {
    const tree = identityTree();
    const plan = identityPlan();
    const owner = identityOwner();
    plant.mutate(tree, plan, owner);
    assert.throws(
      () => resolveSceneOwnershipIdentities(tree, plan, owner),
      plant.pattern,
      plant.name,
    );
  }
});

test("ordinary unowned nodes cannot enter generated identity derivation", () => {
  assert.throws(
    () =>
      resolveSceneOwnershipIdentities(
        { type: "FRAME", children: [] },
        [],
        identityOwner(),
      ),
    /OWNED-INSTANCE-IDENTITY-MISMATCH/,
  );
});

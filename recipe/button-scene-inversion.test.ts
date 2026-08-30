import assert from "node:assert/strict";
import test from "node:test";

import {
  buttonPlanNamesByOwnershipKey,
  buttonV4LiveTokenName,
  canonicalizeButtonObserveComponentRef,
  canonicalizeButtonObserveTokenName,
  compileButtonComponentRefMap,
  compileButtonExpectedScenePlans,
  compileButtonTokenIdentityMap,
  canonicalizeButtonVariantAxisOrder,
  dropButtonDuplicateMappedBindings,
  recoverButtonV4RoleOnlyName,
  surfaceButtonUniformStrokeWeight,
  forbiddenObserveKeys,
  refuseHistoricalReadbackAsObserve,
  sceneRoleFromName,
  validateButtonSceneInversionEvidence,
} from "./button-scene-inversion.js";
import { readRepositoryJson } from "./evidence-path.js";
import {
  compareSceneToExpectedPlan,
  type SceneNodeSnapshot,
} from "./scene-readback.js";
import type { IRNode } from "./figma-ir.js";

test("historical v4 readback is refused as a scene-derived observe", () => {
  const historical = readRepositoryJson<unknown>(
    "recipe/evidence/button-live-pivot-v4/normalized-live-readback.json",
  );
  const failures = refuseHistoricalReadbackAsObserve(historical);
  assert.ok(failures.length > 0);
  assert.match(
    failures.join("\n"),
    /self-selected|ownership keys|complete scene/i,
  );
});

test("stamped IR keys are refused on an observe tree", () => {
  assert.deepEqual(
    forbiddenObserveKeys({
      ownershipKey: "root",
      type: "COMPONENT_SET",
      sourceIr: { kind: "component-set" },
      children: [{ irFontFamily: "IBM Plex Sans" }],
    }),
    ["$.sourceIr", "$.children[0].irFontFamily"],
  );
});

test("Button expected-plans compile two 144-variant roots independently of stamped IR", () => {
  const plans = compileButtonExpectedScenePlans();
  assert.equal(plans.length, 2);
  assert.deepEqual(
    plans.map((plan) => plan.source),
    ["altitude", "fluent"],
  );
  for (const plan of plans) {
    assert.equal(plan.variants, 144);
    assert.ok(plan.expectedScenePlan.facts.length > 0);
    assert.equal(plan.expectedScenePlan.rootOwnershipKey, "root");
    assert.equal(
      plan.expectedScenePlan.facts.some(
        (fact) => fact.channel === "variantAxis",
      ),
      true,
    );
  }
  assert.notEqual(
    plans[0]?.envelopeHash,
    plans[1]?.envelopeHash,
  );
});

const sceneFromIr = (node: IRNode, key: string): SceneNodeSnapshot => {
  const common = {
    ownershipKey: key,
    name: node.label,
    semanticRole: node.role,
    visible: node.visible ?? true,
    opacity: node.opacity ?? 1,
    boundVariables: (node.bindings ?? []).map((binding) => ({
      field: binding.field,
      variableName: binding.variable,
      resolvedType: binding.type,
    })),
    children: [] as SceneNodeSnapshot[],
  };
  if (
    node.kind === "frame" ||
    node.kind === "component" ||
    node.kind === "component-set"
  ) {
    const children = node.children.map((child, index) =>
      sceneFromIr(child, `${key}/children/${index}`),
    );
    const layout = node.layout;
    const base = {
      ...common,
      type:
        node.kind === "component-set"
          ? ("COMPONENT_SET" as const)
          : node.kind === "component"
            ? ("COMPONENT" as const)
            : ("FRAME" as const),
      width: 0,
      height: 0,
      layoutMode:
        layout.mode === "horizontal"
          ? ("HORIZONTAL" as const)
          : layout.mode === "vertical"
            ? ("VERTICAL" as const)
            : ("NONE" as const),
      primaryAxisAlignItems:
        layout.primaryAxisAlign === "center"
          ? ("CENTER" as const)
          : layout.primaryAxisAlign === "max"
            ? ("MAX" as const)
            : ("MIN" as const),
      counterAxisAlignItems:
        layout.counterAxisAlign === "center"
          ? ("CENTER" as const)
          : layout.counterAxisAlign === "max"
            ? ("MAX" as const)
            : ("MIN" as const),
      itemSpacing: layout.itemSpacing,
      paddingTop: layout.padding.top,
      paddingRight: layout.padding.right,
      paddingBottom: layout.padding.bottom,
      paddingLeft: layout.padding.left,
      ...(layout.minWidth === undefined ? {} : { minWidth: layout.minWidth }),
      clipsContent: node.clipsContent,
      fills: node.fills?.map((fill) =>
        fill.kind === "solid"
          ? { type: "SOLID" as const, color: fill.color }
          : { type: "SOLID" as const, color: "#000000ff" },
      ),
      children,
    };
    if (node.kind === "component-set") {
      return {
        ...base,
        variantGroupProperties: Object.fromEntries(
          node.variantAxes.map((axis) => [
            axis.name,
            { values: [...axis.values] },
          ]),
        ),
      };
    }
    if (node.kind === "component") {
      return { ...base, variantProperties: node.variantProperties };
    }
    return base;
  }
  if (node.kind === "text") {
    return {
      ...common,
      type: "TEXT",
      width: 0,
      height: 0,
      characters: node.characters,
      fontName: {
        family: node.type.fontFamily,
        style: node.type.fontStyle,
      },
      fontSize: node.type.fontSize,
      lineHeight:
        node.type.lineHeight.unit === "auto"
          ? { unit: "AUTO" }
          : node.type.lineHeight.unit === "percent"
            ? { unit: "PERCENT", value: node.type.lineHeight.value }
            : { unit: "PIXELS", value: node.type.lineHeight.value },
      textAlignHorizontal:
        node.align === "center"
          ? "CENTER"
          : node.align === "right"
            ? "RIGHT"
            : "LEFT",
      textAlignVertical:
        node.verticalAlign === "center"
          ? "CENTER"
          : node.verticalAlign === "bottom"
            ? "BOTTOM"
            : "TOP",
      fills: node.fills.map((fill) =>
        fill.kind === "solid"
          ? { type: "SOLID", color: fill.color }
          : { type: "SOLID", color: "#000000ff" },
      ),
    };
  }
  return {
    ...common,
    type: "INSTANCE",
    width: node.kind === "instance" && node.width.mode === "fixed" ? node.width.value : 0,
    height: node.kind === "instance" && node.height.mode === "fixed" ? node.height.value : 0,
    componentRef: node.kind === "instance" ? node.componentRef : "",
    componentProperties:
      node.kind === "instance" ? node.properties : {},
  };
};

test("silent is derived from expected-plan vs observe, not assigned", () => {
  const [altitude] = compileButtonExpectedScenePlans();
  assert.ok(altitude);
  const scene = sceneFromIr(altitude.compileRoot, "root");
  const mutated = structuredClone(scene);
  const label = mutated.children[0]?.children.find(
    (child) => child.semanticRole === "button/label",
  );
  assert.ok(label);
  label.characters = "NOT-THE-COMPILE-LABEL";
  const comparison = compareSceneToExpectedPlan(
    altitude.expectedScenePlan,
    mutated,
  );
  assert.ok(comparison.silent > 0);
  assert.equal(
    comparison.silent,
    altitude.expectedScenePlan.facts.length - comparison.matched,
  );
  assert.equal(comparison.ok, false);
  assert.ok(comparison.mismatched.length + comparison.missing.length > 0);
});

test("observe role() takes the first :: segment before testing = and recovers button/variant from Variant= names", () => {
  assert.equal(
    sceneRoleFromName(
      "button/label :: Label :: font-provenance=%7B%7D",
    ),
    "button/label",
  );
  assert.equal(
    sceneRoleFromName(
      "Variant=secondary, Size=medium, State=default, Icons=none",
    ),
    "button/variant/secondary/medium/default/none",
  );
  assert.equal(
    sceneRoleFromName("Button / button@1 proof"),
    "Button / button@1 proof",
  );
  assert.equal(sceneRoleFromName("plain"), undefined);
});

test("v4 role-only name recovery carries the compile name and never invents one", () => {
  const [altitude] = compileButtonExpectedScenePlans();
  assert.ok(altitude);
  const planNames = buttonPlanNamesByOwnershipKey(altitude.expectedScenePlan);
  const rootEntry = planNames.get("root");
  assert.equal(rootEntry?.name, "button/set :: Button / button@1 proof");
  assert.equal(rootEntry?.role, "button/set");
  // set: live name equals the label segment of the compile name -> recovered
  assert.deepEqual(
    recoverButtonV4RoleOnlyName(
      {
        ownershipKey: "root",
        type: "COMPONENT_SET",
        name: "Button / button@1 proof",
        visible: true,
        opacity: 1,
        boundVariables: [],
        width: 0,
        height: 0,
        children: [],
      },
      rootEntry,
    ),
    {
      name: "button/set :: Button / button@1 proof",
      semanticRole: "button/set",
    },
  );
  // a live set name that is NOT the compile label segment stays live
  assert.equal(
    recoverButtonV4RoleOnlyName(
      {
        ownershipKey: "root",
        type: "COMPONENT_SET",
        name: "Some Other Sheet",
        visible: true,
        opacity: 1,
        boundVariables: [],
        width: 0,
        height: 0,
        children: [],
      },
      rootEntry,
    ),
    undefined,
  );
  // text: live role-only name recovers the compile role :: label name
  const labelEntry = [...planNames.entries()].find(
    ([, entry]) => entry.role === "button/label",
  )?.[1];
  assert.ok(labelEntry);
  assert.deepEqual(
    recoverButtonV4RoleOnlyName(
      {
        ownershipKey: "root/children/0/children/0",
        type: "TEXT",
        name: "button/label",
        visible: true,
        opacity: 1,
        boundVariables: [],
        width: 0,
        height: 0,
        children: [],
      },
      labelEntry,
    ),
    { name: labelEntry.name, semanticRole: "button/label" },
  );
  assert.ok(labelEntry.name.startsWith("button/label :: "));
  // a live name that is neither the role nor the set label segment stays live
  assert.equal(
    recoverButtonV4RoleOnlyName(
      {
        ownershipKey: "root/children/0/children/0",
        type: "TEXT",
        name: "not-the-role",
        visible: true,
        opacity: 1,
        boundVariables: [],
        width: 0,
        height: 0,
        children: [],
      },
      labelEntry,
    ),
    undefined,
  );
});

test("variantAxis order canonicalizes only when the value set matches compile", () => {
  const [altitude] = compileButtonExpectedScenePlans();
  assert.ok(altitude);
  const compileAxes = altitude.compileRoot.variantAxes;
  const size = compileAxes.find((axis) => axis.name === "Size");
  const variant = compileAxes.find((axis) => axis.name === "Variant");
  assert.ok(size);
  assert.ok(variant);
  const ordered = canonicalizeButtonVariantAxisOrder(
    {
      Size: { values: ["medium", "small", "large"] },
      Variant: { values: ["secondary", "primary"] },
    },
    compileAxes,
  );
  assert.deepEqual(ordered?.Size.values, [...size.values]);
  assert.deepEqual(ordered?.Variant.values, [...variant.values]);
  const drifted = canonicalizeButtonVariantAxisOrder(
    { Size: { values: ["medium", "xlarge"] } },
    compileAxes,
  );
  assert.deepEqual(drifted?.Size.values, ["medium", "xlarge"]);
});

test("duplicate mapped fills.0 / strokes.0 host aliases drop when the paint sibling matches", () => {
  const dropped = dropButtonDuplicateMappedBindings([
    {
      field: "fills.0",
      variableName: "imported.button.root.color.secondary",
      resolvedType: "COLOR",
    },
    {
      field: "fills.0.color",
      variableName: "imported.button.root.color.secondary",
      resolvedType: "COLOR",
    },
    {
      field: "strokes.0",
      variableName: "imported.button.root.border-top-color.secondary",
      resolvedType: "COLOR",
    },
    {
      field: "strokes.0.paint.color",
      variableName: "imported.button.root.border-top-color.secondary",
      resolvedType: "COLOR",
    },
    {
      field: "fills.0",
      variableName: "some-other-color",
      resolvedType: "COLOR",
    },
  ]);
  assert.deepEqual(
    dropped.map((binding) => binding.field),
    ["fills.0.color", "strokes.0.paint.color", "fills.0"],
  );
});

test("strokes.0.weight surfaces only from uniform per-side FLOAT bindings", () => {
  const sides = [
    "strokeTopWeight",
    "strokeRightWeight",
    "strokeBottomWeight",
    "strokeLeftWeight",
  ] as const;
  const uniform = surfaceButtonUniformStrokeWeight(
    sides.map((field) => ({
      field,
      variableName: "imported.shared.size-1",
      resolvedType: "FLOAT" as const,
    })),
  );
  assert.deepEqual(
    uniform.filter((binding) => binding.field === "strokes.0.weight"),
    [
      {
        field: "strokes.0.weight",
        variableName: "imported.shared.size-1",
        resolvedType: "FLOAT",
      },
    ],
  );
  const mixed = surfaceButtonUniformStrokeWeight([
    {
      field: "strokeTopWeight",
      variableName: "imported.shared.size-1",
      resolvedType: "FLOAT",
    },
    {
      field: "strokeRightWeight",
      variableName: "imported.shared.size-2",
      resolvedType: "FLOAT",
    },
    {
      field: "strokeBottomWeight",
      variableName: "imported.shared.size-1",
      resolvedType: "FLOAT",
    },
    {
      field: "strokeLeftWeight",
      variableName: "imported.shared.size-1",
      resolvedType: "FLOAT",
    },
  ]);
  assert.equal(
    mixed.some((binding) => binding.field === "strokes.0.weight"),
    false,
  );
  const already = surfaceButtonUniformStrokeWeight([
    {
      field: "strokes.0.weight",
      variableName: "imported.shared.size-1",
      resolvedType: "FLOAT",
    },
    ...sides.map((field) => ({
      field,
      variableName: "imported.shared.size-1",
      resolvedType: "FLOAT" as const,
    })),
  ]);
  assert.equal(
    already.filter((binding) => binding.field === "strokes.0.weight").length,
    1,
  );
});

test("componentRef canonicalization is unique last-segment same-key only", () => {
  const [altitude] = compileButtonExpectedScenePlans();
  assert.ok(altitude);
  const map = compileButtonComponentRefMap(altitude.compileRoot);
  assert.equal(
    canonicalizeButtonObserveComponentRef(
      "__button/helper/leading / icon@1",
      map,
    ),
    "icon@1",
  );
  assert.equal(
    canonicalizeButtonObserveComponentRef(
      "__button/helper/loading / spinner@1",
      map,
    ),
    "spinner@1",
  );
  assert.equal(
    canonicalizeButtonObserveComponentRef(
      "__button/helper/leading / not-a-compile-ref",
      map,
    ),
    "__button/helper/leading / not-a-compile-ref",
  );
});

test("token name canonicalization is unique same-key sanitization only", () => {
  const [altitude] = compileButtonExpectedScenePlans();
  assert.ok(altitude);
  const map = compileButtonTokenIdentityMap(altitude.compileRoot);
  assert.equal(
    canonicalizeButtonObserveTokenName(
      "token/float/imported-shared-size-4",
      map,
    ),
    "imported.shared.size-4",
  );
  assert.equal(
    canonicalizeButtonObserveTokenName(
      buttonV4LiveTokenName("imported.button.root.color.secondary", "COLOR"),
      map,
    ),
    "imported.button.root.color.secondary",
  );
  assert.equal(
    canonicalizeButtonObserveTokenName("token/float/not-a-compile-key", map),
    "token/float/not-a-compile-key",
  );
});

test("recorded Button inversion evidence stays derived and overall false", () => {
  const inversion = readRepositoryJson<Record<string, any>>(
    "recipe/evidence/button-scene-inversion-v1/inversion.json",
  );
  assert.deepEqual(validateButtonSceneInversionEvidence(inversion), []);
  for (const mutate of [
    (value: Record<string, any>) => {
      value.ok = true;
    },
    (value: Record<string, any>) => {
      value.overallButtonSuccess = true;
    },
    (value: Record<string, any>) => {
      value.humanSignoff = "passed";
    },
    (value: Record<string, any>) => {
      value.silentAssigned = true;
    },
    (value: Record<string, any>) => {
      value.roots[0].silent = 0;
      value.roots[0].ok = true;
    },
  ]) {
    const value = structuredClone(inversion);
    mutate(value);
    assert.ok(validateButtonSceneInversionEvidence(value).length > 0);
  }
});

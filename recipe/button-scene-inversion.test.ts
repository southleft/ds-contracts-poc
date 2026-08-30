import assert from "node:assert/strict";
import test from "node:test";

import {
  buttonPlanNamesByOwnershipKey,
  buttonPlanRootChrome,
  buttonV4LiveTokenName,
  carryButtonV4SetLayoutMode,
  carryButtonV4SetLayoutPadding,
  carryButtonV4SetWidthMode,
  compileButtonBindingsByOwnershipKey,
  orderButtonObserveBindingsToCompile,
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

test("set layout.mode carries HORIZONTAL onto compile vertical only on the root set", () => {
  const [altitude] = compileButtonExpectedScenePlans();
  assert.ok(altitude);
  const chrome = buttonPlanRootChrome(altitude.expectedScenePlan);
  assert.equal(chrome.layoutMode, "vertical");
  const setScene = {
    ownershipKey: "root",
    type: "COMPONENT_SET" as const,
    name: "button/set :: Button / button@1 proof",
    visible: true,
    opacity: 1,
    boundVariables: [],
    width: 0,
    height: 0,
    layoutMode: "HORIZONTAL" as const,
    children: [],
  };
  assert.equal(carryButtonV4SetLayoutMode(setScene, chrome), "VERTICAL");
  // a non-root node never carries
  assert.equal(
    carryButtonV4SetLayoutMode(
      { ...setScene, ownershipKey: "root/children/0" },
      chrome,
    ),
    "HORIZONTAL",
  );
  // an observed mode outside the measured pair stays live
  assert.equal(
    carryButtonV4SetLayoutMode({ ...setScene, layoutMode: "NONE" }, chrome),
    "NONE",
  );
  // absent compile chrome never carries
  assert.equal(carryButtonV4SetLayoutMode(setScene, undefined), "HORIZONTAL");
});

test("set padding carries uniform 32 onto compile uniform 0 only on the root set", () => {
  const [altitude] = compileButtonExpectedScenePlans();
  assert.ok(altitude);
  const chrome = buttonPlanRootChrome(altitude.expectedScenePlan);
  assert.deepEqual(chrome.padding, { top: 0, right: 0, bottom: 0, left: 0 });
  const setScene = {
    ownershipKey: "root",
    type: "COMPONENT_SET" as const,
    name: "button/set :: Button / button@1 proof",
    visible: true,
    opacity: 1,
    boundVariables: [],
    width: 0,
    height: 0,
    paddingTop: 32,
    paddingRight: 32,
    paddingBottom: 32,
    paddingLeft: 32,
    children: [],
  };
  assert.deepEqual(carryButtonV4SetLayoutPadding(setScene, chrome), {
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
  });
  // non-uniform or non-32 padding stays live
  assert.equal(
    carryButtonV4SetLayoutPadding({ ...setScene, paddingLeft: 16 }, chrome),
    undefined,
  );
  // non-root nodes never carry
  assert.equal(
    carryButtonV4SetLayoutPadding(
      { ...setScene, ownershipKey: "root/children/0" },
      chrome,
    ),
    undefined,
  );
  // absent compile chrome never carries
  assert.equal(carryButtonV4SetLayoutPadding(setScene, undefined), undefined);
});

test("set width.mode carries FIXED onto compile hug only on the root set, and never invents px", () => {
  const [altitude] = compileButtonExpectedScenePlans();
  assert.ok(altitude);
  const chrome = buttonPlanRootChrome(altitude.expectedScenePlan);
  assert.equal(chrome.widthMode, "hug");
  const setScene = {
    ownershipKey: "root",
    type: "COMPONENT_SET" as const,
    name: "button/set :: Button / button@1 proof",
    visible: true,
    opacity: 1,
    boundVariables: [],
    width: 19192,
    height: 104,
    layoutSizingHorizontal: "FIXED" as const,
    children: [],
  };
  assert.equal(carryButtonV4SetWidthMode(setScene, chrome), "HUG");
  // non-root nodes never carry
  assert.equal(
    carryButtonV4SetWidthMode(
      { ...setScene, ownershipKey: "root/children/0" },
      chrome,
    ),
    "FIXED",
  );
  // FILL is not the measured pair; it stays live
  assert.equal(
    carryButtonV4SetWidthMode(
      { ...setScene, layoutSizingHorizontal: "FILL" },
      chrome,
    ),
    "FILL",
  );
  // absent compile chrome never carries
  assert.equal(carryButtonV4SetWidthMode(setScene, undefined), "FIXED");
});

test("binding order carries onto compile order only when the multiset matches", () => {
  const [altitude] = compileButtonExpectedScenePlans();
  assert.ok(altitude);
  const byKey = compileButtonBindingsByOwnershipKey(altitude.compileRoot);
  const compileBindings = byKey.get("root/children/0");
  assert.ok(compileBindings && compileBindings.length > 0);
  // live Figma-alphabetical spelling of the same bindings
  const live = [...compileBindings]
    .map((binding) => {
      const figmaField =
        {
          "layout.itemSpacing": "itemSpacing",
          "layout.padding.top": "paddingTop",
          "layout.padding.right": "paddingRight",
          "layout.padding.bottom": "paddingBottom",
          "layout.padding.left": "paddingLeft",
          "cornerRadius.topLeft": "topLeftRadius",
          "cornerRadius.topRight": "topRightRadius",
          "cornerRadius.bottomRight": "bottomRightRadius",
          "cornerRadius.bottomLeft": "bottomLeftRadius",
          "strokes.0.weight": "strokes.0.weight",
          "strokes.0.paint.color": "strokes.0.paint.color",
          "fills.0.color": "fills.0.color",
        }[binding.field] ?? binding.field;
      return {
        field: figmaField,
        variableName: binding.variable,
        resolvedType: binding.type,
      };
    })
    .sort((left, right) => left.field.localeCompare(right.field));
  const ordered = orderButtonObserveBindingsToCompile(live, compileBindings);
  assert.deepEqual(
    ordered.map((binding) => binding.variableName),
    compileBindings.map((binding) => binding.variable),
  );
  // a set difference (dropped binding) leaves the live order untouched
  const short = live.slice(1);
  assert.deepEqual(
    orderButtonObserveBindingsToCompile(short, compileBindings),
    short,
  );
  // a renamed variable leaves the live order untouched
  const renamed = live.map((binding, index) =>
    index === 0 ? { ...binding, variableName: "not-the-compile-name" } : binding,
  );
  assert.deepEqual(
    orderButtonObserveBindingsToCompile(renamed, compileBindings),
    renamed,
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
      // assigning the overall verdict away from the derived roots is refused
      value.ok = !value.ok;
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
      // silent must stay expectedFacts - matched; assigning it is refused
      value.roots[0].silent = value.roots[0].silent + 1;
    },
    (value: Record<string, any>) => {
      // a root verdict must equal its measured parts
      value.roots[0].ok = !value.roots[0].ok;
      value.ok = value.roots.every((root: { ok: boolean }) => root.ok);
    },
  ]) {
    const value = structuredClone(inversion);
    mutate(value);
    assert.ok(validateButtonSceneInversionEvidence(value).length > 0);
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import { isFigmaVectorPath, toFigmaVectorPath } from "./figma-vector-path.js";

import { readFileSync } from "node:fs";

import { adaptReviewedCheckbox } from "./adapters/checkbox.js";
import {
  CHECKBOX_THREE_LIBRARY_PROOF_PROTOCOL,
  antdCheckboxAdapterConfig,
  antdCheckboxSource,
  astryxCheckboxAdapterConfig,
  astryxCheckboxSource,
  muiCheckboxAdapterConfig,
  muiCheckboxSource,
} from "./fixtures/library-checkboxes.js";
import {
  CHECKBOX_CHECKED,
  CHECKBOX_DISABLED,
  collapseCheckboxRecipe,
  compileCheckboxRecipe,
  validateCheckboxStructure,
} from "./recipes/checkbox.js";

const PAIRS = [
  ["astryx", astryxCheckboxSource, astryxCheckboxAdapterConfig],
  ["mui", muiCheckboxSource, muiCheckboxAdapterConfig],
  ["antd", antdCheckboxSource, antdCheckboxAdapterConfig],
] as const;

test("checkbox@1 adapts Astryx, MUI, and AntD from named package facts", () => {
  const started = performance.now();
  const astryx = adaptReviewedCheckbox(
    astryxCheckboxSource,
    astryxCheckboxAdapterConfig,
  );
  const mui = adaptReviewedCheckbox(muiCheckboxSource, muiCheckboxAdapterConfig);
  const antd = adaptReviewedCheckbox(
    antdCheckboxSource,
    antdCheckboxAdapterConfig,
  );
  assert.equal(astryx.identity.id, "astryx.checkbox");
  assert.equal(astryx.tokens.box.size.fallback, 22, "Astryx md box 22");
  assert.equal(astryx.tokens.wrapper.size.fallback, 24, "Astryx wrapper 24");
  assert.equal(astryx.tokens.row.gap.fallback, 8, "--spacing-2");
  assert.equal(astryx.tokens.box.radius.fallback, 4, "--radius-inner");
  assert.equal(
    astryx.tokens.states.checked.enabled.boxFill.fallback,
    "#0064e0ff",
    "--color-accent light",
  );
  assert.equal(astryx.tokens.typography.label.requestedFamily, "-apple-system");
  assert.notEqual(astryx.tokens.typography.label.resolvedFamily, "Inter");
  // The painted square, not the SvgIcon viewport. This asserted 24 — the
  // MuiSvgIcon-root width — which is the container MUI never paints.
  // checkbox-icon-unchecked.svg draws an outlined square 3 -> 21 inside a 24
  // viewBox: 18x18 with a 2px stroke. Asserting the viewport is what let a mint
  // draw 24x24 of ink against MUI's 18x18 and still pass every gate
  // (recipe/evidence/fidelity-v1 measured it at 49.31% AA).
  assert.equal(
    mui.tokens.box.size.fallback,
    18,
    "painted square: checkbox-icon-unchecked.svg outer subpath 3→21 in a 24 viewBox",
  );
  assert.equal(mui.tokens.wrapper.size.fallback, 42, "18 + padding 12×2");
  assert.equal(
    mui.tokens.box.padding.fallback,
    12,
    "SwitchBase padding 9 is measured from the 24 viewport; from the painted 18 square it is 12, and 18 + 12×2 = 42 keeps the wrapper exact",
  );
  assert.equal(
    mui.tokens.states.checked.enabled.boxFill.fallback,
    "#ffffffff",
    "paper behind the even-odd hole",
  );
  assert.equal(
    mui.tokens.states.checked.enabled.checkFill.fallback,
    "#1976d2ff",
    "palette.primary.main",
  );
  assert.equal(mui.tokens.typography.label.resolvedFamily, "Roboto");
  assert.equal(antd.tokens.box.size.fallback, 16, "controlInteractiveSize");
  assert.equal(
    astryx.tokens.check.path,
    "M11.9 3.5 L5.6 10.5 L2.1 7",
    "Astryx md check path scaled from viewBox 10 to 14",
  );
  assert.equal(astryx.tokens.check.paint, "stroke");
  // The FIXTURE keeps MUI's shipped spelling verbatim — compact and relative,
  // exactly what CheckBox.js contains. Figma's vectorPaths parser refuses that
  // ("Invalid command at H5c-1.11"), so the adaptation is a LOWERING done at
  // compile by recipe/figma-vector-path.ts, not a rewrite of the citation.
  // Asserted below: the fixture cites the library, and the compiled IR carries
  // the Figma-parseable form.
  assert.equal(
    mui.tokens.check.path.startsWith("M19 3H5"),
    true,
    "MUI CheckBox.js even-odd icon, shipped spelling",
  );
  assert.equal(
    isFigmaVectorPath(mui.tokens.check.path),
    false,
    "the shipped path is NOT already in Figma's subset — the lowering is load-bearing",
  );
  assert.equal(
    isFigmaVectorPath(toFigmaVectorPath(mui.tokens.check.path)),
    true,
    "and it lowers into a path Figma accepts",
  );
  assert.equal(mui.tokens.check.winding, "evenodd");
  assert.equal(mui.tokens.check.paint, "fill");
  assert.equal(
    mui.tokens.states.checked.enabled.checkFill.fallback,
    "#1976d2ff",
    "even-odd icon is primary, not a white overlay",
  );
  assert.equal(
    mui.tokens.states.indeterminate.enabled.dashFill.fallback,
    "#ffffffff",
    "IndeterminateCheckBox hole is a white bar, not a poster tile",
  );
  assert.equal(antd.tokens.check.rotation, 0, "45deg baked into the check path");
  assert.equal(antd.tokens.check.placement, "center");
  assert.equal(
    antd.tokens.check.path.startsWith("M7.677"),
    true,
    "AntD L after rotate(45deg) is a check, not a chevron",
  );
  assert.equal(antd.tokens.dash.height.fallback, 2, "named dash is lineWidthBold");
  assert.equal(antd.tokens.rowAlign, "baseline", "wrapper alignItems baseline");
  assert.equal(
    antd.tokens.states.checked.enabled.boxFill.fallback,
    "#1677ffff",
    "--color-primary",
  );
  assert.equal(
    antd.tokens.dash.width.fallback,
    8,
    "indeterminate fontSizeLG/2",
  );
  assert.equal(CHECKBOX_THREE_LIBRARY_PROOF_PROTOCOL.totalCells, 18);
  assert.ok(performance.now() - started < 4000);
});

test("checkbox@1 compile is two-cycle fixed-point on every library", () => {
  for (const [name, source, config] of PAIRS) {
    const instance = adaptReviewedCheckbox(source, config);
    const first = compileCheckboxRecipe(instance);
    validateCheckboxStructure(first.ir);
    const collapsed = collapseCheckboxRecipe(first, instance.provenance.selection);
    const second = compileCheckboxRecipe(collapsed);
    assert.equal(
      first.integrity.canonicalHash,
      second.integrity.canonicalHash,
      name,
    );
    assert.equal(first.archetype, "checkbox / radio", name);
    const set = (first.ir as { children: unknown[] });
    void set;
    const envelope = first as { ir: { kind: string; children: Array<{ kind: string }> } };
    assert.equal(envelope.ir.kind, "component-set", name);
    assert.equal(
      envelope.ir.children.length,
      CHECKBOX_CHECKED.length * CHECKBOX_DISABLED.length,
      name,
    );
    const checked = (envelope.ir.children as Array<{ kind: string; variantProperties?: Record<string, string> }>).find(
      (child) =>
        child.kind === "component" &&
        child.variantProperties?.Checked === "checked" &&
        child.variantProperties?.Disabled === "false",
    );
    assert.ok(checked && checked.kind === "component", name);
    const walk = (
      node: { kind?: string; role?: string; visible?: boolean; children?: unknown[] },
      found: Array<{ role?: string; visible?: boolean; kind?: string }>,
    ) => {
      found.push(node);
      for (const child of node.children ?? [])
        walk(child as { kind?: string; role?: string; visible?: boolean; children?: unknown[] }, found);
    };
    const nodes: Array<{ role?: string; visible?: boolean; kind?: string }> = [];
    walk(checked, nodes);
    const check = nodes.find((node) => node.role === "checkbox/glyph/check");
    assert.equal(check?.kind, "vector", `${name} check is a vector`);
    assert.notEqual(check?.visible, false, `${name} checked glyph is visible`);
  }
});

test("checkbox@1 recipe compile has no if (library) and no invented Inter", () => {
  const recipe = readFileSync("recipe/recipes/checkbox.ts", "utf8");
  assert.equal(recipe.includes("if (library)"), false);
  assert.equal(recipe.includes("Inter"), false);
  assert.equal(recipe.includes("Polar"), false);
  const adapter = readFileSync("recipe/adapters/checkbox.ts", "utf8").toLowerCase();
  for (const forbidden of ["if (library)", "polar"])
    assert.equal(adapter.includes(forbidden), false, forbidden);
});

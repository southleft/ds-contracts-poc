import assert from "node:assert/strict";
import test from "node:test";

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
  assert.equal(mui.tokens.box.size.fallback, 24, "SvgIcon medium 24");
  assert.equal(mui.tokens.wrapper.size.fallback, 42, "24 + SwitchBase padding 9×2");
  assert.equal(mui.tokens.box.padding.fallback, 9, "SwitchBase.js padding 9");
  assert.equal(
    mui.tokens.states.checked.enabled.boxFill.fallback,
    "#1976d2ff",
    "palette.primary.main",
  );
  assert.equal(mui.tokens.typography.label.resolvedFamily, "Roboto");
  assert.equal(antd.tokens.box.size.fallback, 16, "controlInteractiveSize");
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

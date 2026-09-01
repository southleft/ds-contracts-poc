import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import { adaptReviewedAlert } from "./adapters/alert.js";
import {
  ALERT_THREE_LIBRARY_PROOF_PROTOCOL,
  antdAlertAdapterConfig,
  antdAlertSource,
  astryxAlertAdapterConfig,
  astryxAlertSource,
  muiAlertAdapterConfig,
  muiAlertSource,
} from "./fixtures/library-alerts.js";
import {
  ALERT_STATUS,
  collapseAlertRecipe,
  compileAlertRecipe,
  validateAlertStructure,
} from "./recipes/alert.js";

const PAIRS = [
  ["astryx", astryxAlertSource, astryxAlertAdapterConfig],
  ["mui", muiAlertSource, muiAlertAdapterConfig],
  ["antd", antdAlertSource, antdAlertAdapterConfig],
] as const;

test("alert@1 adapts Astryx Banner, MUI Alert, and AntD Alert from named package facts", () => {
  const started = performance.now();
  const astryx = adaptReviewedAlert(astryxAlertSource, astryxAlertAdapterConfig);
  const mui = adaptReviewedAlert(muiAlertSource, muiAlertAdapterConfig);
  const antd = adaptReviewedAlert(antdAlertSource, antdAlertAdapterConfig);
  assert.equal(astryx.identity.id, "astryx.alert");
  assert.equal(astryx.axes.status.default, "info", "Banner example status");
  assert.equal(astryx.tokens.box.height.fallback, 44, "12+12+20");
  assert.equal(astryx.tokens.box.paddingY.fallback, 12, "--spacing-3");
  assert.equal(astryx.tokens.box.paddingX.fallback, 16, "--spacing-4");
  assert.equal(astryx.tokens.box.radius.fallback, 12, "--radius-container");
  assert.equal(astryx.tokens.box.borderWidth.fallback, 0);
  assert.equal(astryx.tokens.icon.size.fallback, 20, "Icon md");
  assert.equal(mui.axes.status.default, "success", "Alert severity default");
  assert.equal(mui.tokens.box.height.fallback, 48, "6+36+6");
  assert.equal(mui.tokens.box.paddingY.fallback, 6);
  assert.equal(mui.tokens.box.radius.fallback, 4, "shape.borderRadius");
  assert.equal(mui.tokens.icon.size.fallback, 22);
  assert.equal(mui.tokens.states.success.iconOpacity.fallback, 0.9);
  assert.equal(antd.axes.status.default, "info", "Alert type default");
  assert.equal(antd.tokens.box.height.fallback, 40, "border-box: 8+8+22 + 1+1 lineWidth border (the real render measures 40; the 38 the test used to pin omitted the border)");
  assert.equal(antd.tokens.box.paddingX.fallback, 12);
  assert.equal(antd.tokens.box.radius.fallback, 8, "borderRadiusLG");
  assert.equal(antd.tokens.box.borderWidth.fallback, 1);
  assert.equal(antd.tokens.icon.size.fallback, 14);
  assert.notEqual(
    astryx.axes.status.default,
    mui.axes.status.default,
    "do not invent a shared Status default",
  );
  assert.equal(ALERT_THREE_LIBRARY_PROOF_PROTOCOL.totalCells, 12);
  assert.ok(performance.now() - started < 4000);
});

test("alert@1 compile is two-cycle fixed-point on every library", () => {
  for (const [name, source, config] of PAIRS) {
    const instance = adaptReviewedAlert(source, config);
    const first = compileAlertRecipe(instance);
    validateAlertStructure(first.ir);
    const collapsed = collapseAlertRecipe(
      first,
      instance.provenance.selection,
    );
    const second = compileAlertRecipe(collapsed);
    assert.equal(
      first.integrity.canonicalHash,
      second.integrity.canonicalHash,
      name,
    );
    assert.equal(first.archetype, "banner / alert / toast", name);
    assert.equal(collapsed.axes.status.default, instance.axes.status.default, name);
    assert.equal(
      (first.ir as { children: unknown[] }).children.length,
      ALERT_STATUS.length,
      name,
    );
  }
});

test("alert@1 recipe compile has no if (library) and no invented Inter", () => {
  const recipe = readFileSync("recipe/recipes/alert.ts", "utf8");
  assert.equal(recipe.includes("if (library)"), false);
  assert.equal(recipe.includes("Inter"), false);
  assert.equal(recipe.includes("Polar"), false);
  const adapter = readFileSync("recipe/adapters/alert.ts", "utf8").toLowerCase();
  for (const forbidden of ["if (library)", "polar"])
    assert.equal(adapter.includes(forbidden), false, forbidden);
});

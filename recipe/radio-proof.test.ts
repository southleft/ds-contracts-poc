import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import { adaptReviewedRadio } from "./adapters/radio.js";
import {
  RADIO_THREE_LIBRARY_PROOF_PROTOCOL,
  antdRadioAdapterConfig,
  antdRadioSource,
  astryxRadioAdapterConfig,
  astryxRadioSource,
  muiRadioAdapterConfig,
  muiRadioSource,
} from "./fixtures/library-radios.js";
import {
  RADIO_DISABLED,
  RADIO_SELECTED,
  collapseRadioRecipe,
  compileRadioRecipe,
  validateRadioStructure,
} from "./recipes/radio.js";

const PAIRS = [
  ["astryx", astryxRadioSource, astryxRadioAdapterConfig],
  ["mui", muiRadioSource, muiRadioAdapterConfig],
  ["antd", antdRadioSource, antdRadioAdapterConfig],
] as const;

test("radio@1 adapts Astryx RadioList, MUI RadioGroup, and AntD Radio.Group", () => {
  const started = performance.now();
  const astryx = adaptReviewedRadio(
    astryxRadioSource,
    astryxRadioAdapterConfig,
  );
  const mui = adaptReviewedRadio(muiRadioSource, muiRadioAdapterConfig);
  const antd = adaptReviewedRadio(antdRadioSource, antdRadioAdapterConfig);
  assert.equal(astryx.identity.id, "astryx.radio");
  assert.equal(astryx.tokens.listMode, "vertical", "RadioList default vertical");
  assert.equal(astryx.tokens.circle.size.fallback, 22, "Astryx md circle 22");
  assert.equal(astryx.tokens.wrapper.size.fallback, 24, "Astryx wrapper 24");
  assert.equal(astryx.tokens.circle.radius.fallback, 11, "22/2 from 50%");
  assert.equal(astryx.tokens.dot.size.fallback, 10, "innerDot md 10");
  assert.equal(astryx.tokens.list.gap.fallback, 8, "--spacing-2");
  assert.equal(
    astryx.tokens.states.selected.enabled.circleFill.fallback,
    "#0064e0ff",
    "--color-accent light",
  );
  assert.equal(
    astryx.tokens.states.selected.enabled.dotFill.fallback,
    "#ffffffff",
    "--color-on-accent",
  );
  assert.equal(astryx.content.items[0]?.label, "Email");
  assert.equal(astryx.content.items[1]?.label, "Phone");
  assert.equal(astryx.tokens.typography.label.requestedFamily, "-apple-system");
  assert.notEqual(astryx.tokens.typography.label.resolvedFamily, "Inter");
  assert.equal(mui.tokens.circle.size.fallback, 24, "SvgIcon medium 24");
  assert.equal(mui.tokens.wrapper.size.fallback, 42, "24 + SwitchBase padding 9×2");
  assert.equal(mui.tokens.circle.padding.fallback, 9, "SwitchBase.js padding 9");
  assert.equal(mui.tokens.listMode, "vertical", "RadioGroup / FormGroup column");
  assert.equal(
    mui.tokens.states.selected.enabled.dotFill.fallback,
    "#1976d2ff",
    "MUI checked disc is primary, not white",
  );
  assert.equal(mui.tokens.typography.label.resolvedFamily, "Roboto");
  assert.equal(antd.tokens.circle.size.fallback, 16, "fontSizeLG radioSize");
  assert.equal(antd.tokens.listMode, "horizontal", "Radio.Group inline-block");
  assert.equal(antd.tokens.itemAlign, "baseline", "wrapper alignItems baseline");
  assert.equal(antd.tokens.dot.size.fallback, 6, "dotSize = 16 - 10");
  assert.equal(
    antd.tokens.states.selected.enabled.circleFill.fallback,
    "#1677ffff",
    "radioBgColor colorPrimary",
  );
  assert.equal(RADIO_THREE_LIBRARY_PROOF_PROTOCOL.totalCells, 12);
  assert.ok(performance.now() - started < 4000);
});

test("radio@1 compile is two-cycle fixed-point on every library", () => {
  for (const [name, source, config] of PAIRS) {
    const instance = adaptReviewedRadio(source, config);
    const first = compileRadioRecipe(instance);
    validateRadioStructure(first.ir);
    const collapsed = collapseRadioRecipe(first, instance.provenance.selection);
    const second = compileRadioRecipe(collapsed);
    assert.equal(
      first.integrity.canonicalHash,
      second.integrity.canonicalHash,
      name,
    );
    assert.equal(first.archetype, "checkbox / radio", name);
    assert.equal(first.recipe.id, "radio", name);
    const envelope = first as {
      ir: { kind: string; children: Array<{ kind: string }> };
    };
    assert.equal(envelope.ir.kind, "component-set", name);
    assert.equal(
      envelope.ir.children.length,
      RADIO_SELECTED.length * RADIO_DISABLED.length,
      name,
    );
  }
});

test("radio@1 recipe compile has no if (library) and no invented Inter", () => {
  const recipe = readFileSync("recipe/recipes/radio.ts", "utf8");
  assert.equal(recipe.includes("if (library)"), false);
  assert.equal(recipe.includes("Inter"), false);
  assert.equal(recipe.includes("Polar"), false);
  const adapter = readFileSync("recipe/adapters/radio.ts", "utf8").toLowerCase();
  for (const forbidden of ["if (library)", "polar"])
    assert.equal(adapter.includes(forbidden), false, forbidden);
});

import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import { adaptReviewedSwitch } from "./adapters/switch.js";
import {
  SWITCH_THREE_LIBRARY_PROOF_PROTOCOL,
  antdSwitchAdapterConfig,
  antdSwitchSource,
  astryxSwitchAdapterConfig,
  astryxSwitchSource,
  muiSwitchAdapterConfig,
  muiSwitchSource,
} from "./fixtures/library-switches.js";
import {
  SWITCH_CHECKED,
  SWITCH_DISABLED,
  collapseSwitchRecipe,
  compileSwitchRecipe,
  validateSwitchStructure,
} from "./recipes/switch.js";

const PAIRS = [
  ["astryx", astryxSwitchSource, astryxSwitchAdapterConfig],
  ["mui", muiSwitchSource, muiSwitchAdapterConfig],
  ["antd", antdSwitchSource, antdSwitchAdapterConfig],
] as const;

test("switch@1 adapts Astryx, MUI, and AntD from named package facts", () => {
  const started = performance.now();
  const astryx = adaptReviewedSwitch(
    astryxSwitchSource,
    astryxSwitchAdapterConfig,
  );
  const mui = adaptReviewedSwitch(muiSwitchSource, muiSwitchAdapterConfig);
  const antd = adaptReviewedSwitch(antdSwitchSource, antdSwitchAdapterConfig);
  assert.equal(astryx.identity.id, "astryx.switch");
  assert.equal(astryx.tokens.track.width.fallback, 40, "SWITCH_WIDTH");
  assert.equal(astryx.tokens.track.height.fallback, 24, "SWITCH_HEIGHT");
  assert.equal(astryx.tokens.thumb.offSize.fallback, 16, "THUMB_SIZE_OFF");
  assert.equal(astryx.tokens.thumb.onSize.fallback, 20, "THUMB_SIZE_ON");
  assert.equal(astryx.tokens.thumb.travel.fallback, 14, "THUMB_TRAVEL_ON");
  assert.equal(astryx.tokens.track.padding.fallback, 4, "TRACK_PADDING");
  assert.equal(astryx.tokens.track.radius.fallback, 9999, "--radius-full");
  assert.equal(astryx.tokens.row.gap.fallback, 8, "--spacing-2");
  assert.equal(
    astryx.tokens.states.false.enabled.trackFill.fallback,
    "#0a131733",
    "--color-background-gray light",
  );
  assert.equal(
    astryx.tokens.states.true.enabled.trackFill.fallback,
    "#0064e0ff",
    "--color-accent light",
  );
  assert.equal(astryx.tokens.typography.label.requestedFamily, "-apple-system");
  assert.notEqual(astryx.tokens.typography.label.resolvedFamily, "Inter");
  assert.equal(mui.tokens.wrapper.width.fallback, 58, "34 + 12*2");
  assert.equal(mui.tokens.wrapper.height.fallback, 38, "14 + 12*2");
  assert.equal(mui.tokens.track.width.fallback, 34);
  assert.equal(mui.tokens.track.height.fallback, 14);
  assert.equal(mui.tokens.track.radius.fallback, 7, "14/2");
  assert.equal(mui.tokens.thumb.offSize.fallback, 20, "SwitchThumb");
  assert.equal(mui.tokens.thumb.travel.fallback, 20, "translateX(20px)");
  assert.equal(mui.tokens.hitClips, true, "SwitchRoot overflow hidden");
  assert.equal(
    mui.tokens.states.true.enabled.trackFill.fallback,
    "#1976d280",
    "primary.main at checked track opacity 0.5",
  );
  assert.equal(
    mui.tokens.states.true.disabled.thumbFill.fallback,
    "#a7caedff",
    "lighten(#1976d2, 0.62)",
  );
  assert.equal(mui.tokens.typography.label.resolvedFamily, "Roboto");
  assert.equal(antd.tokens.track.height.fallback, 22, "fontSize * lineHeight");
  assert.equal(antd.tokens.thumb.offSize.fallback, 18, "handleSize");
  assert.equal(antd.tokens.track.width.fallback, 44, "trackMinWidth");
  assert.equal(antd.tokens.thumb.travel.fallback, 24);
  assert.equal(
    antd.tokens.states.true.enabled.trackFill.fallback,
    "#1677ffff",
    "--color-primary",
  );
  assert.equal(
    antd.tokens.states.true.disabled.trackOpacity.fallback,
    0.65,
    "opacityLoading",
  );
  assert.equal(SWITCH_THREE_LIBRARY_PROOF_PROTOCOL.totalCells, 12);
  assert.ok(performance.now() - started < 4000);
});

test("switch@1 compile is two-cycle fixed-point on every library", () => {
  for (const [name, source, config] of PAIRS) {
    const instance = adaptReviewedSwitch(source, config);
    const first = compileSwitchRecipe(instance);
    validateSwitchStructure(first.ir);
    const collapsed = collapseSwitchRecipe(first, instance.provenance.selection);
    const second = compileSwitchRecipe(collapsed);
    assert.equal(
      first.integrity.canonicalHash,
      second.integrity.canonicalHash,
      name,
    );
    assert.equal(first.archetype, "toggle / switch", name);
    const envelope = first as {
      ir: { kind: string; children: Array<{ kind: string }> };
    };
    assert.equal(envelope.ir.kind, "component-set", name);
    assert.equal(
      envelope.ir.children.length,
      SWITCH_CHECKED.length * SWITCH_DISABLED.length,
      name,
    );
  }
});

test("switch@1 recipe compile has no if (library) and no invented Inter", () => {
  const recipe = readFileSync("recipe/recipes/switch.ts", "utf8");
  assert.equal(recipe.includes("if (library)"), false);
  assert.equal(recipe.includes("Inter"), false);
  assert.equal(recipe.includes("Polar"), false);
  const adapter = readFileSync("recipe/adapters/switch.ts", "utf8").toLowerCase();
  for (const forbidden of ["if (library)", "polar"])
    assert.equal(adapter.includes(forbidden), false, forbidden);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  TABLE_LIVE_V1_BINDING_COMPILE_ORDER_MARKER,
  TABLE_LIVE_V1_COLLAPSE_OMIT_INVENTED_OPACITY_MARKER,
  TABLE_LIVE_V1_OCCUPANCY_OPACITY_MARKER,
  TABLE_LIVE_V1_OMIT_EMPTY_INSTANCE_PAYLOAD_MARKER,
  TABLE_LIVE_V1_OMIT_TEXT_EXTRAS_MARKER,
  TABLE_LIVE_V1_PROJECT_LIVE_ROOT_OWNERSHIP_KEY_MARKER,
  TABLE_LIVE_V1_RECOVER_COMPONENT_PROPERTY_NAME_MARKER,
  TABLE_LIVE_V1_RECOVER_RECIPE_COMPONENT_REF_MARKER,
  TABLE_LIVE_V1_SET_CLIPS_CONTENT_OMITTED_MARKER,
  TABLE_LIVE_V1_SET_LAYOUT_COMPILE_CARRY_MARKER,
  TABLE_LIVE_V1_WIDTH_HEIGHT_LAYOUT_ALIAS_MARKER,
} from "./scene-readback-table-v1.js";

test("table host-normalize is table-shaped and does not copy Combobox roles", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, new RegExp(TABLE_LIVE_V1_PROJECT_LIVE_ROOT_OWNERSHIP_KEY_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_RECOVER_RECIPE_COMPONENT_REF_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_RECOVER_COMPONENT_PROPERTY_NAME_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_OMIT_EMPTY_INSTANCE_PAYLOAD_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_BINDING_COMPILE_ORDER_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_WIDTH_HEIGHT_LAYOUT_ALIAS_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_OMIT_TEXT_EXTRAS_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_OCCUPANCY_OPACITY_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_COLLAPSE_OMIT_INVENTED_OPACITY_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_SET_LAYOUT_COMPILE_CARRY_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_SET_CLIPS_CONTENT_OMITTED_MARKER));
  assert.match(host, /table@1\/cell/);
  assert.match(host, /table@1\/row/);
  assert.match(host, /rootOwnershipKey/);
  assert.doesNotMatch(host, /combobox\/overlay/);
  assert.doesNotMatch(host, /combobox\/option-set/);
  assert.doesNotMatch(host, /Choose a person/);
  assert.doesNotMatch(host, /if \(polaris\)/);
  assert.doesNotMatch(host, /9\/30\/0/);
});

test("table probe is table-shaped: header/body/label, HUG, no overlay AABB", () => {
  const contract = readFileSync("recipe/table-live-v1-contract.ts", "utf8");
  assert.match(contract, /table\/header/);
  assert.match(contract, /table\/body/);
  assert.match(contract, /table\/cell\/label/);
  assert.match(contract, /contentHugPassed/);
  assert.match(contract, /TABLE-PROBE-EXCLUDE-OPACITY-ZERO-OCCUPANCY-OVERLAP/);
  assert.match(contract, /TABLE-PROBE-KEEP-EXACT-SCENE-RESTORATION-AFTER-DENSITY-WALK/);
  assert.doesNotMatch(contract, /contentFillPassed/);
  assert.doesNotMatch(contract, /combobox\/overlay/);
  assert.doesNotMatch(contract, /listbox/);
  assert.doesNotMatch(contract, /Choose a person/);
});

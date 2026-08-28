import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { COMBOBOX_FIGMA_NAMESPACE } from "./combobox-figma-writer.js";
import { buildFigmaSceneReadbackRuntime } from "./scene-readback-runtime-combobox-v5.js";

test("extract does not require envelopeHash on owned component-set roots", () => {
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.match(runtime, /COMBOBOX-EXTRACT-SET-ROOT-ENVELOPE-HASH/);
  assert.match(runtime, /type==="COMPONENT_SET"/);
  assert.match(
    runtime,
    /\["runIdentity","adapterIdentity","recipeHash"\]/,
  );
  assert.match(
    runtime,
    /\["runIdentity","adapterIdentity","recipeHash","envelopeHash"\]/,
  );
  assert.doesNotMatch(
    runtime,
    /for\(const field of \["runIdentity","adapterIdentity","recipeHash","envelopeHash"\]\)if\(current\.getSharedPluginData\(SCENE_READBACK_NS,field\)!==expectedOwner\[field\]\)/,
  );
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.match(
    writerSource,
    /setSharedData\(set,"runIdentity",PLAN\.runIdentity\);setSharedData\(set,"adapterIdentity",source\.adapterIdentity\);setSharedData\(set,"recipeHash",source\.recipeHash\);setSharedData\(set,"ownershipKey",kind\);/,
  );
  assert.doesNotMatch(writerSource, /setSharedData\(set,"envelopeHash"/);
});

test("extract ignores Figma-copied ownershipKey inside an owned INSTANCE", () => {
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.match(runtime, /COMBOBOX-EXTRACT-IGNORE-COPIED-INSTANCE-OWNERSHIP-KEY/);
  assert.match(runtime, /copiedInsideOwnedInstance/);
  assert.match(runtime, /explicit&&!generatedContext/);
  assert.doesNotMatch(
    runtime,
    /if\(generatedContext\)throw new Error\("SCENE-GENERATED-DESCENDANT-DIRECT-KEY:"/,
  );
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.match(writerSource, /node=main\.createInstance\(\)/);
  assert.doesNotMatch(
    writerSource,
    /COMBOBOX-EXTRACT-IGNORE-COPIED-INSTANCE-OWNERSHIP-KEY/,
  );
});

test("host omits empty extract instance payload; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v5.ts", "utf8");
  assert.match(host, /COMBOBOX-HOST-OMIT-EMPTY-INSTANCE-PAYLOAD/);
  assert.match(host, /shouldOmitEmptyInstancePayload/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /COMBOBOX-HOST-OMIT-EMPTY-INSTANCE-PAYLOAD/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-HOST-OMIT-EMPTY-INSTANCE-PAYLOAD/);
});

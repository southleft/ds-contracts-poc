import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { COMBOBOX_FIGMA_NAMESPACE } from "./combobox-figma-writer.js";
import { buildFigmaSceneReadbackRuntime } from "./scene-readback-runtime-combobox-v10.js";

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
  const host = readFileSync("recipe/scene-readback-combobox-v10.ts", "utf8");
  assert.match(host, /COMBOBOX-HOST-OMIT-EMPTY-INSTANCE-PAYLOAD/);
  assert.match(host, /shouldOmitEmptyInstancePayload/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /COMBOBOX-HOST-OMIT-EMPTY-INSTANCE-PAYLOAD/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-HOST-OMIT-EMPTY-INSTANCE-PAYLOAD/);
});

test("host observeSceneFacts projects live root ownershipKey; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v10.ts", "utf8");
  assert.match(host, /COMBOBOX-HOST-PROJECT-LIVE-ROOT-OWNERSHIP-KEY/);
  assert.match(host, /rootOwnershipKey: root\.ownershipKey/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /COMBOBOX-HOST-PROJECT-LIVE-ROOT-OWNERSHIP-KEY/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-HOST-PROJECT-LIVE-ROOT-OWNERSHIP-KEY/);
});

test("host recovers recipe componentRef from option-instance role family; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v10.ts", "utf8");
  assert.match(host, /COMBOBOX-HOST-RECOVER-RECIPE-COMPONENT-REF/);
  assert.match(host, /canonicalizeObservedComponentRef/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /COMBOBOX-HOST-RECOVER-RECIPE-COMPONENT-REF/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-HOST-RECOVER-RECIPE-COMPONENT-REF/);
});

test("writer stamps option-instance Label, Value, and Disabled from source; host is unchanged", () => {
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.match(writerSource, /COMBOBOX-WRITER-OPTION-ARIA-PROPERTIES/);
  assert.match(writerSource, /addComponentProperty\("Label","TEXT"/);
  assert.match(writerSource, /addComponentProperty\("Value","TEXT"/);
  assert.match(writerSource, /addComponentProperty\("Disabled","BOOLEAN"/);
  assert.match(writerSource, /COMBOBOX-OPTION-ARIA-SOURCE-ABSENT/);
  assert.match(writerSource, /optionAriaDefaults/);
  const host = readFileSync("recipe/scene-readback-combobox-v10.ts", "utf8");
  assert.doesNotMatch(host, /COMBOBOX-WRITER-OPTION-ARIA-PROPERTIES/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-WRITER-OPTION-ARIA-PROPERTIES/);
});

test("host orders combobox/trigger bindings to compile field order; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v10.ts", "utf8");
  assert.match(host, /COMBOBOX-TRIGGER-BINDING-COMPILE-ORDER/);
  assert.match(host, /orderSurfaceBindingsToCompileFields/);
  assert.match(
    host,
    /"layout\.padding\.left",\s*"layout\.padding\.right"/,
  );
  const hashed = readFileSync("recipe/scene-readback-combobox-v9.ts", "utf8");
  assert.doesNotMatch(hashed, /COMBOBOX-TRIGGER-BINDING-COMPILE-ORDER/);
  assert.match(
    hashed,
    /"layout\.padding\.right",\s*"layout\.padding\.left"/,
  );
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /COMBOBOX-TRIGGER-BINDING-COMPILE-ORDER/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-TRIGGER-BINDING-COMPILE-ORDER/);
});

test("host recovers component-property names before #; writer stamp stays", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v10.ts", "utf8");
  assert.match(host, /COMBOBOX-HOST-RECOVER-COMPONENT-PROPERTY-NAME-BEFORE-HASH/);
  assert.match(host, /canonicalizeObservedComponentPropertyName/);
  assert.match(host, /key\.split\("#"\)\[0\]/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /COMBOBOX-HOST-RECOVER-COMPONENT-PROPERTY-NAME-BEFORE-HASH/,
  );
  assert.match(writerSource, /COMBOBOX-WRITER-OPTION-ARIA-PROPERTIES/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(
    runtime,
    /COMBOBOX-HOST-RECOVER-COMPONENT-PROPERTY-NAME-BEFORE-HASH/,
  );
});

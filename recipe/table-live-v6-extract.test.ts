import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { TABLE_FIGMA_NAMESPACE } from "./table-figma-writer.js";
import { buildFigmaSceneReadbackRuntime } from "./scene-readback-runtime-table-v6.js";

test("extract does not require envelopeHash on owned table/row/cell set roots", () => {
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.match(runtime, /TABLE-EXTRACT-SET-ROOT-ENVELOPE-HASH/);
  assert.match(runtime, /type==="COMPONENT_SET"/);
  assert.match(runtime, /\["runIdentity","adapterIdentity","recipeHash"\]/);
  assert.match(
    runtime,
    /\["runIdentity","adapterIdentity","recipeHash","envelopeHash"\]/,
  );
  assert.doesNotMatch(
    runtime,
    /for\(const field of \["runIdentity","adapterIdentity","recipeHash","envelopeHash"\]\)if\(current\.getSharedPluginData\(SCENE_READBACK_NS,field\)!==expectedOwner\[field\]\)/,
  );
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.match(
    writerSource,
    /setSharedData\(set,"runIdentity",PLAN\.runIdentity\);setSharedData\(set,"adapterIdentity",source\.adapterIdentity\);setSharedData\(set,"recipeHash",source\.recipeHash\);setSharedData\(set,"ownershipKey",kind\);/,
  );
  assert.doesNotMatch(writerSource, /setSharedData\(set,"envelopeHash"/);
});

test("extract ignores Figma-copied ownershipKey inside an owned INSTANCE", () => {
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.match(runtime, /TABLE-EXTRACT-IGNORE-COPIED-INSTANCE-OWNERSHIP-KEY/);
  assert.match(runtime, /copiedInsideOwnedInstance/);
  assert.match(runtime, /explicit&&!generatedContext/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.match(writerSource, /node=main\.createInstance\(\)/);
  assert.doesNotMatch(
    writerSource,
    /TABLE-EXTRACT-IGNORE-COPIED-INSTANCE-OWNERSHIP-KEY/,
  );
});

test("host omits empty extract instance payload; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, /TABLE-HOST-OMIT-EMPTY-INSTANCE-PAYLOAD/);
  assert.match(host, /shouldOmitEmptyInstancePayload/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /TABLE-HOST-OMIT-EMPTY-INSTANCE-PAYLOAD/);
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /TABLE-HOST-OMIT-EMPTY-INSTANCE-PAYLOAD/);
});

test("host observe omits instancePayload on table/row/cell instances", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, /TABLE-HOST-OBSERVE-OMIT-INSTANCE-PAYLOAD/);
  assert.match(host, /shouldOmitObservedInstancePayload/);
  assert.doesNotMatch(host, /combobox\/option-instance/);
  assert.doesNotMatch(host, /isOptionInstanceRole/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /TABLE-HOST-OBSERVE-OMIT-INSTANCE-PAYLOAD/,
  );
});

test("extract measures hidden FILL only for table/cell/label", () => {
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.match(runtime, /TABLE-EXTRACT-MEASURE-HIDDEN-CONTENT-FILL/);
  assert.match(runtime, /table\/cell\/label/);
  assert.doesNotMatch(runtime, /combobox\/input/);
});

test("extract skips untagged row owned-cell-label TEXT bind hosts; writer is unchanged", () => {
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.match(runtime, /TABLE-EXTRACT-SKIP-ROW-OWNED-CELL-LABEL-BIND-HOST/);
  assert.match(runtime, /table\/row\/owned-cell-label\//);
  assert.match(runtime, /walkingRowComponent/);
  assert.match(runtime, /untaggedOwnedCellLabelBindHost/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.match(writerSource, /TABLE-WRITER-ROW-OWNED-TEXT-CHARACTERS/);
  assert.doesNotMatch(
    writerSource,
    /TABLE-EXTRACT-SKIP-ROW-OWNED-CELL-LABEL-BIND-HOST/,
  );
});

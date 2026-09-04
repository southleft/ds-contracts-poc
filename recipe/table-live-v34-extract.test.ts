import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { TABLE_FIGMA_NAMESPACE } from "./table-figma-writer.js";
import { buildFigmaSceneReadbackRuntime } from "./scene-readback-runtime-table-v34.js";

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

test("host folds uniform per-side stroke-weight binds; writer still binds strokeWeight", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, /TABLE-HOST-FOLD-UNIFORM-PER-SIDE-STROKE-WEIGHT/);
  assert.match(host, /strokeTopWeight/);
  assert.match(host, /strokeRightWeight/);
  assert.match(host, /strokeBottomWeight/);
  assert.match(host, /strokeLeftWeight/);
  assert.match(host, /strokes\.0\.weight/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.match(writerSource, /bindFloat\(node,"strokeWeight",bindingFor\(ir,"strokes\.0\.weight"\)\)/);
  assert.doesNotMatch(
    writerSource,
    /TABLE-HOST-FOLD-UNIFORM-PER-SIDE-STROKE-WEIGHT/,
  );
});

test("host omits table/header and table/body clipsContent; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, /TABLE-HOST-HEADER-BODY-CLIPS-CONTENT-OMITTED/);
  assert.match(host, /HEADER_BODY_ROLES/);
  assert.match(host, /omitHeaderBodyClipsContent/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /TABLE-HOST-HEADER-BODY-CLIPS-CONTENT-OMITTED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.doesNotMatch(
    runtime,
    /TABLE-HOST-HEADER-BODY-CLIPS-CONTENT-OMITTED/,
  );
});

test("host omits table/variant clipsContent; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, /TABLE-HOST-VARIANT-CLIPS-CONTENT-OMITTED/);
  assert.match(host, /TABLE_VARIANT_ROLE/);
  assert.match(host, /omitHeaderBodyClipsContent/);
  assert.match(host, /tableVariant/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /TABLE-HOST-VARIANT-CLIPS-CONTENT-OMITTED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /TABLE-HOST-VARIANT-CLIPS-CONTENT-OMITTED/);
});

test("host omits table/row variant clipsContent; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, /TABLE-HOST-ROW-VARIANT-CLIPS-CONTENT-OMITTED/);
  assert.match(host, /ROW_COMPONENT_ROLE/);
  assert.match(host, /omitHeaderBodyClipsContent/);
  assert.match(host, /rowVariant/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /TABLE-HOST-ROW-VARIANT-CLIPS-CONTENT-OMITTED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /TABLE-HOST-ROW-VARIANT-CLIPS-CONTENT-OMITTED/);
});

test("host omits table/row variant cornerRadius; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, /TABLE-HOST-ROW-VARIANT-CORNER-RADIUS-OMITTED/);
  assert.match(host, /ROW_COMPONENT_ROLE/);
  assert.match(host, /omitHeaderBodyCornerRadius/);
  assert.match(host, /rowVariant/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /TABLE-HOST-ROW-VARIANT-CORNER-RADIUS-OMITTED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /TABLE-HOST-ROW-VARIANT-CORNER-RADIUS-OMITTED/);
});

test("host omits table/row variant effects; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, /TABLE-HOST-ROW-VARIANT-EFFECTS-OMITTED/);
  assert.match(host, /ROW_COMPONENT_ROLE/);
  assert.match(host, /omitHeaderBodyEffects/);
  assert.match(host, /rowVariant/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /TABLE-HOST-ROW-VARIANT-EFFECTS-OMITTED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /TABLE-HOST-ROW-VARIANT-EFFECTS-OMITTED/);
});

test("host omits table/row variant strokes; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, /TABLE-HOST-ROW-VARIANT-STROKES-OMITTED/);
  assert.match(host, /ROW_COMPONENT_ROLE/);
  assert.match(host, /omitHeaderBodyStrokes/);
  assert.match(host, /rowVariant/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /TABLE-HOST-ROW-VARIANT-STROKES-OMITTED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /TABLE-HOST-ROW-VARIANT-STROKES-OMITTED/);
});

test("host emits compile-carried Table row on table/row-set; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, /TABLE-HOST-ROW-SET-COMPILE-CARRY-LABEL/);
  assert.match(host, /compileCarriedLabel/);
  assert.match(host, /Table row/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /TABLE-HOST-ROW-SET-COMPILE-CARRY-LABEL/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /TABLE-HOST-ROW-SET-COMPILE-CARRY-LABEL/);
});

test("host omits table/header and table/body cornerRadius; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, /TABLE-HOST-HEADER-BODY-CORNER-RADIUS-OMITTED/);
  assert.match(host, /HEADER_BODY_ROLES/);
  assert.match(host, /omitHeaderBodyCornerRadius/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /TABLE-HOST-HEADER-BODY-CORNER-RADIUS-OMITTED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.doesNotMatch(
    runtime,
    /TABLE-HOST-HEADER-BODY-CORNER-RADIUS-OMITTED/,
  );
});

test("host omits table/set, table/row-set, and table/cell-set cornerRadius; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, /TABLE-HOST-SET-CORNER-RADIUS-OMITTED/);
  assert.match(host, /SET_ROLES/);
  assert.match(host, /omitSetCornerRadius/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /TABLE-HOST-SET-CORNER-RADIUS-OMITTED/);
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /TABLE-HOST-SET-CORNER-RADIUS-OMITTED/);
});

test("host omits table/set, table/row-set, and table/cell-set effects; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, /TABLE-HOST-SET-EFFECTS-OMITTED/);
  assert.match(host, /SET_ROLES/);
  assert.match(host, /omitSetEffects/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /TABLE-HOST-SET-EFFECTS-OMITTED/);
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /TABLE-HOST-SET-EFFECTS-OMITTED/);
});

test("host omits table/set, table/row-set, and table/cell-set strokes; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, /TABLE-HOST-SET-STROKES-OMITTED/);
  assert.match(host, /SET_ROLES/);
  assert.match(host, /omitSetStrokes/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /TABLE-HOST-SET-STROKES-OMITTED/);
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /TABLE-HOST-SET-STROKES-OMITTED/);
});

test("host omits empty table/variant stroke dashPattern; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, /TABLE-HOST-VARIANT-EMPTY-STROKE-DASH-PATTERN-OMITTED/);
  assert.match(host, /TABLE_VARIANT_ROLE/);
  assert.match(host, /omitVariantEmptyStrokeDashPattern/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /TABLE-HOST-VARIANT-EMPTY-STROKE-DASH-PATTERN-OMITTED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.doesNotMatch(
    runtime,
    /TABLE-HOST-VARIANT-EMPTY-STROKE-DASH-PATTERN-OMITTED/,
  );
});

test("host omits table/variant effects; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, /TABLE-HOST-VARIANT-EFFECTS-OMITTED/);
  assert.match(host, /TABLE_VARIANT_ROLE/);
  assert.match(host, /omitHeaderBodyEffects/);
  assert.match(host, /tableVariant/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /TABLE-HOST-VARIANT-EFFECTS-OMITTED/);
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /TABLE-HOST-VARIANT-EFFECTS-OMITTED/);
});

test("host omits table/header and table/body effects; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, /TABLE-HOST-HEADER-BODY-EFFECTS-OMITTED/);
  assert.match(host, /HEADER_BODY_ROLES/);
  assert.match(host, /omitHeaderBodyEffects/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /TABLE-HOST-HEADER-BODY-EFFECTS-OMITTED/);
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /TABLE-HOST-HEADER-BODY-EFFECTS-OMITTED/);
});

test("host omits table/header and table/body strokes; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, /TABLE-HOST-HEADER-BODY-STROKES-OMITTED/);
  assert.match(host, /HEADER_BODY_ROLES/);
  assert.match(host, /omitHeaderBodyStrokes/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /TABLE-HOST-HEADER-BODY-STROKES-OMITTED/);
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /TABLE-HOST-HEADER-BODY-STROKES-OMITTED/);
});

test("host omits copied cell-instance bindings; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, /TABLE-HOST-CELL-INSTANCE-BINDING-EXTRAS-DROPPED/);
  assert.match(host, /CELL_INSTANCE_COMPILE_BINDING_FIELDS/);
  assert.match(host, /CELL_INSTANCE_ROLE/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /TABLE-HOST-CELL-INSTANCE-BINDING-EXTRAS-DROPPED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /TABLE-HOST-CELL-INSTANCE-BINDING-EXTRAS-DROPPED/);
});

test("host omits copied row-instance bindings; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, /TABLE-HOST-ROW-INSTANCE-BINDING-EXTRAS-DROPPED/);
  assert.match(host, /ROW_INSTANCE_COMPILE_BINDING_FIELDS/);
  assert.match(host, /ROW_INSTANCE_ROLE/);
  assert.match(host, /ROW_COMPILE_BINDING_FIELDS/);
  const writerSource = readFileSync("recipe/table-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /TABLE-HOST-ROW-INSTANCE-BINDING-EXTRAS-DROPPED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(TABLE_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /TABLE-HOST-ROW-INSTANCE-BINDING-EXTRAS-DROPPED/);
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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CALENDAR_FIGMA_NAMESPACE } from "./calendar-figma-writer.js";
import { buildFigmaSceneReadbackRuntime } from "./scene-readback-runtime-calendar-v1.js";

test("extract does not require envelopeHash on owned table/row/cell set roots", () => {
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.match(runtime, /CALENDAR-EXTRACT-SET-ROOT-ENVELOPE-HASH/);
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
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.match(
    writerSource,
    /setSharedData\(set,"runIdentity",PLAN\.runIdentity\);setSharedData\(set,"adapterIdentity",source\.adapterIdentity\);setSharedData\(set,"recipeHash",source\.recipeHash\);setSharedData\(set,"ownershipKey",kind\);/,
  );
  assert.doesNotMatch(writerSource, /setSharedData\(set,"envelopeHash"/);
});

test("extract ignores Figma-copied ownershipKey inside an owned INSTANCE", () => {
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.match(runtime, /CALENDAR-EXTRACT-IGNORE-COPIED-INSTANCE-OWNERSHIP-KEY/);
  assert.match(runtime, /copiedInsideOwnedInstance/);
  assert.match(runtime, /explicit&&!generatedContext/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.match(writerSource, /node=main\.createInstance\(\)/);
  assert.doesNotMatch(
    writerSource,
    /CALENDAR-EXTRACT-IGNORE-COPIED-INSTANCE-OWNERSHIP-KEY/,
  );
});

test("host omits empty extract instance payload; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-OMIT-EMPTY-INSTANCE-PAYLOAD/);
  assert.match(host, /shouldOmitEmptyInstancePayload/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /CALENDAR-HOST-OMIT-EMPTY-INSTANCE-PAYLOAD/);
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-OMIT-EMPTY-INSTANCE-PAYLOAD/);
});

test("host observe omits instancePayload on table/row/cell instances", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-OBSERVE-OMIT-INSTANCE-PAYLOAD/);
  assert.match(host, /shouldOmitObservedInstancePayload/);
  assert.doesNotMatch(host, /combobox\/option-instance/);
  assert.doesNotMatch(host, /isOptionInstanceRole/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /CALENDAR-HOST-OBSERVE-OMIT-INSTANCE-PAYLOAD/,
  );
});

test("extract measures hidden FILL only for table/cell/label", () => {
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.match(runtime, /CALENDAR-EXTRACT-MEASURE-HIDDEN-CONTENT-FILL/);
  assert.match(runtime, /calendar\/day\/label/);
  assert.doesNotMatch(runtime, /combobox\/input/);
});

test("host folds uniform per-side stroke-weight binds; writer still binds strokeWeight", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-FOLD-UNIFORM-PER-SIDE-STROKE-WEIGHT/);
  assert.match(host, /strokeTopWeight/);
  assert.match(host, /strokeRightWeight/);
  assert.match(host, /strokeBottomWeight/);
  assert.match(host, /strokeLeftWeight/);
  assert.match(host, /strokes\.0\.weight/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.match(writerSource, /bindFloat\(node,"strokeWeight",bindingFor\(ir,"strokes\.0\.weight"\)\)/);
  assert.doesNotMatch(
    writerSource,
    /CALENDAR-HOST-FOLD-UNIFORM-PER-SIDE-STROKE-WEIGHT/,
  );
});

test("host omits table/header and table/body clipsContent; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-HEADER-BODY-CLIPS-CONTENT-OMITTED/);
  assert.match(host, /HEADER_BODY_ROLES/);
  assert.match(host, /omitHeaderBodyClipsContent/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /CALENDAR-HOST-HEADER-BODY-CLIPS-CONTENT-OMITTED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(
    runtime,
    /CALENDAR-HOST-HEADER-BODY-CLIPS-CONTENT-OMITTED/,
  );
});

test("host omits table/variant clipsContent; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-VARIANT-CLIPS-CONTENT-OMITTED/);
  assert.match(host, /TABLE_VARIANT_ROLE/);
  assert.match(host, /omitHeaderBodyClipsContent/);
  assert.match(host, /tableVariant/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /CALENDAR-HOST-VARIANT-CLIPS-CONTENT-OMITTED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-VARIANT-CLIPS-CONTENT-OMITTED/);
});

test("host omits table/row variant clipsContent; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-ROW-VARIANT-CLIPS-CONTENT-OMITTED/);
  assert.match(host, /ROW_COMPONENT_ROLE/);
  assert.match(host, /omitHeaderBodyClipsContent/);
  assert.match(host, /rowVariant/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /CALENDAR-HOST-ROW-VARIANT-CLIPS-CONTENT-OMITTED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-ROW-VARIANT-CLIPS-CONTENT-OMITTED/);
});

test("host omits table/row variant cornerRadius; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-ROW-VARIANT-CORNER-RADIUS-OMITTED/);
  assert.match(host, /ROW_COMPONENT_ROLE/);
  assert.match(host, /omitHeaderBodyCornerRadius/);
  assert.match(host, /rowVariant/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /CALENDAR-HOST-ROW-VARIANT-CORNER-RADIUS-OMITTED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-ROW-VARIANT-CORNER-RADIUS-OMITTED/);
});

test("host omits table/row variant effects; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-ROW-VARIANT-EFFECTS-OMITTED/);
  assert.match(host, /ROW_COMPONENT_ROLE/);
  assert.match(host, /omitHeaderBodyEffects/);
  assert.match(host, /rowVariant/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /CALENDAR-HOST-ROW-VARIANT-EFFECTS-OMITTED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-ROW-VARIANT-EFFECTS-OMITTED/);
});

test("host omits table/row variant strokes; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-ROW-VARIANT-STROKES-OMITTED/);
  assert.match(host, /ROW_COMPONENT_ROLE/);
  assert.match(host, /omitHeaderBodyStrokes/);
  assert.match(host, /rowVariant/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /CALENDAR-HOST-ROW-VARIANT-STROKES-OMITTED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-ROW-VARIANT-STROKES-OMITTED/);
});

test("host emits compile-carried Table row on table/row-set; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-ROW-SET-COMPILE-CARRY-LABEL/);
  assert.match(host, /compileCarriedLabel/);
  assert.match(host, /Calendar week/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /CALENDAR-HOST-ROW-SET-COMPILE-CARRY-LABEL/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-ROW-SET-COMPILE-CARRY-LABEL/);
});

test("host omits table/header and table/body cornerRadius; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-HEADER-BODY-CORNER-RADIUS-OMITTED/);
  assert.match(host, /HEADER_BODY_ROLES/);
  assert.match(host, /omitHeaderBodyCornerRadius/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /CALENDAR-HOST-HEADER-BODY-CORNER-RADIUS-OMITTED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(
    runtime,
    /CALENDAR-HOST-HEADER-BODY-CORNER-RADIUS-OMITTED/,
  );
});

test("host omits table/set, table/row-set, and table/cell-set cornerRadius; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-SET-CORNER-RADIUS-OMITTED/);
  assert.match(host, /SET_ROLES/);
  assert.match(host, /omitSetCornerRadius/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /CALENDAR-HOST-SET-CORNER-RADIUS-OMITTED/);
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-SET-CORNER-RADIUS-OMITTED/);
});

test("host omits table/set, table/row-set, and table/cell-set effects; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-SET-EFFECTS-OMITTED/);
  assert.match(host, /SET_ROLES/);
  assert.match(host, /omitSetEffects/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /CALENDAR-HOST-SET-EFFECTS-OMITTED/);
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-SET-EFFECTS-OMITTED/);
});

test("host omits table/set, table/row-set, and table/cell-set strokes; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-SET-STROKES-OMITTED/);
  assert.match(host, /SET_ROLES/);
  assert.match(host, /omitSetStrokes/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /CALENDAR-HOST-SET-STROKES-OMITTED/);
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-SET-STROKES-OMITTED/);
});

test("host omits empty table/variant stroke dashPattern; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-VARIANT-EMPTY-STROKE-DASH-PATTERN-OMITTED/);
  assert.match(host, /TABLE_VARIANT_ROLE/);
  assert.match(host, /omitVariantEmptyStrokeDashPattern/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /CALENDAR-HOST-VARIANT-EMPTY-STROKE-DASH-PATTERN-OMITTED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(
    runtime,
    /CALENDAR-HOST-VARIANT-EMPTY-STROKE-DASH-PATTERN-OMITTED/,
  );
});

test("host omits table/variant effects; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-VARIANT-EFFECTS-OMITTED/);
  assert.match(host, /TABLE_VARIANT_ROLE/);
  assert.match(host, /omitHeaderBodyEffects/);
  assert.match(host, /tableVariant/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /CALENDAR-HOST-VARIANT-EFFECTS-OMITTED/);
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-VARIANT-EFFECTS-OMITTED/);
});

test("host omits table/header and table/body effects; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-HEADER-BODY-EFFECTS-OMITTED/);
  assert.match(host, /HEADER_BODY_ROLES/);
  assert.match(host, /omitHeaderBodyEffects/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /CALENDAR-HOST-HEADER-BODY-EFFECTS-OMITTED/);
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-HEADER-BODY-EFFECTS-OMITTED/);
});

test("host omits table/header and table/body strokes; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-HEADER-BODY-STROKES-OMITTED/);
  assert.match(host, /HEADER_BODY_ROLES/);
  assert.match(host, /omitHeaderBodyStrokes/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /CALENDAR-HOST-HEADER-BODY-STROKES-OMITTED/);
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-HEADER-BODY-STROKES-OMITTED/);
});

test("host omits copied cell-instance bindings; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-CELL-INSTANCE-BINDING-EXTRAS-DROPPED/);
  assert.match(host, /CELL_INSTANCE_COMPILE_BINDING_FIELDS/);
  assert.match(host, /CELL_INSTANCE_ROLE/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /CALENDAR-HOST-CELL-INSTANCE-BINDING-EXTRAS-DROPPED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-CELL-INSTANCE-BINDING-EXTRAS-DROPPED/);
});

test("host omits copied row-instance bindings; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-ROW-INSTANCE-BINDING-EXTRAS-DROPPED/);
  assert.match(host, /ROW_INSTANCE_COMPILE_BINDING_FIELDS/);
  assert.match(host, /ROW_INSTANCE_ROLE/);
  assert.match(host, /ROW_COMPILE_BINDING_FIELDS/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /CALENDAR-HOST-ROW-INSTANCE-BINDING-EXTRAS-DROPPED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-ROW-INSTANCE-BINDING-EXTRAS-DROPPED/);
});

test("host omits effects on calendar/week/${n} frames — the Calendar live v12 class", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-WEEK-FRAME-EFFECTS-OMITTED/);
  assert.match(host, /omitWeekFrameEffects/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /CALENDAR-HOST-WEEK-FRAME-EFFECTS-OMITTED/);
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-WEEK-FRAME-EFFECTS-OMITTED/);
});

test("host omits cornerRadius on calendar/week/${n} frames — the Calendar live v11 class", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-WEEK-FRAME-CORNER-RADIUS-OMITTED/);
  assert.match(host, /omitWeekFrameCornerRadius/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /CALENDAR-HOST-WEEK-FRAME-CORNER-RADIUS-OMITTED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-WEEK-FRAME-CORNER-RADIUS-OMITTED/);
});

test("host omits clipsContent on calendar/week/${n} frames — the Calendar live v10 class", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-WEEK-FRAME-CLIPS-CONTENT-OMITTED/);
  assert.match(host, /omitWeekFrameClipsContent/);
  assert.match(host, /!ROW_INSTANCE_ROLE\.test\(role\) \|\| scene\.type !== "FRAME"/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /CALENDAR-HOST-WEEK-FRAME-CLIPS-CONTENT-OMITTED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-WEEK-FRAME-CLIPS-CONTENT-OMITTED/);
});

test("host orders calendar/week/${n}/number TEXT bindings to compile field order — the Calendar live v9 class", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-WEEK-NUMBER-BINDING-COMPILE-ORDER/);
  assert.match(host, /WEEK_NUMBER_COMPILE_BINDING_FIELDS/);
  assert.match(host, /WEEK_NUMBER_TEXT_ROLE/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /CALENDAR-HOST-WEEK-NUMBER-BINDING-COMPILE-ORDER/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-WEEK-NUMBER-BINDING-COMPILE-ORDER/);
});

test("host emits compile-carried layout.itemSpacing on calendar/week/${n} frames — the Calendar live v8 class", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-WEEK-FRAME-ITEM-SPACING/);
  assert.match(host, /ROW_INSTANCE_ROLE\.test\(role\) && scene\.type === "INSTANCE"/);
  assert.match(host, /ROW_COMPILE_BINDING_FIELDS/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /CALENDAR-HOST-WEEK-FRAME-ITEM-SPACING/);
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-WEEK-FRAME-ITEM-SPACING/);
});

test("host orders calendar/weekday TEXT bindings to compile field order — the Calendar live v6 class", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-WEEKDAY-BINDING-COMPILE-ORDER/);
  assert.match(host, /WEEKDAY_COMPILE_BINDING_FIELDS/);
  assert.match(host, /WEEKDAY_TEXT_ROLE/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /CALENDAR-HOST-WEEKDAY-BINDING-COMPILE-ORDER/);
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-WEEKDAY-BINDING-COMPILE-ORDER/);
});

test("host orders calendar/caption bindings to compile field order — the Calendar live v5 class", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-CAPTION-BINDING-COMPILE-ORDER/);
  assert.match(host, /CAPTION_COMPILE_BINDING_FIELDS/);
  assert.match(
    host,
    /if \(role === "calendar\/caption"\) return \[\.\.\.CAPTION_COMPILE_BINDING_FIELDS\]/,
  );
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /CALENDAR-HOST-CAPTION-BINDING-COMPILE-ORDER/);
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-CAPTION-BINDING-COMPILE-ORDER/);
});

test("host emits compile-carried empty bindings on calendar sets — the Calendar live v4 class", () => {
  const host = readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8");
  assert.match(host, /CALENDAR-HOST-SET-EMPTY-BINDINGS/);
  assert.match(host, /SET_ROLES\.has\(role \?\? ""\) \|\| bindings\.length > 0/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /CALENDAR-HOST-SET-EMPTY-BINDINGS/);
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /CALENDAR-HOST-SET-EMPTY-BINDINGS/);
});

test("extract skips untagged row owned-cell-label TEXT bind hosts; writer is unchanged", () => {
  const runtime = buildFigmaSceneReadbackRuntime(CALENDAR_FIGMA_NAMESPACE);
  assert.match(runtime, /CALENDAR-EXTRACT-SKIP-WEEK-OWNED-DAY-LABEL-BIND-HOST/);
  assert.match(runtime, /calendar\/day\/label/);
  assert.match(runtime, /walkingRowComponent/);
  assert.match(runtime, /untaggedOwnedCellLabelBindHost/);
  const writerSource = readFileSync("recipe/calendar-figma-writer.ts", "utf8");
  assert.match(writerSource, /CALENDAR-WRITER-DAY-PROPERTIES/);
  assert.doesNotMatch(
    writerSource,
    /CALENDAR-EXTRACT-SKIP-WEEK-OWNED-DAY-LABEL-BIND-HOST/,
  );
});

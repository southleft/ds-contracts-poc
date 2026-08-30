import assert from "node:assert/strict";
import test from "node:test";

import { astryxCalendarInstance } from "./fixtures/library-calendars.js";
import { compileCalendarRecipe } from "./recipes/calendar.js";
import {
  CALENDAR_FIGMA_INSTANCES_PER_SOURCE,
  CALENDAR_FIGMA_NAMESPACE,
  CALENDAR_FIGMA_VARIANTS_PER_SOURCE,
  emitCalendarFigmaWriter,
  validateCalendarFigmaSourcePlans,
} from "./calendar-figma-writer.js";

const input = () => ({
  adapterIdentity: "astryx-calendar-reviewed-v1",
  displayName: "Astryx Calendar",
  recipeHash: "a".repeat(64),
  envelope: compileCalendarRecipe(astryxCalendarInstance),
});

test("the writer plans a complete calendar source without touching Figma", () => {
  const writer = emitCalendarFigmaWriter([input()]);
  assert.equal(writer.namespace, CALENDAR_FIGMA_NAMESPACE);
  assert.notEqual(writer.namespace, "ds.contracts.table.recipe.v1");
  assert.notEqual(writer.namespace, "ds.contracts.input.recipe.v5");
  assert.notEqual(writer.namespace, "ds.contracts.combobox.recipe.v1");
  assert.match(writer.pageName, /^Recipe Pivot \/ Calendar \//);
  assert.match(writer.runIdentity, /-calendar-v25$/);

  const plan = writer.sourcePlans[0]!;
  assert.equal(plan.instanceCount, CALENDAR_FIGMA_INSTANCES_PER_SOURCE);
  assert.equal(
    plan.calendarSet.children.length +
      plan.weekSet.children.length +
      plan.daySet.children.length,
    CALENDAR_FIGMA_VARIANTS_PER_SOURCE,
  );
  assert.ok(plan.variables.length > 0, "a zero-variable mint is not a mint");
  assert.equal(validateCalendarFigmaSourcePlans([plan]).length, 0);
});

test("the set name carries the compile label — the Table live v25 class", () => {
  // Table v25 refused because the writer named every set
  // `<role> :: <source display name>` while compile carried `Table row` /
  // `Table cell`. The IR diff went green and independent root accounting still
  // refused on the node NAME. This writer must not repeat it.
  const writer = emitCalendarFigmaWriter([input()]);
  assert.match(
    writer.code,
    /set\.name=setIr\.role\+" :: "\+\(setIr\.label\|\|source\.sourceName\)/,
  );
  assert.match(writer.code, /CALENDAR-WRITER-SET-NAME-CARRIES-COMPILE-LABEL/);
});

test("only calendar@1/day is instantiable", () => {
  // A week cannot be an instance: day state varies within a week and an
  // instance picks one variant for the whole component.
  const writer = emitCalendarFigmaWriter([input()]);
  assert.match(writer.code, /CALENDAR-WRITER-ONLY-DAY-IS-INSTANTIABLE/);
  assert.match(writer.code, /CALENDAR-UNKNOWN-INSTANCE/);
  assert.equal(
    writer.code.includes('componentRef!=="calendar@1/day"'),
    true,
    "anything but a day instance must refuse",
  );
});

test("the writer refuses a day cell that is not a measured box", () => {
  const writer = emitCalendarFigmaWriter([input()]);
  assert.match(writer.code, /CALENDAR-WRITER-DAY-CELL-BOX/);
  assert.match(writer.code, /CALENDAR-DAY-CELL-NOT-MEASURED/);
});

test("the day-cell box is applied before children — the Calendar live v1 class", () => {
  const writer = emitCalendarFigmaWriter([input()]);
  assert.match(writer.code, /CALENDAR-WRITER-DAY-CELL-BOX-BEFORE-CHILDREN/);
  assert.match(
    writer.code,
    /CALENDAR-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE/,
  );
  assert.match(writer.code, /CALENDAR-V1-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v1/);
  assert.match(writer.code, /CALENDAR-V2-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v2/);
  assert.match(writer.code, /CALENDAR-V3-IDENTITY-REUSE/);
  const dayBefore = writer.code.indexOf(
    "CALENDAR-WRITER-DAY-CELL-BOX-BEFORE-CHILDREN",
  );
  const childrenLoop = writer.code.indexOf(
    "for(const [childIndex,child] of ir.children.entries())await render(child,component",
  );
  assert.ok(dayBefore >= 0 && childrenLoop >= 0 && dayBefore < childrenLoop);
});

test("the writer loads the instance font before writing Label — the Calendar live v2 class", () => {
  const writer = emitCalendarFigmaWriter([input()]);
  assert.match(
    writer.code,
    /CALENDAR-WRITER-LOAD-INSTANCE-FONT-BEFORE-SET-PROPERTIES/,
  );
});

test("the writer applies instance Label via characters — the Calendar live v3 class", () => {
  const writer = emitCalendarFigmaWriter([input()]);
  assert.match(writer.code, /CALENDAR-WRITER-INSTANCE-LABEL-VIA-CHARACTERS/);
  assert.equal(
    writer.code.includes("node.setProperties({[property]:ir.properties.Label})"),
    false,
    "setProperties(Label) is the refused class; do not call it",
  );
  assert.match(writer.code, /text\.characters=ir\.properties\.Label/);
  assert.match(writer.code, /CALENDAR-V3-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v3/);
  assert.match(writer.code, /CALENDAR-V4-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v4/);
  assert.match(writer.code, /CALENDAR-V5-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v5/);
  assert.match(writer.code, /CALENDAR-V6-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v6/);
  assert.match(writer.code, /CALENDAR-V7-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v7/);
  assert.match(writer.code, /CALENDAR-V8-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v8/);
  assert.match(writer.code, /CALENDAR-V9-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v9/);
  assert.match(writer.code, /CALENDAR-V10-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v10/);
  assert.match(writer.code, /CALENDAR-V11-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v11/);
  assert.match(writer.code, /CALENDAR-V12-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v12/);
  assert.match(writer.code, /CALENDAR-V13-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v13/);
  assert.match(writer.code, /CALENDAR-V14-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v14/);
  assert.match(writer.code, /CALENDAR-V15-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v15/);
  assert.match(writer.code, /CALENDAR-V16-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v16/);
  assert.match(writer.code, /CALENDAR-V17-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v17/);
  assert.match(writer.code, /CALENDAR-V18-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v18/);
  assert.match(writer.code, /CALENDAR-V19-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v19/);
  assert.match(writer.code, /CALENDAR-V20-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v20/);
  assert.match(writer.code, /CALENDAR-V21-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v21/);
  assert.match(writer.code, /CALENDAR-V22-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v22/);
  assert.match(writer.code, /CALENDAR-V23-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v23/);
  assert.match(writer.code, /CALENDAR-V24-IDENTITY-REUSE/);
  assert.match(writer.code, /19be1c96-calendar-v24/);
});

test("the writer writes instance Label through the set-issued property after a painted fallback — the Calendar live v24 class", () => {
  const writer = emitCalendarFigmaWriter([input()]);
  assert.match(
    writer.code,
    /CALENDAR-WRITER-INSTANCE-LABEL-VIA-SET-PROPERTIES-AFTER-PAINTED-FALLBACK/,
  );
  assert.match(
    writer.code,
    /node\.setProperties\(\{\[dayLabelProperty\]:ir\.properties\.Label\}\)/,
  );
  assert.equal(
    writer.code.includes("node.setProperties({[property]:ir.properties.Label})"),
    false,
    "fresh instance propertyKey(Label) is still the refused class",
  );
});

test("the writer hugs from post-character intrinsic and walks a zero-glyph named fallback — the Calendar live v23 class", () => {
  const writer = emitCalendarFigmaWriter([input()]);
  assert.match(writer.code, /CALENDAR-WRITER-HUG-TEXT-POST-CHARACTER-INTRINSIC/);
  assert.match(writer.code, /CALENDAR-WRITER-NAMED-FALLBACK-AFTER-ZERO-GLYPH/);
  assert.match(writer.code, /CALENDAR-WRITER-HUG-FROM-POST-CHARACTER-INTRINSIC/);
  assert.match(writer.code, /CALENDAR-FONT-ZERO-INTRINSIC/);
  assert.equal(
    writer.code.includes("hugTextIntrinsic={width:Math.max(node.width,1)"),
    false,
    "stamping hug from Math.max(emptyWidth, 1) is the 1px sliver class",
  );
  assert.match(writer.code, /fallbackChain/);
  assert.doesNotMatch(writer.code, /family==="Inter"/);
});

test("the writer re-applies instance Label after append — the Calendar live v20 class", () => {
  const writer = emitCalendarFigmaWriter([input()]);
  assert.match(writer.code, /CALENDAR-WRITER-INSTANCE-LABEL-AFTER-APPEND/);
  assert.match(writer.code, /CALENDAR-DAY-LABEL-MISMATCH/);
  const afterAppend = writer.code.slice(
    writer.code.indexOf("else applySizing(node,ir);"),
  );
  assert.match(afterAppend, /CALENDAR-WRITER-INSTANCE-LABEL-AFTER-APPEND/);
  assert.match(afterAppend, /text\.characters=ir\.properties\.Label/);
});

test("the writer takes day Label presence from the set — the Calendar live v7 class", () => {
  const writer = emitCalendarFigmaWriter([input()]);
  assert.match(writer.code, /CALENDAR-WRITER-DAY-LABEL-FROM-SET/);
  assert.equal(
    writer.code.includes('propertyKey(node,"Label")'),
    false,
    "fresh instance componentProperties is the refused class",
  );
  assert.match(writer.code, /if\(!dayLabelProperty\)throw new Error\("CALENDAR-DAY-PROPERTY-ABSENT:Label"\)/);
});

test("the writer refuses every other archetype's page", () => {
  const writer = emitCalendarFigmaWriter([input()]);
  for (const marker of [
    "CALENDAR-MUST-NOT-WRITE-INPUT-PAGE",
    "CALENDAR-MUST-NOT-WRITE-COMBOBOX-PAGE",
    "CALENDAR-MUST-NOT-WRITE-BUTTON-PAGE",
    "CALENDAR-MUST-NOT-WRITE-TABLE-PAGE",
  ])
    assert.match(writer.code, new RegExp(marker));
  for (const pageId of ["115:295378", "163:35981", "85:6781", "173:48924"])
    assert.equal(
      writer.code.includes(pageId),
      true,
      `${pageId} must appear, as a guard`,
    );
});

test("the writer pins the exact target file and refuses font tampering", () => {
  const writer = emitCalendarFigmaWriter([input()]);
  assert.match(writer.code, /byMp6lt0Ij9b2QbkDGFwBh/);
  assert.match(writer.code, /WRONG-FILE:/);
  assert.match(writer.code, /WRONG-FILE-NAME:/);
  assert.match(writer.code, /WRONG-EDITOR:/);
  assert.match(writer.code, /CALENDAR-FONT-PROVENANCE-TAMPER/);
  assert.match(writer.code, /CALENDAR-PAGE-OWNERSHIP-COLLISION/);
  assert.match(writer.code, /CALENDAR-VARIABLE-COLLECTION-OWNERSHIP-COLLISION/);
});

test("a foreign envelope is refused", () => {
  const table = { ...input() };
  (table.envelope as any).recipe = { id: "table", version: 1 };
  assert.throws(() => emitCalendarFigmaWriter([table]), /requires calendar@1/);
});

test("a wrong archetype is refused", () => {
  const wrong = { ...input() };
  (wrong.envelope as any).archetype = "table / data-grid";
  assert.throws(
    () => emitCalendarFigmaWriter([wrong]),
    /requires the calendar archetype/,
  );
});

test("duplicate adapter identities are refused", () => {
  assert.throws(
    () => emitCalendarFigmaWriter([input(), input()]),
    /duplicate adapter identity/,
  );
});

test("the emitted program is deterministic", () => {
  assert.equal(
    emitCalendarFigmaWriter([input()]).code,
    emitCalendarFigmaWriter([input()]).code,
  );
});

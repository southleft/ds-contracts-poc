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
  assert.match(writer.runIdentity, /-calendar-v1$/);

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

test("the writer refuses every other archetype's page", () => {
  const writer = emitCalendarFigmaWriter([input()]);
  for (const marker of [
    "CALENDAR-MUST-NOT-WRITE-INPUT-PAGE",
    "CALENDAR-MUST-NOT-WRITE-COMBOBOX-PAGE",
    "CALENDAR-MUST-NOT-WRITE-BUTTON-PAGE",
  ])
    assert.match(writer.code, new RegExp(marker));
  for (const pageId of ["115:295378", "163:35981", "85:6781"])
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

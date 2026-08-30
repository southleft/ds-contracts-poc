import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import { adaptReviewedCalendar } from "./adapters/calendar.js";
import { canonicalCalendarRecipeInstance } from "./fixtures/calendar.js";
import {
  CALENDAR_SINGLE_LIBRARY_PROOF_PROTOCOL,
  REACT_DAY_PICKER_ADAPTER_REFUSAL,
  astryxCalendarAdapterConfig,
  astryxCalendarInstance,
  astryxCalendarSource,
} from "./fixtures/library-calendars.js";
import {
  CALENDAR_DAY_COUNT,
  CALENDAR_DAY_STATES,
  CALENDAR_WEEK_COUNT,
  CALENDAR_WEEK_NUMBERS,
  collapseCalendarRecipe,
  compileCalendarRecipe,
  validateCalendarStructure,
} from "./recipes/calendar.js";
import { RecipeRefusal } from "./recipe.js";

const INSTANCES = [
  ["canonical", canonicalCalendarRecipeInstance],
  ["astryx", astryxCalendarInstance],
] as const;

const setOf = (envelope: any, role: string) =>
  envelope.ir.children.find((child: any) => child.role === role);

test("calendar@1 adapts the one reviewed source and refuses a second-library invention", () => {
  const started = performance.now();
  const instance = adaptReviewedCalendar(
    astryxCalendarSource,
    astryxCalendarAdapterConfig,
  );
  const first = compileCalendarRecipe(instance);
  const collapsed = collapseCalendarRecipe(
    first,
    instance.provenance.selection,
  );
  const second = compileCalendarRecipe(collapsed);
  assert.equal(first.integrity.canonicalHash, second.integrity.canonicalHash);
  assert.equal(instance.identity.id, "astryx.calendar");
  assert.equal(
    instance.tokens.dayCell.size.fallback,
    32,
    "astryx --size-element-md",
  );
  assert.equal(
    instance.tokens.dayStates.today.ring?.fallback,
    "#ccd3dbff",
    "today is a ring, not a fill lookalike",
  );
  assert.ok(performance.now() - started < 4000);
  assert.equal(REACT_DAY_PICKER_ADAPTER_REFUSAL.adapterAuthored, false);
  assert.equal(
    CALENDAR_SINGLE_LIBRARY_PROOF_PROTOCOL.comparison.secondLibrary,
    "named-refusal",
  );
  const adapter = readFileSync("recipe/adapters/calendar.ts", "utf8").toLowerCase();
  for (const forbidden of ["@mui", "antd", "ant-design", "react-day-picker"])
    assert.equal(
      adapter.includes(forbidden),
      false,
      `${forbidden} must remain fixture/refusal data, not adapter cosmetics`,
    );
});

test("calendar@1 compiles the declared set shape for every source", () => {
  for (const [name, instance] of INSTANCES) {
    const envelope: any = compileCalendarRecipe(instance);
    assert.equal(envelope.archetype, "calendar / date-picker", name);
    assert.equal(envelope.recipe.id, "calendar");
    assert.equal(envelope.ir.role, "calendar/library");

    const calendarSet = setOf(envelope, "calendar/set");
    const weekSet = setOf(envelope, "calendar/week-set");
    const daySet = setOf(envelope, "calendar/day-set");
    assert.equal(
      calendarSet.children.length,
      CALENDAR_WEEK_NUMBERS.length,
      `${name}: every WeekNumbers variant`,
    );
    assert.equal(weekSet.children.length, CALENDAR_WEEK_NUMBERS.length);
    assert.equal(daySet.children.length, CALENDAR_DAY_STATES.length);
    assert.equal(
      calendarSet.children.length +
        weekSet.children.length +
        daySet.children.length,
      8,
      `${name}: eight components — two calendar, two week, four day`,
    );
  }
});

test("a week carries exactly seven days and a grid exactly the declared weeks", () => {
  const envelope: any = compileCalendarRecipe(astryxCalendarInstance);
  const weekSet = setOf(envelope, "calendar/week-set");
  for (const week of weekSet.children) {
    const days = week.children.filter((child: any) =>
      String(child.role).startsWith("calendar/day-instance/"),
    );
    assert.equal(
      days.length,
      CALENDAR_DAY_COUNT,
      "seven days is what a week is",
    );
  }
  const variant = setOf(envelope, "calendar/set").children[0];
  const grid = variant.children.find(
    (child: any) => child.role === "calendar/grid",
  );
  assert.equal(grid.children.length, CALENDAR_WEEK_COUNT);
});

test("every day cell carries a measured box — calendar/day-cell-box", () => {
  // This is the required fact the Table climb ran into live: a grid whose cells
  // hug their own content cannot align into columns. Enforced here, not hoped for.
  const envelope: any = compileCalendarRecipe(astryxCalendarInstance);
  for (const day of setOf(envelope, "calendar/day-set").children) {
    assert.equal(day.layout.width.mode, "fixed", `${day.role} width`);
    assert.equal(day.layout.height.mode, "fixed", `${day.role} height`);
    assert.equal(
      day.layout.width.value,
      day.layout.height.value,
      "square cell",
    );
  }
});

test("each week in the grid carries its OWN days and states", () => {
  // The defect this pins: the grid first held week INSTANCES carrying only a
  // week number, so every week rendered week one's seven days and week one's
  // states -- the same seven days three times. It compiled and held its fixed
  // point and was not a calendar. A week instance cannot express this month
  // because day state varies WITHIN a week (one today, one selected, leading
  // days outside) while an instance picks one variant for the whole component.
  const envelope: any = compileCalendarRecipe(astryxCalendarInstance);
  const variant = setOf(envelope, "calendar/set").children[0];
  const grid = variant.children.find(
    (child: any) => child.role === "calendar/grid",
  );

  const rendered = grid.children.map((week: any) =>
    week.children
      .filter((child: any) => String(child.role).includes("/day/"))
      .map((day: any) => `${day.properties.Label}:${day.properties.State}`)
      .join(" "),
  );
  assert.equal(rendered.length, CALENDAR_WEEK_COUNT);
  assert.equal(
    new Set(rendered).size,
    CALENDAR_WEEK_COUNT,
    "every week must render a different set of days",
  );

  for (const week of grid.children) {
    assert.equal(
      week.kind,
      "frame",
      "a week in the grid is a frame, not an instance",
    );
    const days = week.children.filter((child: any) =>
      String(child.role).includes("/day/"),
    );
    assert.equal(days.length, CALENDAR_DAY_COUNT);
    for (const day of days) assert.equal(day.kind, "instance");
  }

  // The month the fixture pins: outside days lead, today lands, selection lands.
  const states = grid.children.flatMap((week: any) =>
    week.children
      .filter((child: any) => String(child.role).includes("/day/"))
      .map((day: any) => day.properties.State),
  );
  assert.equal(states.filter((s: string) => s === "outside").length, 5);
  assert.equal(states.filter((s: string) => s === "today").length, 1);
  assert.equal(states.filter((s: string) => s === "selected").length, 1);
});

test("the weekday header lines up with the day columns", () => {
  // The defect this pins: weekday labels were `hug`, so "Mo" was about 18px
  // while a day cell renders 32. The header did not line up with the days
  // beneath it -- the same ragged-column defect the Table climb hit live, in a
  // header row instead of a body row. `calendar/day-cell-box` does not catch it,
  // because it only measures the day cells.
  const envelope: any = compileCalendarRecipe(astryxCalendarInstance);
  const daySize = setOf(envelope, "calendar/day-set").children[0].layout.width;
  assert.equal(daySize.mode, "fixed");

  const variant = setOf(envelope, "calendar/set").children.find(
    (child: any) => child.label === "WeekNumbers=on",
  );
  const header = variant.children.find(
    (child: any) => child.role === "calendar/weekday-row",
  );
  const grid = variant.children.find(
    (child: any) => child.role === "calendar/grid",
  );

  // Every cell in a column-bearing row is measured to the day column.
  for (const cell of header.children) {
    assert.equal(cell.width.mode, "fixed", `${cell.role} must be measured`);
    assert.equal(
      cell.width.value,
      daySize.value,
      `${cell.role} spans one column`,
    );
  }

  // Same gutter width and same gap, so the two rows share a column grid.
  assert.equal(header.layout.itemSpacing, grid.children[0].layout.itemSpacing);
  for (const week of grid.children) {
    const gutter = week.children[0];
    assert.equal(
      gutter.width.mode,
      "fixed",
      "the week-number gutter is measured",
    );
    assert.equal(gutter.width.value, daySize.value);
    assert.equal(
      week.children.length,
      header.children.length,
      "header and week carry the same number of columns",
    );
  }

  // Compute the column x-positions of both rows and require them to agree.
  const positions = (row: any): number[] => {
    let x = 0;
    const xs: number[] = [];
    for (const child of row.children) {
      xs.push(x);
      const width =
        child.kind === "instance" ? daySize.value : child.width.value;
      x += width + row.layout.itemSpacing;
    }
    return xs;
  };
  const headerX = positions(header);
  for (const week of grid.children)
    assert.deepEqual(
      positions(week),
      headerX,
      "every week's columns land on the header's columns",
    );
});

test("collapse is a fixed point for every source", () => {
  for (const [name, instance] of INSTANCES) {
    const envelope: any = compileCalendarRecipe(instance);
    const collapsed = collapseCalendarRecipe(
      envelope,
      (instance as any).provenance.selection,
    );
    const again: any = compileCalendarRecipe(collapsed);
    assert.equal(
      again.integrity.canonicalHash,
      envelope.integrity.canonicalHash,
      `${name}: compile(collapse(compile(x))) === compile(x)`,
    );
  }
});

test("astryx carries the today ring rather than dropping it", () => {
  // @astryxdesign/core marks TODAY with an inset 1px ring and NO background.
  // A model of background+text alone would have lost the today marker; Figma
  // expresses a ring as an inside stroke, so it is carried.
  const envelope: any = compileCalendarRecipe(astryxCalendarInstance);
  const daySet = setOf(envelope, "calendar/day-set");
  const today = daySet.children.find(
    (child: any) => child.role === "calendar/day/today",
  );
  const selected = daySet.children.find(
    (child: any) => child.role === "calendar/day/selected",
  );
  assert.equal(today.strokes?.length, 1, "today carries a ring");
  assert.equal(today.strokes[0].weight, 1);
  assert.equal(today.strokes[0].align, "inside");
  assert.equal(today.fills[0].color, "#00000000", "today has no background");
  assert.equal(selected.strokes, undefined, "selected carries no ring");
  assert.equal(
    selected.fills[0].color,
    "#0064e0ff",
    "selected carries the accent background",
  );
});

test("what calendar@1 cannot carry is receipted, not dropped", () => {
  const envelope: any = compileCalendarRecipe(astryxCalendarInstance);
  assert.equal(envelope.receipts.length, 2);

  const byReason = Object.fromEntries(
    envelope.receipts.map((receipt: any) => [receipt.reason, receipt]),
  );

  // The dark half of every astryx light-dark() pair: a second Figma variable
  // mode, not a missing colour.
  assert.ok(byReason.lowered, "the colour-scheme loss is receipted");
  assert.match(byReason.lowered.evidence, /light-dark/);

  // hasOutsideDays / showOutsideDays: both sources declare it and calendar@1
  // has no primitive for a blank-but-measured cell. It was briefly a variant
  // axis whose two values compiled to identical content -- a dead axis is worse
  // than an honest refusal, so it is dropped and named.
  assert.ok(
    byReason["no-figma-primitive"],
    "the dropped outside-days prop is receipted",
  );
  assert.match(byReason["no-figma-primitive"].evidence, /byte-identical/);
  assert.match(byReason["no-figma-primitive"].fact.path, /hasOutsideDays/);
});

test("no axis is dead — every variant compiles to distinct content", () => {
  // A dead axis is a lie a designer can click on. OutsideDays was exactly that
  // before it was dropped: show and hide produced byte-identical content.
  const envelope: any = compileCalendarRecipe(astryxCalendarInstance);
  for (const set of envelope.ir.children) {
    const rendered = set.children.map((child: any) => {
      const stripped = structuredClone(child);
      delete stripped.role;
      delete stripped.label;
      delete stripped.variantProperties;
      return JSON.stringify(stripped);
    });
    assert.equal(
      new Set(rendered).size,
      set.children.length,
      `${set.role}: every variant must compile to distinct content`,
    );
  }
});

test("a hugged day cell is refused — the ragged-column defect cannot compile", () => {
  const envelope: any = compileCalendarRecipe(astryxCalendarInstance);
  const broken = structuredClone(envelope);
  const daySet = broken.ir.children.find(
    (child: any) => child.role === "calendar/day-set",
  );
  daySet.children[0].layout.width = { mode: "hug" };
  assert.throws(
    () => validateCalendarStructure(broken.ir),
    (error: unknown) =>
      error instanceof RecipeRefusal &&
      error.findings.some((line) => line.includes("calendar/day-cell-box")),
    "a day cell without a measured box must refuse",
  );
});

test("a hug text cell in a column-bearing row is refused", () => {
  // The class-level refusal, not just the instance. If a weekday label or a
  // week-number gutter ever goes back to hug, the recipe refuses rather than
  // compiling a header that does not line up with its columns.
  const envelope: any = compileCalendarRecipe(astryxCalendarInstance);
  const broken = structuredClone(envelope);
  const variant = broken.ir.children
    .find((child: any) => child.role === "calendar/set")
    .children.find((child: any) => child.label === "WeekNumbers=on");
  const header = variant.children.find(
    (child: any) => child.role === "calendar/weekday-row",
  );
  header.children[1].width = { mode: "hug" };

  assert.throws(
    () => validateCalendarStructure(broken.ir),
    (error: unknown) =>
      error instanceof RecipeRefusal &&
      error.findings.some((line) => line.includes("measured to the column")),
    "an unmeasured column cell must refuse",
  );
});

test("a short week is refused", () => {
  const envelope: any = compileCalendarRecipe(astryxCalendarInstance);
  const broken = structuredClone(envelope);
  const weekSet = broken.ir.children.find(
    (child: any) => child.role === "calendar/week-set",
  );
  weekSet.children[0].children.pop();
  assert.throws(
    () => validateCalendarStructure(broken.ir),
    (error: unknown) => error instanceof RecipeRefusal,
    "a week that is not seven days must refuse",
  );
});

test("an unsupported structural edit is refused on collapse", () => {
  const envelope: any = compileCalendarRecipe(astryxCalendarInstance);
  const edited = structuredClone(envelope);
  const daySet = edited.ir.children.find(
    (child: any) => child.role === "calendar/day-set",
  );
  daySet.children[0].cornerRadius.topLeft = 999;
  assert.throws(
    () =>
      collapseCalendarRecipe(
        edited,
        (astryxCalendarInstance as any).provenance.selection,
      ),
    (error: unknown) => error instanceof RecipeRefusal,
    "calendar@1 accepts only the declared designer edit surface",
  );
});

test("a foreign envelope is refused", () => {
  const envelope: any = compileCalendarRecipe(astryxCalendarInstance);
  const foreign = structuredClone(envelope);
  foreign.recipe = { id: "table", version: 1 };
  assert.throws(
    () =>
      collapseCalendarRecipe(
        foreign,
        (astryxCalendarInstance as any).provenance.selection,
      ),
    (error: unknown) => error instanceof RecipeRefusal,
  );
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canonicalCalendarRecipeInstance } from "./fixtures/calendar.js";
import { astryxCalendarInstance } from "./fixtures/library-calendars.js";
import { proposeCalendarInstanceFromLedger } from "./fixture-reader/propose-calendar-instance.js";
import { compileCalendarRecipe, collapseCalendarRecipe, type CalendarRecipeInstance } from "./recipes/calendar.js";

const dayLabel = (envelope: ReturnType<typeof compileCalendarRecipe>, state: string) => {
  const group = envelope.ir.children.find((node: any) => node.role === "calendar/day-set") as any;
  const day = group.children.find((node: any) => node.variantProperties.State === state);
  return day.children.find((node: any) => node.role === "calendar/day/button")
    .children.find((node: any) => node.role === "calendar/day/label");
};
const roundtrip = (instance: CalendarRecipeInstance) => {
  const first = compileCalendarRecipe(instance);
  const raised = collapseCalendarRecipe(first, instance.provenance.selection);
  const second = compileCalendarRecipe(raised);
  assert.equal(second.integrity.canonicalHash, first.integrity.canonicalHash);
  const again = collapseCalendarRecipe(second, raised.provenance.selection);
  assert.equal(compileCalendarRecipe(again).integrity.canonicalHash, first.integrity.canonicalHash);
  return { first, raised };
};

test("absent state typography preserves both pre-fix fixture envelopes byte-exactly", () => {
  for (const [instance, hash] of [
    [canonicalCalendarRecipeInstance, "d5d5dab32b9e4aacc8c219be1b58627493f3a21275e36feba2f08b6832301c46"],
    [astryxCalendarInstance, "4a703f3f645617a0da03714227653850028a62f6b2d36a829ee0f4472c818b56"],
  ] as const) {
    const { first, raised } = roundtrip(instance);
    assert.equal(first.integrity.canonicalHash, hash);
    for (const state of ["today", "selected", "outside"] as const) {
      assert.equal(raised.tokens.dayStates[state].typography, undefined);
    }
  }
});

test("the held-out selected-day type is measured from the selected source button, not the first day", () => {
  const file = "extract/computed/out/day-picker/calendar/captured-truth.json";
  const truth = JSON.parse(readFileSync(file, "utf8"));
  const selected = (node: any): any => {
    if (node.classes?.includes("rdp-selected")) return node;
    for (const child of node.nodes ?? []) {
      if (!child.el) continue;
      const found = selected(child.el);
      if (found) return found;
    }
  };
  const source = selected(truth.base.root).nodes.find((node: any) => node.el?.tag === "button").el;
  const proposed = proposeCalendarInstanceFromLedger(process.cwd(), file);
  assert.ok(proposed.instanceParse.success);
  const { first, raised } = roundtrip(proposed.instance as CalendarRecipeInstance);
  const label = dayLabel(first, "selected");
  assert.equal(label.type.fontSize, parseFloat(source.style["font-size"]));
  assert.equal(source.style["font-weight"], "700");
  assert.equal(label.type.fontProvenance.requestedStyle, "Bold");
  assert.notEqual(label.type.fontSize, dayLabel(first, "default").type.fontSize);
  assert.equal(raised.header?.navPlacement, "trailing");
  assert.equal(raised.tokens.captionFontSize?.fallback, 18);
  assert.equal(raised.tokens.weekdayPadding?.fallback, 8);
});

test("state typography applies generically to today, selected, and outside and survives two readbacks", () => {
  for (const state of ["today", "selected", "outside"] as const) {
    const instance = structuredClone(canonicalCalendarRecipeInstance);
    const font = structuredClone(instance.tokens.typography.day);
    font.requestSource += `; measured ${state} type`;
    const override = { font, fontSize: { variable: `test.${state}.font-size`, fallback: 23 } };
    instance.tokens.dayStates[state].typography = override;
    const { first, raised } = roundtrip(instance);
    assert.equal(dayLabel(first, state).type.fontSize, 23);
    assert.deepEqual(raised.tokens.dayStates[state].typography, override);
    assert.equal(dayLabel(first, "default").type.fontSize, instance.tokens.dayCell.fontSize.fallback);
  }
});

test("header placement, caption size, and bound zero weekday padding survive readback", () => {
  const instance = structuredClone(canonicalCalendarRecipeInstance);
  instance.header = { navPlacement: "trailing" };
  instance.tokens.captionFontSize = { variable: "test.caption.size", fallback: 25 };
  instance.tokens.weekdayPadding = { variable: "test.weekday.padding", fallback: 0 };
  const { raised } = roundtrip(instance);
  assert.deepEqual(raised.header, instance.header);
  assert.deepEqual(raised.tokens.captionFontSize, instance.tokens.captionFontSize);
  assert.deepEqual(raised.tokens.weekdayPadding, instance.tokens.weekdayPadding);
});

test("partial, default-state, and redundant type overrides are refused, not silently discarded", () => {
  const partial: any = structuredClone(canonicalCalendarRecipeInstance);
  partial.tokens.dayStates.selected.typography = { fontSize: { variable: null, fallback: 23 } };
  assert.throws(() => compileCalendarRecipe(partial));
  const atDefault: any = structuredClone(canonicalCalendarRecipeInstance);
  atDefault.tokens.dayStates.default.typography = {
    font: atDefault.tokens.typography.day,
    fontSize: { variable: null, fallback: 23 },
  };
  assert.throws(() => compileCalendarRecipe(atDefault));
  const redundant = structuredClone(canonicalCalendarRecipeInstance);
  redundant.tokens.dayStates.selected.typography = {
    font: redundant.tokens.typography.day,
    fontSize: redundant.tokens.dayCell.fontSize,
  };
  assert.throws(() => compileCalendarRecipe(redundant), /duplicates the common day typography/);
});

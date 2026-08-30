import {
  CALENDAR_DAY_STATES,
  CALENDAR_WEEK_NUMBERS,
  type CalendarColorParameter,
  type CalendarFontSpec,
  type CalendarNumberParameter,
  type CalendarRecipeInstance,
} from "../recipes/calendar.js";

const number = (
  variable: string,
  fallback: number,
): CalendarNumberParameter => ({ variable, fallback });
const color = (
  variable: string,
  fallback: `#${string}`,
): CalendarColorParameter => ({ variable, fallback });
const font = (
  role: "caption" | "weekday" | "day",
  family: string,
  style: string,
): CalendarFontSpec => ({
  requestedFamily: family,
  requestedStyle: style,
  requestSource: `recipe/fixtures/calendar.ts#${role}`,
  fallbackChain: [
    { family, style },
    {
      family: "Arial",
      style: style.replaceAll(/\s+/g, "") === "SemiBold" ? "Bold" : "Regular",
    },
  ],
  resolvedFamily: family,
  resolvedStyle: style,
  resolution: "requested",
});

/**
 * A pinned month, carried literally.
 *
 * `examples/day-picker/PROVENANCE.md` records why: the capture grammar cannot
 * spell a `Date`, so a calendar driven by a live clock has a "today" ring and a
 * visible month that move between captures and never byte-compare. The contract
 * therefore carries the month that was RENDERED. These are three weeks of a
 * fixed August 2026, with the leading days belonging to July.
 */
const week = (
  id: string,
  weekNumber: string,
  days: Array<[string, (typeof CALENDAR_DAY_STATES)[number]]>,
) => ({
  id,
  weekNumber,
  days: days.map(([label, state]) => ({ label, state })),
});

export const canonicalCalendarRecipeInstance = {
  identity: { id: "ds.calendar", name: "Calendar" },
  semantic: {
    root: "application",
    grid: "grid",
    weekdayRow: "row",
    week: "row",
    weekday: "columnheader",
    day: "gridcell",
    dayAxis: "declared",
  },
  axes: {
    weekNumbers: {
      name: "WeekNumbers",
      values: [...CALENDAR_WEEK_NUMBERS],
      default: "on",
    },
    dayState: {
      name: "State",
      values: [...CALENDAR_DAY_STATES],
      default: "default",
    },
  },
  content: {
    caption: "August 2026",
    weekdays: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
    weeks: [
      week("week-31", "31", [
        ["27", "outside"],
        ["28", "outside"],
        ["29", "outside"],
        ["30", "outside"],
        ["31", "outside"],
        ["1", "default"],
        ["2", "default"],
      ]),
      week("week-32", "32", [
        ["3", "default"],
        ["4", "default"],
        ["5", "today"],
        ["6", "default"],
        ["7", "default"],
        ["8", "default"],
        ["9", "default"],
      ]),
      week("week-33", "33", [
        ["10", "default"],
        ["11", "default"],
        ["12", "selected"],
        ["13", "default"],
        ["14", "default"],
        ["15", "default"],
        ["16", "default"],
      ]),
    ],
    selectedDayLabel: "12",
    todayDayLabel: "5",
  },
  tokens: {
    dayCell: {
      size: number("ds.calendar.dayCell-size", 36),
      padding: number("ds.calendar.dayCell-padding", 4),
      fontSize: number("ds.calendar.dayCell-fontSize", 14),
      radius: number("ds.calendar.dayCell-radius", 6),
    },
    gridGap: number("ds.calendar.gridGap", 4),
    surface: color("ds.calendar.surface", "#ffffffff"),
    captionText: color("ds.calendar.captionText", "#111827ff"),
    weekdayText: color("ds.calendar.weekdayText", "#6b7280ff"),
    weekNumberText: color("ds.calendar.weekNumberText", "#9ca3afff"),
    dayStates: {
      default: {
        background: color(
          "ds.calendar.dayStates-default-background",
          "#00000000",
        ),
        text: color("ds.calendar.dayStates-default-text", "#111827ff"),
      },
      today: {
        background: color(
          "ds.calendar.dayStates-today-background",
          "#eef2ffff",
        ),
        text: color("ds.calendar.dayStates-today-text", "#1d4ed8ff"),
      },
      selected: {
        background: color(
          "ds.calendar.dayStates-selected-background",
          "#1d4ed8ff",
        ),
        text: color("ds.calendar.dayStates-selected-text", "#ffffffff"),
      },
      outside: {
        background: color(
          "ds.calendar.dayStates-outside-background",
          "#00000000",
        ),
        text: color("ds.calendar.dayStates-outside-text", "#c3c8d1ff"),
      },
    },
    typography: {
      caption: font("caption", "Inter", "Semi Bold"),
      weekday: font("weekday", "Inter", "Semi Bold"),
      day: font("day", "Inter", "Regular"),
    },
  },
  inputFacts: [],
  accounting: { carried: [] },
  extensions: [],
  receipts: [],
  provenance: {
    source: "recipe/fixtures/calendar.ts",
    tool: "calendar@1",
    generatedAt: "2026-08-29T00:00:00.000Z",
    selection: {
      candidates: [{ id: "calendar", version: 1 }],
      selectedBy: "recipe-pivot-calendar-review",
      mechanism: "human-review",
      source: "docs/32-recipe-ir-pivot.md §7",
      reviewedAt: "2026-08-29T00:00:00.000Z",
      manualCost: {
        value: 1,
        unit: "reviewed-mapping",
        note: "one explicit calendar / date-picker to calendar@1 selection",
      },
    },
  },
} as unknown as CalendarRecipeInstance;

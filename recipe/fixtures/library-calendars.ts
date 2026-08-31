import type {
  ReviewedCalendarAdapterConfig,
  ReviewedCalendarSource,
  ReviewedCalendarSourceFact,
  CalendarFactCategory,
} from "../adapters/calendar.js";
import { canonicalCalendarRecipeInstance } from "./calendar.js";
import type { CalendarRecipeInstance } from "../recipes/calendar.js";

/**
 * Reviewed calendar sources.
 *
 * ONE source, deliberately. The cross-library leg every other archetype carries
 * is not available for Calendar today, and the reason is worth stating rather
 * than papering over:
 *
 *  - `@astryxdesign/core` Calendar is real, vendored in this repo, and its
 *    `src/Calendar/styles.ts` carries actual token values. It is the source
 *    below, and every number and colour here was read out of it.
 *  - `react-day-picker@10.0.1` is the obvious second library and it is
 *    DELIBERATELY NOT USED. `examples/day-picker/PROVENANCE.md` states a
 *    blindness rule: nothing in this repo's pipeline has ever been run against
 *    it, precisely so it can serve as the unseen-library exam. Authoring an
 *    adapter for it now would spend an asset worth more than this proof.
 *  - `extract/pilots/eventz/out/contracts/date-picker.contract.json` exists but
 *    carries `props: []` and `anatomy: { root: {} }` — an empty shell, not a
 *    source.
 *
 * So the Calendar offline proof is single-library, and says so. The second leg
 * is a named refusal, not an omission.
 */

const cloneTokens = (
  prefix: string,
  mutate: (path: string, fallback: string | number) => string | number,
): CalendarRecipeInstance["tokens"] => {
  const tokens = structuredClone(
    canonicalCalendarRecipeInstance.tokens,
  ) as CalendarRecipeInstance["tokens"];
  const visit = (value: unknown, path: string): void => {
    if (value === null || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (
      typeof record.variable === "string" &&
      (typeof record.fallback === "string" ||
        typeof record.fallback === "number")
    ) {
      record.variable = `${prefix}.${path.replaceAll(".", "-")}`;
      record.fallback = mutate(path, record.fallback);
      return;
    }
    for (const [key, child] of Object.entries(record))
      visit(child, path ? `${path}.${key}` : key);
  };
  visit(tokens, "");
  return tokens;
};

/**
 * Values read from `@astryxdesign/core/src/Calendar/styles.ts` and resolved
 * through `dist/astryx.css` / `src/theme/tokens.stylex.ts`. Named or carried
 * only — a previous draft invented Inter, Monday-start, an 8px day-grid gap,
 * `--radius-inner` 4px, and `--spacing-1` day padding. Those tokens are real
 * in the theme and unused by the day grid; they are not minted here.
 *
 * Carried:
 *   column / cell slot   --size-element-md                         32px
 *   day + caption size   --text-body-size / --text-label-size
 *                        → --font-size-base                        0.875rem = 14px
 *   text primary         --color-text-primary                      #0A1317
 *   text secondary       --color-text-secondary                    #4E606F
 *   accent / on-accent   --color-accent / --color-on-accent        #0064E0 / #FFFFFF
 *   today ring           --color-border-emphasized inset 0 0 0 1px #CCD3DB
 *   caption stack gap     header.marginBottom --spacing-2          8px
 *                         (header.gap is the same --spacing-2 token)
 *   day button            --size-element-sm 28 circle (50% → 14)
 *   root padding          --spacing-3                              12px
 *   root minWidth         220px
 *   nav icon              Button iconSizeStyles sm/md              16px
 *   default grid          6 rows / 42 cells (hasVariableRowCount false)
 *
 * Receipted (see astryxCalendarInstance.receipts):
 *   daysGrid has no gap (header.gap --spacing-2 is not the day grid)
 *   dayName paddingBottom --spacing-1 4px is not a second stack-gap token
 *   weekday size is --text-supporting-size 12px; calendar@1 has one fontSize
 *   Calendar.tsx paints no surface; --color-background-surface is not applied
 *   dayOutside also sets opacity 0.5
 *   default weekStartsOn is 0 (Sunday); content carries that default
 *   dark half of every light-dark() pair
 *   hasOutsideDays / showOutsideDays
 */
const astryxTokens = cloneTokens("astryx.calendar", (path, fallback) => {
  if (path === "dayCell.size") return 32;
  if (path === "dayCell.padding") return 0;
  if (path === "dayCell.fontSize") return 14;
  if (path === "dayCell.radius") return 0;
  if (path === "dayButton.size") return 28;
  if (path === "dayButton.radius") return 14;
  if (path === "gridGap") return 0;
  if (path === "captionGap") return 8;
  if (path === "rootPadding") return 12;
  if (path === "rootMinWidth") return 220;
  if (path === "navIconSize") return 16;
  if (path === "surface") return "#00000000";
  if (path === "captionText") return "#0a1317ff";
  if (path === "weekdayText") return "#4e606fff";
  if (path === "weekNumberText") return "#4e606fff";
  if (path === "dayStates.default.background") return "#00000000";
  if (path === "dayStates.default.text") return "#0a1317ff";
  // astryx marks TODAY with an inset ring and NO background fill.
  if (path === "dayStates.today.background") return "#00000000";
  if (path === "dayStates.today.text") return "#0a1317ff";
  // astryx marks SELECTED with a background and no ring.
  if (path === "dayStates.selected.background") return "#0064e0ff";
  if (path === "dayStates.selected.text") return "#ffffffff";
  if (path === "dayStates.outside.background") return "#00000000";
  if (path === "dayStates.outside.text") return "#4e606fff";
  return fallback;
});

astryxTokens.dayStates.today.ring = {
  variable: "astryx.calendar.dayStates-today-ring",
  fallback: "#ccd3dbff",
};
astryxTokens.dayStates.today.ringWidth = {
  variable: "astryx.calendar.dayStates-today-ringWidth",
  fallback: 1,
};
const ASTRYX_BODY_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const astryxFont = (
  role: "caption" | "weekday" | "day",
  requestedStyle: string,
  resolvedStyle: string,
): CalendarRecipeInstance["tokens"]["typography"]["caption"] => ({
  requestedFamily: "-apple-system",
  requestedStyle,
  requestSource: `@astryxdesign/core/src/theme/tokens.stylex.ts --font-family-body ${role}; Calendar inherits the body stack and names no first-party face`,
  fallbackChain: [
    { family: "-apple-system", style: requestedStyle },
    { family: "SF Pro", style: resolvedStyle },
    { family: "Segoe UI", style: resolvedStyle },
    {
      family: "Roboto",
      style: requestedStyle === "Semi Bold" ? "Medium" : "Regular",
    },
    {
      family: "Helvetica",
      style: requestedStyle === "Semi Bold" ? "Bold" : "Regular",
    },
    {
      family: "Arial",
      style: requestedStyle === "Semi Bold" ? "Bold" : "Regular",
    },
  ],
  resolvedFamily: "SF Pro",
  resolvedStyle,
  resolution: "fallback",
  degradation: `source ${ASTRYX_BODY_STACK}; Figma cannot load a CSS stack; first named host font is SF Pro ${resolvedStyle}`,
});
astryxTokens.typography = {
  caption: astryxFont("caption", "Semi Bold", "Semibold"),
  weekday: astryxFont("weekday", "Regular", "Regular"),
  day: astryxFont("day", "Regular", "Regular"),
};

export const astryxCalendarSource: ReviewedCalendarSource = {
  packageName: "@astryxdesign/core",
  version: "0.0.0-vendored",
  exportName: "Calendar",
  framework: "react",
  sourceRoot:
    "examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Calendar",
  anatomy: {
    root: "@astryxdesign/core/src/Calendar/Calendar.tsx header (nav+caption) + weekday row + week grid",
    grid: "default 6 weeks of seven day cells (42); day state varies within a week",
    weekdayRow:
      "Su–Sa labels (weekStartsOn default 0), measured to the --size-element-md column",
    week: "seven day cells; week number optional; ISO week from first in-month day",
    day: "grid slot --size-element-md 32px; inner day button --size-element-sm 28px circle (borderRadius 50%); default / today / selected / outside",
    dayAxis:
      "seven declared day columns; calendar@1 refuses hug cells in a column-bearing row",
  },
  api: {
    hasWeekNumbers: "hasWeekNumbers boolean — WeekNumbers on|off; source default false",
    hasOutsideDays:
      "hasOutsideDays boolean — receipted; calendar@1 has no blank-but-measured cell",
    selected: "selected day is content, not a live Date",
    extras: "no range, no dropdown month, no time, no react-day-picker adapter",
  },
  styleSources: [
    "@astryxdesign/core/src/Calendar/styles.ts cell height --size-element-md 32; day button --size-element-sm 28 circle; daysGrid has no gap; header.marginBottom --spacing-2; root padding --spacing-3 12; minWidth 220",
    "@astryxdesign/core/dist/astryx.css light-dark color pairs; light half carried",
  ],
  fontSources: [
    "@astryxdesign/core/src/theme/tokens.stylex.ts --font-family-body system stack; caption --font-weight-semibold; weekday/day normal; day --text-body-size 14; weekday --text-supporting-size 12 receipted",
  ],
};

/**
 * react-day-picker is the obvious second library and is DELIBERATELY not an
 * adapter. examples/day-picker/PROVENANCE.md holds it blind as the unseen-library
 * exam. Authoring it here would spend that asset. This is a named refusal, not
 * a missing file.
 */
export const REACT_DAY_PICKER_ADAPTER_REFUSAL = {
  packageName: "react-day-picker",
  version: "10.0.1",
  adapterAuthored: false,
  reason:
    "examples/day-picker/PROVENANCE.md blindness rule — unseen-library exam; do not spend it on this proof",
  eventzDatePicker:
    "extract/pilots/eventz/out/contracts/date-picker.contract.json is props: [] / anatomy: { root: {} }",
} as const;

const categoryForToken = (path: string): CalendarFactCategory => {
  if (path.includes("typography")) return "typography";
  if (path.includes("dayStates")) return "state";
  if (
    path.includes("background") ||
    path.includes("surface") ||
    path.includes("Text") ||
    path.includes(".text")
  )
    return "fill";
  return "geometry";
};

const tokenFacts = (
  sourceSlug: string,
  evidence: string,
  value: unknown,
  path = "tokens",
  facts: ReviewedCalendarSourceFact[] = [],
): ReviewedCalendarSourceFact[] => {
  if (value === null || typeof value !== "object") {
    if (path.startsWith("tokens.typography")) {
      facts.push({
        occurrenceId: `${sourceSlug}-ir-${facts.length + 1}`,
        category: "typography",
        source: {
          kind: "review",
          evidence: `${evidence}; reviewed font provenance field ${path}=${String(value)}`,
        },
        disposition: "ir",
        target: path,
      });
    }
    return facts;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.variable === "string" &&
    (typeof record.fallback === "string" || typeof record.fallback === "number")
  ) {
    facts.push({
      occurrenceId: `${sourceSlug}-ir-${facts.length + 1}`,
      category: categoryForToken(path),
      source: {
        kind: "review",
        evidence: `${evidence}; reviewed ${record.variable}=${record.fallback}`,
      },
      disposition: "ir",
      target: path,
    });
    return facts;
  }
  for (const [key, child] of Object.entries(record))
    tokenFacts(sourceSlug, evidence, child, `${path}.${key}`, facts);
  return facts;
};

export const CALENDAR_SINGLE_LIBRARY_PROOF_PROTOCOL = {
  artifactVersion: "calendar-single-library-proof-protocol-v1",
  frozenBeforeResults: true,
  resultStatus: "not-run",
  cellsPerSource: 4,
  totalCells: 4,
  cells: ["week-numbers-on", "week-numbers-off", "today", "selected"],
  expected: {
    calendarVariants: 2,
    weekVariants: 2,
    dayVariants: 4,
    components: 8,
  },
  comparison: {
    sourceReferencesRendered: false,
    aiGrading: false,
    liveFigma: false,
    secondLibrary: "named-refusal",
  },
} as const;

export const astryxCalendarInstance = {
  ...structuredClone(canonicalCalendarRecipeInstance),
  identity: { id: "astryx.calendar", name: "Astryx Calendar" },
  axes: {
    ...structuredClone(canonicalCalendarRecipeInstance.axes),
    weekNumbers: {
      ...canonicalCalendarRecipeInstance.axes.weekNumbers,
      default: "off",
    },
  },
  content: {
    /**
     * Pinned capture month, not the only month.
     * Vendored Calendar.doc.mjs / stories do not pin a date. Calendar.test.tsx
     * uses 2026-01-15. The docs showcase (cross-check only) pins 2026-04-15.
     * This capture uses that April 2026 month so the 6-row default, selected
     * 15, and Sunday-start grid match the live component people look at —
     * tokens stay vendored light-dark(), not the docs site theme.
     */
    caption: "April 2026",
    weekdays: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    weeks: [
      {
        id: "week-1",
        weekNumber: "14",
        days: [
          { label: "29", state: "outside" },
          { label: "30", state: "outside" },
          { label: "31", state: "outside" },
          { label: "1", state: "default" },
          { label: "2", state: "default" },
          { label: "3", state: "default" },
          { label: "4", state: "default" },
        ],
      },
      {
        id: "week-2",
        weekNumber: "14",
        days: [
          { label: "5", state: "default" },
          { label: "6", state: "default" },
          { label: "7", state: "default" },
          { label: "8", state: "default" },
          { label: "9", state: "default" },
          { label: "10", state: "default" },
          { label: "11", state: "default" },
        ],
      },
      {
        id: "week-3",
        weekNumber: "15",
        days: [
          { label: "12", state: "default" },
          { label: "13", state: "default" },
          { label: "14", state: "default" },
          { label: "15", state: "selected" },
          { label: "16", state: "default" },
          { label: "17", state: "default" },
          { label: "18", state: "default" },
        ],
      },
      {
        id: "week-4",
        weekNumber: "16",
        days: [
          { label: "19", state: "default" },
          { label: "20", state: "default" },
          { label: "21", state: "default" },
          { label: "22", state: "default" },
          { label: "23", state: "default" },
          { label: "24", state: "default" },
          { label: "25", state: "default" },
        ],
      },
      {
        id: "week-5",
        weekNumber: "17",
        days: [
          { label: "26", state: "default" },
          { label: "27", state: "default" },
          { label: "28", state: "default" },
          { label: "29", state: "default" },
          { label: "30", state: "default" },
          { label: "1", state: "outside" },
          { label: "2", state: "outside" },
        ],
      },
      {
        id: "week-6",
        weekNumber: "18",
        days: [
          { label: "3", state: "outside" },
          { label: "4", state: "outside" },
          { label: "5", state: "outside" },
          { label: "6", state: "outside" },
          { label: "7", state: "outside" },
          { label: "8", state: "outside" },
          { label: "9", state: "outside" },
        ],
      },
    ],
    selectedDayLabel: "15",
    todayDayLabel: "1",
  },
  tokens: astryxTokens,
  receipts: [
    {
      fact: {
        path: "@astryxdesign/core/src/Calendar/Calendar.tsx#/props/hasOutsideDays",
        channel: "variant-axis",
      },
      value:
        "hasOutsideDays: boolean (default true) — show days from adjacent months",
      reason: "no-figma-primitive",
      evidence:
        "Hiding an outside day means the cell renders nothing while the grid keeps its shape, and calendar@1 has no primitive for 'present, measured, and showing no text'. It was briefly modelled as a variant axis and that was worse: OutsideDays=show and OutsideDays=hide compiled to byte-identical content, so the axis decided nothing while a designer could still click it. Dropped and named rather than faked. react-day-picker declares the same prop as showOutsideDays. docs/32 §5.",
    },
    {
      fact: {
        path: "@astryxdesign/core/dist/astryx.css#/color-tokens",
        channel: "color-scheme",
      },
      value: "light-dark(<light>, <dark>)",
      reason: "lowered",
      evidence:
        "@astryxdesign/core resolves every colour through CSS light-dark() pairs. calendar@1 carries one mode, so the light half is carried and the dark half is dropped here. Named so a reader can act on it: the dark half is a second Figma variable mode, not a missing colour. docs/32 §5.",
    },
    {
      fact: {
        path: "@astryxdesign/core/src/Calendar/styles.ts#/monthGridStyles/daysGrid",
        channel: "geometry",
      },
      value: "display:grid; gridTemplateColumns:repeat(7, 1fr); no gap",
      reason: "refused-by-recipe",
      evidence:
        "daysGrid declares no gap. A previous adapter minted gridGap=8 from header gap --spacing-2. That token is real on the header, not on the day grid. Carried gridGap is 0.",
    },
    {
      fact: {
        path: "@astryxdesign/core/src/Calendar/styles.ts#/monthGridStyles/dayName/fontSize",
        channel: "typography",
      },
      value: "--text-supporting-size 12px",
      reason: "lowered",
      evidence:
        "Weekday and week-number text are --text-supporting-size 12px. Caption and day are --font-size-base 14px. calendar@1 has one dayCell.fontSize; it carries 14 (the day required fact). Weekday 12 is named.",
    },
    {
      fact: {
        path: "@astryxdesign/core/src/Calendar/styles.ts#/dayCellStyles/dayOutside",
        channel: "state",
      },
      value: "opacity 0.5 plus --color-text-secondary",
      reason: "no-figma-primitive",
      evidence:
        "Outside days set color to --color-text-secondary AND opacity 0.5. calendar@1 dayStates carry colour only; the 0.5 opacity is named rather than invented as a fill.",
    },
    {
      fact: {
        path: "@astryxdesign/core/src/Calendar/styles.ts#/calendarStyles/calendar/background",
        channel: "fill",
      },
      value: "Calendar.tsx paints no background",
      reason: "refused-by-recipe",
      evidence:
        "--color-background-surface exists on the theme and is not applied by Calendar.tsx. Carried surface is transparent. Minting #FFFFFF would invent a fill.",
    },
    {
      fact: {
        path: "@astryxdesign/core/src/Calendar/styles.ts#/monthGridStyles/dayName/paddingBottom",
        channel: "geometry",
      },
      value:
        "height calc(--size-element-md + --spacing-1); paddingBottom --spacing-1 4px",
      reason: "lowered",
      evidence:
        "calendar@1 has one caption-stack gap. This PREPARE carries header.marginBottom --spacing-2 as variant itemSpacing. dayName extra 4px below weekdays is named here, not minted as a second gap token. Applying the stack gap also spaces weekday-row from the day grid.",
    },
  ],
  inputFacts: [
    {
      path: "@astryxdesign/core/src/Calendar/Calendar.tsx#/props/hasOutsideDays",
      channel: "variant-axis",
    },
    {
      path: "@astryxdesign/core/dist/astryx.css#/color-tokens",
      channel: "color-scheme",
    },
    {
      path: "@astryxdesign/core/src/Calendar/styles.ts#/monthGridStyles/daysGrid",
      channel: "geometry",
    },
    {
      path: "@astryxdesign/core/src/Calendar/styles.ts#/monthGridStyles/dayName/fontSize",
      channel: "typography",
    },
    {
      path: "@astryxdesign/core/src/Calendar/styles.ts#/dayCellStyles/dayOutside",
      channel: "state",
    },
    {
      path: "@astryxdesign/core/src/Calendar/styles.ts#/calendarStyles/calendar/background",
      channel: "fill",
    },
    {
      path: "@astryxdesign/core/src/Calendar/styles.ts#/monthGridStyles/dayName/paddingBottom",
      channel: "geometry",
    },
  ],
  provenance: {
    source:
      "examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Calendar",
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
        note: "one reviewed @astryxdesign/core Calendar to calendar@1 selection",
      },
    },
  },
} as unknown as CalendarRecipeInstance;

const astryxSourceFacts = (): ReviewedCalendarSourceFact[] => {
  const facts = tokenFacts(
    "astryx",
    "@astryxdesign/core Calendar source/style review",
    astryxCalendarInstance.tokens,
  );
  facts.push(
    {
      occurrenceId: "astryx-anatomy-days",
      category: "anatomy",
      source: {
        kind: "pointer",
        pointer: "/anatomy/dayAxis",
        expected: astryxCalendarSource.anatomy.dayAxis,
      },
      disposition: "ir",
      target: "content.weeks",
    },
    {
      occurrenceId: "astryx-anatomy-grid",
      category: "anatomy",
      source: {
        kind: "pointer",
        pointer: "/anatomy/grid",
        expected: astryxCalendarSource.anatomy.grid,
      },
      disposition: "ir",
      target: "content.weekdays",
    },
    {
      occurrenceId: "astryx-refusal-outside-days",
      category: "refusal",
      source: {
        kind: "pointer",
        pointer: "/api/hasOutsideDays",
        expected: astryxCalendarSource.api.hasOutsideDays,
      },
      disposition: "refusal",
      target:
        "hasOutsideDays / showOutsideDays dropped; calendar@1 has no blank-but-measured cell",
      receiptReason: "no-figma-primitive",
    },
    {
      occurrenceId: "astryx-refusal-dark-mode",
      category: "refusal",
      source: {
        kind: "review",
        evidence:
          "@astryxdesign/core/dist/astryx.css light-dark pairs; calendar@1 carries one mode",
      },
      disposition: "refusal",
      target: "dark half of every light-dark() colour pair",
      receiptReason: "lowered",
    },
    {
      occurrenceId: "astryx-refusal-day-picker",
      category: "refusal",
      source: {
        kind: "review",
        evidence: REACT_DAY_PICKER_ADAPTER_REFUSAL.reason,
      },
      disposition: "refusal",
      target:
        "react-day-picker@10.0.1 held blind; no second-library adapter authored",
      receiptReason: "refused-by-recipe",
    },
    {
      occurrenceId: "astryx-refusal-day-grid-gap",
      category: "refusal",
      source: {
        kind: "review",
        evidence:
          "styles.ts daysGrid has no gap; header --spacing-2 is not the day grid",
      },
      disposition: "refusal",
      target: "invented 8px day-grid gap from header --spacing-2",
      receiptReason: "refused-by-recipe",
    },
    {
      occurrenceId: "astryx-refusal-weekday-12",
      category: "refusal",
      source: {
        kind: "review",
        evidence:
          "weekday --text-supporting-size 12px; day/caption --font-size-base 14px",
      },
      disposition: "refusal",
      target: "weekday 12px collapsed onto dayCell.fontSize 14",
      receiptReason: "lowered",
    },
    {
      occurrenceId: "astryx-refusal-outside-opacity",
      category: "refusal",
      source: {
        kind: "review",
        evidence: "dayOutside opacity 0.5 plus --color-text-secondary",
      },
      disposition: "refusal",
      target: "outside-day opacity 0.5",
      receiptReason: "no-figma-primitive",
    },
    {
      occurrenceId: "astryx-refusal-unpainted-surface",
      category: "refusal",
      source: {
        kind: "review",
        evidence:
          "Calendar.tsx paints no background; --color-background-surface is not applied",
      },
      disposition: "refusal",
      target: "unpainted surface; #FFFFFF would invent a fill",
      receiptReason: "refused-by-recipe",
    },
    {
      occurrenceId: "astryx-refusal-dayname-padding",
      category: "refusal",
      source: {
        kind: "review",
        evidence:
          "styles.ts dayName paddingBottom --spacing-1 4px; calendar@1 has one caption-stack gap",
      },
      disposition: "refusal",
      target:
        "dayName paddingBottom --spacing-1 collapsed onto one caption-stack gap",
      receiptReason: "lowered",
    },
  );
  return facts;
};

export const astryxCalendarAdapterConfig = ((): ReviewedCalendarAdapterConfig => {
  const sourceFacts = astryxSourceFacts();
  const manualMappings = sourceFacts.map(
    (fact) => `${fact.occurrenceId}→${fact.disposition}:${fact.target}`,
  );
  return {
    sourcePath: "recipe/fixtures/library-calendars.ts#astryxCalendarAdapterConfig",
    generatedAt: "2026-08-29T00:00:00.000Z",
    selection: {
      candidates: [{ id: "calendar", version: 1 }],
      selectedBy: "recipe-pivot-calendar-review",
      mechanism: "reviewed-config",
      source: "recipe/fixtures/library-calendars.ts#astryx",
      reviewedAt: "2026-08-29T00:00:00.000Z",
      manualCost: {
        value: manualMappings.length,
        unit: "reviewed-mapping",
        note: `${manualMappings.length} explicit occurrence mappings plus source setup; no source-name inference; no react-day-picker adapter`,
      },
    },
    identity: { id: "astryx.calendar", name: "Astryx Calendar" },
    content: structuredClone(astryxCalendarInstance.content),
    tokens: structuredClone(astryxCalendarInstance.tokens),
    axes: structuredClone(astryxCalendarInstance.axes),
    sourceFacts,
    manualMappings,
    receipts: structuredClone(astryxCalendarInstance.receipts),
    benchmark: {
      packageName: astryxCalendarSource.packageName,
      version: astryxCalendarSource.version,
      exportName: astryxCalendarSource.exportName,
      importPath: astryxCalendarSource.packageName,
      wrapper: "astryx Calendar caption + weekday row + day grid",
      setupSeconds: 16,
      sourceHarness: astryxCalendarSource.sourceRoot,
      sourceMatrixCells: CALENDAR_SINGLE_LIBRARY_PROOF_PROTOCOL.cellsPerSource,
      unsupportedCells: [
        "range-selection",
        "dropdown-month",
        "time",
        "react-day-picker",
        "antd-datepicker",
        "mui-datepicker",
      ],
      captureCommand:
        "deferred: source references must be rendered in a separately authorized matched-benchmark task",
      renderedReferences: false,
      graded: false,
    },
  };
})();


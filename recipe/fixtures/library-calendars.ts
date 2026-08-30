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
 * through `dist/astryx.css`:
 *
 *   day cell w/h   --size-element-md            32px
 *   grid gap       --spacing-2                   8px
 *   cell padding   --spacing-1                   4px
 *   cell radius    --radius-inner                4px
 *   day font size  --text-supporting-size -> --font-size-sm   0.75rem = 12px
 *   text primary   --color-text-primary         #0A1317
 *   text secondary --color-text-secondary       #4E606F
 *   accent         --color-accent               #0064E0
 *   on accent      --color-on-accent            #FFFFFF
 *   today ring     --color-border-emphasized    #CCD3DB, inset 0 0 0 1px
 *   surface        --color-background-surface   #FFFFFF
 *
 * Light mode is taken from each `light-dark(...)` pair; the dark half is a mode
 * this recipe does not yet carry, and that is a receipt, not a silent drop.
 */
const astryxTokens = cloneTokens("astryx.calendar", (path, fallback) => {
  if (path === "dayCell.size") return 32;
  if (path === "dayCell.padding") return 4;
  if (path === "dayCell.fontSize") return 12;
  if (path === "dayCell.radius") return 4;
  if (path === "gridGap") return 8;
  if (path === "surface") return "#ffffffff";
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
astryxTokens.typography = {
  caption: {
    requestedFamily: "Inter",
    requestedStyle: "Semi Bold",
    requestSource:
      "@astryxdesign/core/src/Calendar/styles.ts caption fontWeight --font-weight-semibold",
    fallbackChain: [
      { family: "Inter", style: "Semi Bold" },
      { family: "Arial", style: "Bold" },
    ],
    resolvedFamily: "Inter",
    resolvedStyle: "Semi Bold",
    resolution: "requested",
  },
  weekday: {
    requestedFamily: "Inter",
    requestedStyle: "Regular",
    requestSource:
      "@astryxdesign/core/src/Calendar/styles.ts weekday fontWeight --font-weight-normal",
    fallbackChain: [
      { family: "Inter", style: "Regular" },
      { family: "Arial", style: "Regular" },
    ],
    resolvedFamily: "Inter",
    resolvedStyle: "Regular",
    resolution: "requested",
  },
  day: {
    requestedFamily: "Inter",
    requestedStyle: "Regular",
    requestSource:
      "@astryxdesign/core/src/Calendar/styles.ts day fontSize --text-supporting-size",
    fallbackChain: [
      { family: "Inter", style: "Regular" },
      { family: "Arial", style: "Regular" },
    ],
    resolvedFamily: "Inter",
    resolvedStyle: "Regular",
    resolution: "requested",
  },
};

export const astryxCalendarSource: ReviewedCalendarSource = {
  packageName: "@astryxdesign/core",
  version: "0.0.0-vendored",
  exportName: "Calendar",
  framework: "react",
  sourceRoot:
    "examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Calendar",
  anatomy: {
    root: "@astryxdesign/core/src/Calendar/Calendar.tsx caption + weekday row + week grid",
    grid: "weeks of seven day cells; day state varies within a week",
    weekdayRow: "Mo–Su labels, measured to the day column",
    week: "seven day cells; week number optional",
    day: "fixed 32px box; default / today / selected / outside",
    dayAxis:
      "seven declared day columns; calendar@1 refuses hug cells in a column-bearing row",
  },
  api: {
    hasWeekNumbers: "hasWeekNumbers boolean — WeekNumbers on|off",
    hasOutsideDays:
      "hasOutsideDays boolean — receipted; calendar@1 has no blank-but-measured cell",
    selected: "selected day is content, not a live Date",
    extras: "no range, no dropdown month, no time, no react-day-picker adapter",
  },
  styleSources: [
    "@astryxdesign/core/src/Calendar/styles.ts --size-element-md 32, --spacing-2 8, --spacing-1 4, --radius-inner 4",
    "@astryxdesign/core/dist/astryx.css light-dark color pairs; light half carried",
  ],
  fontSources: [
    "@astryxdesign/core/src/Calendar/styles.ts caption semibold, weekday/day normal, --font-size-sm 12",
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


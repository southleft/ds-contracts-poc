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

export const astryxCalendarInstance = {
  ...structuredClone(canonicalCalendarRecipeInstance),
  identity: { id: "astryx.calendar", name: "Astryx Calendar" },
  tokens: astryxTokens,
  receipts: [
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

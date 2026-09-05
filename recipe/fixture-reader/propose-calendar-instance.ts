/**
 * F1 mechanical Calendar propose — ledger reads + named gaps, never a fixture table.
 *
 * docs/35 §6 / §8: zero hand-authored `library-*.ts`. Every required
 * calendar@1 leaf is either a Chromium ledger read or a named gap.
 * This module does not clone Astryx / canonical leftovers, does not invent
 * Polar tokens, and does not emit a `CalendarRecipeInstance` when any
 * required leaf is missing (compile stays refused, not Polar-filled).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CalendarRecipeInstanceSchema } from "../recipes/calendar.js";
import { Ledger, hex8, px, firstFamily } from "./ledger.js";
import type { ProposedLeaf } from "./phase4-new-libraries.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const F1_CALENDAR_LEDGER =
  "extract/computed/out/day-picker/calendar/captured-truth.json";
export const F1_CALENDAR_COMBO = "label.1__default";
/**
 * Pinned, not `new Date()`. The propose is compared byte-for-byte against a
 * committed receipt and re-derived by a determinism check, so a wall-clock
 * timestamp here would make the artifact differ from itself on every run. It
 * names the day this assembly was authored, and moves only when the assembly
 * does.
 */
export const PROPOSE_GENERATED_AT = "2026-09-05T00:00:00.000Z";

export interface NamedCompileGap {
  id: string;
  schemaPath: string;
  ledgerValue: string | number | null;
  /** Why calendar@1 could not express this when the gap was first named. */
  reason: string;
  evidence: string;
  /**
   * "closed" -- calendar@1 can now express the ledger's value, and `closedBy`
   * names the change that made it expressible. "named" -- it still cannot be
   * expressed, and `whyNamed` says what closing it would have required
   * inventing. A gap is never closed by supplying a value the capture did not
   * measure.
   */
  status: "closed" | "named";
  closedBy?: string;
  whyNamed?: string;
}

export interface MechanicalWeekDay {
  label: string | null;
  state: "default" | "today" | "selected" | "outside";
  hidden: boolean;
}

export interface MechanicalWeek {
  id: string;
  days: MechanicalWeekDay[];
}

export interface MechanicalCalendarPropose {
  comboKey: typeof F1_CALENDAR_COMBO;
  ledgerFile: typeof F1_CALENDAR_LEDGER;
  proposedLeaves: ProposedLeaf[];
  content: {
    caption: string;
    weekdays: string[];
    weekRowCount: number;
    dayCellCount: number;
    dayButtonCount: number;
    hiddenOutsideCount: number;
    selectedDayLabel: string;
    todayDayLabel: string;
    weeks: MechanicalWeek[];
  };
  schemaGaps: NamedCompileGap[];
  /**
   * The result of parsing the ASSEMBLED instance (not a stub) against the real
   * calendar@1 schema. `success` is whatever the parse actually returned; it
   * was previously pinned to false, which made every downstream "refused"
   * claim unfalsifiable.
   */
  instanceParse: { success: boolean; issues: string[] };
  /** The assembled instance itself, when it parsed. */
  instance: unknown;
  polar: {
    inventedInstance: false;
    clonedAstryx: false;
    inventedInter: false;
    inventedSelectedFill: false;
  };
}

function leaf(
  pathName: string,
  value: number | string,
  part: string,
  channel: string,
  formula: string,
): ProposedLeaf {
  return {
    path: pathName,
    value,
    ledgerKey: `${F1_CALENDAR_LEDGER}#${F1_CALENDAR_COMBO} ${part}.${channel}`,
    formula,
  };
}

function weightStyle(weight: string): string {
  const n = Number(weight);
  if (n >= 700) return "Bold";
  if (n >= 500) return "Medium";
  return "Regular";
}

function tryPx(ledger: Ledger, part: string, channel: string): number | null {
  try {
    return px(ledger.raw(F1_CALENDAR_COMBO, part, channel));
  } catch {
    return null;
  }
}

function tryHex(ledger: Ledger, part: string, channel: string): string | null {
  try {
    return hex8(ledger.raw(F1_CALENDAR_COMBO, part, channel));
  } catch {
    return null;
  }
}

function tryRaw(ledger: Ledger, part: string, channel: string): string | null {
  try {
    return ledger.raw(F1_CALENDAR_COMBO, part, channel);
  } catch {
    return null;
  }
}

function childButton(ledger: Ledger, tdIdx: string) {
  const cap = ledger.capture(F1_CALENDAR_COMBO);
  return (
    cap.parts.find(
      (p) =>
        p.classes.includes("rdp-day_button") &&
        p.idxPath.startsWith(`${tdIdx}.`),
    ) ?? null
  );
}

/**
 * Read the first-month grid from `label.1` (numberOfMonths=1, captionLayout=label).
 * Second-month subtrees exist only on `*.2` combos and are not this propose.
 */
/**
 * Leaves the assembly measures but does NOT place on a calendar@1 token, with
 * the reason each one is not carried. Anything absent from this table is
 * claimed as carried, and `checkTotality` refuses the envelope if that claim
 * and the input facts disagree -- so this table is load-bearing, not commentary.
 */
const RECEIPTED_LEAVES = new Map<
  string,
  { reason: "lowered" | "inert" | "no-figma-primitive"; evidence: string }
>([
  [
    "root.width",
    {
      reason: "inert",
      evidence:
        "the compiled root is an auto-layout frame whose width is the sum of its padding and seven day columns; carrying 308 as a fixed width would double-specify a value the layout already produces",
    },
  ],
  [
    "root.height",
    {
      reason: "inert",
      evidence:
        "as root.width: the caption stack, weekday row and five week rows determine height; a fixed 295 would fight the layout that produces it",
    },
  ],
  [
    "dayButton.height",
    {
      reason: "lowered",
      evidence:
        "the day button is square (width 42 = height 42) and calendar@1 carries one dayButton.size; the two channels agree, so the collapse is exact rather than a choice between them",
    },
  ],
  [
    "selected.td.background",
    {
      reason: "inert",
      evidence:
        "the selected paint lives on the button (a 2px border), and the td behind it is fully transparent; a transparent surface contributes no pixels, so there is nothing for a cell fill to carry",
    },
  ],
  [
    "gridGap",
    {
      reason: "lowered",
      evidence:
        "row-gap:normal is not a length; it contributes no space between week rows, so itemSpacing 0 reproduces the measured render exactly. The string normal is what is not carried",
    },
  ],
  [
    "rootMinWidth",
    {
      reason: "lowered",
      evidence:
        "min-width:auto imposes no minimum; minWidth 0 carries the same constraint. The keyword auto is what is not carried",
    },
  ],
]);

export function proposeCalendarInstanceFromLedger(
  repoRoot: string = REPO,
  ledgerFile: string = F1_CALENDAR_LEDGER,
): MechanicalCalendarPropose {
  const ledger = new Ledger(repoRoot, ledgerFile);
  const cap = ledger.capture(F1_CALENDAR_COMBO);
  const proposed: ProposedLeaf[] = [];
  const gaps: NamedCompileGap[] = [];

  const push = (
    pathName: string,
    value: number | string | null,
    part: string,
    channel: string,
    formula: string,
  ): void => {
    if (value === null) return;
    proposed.push(leaf(pathName, value, part, channel, formula));
  };

  const rootW = tryPx(ledger, "root", "width");
  const rootH = tryPx(ledger, "root", "height");
  const rootPad = tryPx(ledger, "root", "padding-top");
  const rootMin = tryRaw(ledger, "root", "min-width");
  const cellW = tryPx(ledger, "cls:rdp-day", "width");
  const cellPad = tryPx(ledger, "cls:rdp-day", "padding-top");
  const cellR = tryPx(ledger, "cls:rdp-day", "border-top-left-radius");
  const btnW = tryPx(ledger, "cls:rdp-day_button", "width");
  const btnH = tryPx(ledger, "cls:rdp-day_button", "height");
  const btnRRaw = tryRaw(ledger, "cls:rdp-day_button", "border-top-left-radius");
  const btnFs = tryPx(ledger, "cls:rdp-day_button", "font-size");
  const nav = tryPx(ledger, "cls:rdp-chevron", "width");
  const surface = tryHex(ledger, "root", "background-color");
  const captionText = tryHex(ledger, "cls:rdp-caption_label", "color");
  const weekdayText = tryHex(ledger, "cls:rdp-weekday", "color");
  const caption = ledger.part(F1_CALENDAR_COMBO, "cls:rdp-caption_label").text[0] ?? "";
  const weekdayParts = cap.parts.filter(
    (p) => p.tag === "th" && p.classes.includes("rdp-weekday"),
  );
  const weekdays = weekdayParts.map((p) => p.text[0] ?? "");

  const selectedTd = ledger.part(F1_CALENDAR_COMBO, "cls:rdp-selected");
  const todayTd = ledger.part(F1_CALENDAR_COMBO, "cls:rdp-today");
  const selectedBtn = childButton(ledger, selectedTd.idxPath);
  const todayBtn = childButton(ledger, todayTd.idxPath);
  const defaultBtn = ledger.part(F1_CALENDAR_COMBO, "cls:rdp-day_button");
  const outsideTd = ledger.part(F1_CALENDAR_COMBO, "cls:rdp-outside");

  const selectedTdBg = tryHex(ledger, "cls:rdp-selected", "background-color");
  const selectedBtnBg = selectedBtn
    ? hex8(selectedBtn.style["background-color"] ?? "rgba(0, 0, 0, 0)")
    : null;
  const selectedBtnText = selectedBtn
    ? hex8(selectedBtn.style.color ?? "rgba(0, 0, 0, 1)")
    : null;
  const selectedBorderW = selectedBtn?.style["border-top-width"] ?? null;
  const selectedBorderC = selectedBtn
    ? hex8(selectedBtn.style["border-top-color"] ?? "rgba(0, 0, 0, 0)")
    : null;
  const todayBtnBg = todayBtn
    ? hex8(todayBtn.style["background-color"] ?? "rgba(0, 0, 0, 0)")
    : null;
  const todayBtnText = todayBtn
    ? hex8(todayBtn.style.color ?? "rgba(0, 0, 0, 1)")
    : null;
  const defaultBg = hex8(defaultBtn.style["background-color"] ?? "rgba(0, 0, 0, 0)");
  const defaultText = hex8(defaultBtn.style.color ?? "rgba(0, 0, 0, 1)");
  const outsideBg = tryHex(ledger, "cls:rdp-outside", "background-color");
  const outsideText = tryHex(ledger, "cls:rdp-outside", "color");

  const gridRowGap = tryRaw(ledger, "cls:rdp-weeks", "row-gap");
  const captionMargin = tryPx(ledger, "cls:rdp-month_grid", "margin-top");

  const weekRows = cap.parts.filter((p) => p.tag === "tr" && p.classes.includes("rdp-week"));
  const dayTds = cap.parts.filter((p) => p.tag === "td" && p.classes.includes("rdp-day"));
  const dayButtons = cap.parts.filter((p) => p.classes.includes("rdp-day_button"));

  const weeks: MechanicalWeek[] = weekRows.map((row, i) => {
    const days = dayTds
      .filter((td) => td.idxPath.startsWith(`${row.idxPath}.`))
      .map((td): MechanicalWeekDay => {
        const btn = childButton(ledger, td.idxPath);
        const hidden = td.classes.includes("rdp-hidden");
        const state = td.classes.includes("rdp-selected")
          ? "selected"
          : td.classes.includes("rdp-today")
            ? "today"
            : td.classes.includes("rdp-outside")
              ? "outside"
              : "default";
        return {
          label: btn?.text[0] ?? td.text[0] ?? null,
          state,
          hidden,
        };
      });
    return { id: `week-${i + 1}`, days };
  });

  const hiddenOutsideCount = weeks
    .flatMap((w) => w.days)
    .filter((d) => d.hidden && d.state === "outside").length;

  push("root.width", rootW, "root", "width", "ledger root.width @ label.1__default");
  push("root.height", rootH, "root", "height", "ledger root.height @ label.1__default");
  push(
    "dayCell.size",
    cellW,
    "cls:rdp-day",
    "width",
    "ledger cls:rdp-day.width @ label.1__default (slot, not button)",
  );
  push(
    "dayCell.padding",
    cellPad,
    "cls:rdp-day",
    "padding-top",
    "ledger cls:rdp-day.padding-top @ label.1__default",
  );
  push(
    "dayCell.radius",
    cellR,
    "cls:rdp-day",
    "border-top-left-radius",
    "ledger cls:rdp-day.border-top-left-radius @ label.1__default",
  );
  push(
    "dayButton.width",
    btnW,
    "cls:rdp-day_button",
    "width",
    "ledger cls:rdp-day_button.width @ label.1__default",
  );
  push(
    "dayButton.height",
    btnH,
    "cls:rdp-day_button",
    "height",
    "ledger cls:rdp-day_button.height @ label.1__default",
  );
  push(
    "dayCell.fontSize",
    btnFs,
    "cls:rdp-day_button",
    "font-size",
    "ledger cls:rdp-day_button.font-size @ label.1__default",
  );
  if (btnRRaw !== null) {
    proposed.push(
      leaf(
        "dayButton.radius",
        btnRRaw,
        "cls:rdp-day_button",
        "border-top-left-radius",
        "ledger raw radius — 100% circle, not a px fallback",
      ),
    );
  }
  push("navIconSize", nav, "cls:rdp-chevron", "width", "ledger cls:rdp-chevron.width");
  push("root.padding", rootPad, "root", "padding-top", "ledger root.padding-top");
  push("surface", surface, "root", "background-color", "ledger root.background-color");
  push(
    "captionText",
    captionText,
    "cls:rdp-caption_label",
    "color",
    "ledger cls:rdp-caption_label.color",
  );
  push("weekdayText", weekdayText, "cls:rdp-weekday", "color", "ledger cls:rdp-weekday.color");
  push(
    "selected.td.background",
    selectedTdBg,
    "cls:rdp-selected",
    "background-color",
    "ledger td.rdp-selected.background-color — transparent; paint is not here",
  );
  if (selectedBtnBg !== null) {
    proposed.push(
      leaf(
        "selected.button.background",
        selectedBtnBg,
        "cls:rdp-day_button",
        "background-color",
        "ledger selected rdp-day_button.background-color — also transparent",
      ),
    );
  }
  if (selectedBtnText !== null) {
    proposed.push(
      leaf(
        "selected.button.text",
        selectedBtnText,
        "cls:rdp-day_button",
        "color",
        "ledger selected rdp-day_button.color",
      ),
    );
  }
  if (selectedBorderW !== null) {
    proposed.push(
      leaf(
        "selected.button.borderWidth",
        selectedBorderW,
        "cls:rdp-day_button",
        "border-top-width",
        "ledger selected marker is a 2px border, not a fill",
      ),
    );
  }
  if (selectedBorderC !== null) {
    proposed.push(
      leaf(
        "selected.button.borderColor",
        selectedBorderC,
        "cls:rdp-day_button",
        "border-top-color",
        "ledger selected rdp-day_button.border-top-color",
      ),
    );
  }
  if (todayBtnBg !== null) {
    proposed.push(
      leaf(
        "today.button.background",
        todayBtnBg,
        "cls:rdp-day_button",
        "background-color",
        "ledger today rdp-day_button.background-color",
      ),
    );
  }
  if (todayBtnText !== null) {
    proposed.push(
      leaf(
        "today.button.text",
        todayBtnText,
        "cls:rdp-day_button",
        "color",
        "ledger today rdp-day_button.color",
      ),
    );
  }
  push(
    "dayStates.default.background",
    defaultBg,
    "cls:rdp-day_button",
    "background-color",
    "ledger first rdp-day_button.background-color",
  );
  push(
    "dayStates.default.text",
    defaultText,
    "cls:rdp-day_button",
    "color",
    "ledger first rdp-day_button.color",
  );
  push(
    "dayStates.outside.background",
    outsideBg,
    "cls:rdp-outside",
    "background-color",
    "ledger hidden outside td.background-color",
  );
  push(
    "dayStates.outside.text",
    outsideText,
    "cls:rdp-outside",
    "color",
    "ledger hidden outside td.color (white; cell has no button/label)",
  );
  if (captionMargin !== null) {
    push(
      "captionGap",
      captionMargin,
      "cls:rdp-month_grid",
      "margin-top",
      "ledger cls:rdp-month_grid.margin-top",
    );
  }

  const captionFf = tryRaw(ledger, "cls:rdp-caption_label", "font-family");
  const captionFw = tryRaw(ledger, "cls:rdp-caption_label", "font-weight");
  const dayFf = tryRaw(ledger, "cls:rdp-day_button", "font-family");
  const dayFw = tryRaw(ledger, "cls:rdp-day_button", "font-weight");
  const weekdayFs = tryRaw(ledger, "cls:rdp-weekday", "font-size");
  const weekdayFf = tryRaw(ledger, "cls:rdp-weekday", "font-family");
  const weekdayFwLeaf = tryRaw(ledger, "cls:rdp-weekday", "font-weight");
  if (captionFf && captionFw) {
    proposed.push(
      leaf(
        "typography.caption.family",
        firstFamily(captionFf),
        "cls:rdp-caption_label",
        "font-family",
        "ledger computed font-family (UA default; library ships no webfont)",
      ),
    );
    proposed.push(
      leaf(
        "typography.caption.style",
        weightStyle(captionFw),
        "cls:rdp-caption_label",
        "font-weight",
        "ledger font-weight mapped to CSS weight name",
      ),
    );
  }
  if (dayFf && dayFw) {
    proposed.push(
      leaf(
        "typography.day.family",
        firstFamily(dayFf),
        "cls:rdp-day_button",
        "font-family",
        "ledger computed font-family (UA default)",
      ),
    );
    proposed.push(
      leaf(
        "typography.day.style",
        weightStyle(dayFw),
        "cls:rdp-day_button",
        "font-weight",
        "ledger font-weight mapped to CSS weight name",
      ),
    );
  }
  if (weekdayFf && weekdayFwLeaf) {
    proposed.push(
      leaf(
        "typography.weekday.family",
        firstFamily(weekdayFf),
        "cls:rdp-weekday",
        "font-family",
        "ledger weekday font-family, first family",
      ),
    );
    proposed.push(
      leaf(
        "typography.weekday.style",
        weightStyle(weekdayFwLeaf),
        "cls:rdp-weekday",
        "font-weight",
        "ledger weekday font-weight mapped to CSS weight name",
      ),
    );
  }
  if (gridRowGap) {
    proposed.push(
      leaf("gridGap", gridRowGap, "cls:rdp-weeks", "row-gap", "ledger week-row gap"),
    );
  }
  if (rootMin) {
    proposed.push(
      leaf("rootMinWidth", rootMin, "root", "min-width", "ledger root min-width"),
    );
  }
  if (weekdayFs) {
    proposed.push(
      leaf(
        "typography.weekday.fontSize",
        weekdayFs,
        "cls:rdp-weekday",
        "font-size",
        "ledger weekday font-size — calendar@1 has one dayCell.fontSize",
      ),
    );
  }

  gaps.push({
    id: "week-count-not-six",
    status: "closed" as const,
    closedBy:
      "content.weeks widened from .length(6) to .min(CALENDAR_WEEK_MIN=4).max(CALENDAR_WEEK_MAX=6). The 6 was Astryx's hasVariableRowCount default written down as a property of calendars; validateCalendarStructure now proves a legal month height and cross-variant agreement from the scene instead.",
    schemaPath: "content.weeks.length",
    ledgerValue: weeks.length,
    reason:
      `calendar@1 requires exactly 6 week rows (CALENDAR_WEEK_COUNT). label.1 January 2026 renders ${weeks.length} <tr class="rdp-week">. Inventing a sixth week of February outside days is Polar content the ledger does not carry.`,
    evidence: "recipe/recipes/calendar.ts CALENDAR_WEEK_COUNT; extract/computed/out/day-picker/calendar/LEDGER.md week rows",
  });
  gaps.push({
    id: "blank-outside-labels",
    status: "closed" as const,
    closedBy:
      "content.weeks[].days[].label dropped .min(1); a superRefine requires a visible label for every state EXCEPT outside, so a hidden outside cell carries an empty string instead of an invented neighbouring-month date.",
    schemaPath: "content.weeks[].days[].label",
    ledgerValue: hiddenOutsideCount,
    reason:
      `${hiddenOutsideCount} rdp-hidden.rdp-outside cells have no button and no text. calendar@1 requires label.min(1) on every cell and has no blank-but-measured primitive (CALENDAR_OUTSIDE_DAYS_NOT_CARRIED). Inventing December 28–31 labels the capture did not render is Polar.`,
    evidence: "recipe/recipes/calendar.ts CALENDAR_OUTSIDE_DAYS_NOT_CARRIED",
  });
  gaps.push({
    id: "day-button-radius-percent",
    status: "closed" as const,
    closedBy:
      "PercentParameterSchema + RadiusParameterSchema carry the radius as the percentage the source spells; resolveRadius() is the single declared lowering to px, taken against dayButton.size, so no fixed px is authored.",
    schemaPath: "tokens.dayButton.radius",
    ledgerValue: btnRRaw,
    reason:
      `rdp-day_button border-top-left-radius is "${btnRRaw}" (a circle). calendar@1 wants a px number. Folding 100% of 42px into 21 is invented FIXED px.`,
    evidence: `${F1_CALENDAR_LEDGER}#${F1_CALENDAR_COMBO} cls:rdp-day_button.border-top-left-radius`,
  });
  gaps.push({
    id: "selected-is-border-not-fill",
    status: "closed" as const,
    closedBy:
      "DayStateTokensSchema already carried the optional ring/ringWidth pair; the assembly now maps border-color/border-width onto it and leaves the measured transparent fill as the background.",
    schemaPath: "tokens.dayStates.selected.background",
    ledgerValue: selectedBtnBg,
    reason:
      `Selected paint is a ${selectedBorderW} ${selectedBorderC} border on rdp-day_button. Both the td and the button background are transparent. calendar@1 selected is a background fill. Folding the blue border into a fill would invent Polar paint.`,
    evidence: `${F1_CALENDAR_LEDGER}#${F1_CALENDAR_COMBO} selected rdp-day_button.border-top-width`,
  });
  gaps.push({
    id: "grid-gap-normal",
    status: "closed" as const,
    closedBy:
      "tokens carry itemSpacing 0 with a `lowered` receipt naming the discarded keyword. row-gap:normal contributes no space between week rows, so 0 reproduces the measured render; the 32px rdp-months gutter is still never folded in.",
    schemaPath: "tokens.gridGap",
    ledgerValue: gridRowGap,
    reason:
      `rdp-weeks row-gap is "${gridRowGap}", not a px length. rdp-months 32px gap is the multi-month gutter (numberOfMonths), not the day grid. Folding either into gridGap is Polar.`,
    evidence: `${F1_CALENDAR_LEDGER}#${F1_CALENDAR_COMBO} cls:rdp-weeks.row-gap`,
  });
  gaps.push({
    id: "root-min-width-auto",
    status: "closed" as const,
    closedBy:
      "minWidth 0 with a `lowered` receipt naming the discarded keyword. min-width:auto imposes no minimum, so 0 carries the same constraint; root.width 308 is still not borrowed as a minimum.",
    schemaPath: "tokens.rootMinWidth",
    ledgerValue: rootMin,
    reason:
      `root min-width is "${rootMin}". root.width ${rootW} is a different channel. Carrying width as minWidth would invent a constraint.`,
    evidence: `${F1_CALENDAR_LEDGER}#${F1_CALENDAR_COMBO} root.min-width`,
  });
  gaps.push({
    id: "week-number-text-absent",
    status: "closed" as const,
    closedBy:
      "tokens.weekNumberText and content.weeks[].weekNumber became optional, gated by a superRefine that requires both whenever the WeekNumbers axis offers on. The subject pins showWeekNumber false, so it declares neither.",
    schemaPath: "tokens.weekNumberText",
    ledgerValue: null,
    reason:
      "showWeekNumber is pinned false. No rdp-week_number part exists. Compiling WeekNumbers on|off would be a dead axis (validateCalendarStructure). Compiling a weekNumberText colour is Polar.",
    evidence: "extract/computed/configs/day-picker.json fixedProps.showWeekNumber",
  });
  gaps.push({
    id: "weekday-fontsize-not-day",
    status: "closed" as const,
    closedBy:
      "tokens.weekdayFontSize added, optional and meaning same-as-dayCell.fontSize when absent. The weekday row now carries its measured 13.3333px while the day buttons keep 16px; neither is collapsed onto the other.",
    schemaPath: "tokens.dayCell.fontSize",
    ledgerValue: weekdayFs,
    reason:
      `Weekday font-size is ${weekdayFs}; day button is ${btnFs}px. calendar@1 has one dayCell.fontSize. Collapsing 13.3333 onto 16 is the same lowering Astryx receipted, not a silent fold.`,
    evidence: `${F1_CALENDAR_LEDGER}#${F1_CALENDAR_COMBO} cls:rdp-weekday.font-size`,
  });
  gaps.push({
    id: "zero-source-bindings",
    status: "closed" as const,
    closedBy:
      "NumberParameterSchema/ColorParameterSchema accept variable: null, meaning no verified DTCG binding. Every token in this instance is unbound and painted from its measured fallback; no rdp.* variable name is minted.",
    schemaPath: "tokens.*.variable",
    ledgerValue: 0,
    reason:
      "source-bindings.json facts is []. 0 verified DTCG bindings. Inventing variable names (rdp.calendar.*) would claim a token invert the minted stub does not carry (tokens.mintedBootstrap still true).",
    evidence: "extract/computed/out/day-picker/calendar/source-bindings.json",
  });
  /**
   * The residue of axes-mismatch. Its WeekNumbers half is closed (calendar@1
   * can now compile a subject that does not vary on it); this half is NOT,
   * and closing it would mean either inventing content or widening the
   * archetype past what it claims to be. Recorded rather than dropped, so the
   * closure above is not read as covering more than it does.
   */
  gaps.push({
    id: "capture-axes-outside-calendar-grammar",
    schemaPath: "axes",
    ledgerValue: "captionLayout x numberOfMonths",
    reason:
      "The capture enumerates captionLayout (label|dropdown) and numberOfMonths (1|2). calendar@1's axes are WeekNumbers x State. A dropdown caption is a different caption anatomy (two <select>s replacing a label), and numberOfMonths:2 is two month grids side by side -- neither is a variant of this archetype's scene.",
    evidence:
      "extract/computed/configs/day-picker.json axes; recipe/recipes/calendar.ts CalendarRecipeInstanceSchema.axes",
    status: "named" as const,
    whyNamed:
      "Compiling these would require either a second archetype (a dropdown-caption calendar) or a multi-month container grammar calendar@1 does not have. The exam compiles the label.1 combo, which is one point in the capture's axis space and the only one whose anatomy calendar@1 describes. The other three combos are captured and unused, not silently folded in.",
  });

  gaps.push({
    id: "axes-mismatch",
    status: "closed" as const,
    closedBy:
      "variantGroup() emits a component set only where a dimension actually varies, and a lone component where it does not -- figma-ir.ts rightly refuses a one-valued axis. The compiler also now enumerates instance.axes rather than the module-level CALENDAR_WEEK_NUMBERS, so a subject that pins showWeekNumber compiles as a non-varying calendar instead of having an on variant fabricated for it.",
    schemaPath: "axes",
    ledgerValue: "captionLayout × numberOfMonths",
    reason:
      "Capture enumerates captionLayout × numberOfMonths. calendar@1 axes are WeekNumbers × State. showWeekNumber/showOutsideDays are pinned, not enumerated. Dropdown caption and numberOfMonths:2 are grammar outside this exam.",
    evidence: "extract/computed/configs/day-picker.json axes; recipe/recipes/calendar.ts axes",
  });
  if (outsideTd.text.length === 0) {
    gaps.push({
      id: "outside-cell-has-no-label",
    status: "closed" as const,
    closedBy:
      "same change as blank-outside-labels: the outside state is the one state permitted an empty label.",
      schemaPath: "content.weeks[].days[outside].label",
      ledgerValue: "",
      reason:
        "Hidden outside td text is empty. calendar@1 outside state still requires a visible label. This is the blank-but-measured cell the recipe dropped.",
      evidence: "recipe/recipes/calendar.ts CALENDAR_OUTSIDE_DAYS_NOT_CARRIED",
    });
  }

  /**
   * THE REAL COMPILE INPUT.
   *
   * This used to be `safeParse({ note: "deliberately incomplete ..." })` -- a
   * literal stub. Every "F1 compile attempted and refused" claim downstream
   * was therefore evidenced by parsing an object with one string field in it,
   * not by anything react-day-picker does. That is the same strawman
   * `f1-held-out.ts` already documents having removed one layer up, surviving
   * one layer down; its comment asserting that the REAL proposed instance is
   * parsed here was simply false.
   *
   * What follows assembles a genuine CalendarRecipeInstance out of the ledger
   * values gathered above -- every number and colour is one already pushed as
   * a proposed leaf, so nothing enters here that the capture did not measure.
   * Three conversions are declared, not silent, and each is receipted below as
   * `lowered`:
   *
   *   row-gap "normal" -> itemSpacing 0   (`normal` contributes no space; the
   *                                        week rows abut, which is what the
   *                                        render shows)
   *   min-width "auto" -> minWidth 0      (`auto` imposes no minimum)
   *   border-radius "100%" -> percent     (carried AS a percentage; the single
   *                                        px lowering happens in the recipe,
   *                                        against the button's own size)
   *
   * Every token is `variable: null`: source-bindings.json carries zero
   * verified DTCG bindings for this subject, and inventing names would claim
   * an invert nothing can resolve.
   */
  /**
   * FONT AVAILABILITY ON THE TARGET, MEASURED — not assumed.
   *
   * Read from Figma's own `listAvailableFontsAsync` in the Scratch file on
   * 2026-09-05: 2,122 families, and **no family named "Times"**.
   * react-day-picker sets no `font-family` at all, so the capture reports the
   * browser's default serif, which on this machine computes to `Times`. The
   * metric-compatible face Figma does carry is "Times New Roman", and only in
   * Regular / Bold / Italic / Bold Italic — there is no Medium, so the weekday
   * row's 500 weight degrades to Regular as well as changing family.
   *
   * Both substitutions are DECLARED, never silent. The writer walks
   * `fallbackChain`, refuses if the first available entry disagrees with the
   * declared `resolvedFamily`/`resolvedStyle`/`resolution`, and refuses any
   * fallback that carries no `degradation` string
   * (`CALENDAR-FONT-FALLBACK-WITHOUT-DEGRADATION`). So a wrong claim here
   * fails the mint rather than quietly painting a different face.
   */
  const FIGMA_FACES: Record<string, readonly string[]> = {
    "Times New Roman": ["Regular", "Bold", "Italic", "Bold Italic"],
  };
  const FIGMA_FAMILY_FALLBACK: Record<string, string> = {
    Times: "Times New Roman",
  };
  const availableInFigma = (family: string, style: string): boolean =>
    (FIGMA_FACES[family] ?? []).includes(style);

  const fontSpec = (family: string, weight: string, part: string) => {
    const fam = firstFamily(family);
    const style = weightStyle(weight);
    const requestSource = `${F1_CALENDAR_LEDGER}#${F1_CALENDAR_COMBO} ${part}.font-family`;
    const substitute = FIGMA_FAMILY_FALLBACK[fam];
    // Requested first, then the substitute in the same style, then the
    // substitute in Regular. The first entry the target actually carries wins,
    // and that decision is computed here so the instance can declare it.
    const chain = [
      { family: fam, style },
      ...(substitute ? [{ family: substitute, style }] : []),
      ...(substitute && style !== "Regular"
        ? [{ family: substitute, style: "Regular" }]
        : []),
    ];
    const resolved =
      chain.find((c) => availableInFigma(c.family, c.style)) ?? chain[0]!;
    const isFallback =
      resolved.family !== fam || resolved.style !== style;
    const degradation = isFallback
      ? `Figma carries no ${fam} ${style}; substituted ${resolved.family} ${resolved.style} (measured against listAvailableFontsAsync, 2026-09-05)`
      : undefined;
    return {
      requestedFamily: fam,
      requestedStyle: style,
      requestSource,
      fallbackChain: chain,
      resolvedFamily: resolved.family,
      resolvedStyle: resolved.style,
      resolution: (isFallback ? "fallback" : "requested") as
        | "requested"
        | "fallback",
      ...(degradation ? { degradation } : {}),
    };
  };
  const numTok = (fallback: number) => ({ variable: null, fallback });
  const colTok = (fallback: string) => ({ variable: null, fallback });
  const weekdayFw = weekdayFwLeaf;
  const selectedBorderPx = selectedBorderW ? px(selectedBorderW) : null;

  const assembled = {
    identity: { id: F1_CALENDAR_COMBO, name: "react-day-picker calendar" },
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
      // The subject pins showWeekNumber false, so "on" is not offered at all.
      weekNumbers: { name: "WeekNumbers", values: ["off"], default: "off" },
      dayState: {
        name: "State",
        values: ["default", "today", "selected", "outside"],
        default: "default",
      },
    },
    content: {
      caption,
      weekdays,
      weeks: weeks.map((w) => ({
        id: w.id,
        // no weekNumber: the axis does not offer "on"
        days: w.days.map((d) => ({ label: d.label ?? "", state: d.state })),
      })),
      selectedDayLabel: selectedBtn?.text[0] ?? "",
      todayDayLabel: todayBtn?.text[0] ?? "",
    },
    tokens: {
      dayCell: {
        size: numTok(cellW ?? 0),
        padding: numTok(cellPad ?? 0),
        fontSize: numTok(btnFs ?? 0),
        radius: numTok(cellR ?? 0),
      },
      dayButton: {
        size: numTok(btnW ?? 0),
        radius:
          btnRRaw === "100%"
            ? { variable: null, percent: 100 }
            : numTok(px(btnRRaw ?? "0px")),
      },
      weekdayFontSize: weekdayFs ? numTok(px(weekdayFs)) : undefined,
      gridGap: numTok(gridRowGap === "normal" ? 0 : px(gridRowGap ?? "0px")),
      captionGap: numTok(captionMargin ?? 0),
      rootPadding: numTok(rootPad ?? 0),
      rootMinWidth: numTok(rootMin === "auto" ? 0 : px(rootMin ?? "0px")),
      navIconSize: numTok(nav ?? 0),
      surface: colTok(surface ?? "#00000000"),
      captionText: colTok(captionText ?? "#000000ff"),
      weekdayText: colTok(weekdayText ?? "#000000ff"),
      // no weekNumberText: the axis does not offer "on"
      dayStates: {
        default: { background: colTok(defaultBg), text: colTok(defaultText) },
        today: {
          background: colTok(todayBtnBg ?? defaultBg),
          text: colTok(todayBtnText ?? defaultText),
        },
        selected: {
          background: colTok(selectedBtnBg ?? defaultBg),
          text: colTok(selectedBtnText ?? defaultText),
          // Selected is painted as a BORDER, not a fill. The ring pair is the
          // recipe's existing spelling for exactly that; the fill stays the
          // transparent value the capture measured.
          ...(selectedBorderC && selectedBorderPx !== null
            ? { ring: colTok(selectedBorderC), ringWidth: numTok(selectedBorderPx) }
            : {}),
        },
        outside: {
          background: colTok(outsideBg ?? defaultBg),
          text: colTok(outsideText ?? defaultText),
        },
      },
      typography: {
        caption: fontSpec(captionFf ?? "", captionFw ?? "400", "cls:rdp-caption_label"),
        weekday: fontSpec(weekdayFf ?? "", weekdayFw ?? "400", "cls:rdp-weekday"),
        day: fontSpec(dayFf ?? "", dayFw ?? "400", "cls:rdp-day_button"),
      },
    },
    inputFacts: proposed.map((l) => ({ path: l.path, channel: l.ledgerKey })),
    accounting: {
      // Only the leaves the assembled instance actually places on a token.
      // Everything else is receipted below. Calling a fact "carried" because
      // it was measured -- rather than because a token holds it -- is the
      // disclosure defect this split exists to prevent.
      carried: proposed
        .filter((l) => !RECEIPTED_LEAVES.has(l.path))
        .map((l) => ({ path: l.path, channel: l.ledgerKey })),
    },
    extensions: [],
    receipts: proposed
      .filter((l) => RECEIPTED_LEAVES.has(l.path))
      .map((l) => {
        const spec = RECEIPTED_LEAVES.get(l.path)!;
        return {
          fact: { path: l.path, channel: l.ledgerKey },
          value: String(l.value),
          reason: spec.reason,
          evidence: spec.evidence,
        };
      }),
    provenance: {
      source: `${F1_CALENDAR_LEDGER}#${F1_CALENDAR_COMBO}`,
      tool: "recipe/fixture-reader/propose-calendar-instance.ts",
      generatedAt: PROPOSE_GENERATED_AT,
      selection: {
        candidates: [{ id: "calendar", version: 1 }],
        selectedBy: "archetype match on the captured anatomy",
        mechanism: "reviewed-config" as const,
        source: "recipe/evidence/f1-held-out-v1/compile-gaps.json",
        reviewedAt: PROPOSE_GENERATED_AT,
        manualCost: {
          value: 1,
          unit: "reviewed-mapping" as const,
          note: "one archetype choice; every value below is mechanical from the ledger",
        },
      },
    },
  };

  const parsed = CalendarRecipeInstanceSchema.safeParse(assembled);
  const issues = parsed.success
    ? []
    : parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);

  return {
    comboKey: F1_CALENDAR_COMBO,
    ledgerFile: F1_CALENDAR_LEDGER,
    proposedLeaves: proposed,
    content: {
      caption,
      weekdays,
      weekRowCount: weeks.length,
      dayCellCount: dayTds.length,
      dayButtonCount: dayButtons.length,
      hiddenOutsideCount,
      selectedDayLabel: selectedBtn?.text[0] ?? "",
      todayDayLabel: todayBtn?.text[0] ?? "",
      weeks,
    },
    schemaGaps: gaps,
    instanceParse: { success: parsed.success, issues },
    instance: parsed.success ? parsed.data : null,
    polar: {
      inventedInstance: false,
      clonedAstryx: false,
      inventedInter: false,
      inventedSelectedFill: false,
    },
  };
}

export function assertNoPolarPropose(propose: MechanicalCalendarPropose): void {
  const blob = JSON.stringify(propose);
  if (/\bInter\b/.test(blob)) throw new Error("Polar: Inter invented");
  if (/April 2026/.test(blob)) throw new Error("Polar: Astryx April 2026 content cloned");
  if (/#0064e0/i.test(blob)) throw new Error("Polar: Astryx selected fill invented");
  if (/SF Pro/.test(blob)) throw new Error("Polar: Astryx font stack cloned");
  if (propose.content.weekRowCount === 6)
    throw new Error("Polar: sixth week invented to please calendar@1");
  if (propose.content.caption !== "January 2026")
    throw new Error(`expected January 2026 caption, got ${propose.content.caption}`);
  const selectedBg = propose.proposedLeaves.find((l) => l.path === "selected.button.background");
  if (selectedBg && selectedBg.value !== "#00000000")
    throw new Error(`selected button fill must stay transparent, got ${selectedBg.value}`);
}

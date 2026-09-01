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

export interface NamedCompileGap {
  id: string;
  schemaPath: string;
  ledgerValue: string | number | null;
  reason: string;
  evidence: string;
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
  instanceParse: { success: false; issues: string[] };
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
    schemaPath: "content.weeks.length",
    ledgerValue: weeks.length,
    reason:
      `calendar@1 requires exactly 6 week rows (CALENDAR_WEEK_COUNT). label.1 January 2026 renders ${weeks.length} <tr class="rdp-week">. Inventing a sixth week of February outside days is Polar content the ledger does not carry.`,
    evidence: "recipe/recipes/calendar.ts CALENDAR_WEEK_COUNT; extract/computed/out/day-picker/calendar/LEDGER.md week rows",
  });
  gaps.push({
    id: "blank-outside-labels",
    schemaPath: "content.weeks[].days[].label",
    ledgerValue: hiddenOutsideCount,
    reason:
      `${hiddenOutsideCount} rdp-hidden.rdp-outside cells have no button and no text. calendar@1 requires label.min(1) on every cell and has no blank-but-measured primitive (CALENDAR_OUTSIDE_DAYS_NOT_CARRIED). Inventing December 28–31 labels the capture did not render is Polar.`,
    evidence: "recipe/recipes/calendar.ts CALENDAR_OUTSIDE_DAYS_NOT_CARRIED",
  });
  gaps.push({
    id: "day-button-radius-percent",
    schemaPath: "tokens.dayButton.radius",
    ledgerValue: btnRRaw,
    reason:
      `rdp-day_button border-top-left-radius is "${btnRRaw}" (a circle). calendar@1 wants a px number. Folding 100% of 42px into 21 is invented FIXED px.`,
    evidence: `${F1_CALENDAR_LEDGER}#${F1_CALENDAR_COMBO} cls:rdp-day_button.border-top-left-radius`,
  });
  gaps.push({
    id: "selected-is-border-not-fill",
    schemaPath: "tokens.dayStates.selected.background",
    ledgerValue: selectedBtnBg,
    reason:
      `Selected paint is a ${selectedBorderW} ${selectedBorderC} border on rdp-day_button. Both the td and the button background are transparent. calendar@1 selected is a background fill. Folding the blue border into a fill would invent Polar paint.`,
    evidence: `${F1_CALENDAR_LEDGER}#${F1_CALENDAR_COMBO} selected rdp-day_button.border-top-width`,
  });
  gaps.push({
    id: "grid-gap-normal",
    schemaPath: "tokens.gridGap",
    ledgerValue: gridRowGap,
    reason:
      `rdp-weeks row-gap is "${gridRowGap}", not a px length. rdp-months 32px gap is the multi-month gutter (numberOfMonths), not the day grid. Folding either into gridGap is Polar.`,
    evidence: `${F1_CALENDAR_LEDGER}#${F1_CALENDAR_COMBO} cls:rdp-weeks.row-gap`,
  });
  gaps.push({
    id: "root-min-width-auto",
    schemaPath: "tokens.rootMinWidth",
    ledgerValue: rootMin,
    reason:
      `root min-width is "${rootMin}". root.width ${rootW} is a different channel. Carrying width as minWidth would invent a constraint.`,
    evidence: `${F1_CALENDAR_LEDGER}#${F1_CALENDAR_COMBO} root.min-width`,
  });
  gaps.push({
    id: "week-number-text-absent",
    schemaPath: "tokens.weekNumberText",
    ledgerValue: null,
    reason:
      "showWeekNumber is pinned false. No rdp-week_number part exists. Compiling WeekNumbers on|off would be a dead axis (validateCalendarStructure). Compiling a weekNumberText colour is Polar.",
    evidence: "extract/computed/configs/day-picker.json fixedProps.showWeekNumber",
  });
  gaps.push({
    id: "weekday-fontsize-not-day",
    schemaPath: "tokens.dayCell.fontSize",
    ledgerValue: weekdayFs,
    reason:
      `Weekday font-size is ${weekdayFs}; day button is ${btnFs}px. calendar@1 has one dayCell.fontSize. Collapsing 13.3333 onto 16 is the same lowering Astryx receipted, not a silent fold.`,
    evidence: `${F1_CALENDAR_LEDGER}#${F1_CALENDAR_COMBO} cls:rdp-weekday.font-size`,
  });
  gaps.push({
    id: "zero-source-bindings",
    schemaPath: "tokens.*.variable",
    ledgerValue: 0,
    reason:
      "source-bindings.json facts is []. 0 verified DTCG bindings. Inventing variable names (rdp.calendar.*) would claim a token invert the minted stub does not carry (tokens.mintedBootstrap still true).",
    evidence: "extract/computed/out/day-picker/calendar/source-bindings.json",
  });
  gaps.push({
    id: "axes-mismatch",
    schemaPath: "axes",
    ledgerValue: "captionLayout × numberOfMonths",
    reason:
      "Capture enumerates captionLayout × numberOfMonths. calendar@1 axes are WeekNumbers × State. showWeekNumber/showOutsideDays are pinned, not enumerated. Dropdown caption and numberOfMonths:2 are grammar outside this exam.",
    evidence: "extract/computed/configs/day-picker.json axes; recipe/recipes/calendar.ts axes",
  });
  if (outsideTd.text.length === 0) {
    gaps.push({
      id: "outside-cell-has-no-label",
      schemaPath: "content.weeks[].days[outside].label",
      ledgerValue: "",
      reason:
        "Hidden outside td text is empty. calendar@1 outside state still requires a visible label. This is the blank-but-measured cell the recipe dropped.",
      evidence: "recipe/recipes/calendar.ts CALENDAR_OUTSIDE_DAYS_NOT_CARRIED",
    });
  }

  const parsed = CalendarRecipeInstanceSchema.safeParse({
    note: "deliberately incomplete — mechanical propose only",
  });
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
    instanceParse: { success: false, issues },
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

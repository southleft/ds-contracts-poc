import * as z from "zod";

import {
  CodeOnlyExtensionSchema,
  ENVELOPE_VERSION,
  LossReceiptSchema,
  RecipeEnvelopeSchema,
  checkTotality,
  factId,
  isTotal,
  totalityLines,
  type CodeOnlyExtension,
  type FactRef,
  type LossReceipt,
  type RecipeEnvelope,
} from "../envelope.js";
import {
  type ComponentNode,
  type ComponentSetNode,
  type FrameNode,
  type IRNode,
  type TextNode,
  type VariableBinding,
} from "../figma-ir.js";
import { deriveRecipeIntegrity, hashRecipeEnvelope } from "../hash.js";
import { canonicalJson } from "../normalize.js";
import {
  RecipeRefusal,
  RecipeSelectionSchema,
  requireExactRecipeSelection,
  type Recipe,
  type RecipeRef,
  type RecipeSelection,
} from "../recipe.js";

export const CALENDAR_RECIPE_REF = {
  id: "calendar",
  version: 1,
} as const satisfies RecipeRef;

/**
 * Axes both reviewed sources actually declare. `@astryxdesign/core` Calendar
 * carries `hasOutsideDays` / `hasWeekNumbers`; `react-day-picker@10.0.1`
 * carries `showOutsideDays` / `showWeekNumber`. Two libraries that share no
 * lineage agreeing on the same two switches is why these are the axes and not
 * something richer.
 */
/**
 * NOT an axis. `@astryxdesign/core` declares `hasOutsideDays` and
 * `react-day-picker` declares `showOutsideDays`, so the prop is real in both
 * sources -- but `calendar@1` has no way to express a BLANK day cell. Hiding an
 * outside day means the cell renders nothing while the grid keeps its shape,
 * and there is no primitive here for "present, measured, and showing no text"
 * that does not invent one.
 *
 * It was briefly modelled as a variant axis. That was worse than not modelling
 * it: `OutsideDays=show` and `OutsideDays=hide` compiled to byte-identical
 * content, so the set carried four variants of which two were duplicates and
 * the axis decided nothing. A dead axis is a lie a designer can click on.
 *
 * So the prop is DROPPED and receipted (see the astryx fixture), and
 * `validateCalendarStructure` refuses any axis whose values compile to the same
 * thing, so this cannot come back as a decoration.
 */
export const CALENDAR_OUTSIDE_DAYS_NOT_CARRIED =
  "hasOutsideDays / showOutsideDays";
export const CALENDAR_WEEK_NUMBERS = ["on", "off"] as const;
export const CALENDAR_DAY_STATES = [
  "default",
  "today",
  "selected",
  "outside",
] as const;

/**
 * Declared template counts, the same device `table@1` uses for its column and
 * body-row counts. Seven days is what a week IS — that one is arithmetic.
 *
 * THE WEEK COUNT WAS NOT. It read 6, and the paragraph that stood here defended
 * it as "the source default grid: `@astryxdesign/core` `hasVariableRowCount`
 * defaults false, so `useCalendarDays` always emits 6 rows × 7 = 42 cells …
 * Variable-row months are a different prop and are not this template."
 *
 * That is ONE LIBRARY'S DEFAULT written down as a property of calendars. It is
 * true of Astryx and false of the world: react-day-picker renders January 2026
 * as FIVE `<tr class="rdp-week">`, and the F1 held-out exam refused to compile
 * against it — `week-count-not-six`, the first of eleven named gaps in
 * `recipe/evidence/f1-held-out-v1/compile-gaps.json`. The recipe could not
 * describe a real calendar it had not been tuned for, and the honest refusal
 * was the evidence.
 *
 * A month grid carries between four and six week rows. Four is February in a
 * common year beginning on the first weekday; six is any month whose days
 * overflow five rows. The count is a fact of the INSTANCE, read from the
 * ledger, and every enforcement below now compares against the instance's own
 * `content.weeks.length` rather than a constant. Six remains valid, so every
 * committed six-week fixture validates unchanged.
 */
export const CALENDAR_DAY_COUNT = 7;
/** @deprecated The Astryx default. Kept because the writer's per-source
 *  instance arithmetic and the frozen v1 proof tests still pin it; new code
 *  reads the instance's own week count. */
export const CALENDAR_WEEK_COUNT = 6;
export const CALENDAR_WEEK_MIN = 4;
export const CALENDAR_WEEK_MAX = 6;

export type CalendarWeekNumbers = (typeof CALENDAR_WEEK_NUMBERS)[number];
export type CalendarDayState = (typeof CALENDAR_DAY_STATES)[number];

export interface CalendarNumberParameter {
  /** null = no verified source binding; see NumberParameterSchema. */
  variable: string | null;
  fallback: number;
}
export interface CalendarColorParameter {
  /** null = no verified source binding; see ColorParameterSchema. */
  variable: string | null;
  fallback: string;
}
/** A radius spelled as a percentage of its box; see PercentParameterSchema. */
export interface CalendarPercentParameter {
  variable: string | null;
  percent: number;
}
export type CalendarRadiusParameter =
  | CalendarNumberParameter
  | CalendarPercentParameter;
/** Narrowing helper: the percent spelling carries `percent`, the px spelling `fallback`. */
export const isPercentParameter = (
  value: CalendarRadiusParameter,
): value is CalendarPercentParameter =>
  (value as CalendarPercentParameter).percent !== undefined;
/**
 * The single declared lowering for a percent radius: resolve it against the
 * box it applies to. Every consumer of `dayButton.radius` goes through here,
 * so there is exactly one place where a percentage becomes a length.
 */
export const resolveRadius = (
  radius: CalendarRadiusParameter,
  boxSize: number,
): number => {
  if (!isPercentParameter(radius)) return radius.fallback;
  /**
   * CSS scales overlapping corner radii down (CSS Backgrounds 3 s5.5): if the
   * radii along a side sum to more than the side's length, every radius is
   * multiplied by f = min(side / sum). For a uniform p% on a square, each side
   * carries two radii of p*S/100, so f = 50/p whenever p > 50 -- which lands
   * the effective radius at exactly S/2, a circle.
   *
   * So `border-radius: 100%` and `border-radius: 50%` draw the SAME circle,
   * and a naive p*S/100 returns S for the first: a radius twice the real one.
   * The round trip caught it -- the scene came back with 42 where the source
   * draws 21 -- which is the whole point of raising the scene and comparing.
   */
  const effective = Math.min(radius.percent, 50);
  return (boxSize * effective) / 100;
};
export interface CalendarFontSpec {
  requestedFamily: string;
  requestedStyle: string;
  requestSource: string;
  fallbackChain: Array<{ family: string; style: string }>;
  resolvedFamily: string;
  resolvedStyle: string;
  resolution: "requested" | "fallback";
  degradation?: string;
}
export interface CalendarDay {
  label: string;
  state: CalendarDayState;
}
export interface CalendarWeek {
  id: string;
  weekNumber?: string;
  days: CalendarDay[];
}

interface DayStateTokens {
  background: CalendarColorParameter;
  text: CalendarColorParameter;
  /**
   * Optional ring. `@astryxdesign/core` marks TODAY with an inset 1px ring
   * (`boxShadow: inset 0 0 0 1px --color-border-emphasized`) and no background
   * at all, while it marks SELECTED with a background and no ring. A model that
   * only had background and text would have dropped the today marker entirely,
   * and Figma can express a ring perfectly well as an inside stroke -- so it is
   * carried, not receipted away.
   */
  ring?: CalendarColorParameter;
  ringWidth?: CalendarNumberParameter;
}

export interface CalendarRecipeInstance {
  identity: { id: string; name: string };
  semantic: {
    root: "application";
    grid: "grid";
    weekdayRow: "row";
    week: "row";
    weekday: "columnheader";
    day: "gridcell";
    dayAxis: "declared";
  };
  axes: {
    weekNumbers: {
      name: "WeekNumbers";
      values: CalendarWeekNumbers[];
      default: CalendarWeekNumbers;
    };
    dayState: {
      name: "State";
      values: CalendarDayState[];
      default: CalendarDayState;
    };
  };
  content: {
    /**
     * The rendered month, carried literally.
     *
     * `examples/day-picker/PROVENANCE.md` names the problem this avoids: the
     * capture grammar cannot spell a `Date`, so a calendar driven by a live
     * `Date` has a "today" ring and a visible month that move with the clock
     * and no two captures ever byte-compare. A contract carries the month that
     * was rendered, not a Date to re-render from. Determinism comes from the
     * content being data, not from inventing a `$date` marker.
     */
    caption: string;
    weekdays: string[];
    weeks: CalendarWeek[];
    selectedDayLabel: string;
    todayDayLabel: string;
  };
  tokens: {
    dayCell: {
      size: CalendarNumberParameter;
      padding: CalendarNumberParameter;
      fontSize: CalendarNumberParameter;
      radius: CalendarNumberParameter;
    };
    /**
     * The painted day control. `@astryxdesign/core` `dayCellStyles.day` is
     * `--size-element-sm` 28 with `borderRadius: '50%'` (14 on that box).
     * The column slot stays `dayCell.size` (`--size-element-md` 32). Do not
     * collapse these onto one box. Do not invent `--radius-inner` or 9999
     * — source names 50%, not `--radius-full`.
     */
    dayButton: {
      size: CalendarNumberParameter;
      radius: CalendarRadiusParameter;
    };
    weekdayFontSize?: CalendarNumberParameter;
    gridGap: CalendarNumberParameter;
    /**
     * Vertical stack gap between caption and the weekday/grid body.
     *
     * `@astryxdesign/core` names this as `header.marginBottom: --spacing-2`.
     * It is not `gridGap`: daysGrid declares no gap, and a previous adapter
     * that minted `--spacing-2` as the day-grid gutter was refused. calendar@1
     * had one gap token and compiled the caption stack onto `gridGap`, so a
     * 0-gap day grid also collapsed the named header margin. Carry the header
     * margin here. One stack gap also spaces weekday-row from the day grid;
     * source `dayName.paddingBottom: --spacing-1` is not a second token.
     * Header row `gap` is the same `--spacing-2` token.
     */
    captionGap: CalendarNumberParameter;
    /**
     * Calendar root padding. Source `calendarStyles.calendar` is
     * `--spacing-3` 12px. Distinct from the day-slot padding (0).
     */
    rootPadding: CalendarNumberParameter;
    /**
     * Calendar root `minWidth`. Source names `220px`.
     */
    rootMinWidth: CalendarNumberParameter;
    /**
     * Icon-only ghost Button chevron. Source `Button` `iconSizeStyles` sm/md
     * is 16×16 inside a `--size-element-md` 32 icon-only control.
     */
    navIconSize: CalendarNumberParameter;
    surface: CalendarColorParameter;
    captionText: CalendarColorParameter;
    weekdayText: CalendarColorParameter;
    weekNumberText?: CalendarColorParameter;
    dayStates: Record<CalendarDayState, DayStateTokens>;
    typography: {
      caption: CalendarFontSpec;
      weekday: CalendarFontSpec;
      day: CalendarFontSpec;
    };
  };
  inputFacts: FactRef[];
  accounting: { carried: FactRef[] };
  extensions: CodeOnlyExtension[];
  receipts: LossReceipt[];
  provenance: {
    source: string;
    tool: string;
    generatedAt: string;
    selection: RecipeSelection;
    [key: string]: unknown;
  };
}

const FactRefSchema = z.strictObject({
  path: z.string().min(1),
  channel: z.string().min(1),
});
/**
 * `variable: null` means THE LEDGER CARRIES NO VERIFIED BINDING for this
 * channel -- not "we have not looked yet" and not "bind it to something
 * plausible". A subject whose DTCG file the extractor could not join (or which
 * ships no token file at all) has zero verified bindings, and the honest
 * spelling of that is the absence itself. The alternative -- minting a name
 * like `rdp.calendar.day.size` -- would claim an invert that nothing
 * downstream can resolve, so the writer would paint a dangling reference and
 * the round trip would raise a name no source ever defined.
 *
 * An unbound token still carries its `fallback`, so the canvas is painted from
 * a measured literal. What is lost is only the LINK to a source token, and
 * that loss is visible in the instance rather than papered over.
 */
const NumberParameterSchema = z.strictObject({
  variable: z.string().min(1).nullable(),
  fallback: z.number().finite(),
});
const ColorParameterSchema = z.strictObject({
  variable: z.string().min(1).nullable(),
  fallback: z.string().min(1),
});
/**
 * A corner radius the source spells as a PERCENTAGE of its box instead of a
 * length. `border-radius: 100%` on a square is a circle at every size, and
 * folding it to px at authoring time would freeze one box's answer into the
 * token -- the same species of mistake as writing one library's row count into
 * the archetype (see CALENDAR_WEEK_COUNT).
 *
 * The lowering is total and declared: px = size * percent / 100, taken against
 * the SAME `dayButton.size` the instance already carries, so no second
 * measurement and no invented length enter. The raise is deliberately NOT
 * symmetric: reading a scene back always yields the px spelling, because a
 * 21px radius on a 42px square is indistinguishable from 100% once drawn.
 * Scene -> instance -> scene is therefore a fixed point; instance -> scene ->
 * instance normalises percent to px, which is a narrowing we accept and name
 * rather than a loss we hide.
 */
const PercentParameterSchema = z.strictObject({
  variable: z.string().min(1).nullable(),
  percent: z.number().finite().positive(),
});
const RadiusParameterSchema = z.union([
  NumberParameterSchema,
  PercentParameterSchema,
]);
const FontSpecSchema = z.strictObject({
  requestedFamily: z.string().min(1),
  requestedStyle: z.string().min(1),
  requestSource: z.string().min(1),
  fallbackChain: z
    .array(
      z.strictObject({ family: z.string().min(1), style: z.string().min(1) }),
    )
    .min(1),
  resolvedFamily: z.string().min(1),
  resolvedStyle: z.string().min(1),
  resolution: z.enum(["requested", "fallback"]),
  degradation: z.string().min(1).optional(),
});
const DayStateTokensSchema = z.strictObject({
  background: ColorParameterSchema,
  text: ColorParameterSchema,
  ring: ColorParameterSchema.optional(),
  ringWidth: NumberParameterSchema.optional(),
});

export const CalendarRecipeInstanceSchema = z.strictObject({
  identity: z.strictObject({ id: z.string().min(1), name: z.string().min(1) }),
  semantic: z.strictObject({
    root: z.literal("application"),
    grid: z.literal("grid"),
    weekdayRow: z.literal("row"),
    week: z.literal("row"),
    weekday: z.literal("columnheader"),
    day: z.literal("gridcell"),
    dayAxis: z.literal("declared"),
  }),
  axes: z.strictObject({
    weekNumbers: z.strictObject({
      name: z.literal("WeekNumbers"),
      values: z.array(z.enum(CALENDAR_WEEK_NUMBERS)).min(1),
      default: z.enum(CALENDAR_WEEK_NUMBERS),
    }),
    dayState: z.strictObject({
      name: z.literal("State"),
      values: z.array(z.enum(CALENDAR_DAY_STATES)).min(1),
      default: z.enum(CALENDAR_DAY_STATES),
    }),
  }),
  content: z.strictObject({
    caption: z.string().min(1),
    weekdays: z.array(z.string().min(1)).length(CALENDAR_DAY_COUNT),
    weeks: z
      .array(
        z.strictObject({
          id: z.string().min(1),
          /**
           * Absent when the source renders no week-number column. Required
           * whenever the WeekNumbers axis offers "on" -- enforced below,
           * because a week-number label that has to be invented to satisfy a
           * schema is exactly the content this recipe must never mint.
           */
          weekNumber: z.string().min(1).optional(),
          days: z
            .array(
              z
                .strictObject({
                  /**
                   * Empty ONLY for an `outside` cell. A source that renders
                   * the leading/trailing days of adjacent months as blank
                   * but still measured (a hidden cell holding the grid's
                   * shape) carries no text, and the honest spelling of that
                   * is "". Requiring min(1) here forced a compiler to invent
                   * the neighbouring month's dates, which is content no
                   * capture ever saw.
                   */
                  label: z.string(),
                  state: z.enum(CALENDAR_DAY_STATES),
                })
                .superRefine((day, ctx) => {
                  if (day.state !== "outside" && day.label.length === 0)
                    ctx.addIssue({
                      code: "custom",
                      path: ["label"],
                      message: `a ${day.state} day must carry a visible label; only an outside cell may be blank`,
                    });
                }),
            )
            .length(CALENDAR_DAY_COUNT),
        }),
      )
      .min(CALENDAR_WEEK_MIN)
      .max(CALENDAR_WEEK_MAX),
    selectedDayLabel: z.string().min(1),
    todayDayLabel: z.string().min(1),
  }),
  tokens: z.strictObject({
    dayCell: z.strictObject({
      size: NumberParameterSchema,
      padding: NumberParameterSchema,
      fontSize: NumberParameterSchema,
      radius: NumberParameterSchema,
    }),
    dayButton: z.strictObject({
      size: NumberParameterSchema,
      radius: RadiusParameterSchema,
    }),
    /**
     * Weekday-header font size, when the source sizes the weekday row
     * differently from the day numbers. Absent means "same as
     * dayCell.fontSize", which is what a source that sizes them alike
     * carries; it is not a default standing in for an unmeasured value.
     */
    weekdayFontSize: NumberParameterSchema.optional(),
    gridGap: NumberParameterSchema,
    captionGap: NumberParameterSchema,
    rootPadding: NumberParameterSchema,
    rootMinWidth: NumberParameterSchema,
    navIconSize: NumberParameterSchema,
    surface: ColorParameterSchema,
    captionText: ColorParameterSchema,
    weekdayText: ColorParameterSchema,
    weekNumberText: ColorParameterSchema.optional(),
    dayStates: z.strictObject({
      default: DayStateTokensSchema,
      today: DayStateTokensSchema,
      selected: DayStateTokensSchema,
      outside: DayStateTokensSchema,
    }),
    typography: z.strictObject({
      caption: FontSpecSchema,
      weekday: FontSpecSchema,
      day: FontSpecSchema,
    }),
  }),
  inputFacts: z.array(FactRefSchema),
  accounting: z.strictObject({ carried: z.array(FactRefSchema) }),
  // The real schemas, not z.any(). A receipt that does not parse is a receipt
  // nobody can act on, and `z.any()` would have accepted one — it also made the
  // compiled envelope untypeable against RecipeEnvelopeHashInput.
  extensions: z.array(CodeOnlyExtensionSchema),
  receipts: z.array(LossReceiptSchema),
  provenance: z.looseObject({
    source: z.string().min(1),
    tool: z.string().min(1),
    generatedAt: z.string().min(1),
    selection: RecipeSelectionSchema,
  }),
}).superRefine((instance, ctx) => {
  /**
   * The week-number column is all-or-nothing. Making `weekNumberText` and
   * `content.weeks[].weekNumber` optional lets a source that renders no such
   * column say so; it must not let a source that DOES render one omit the
   * paint or the labels and have the writer fill in a colour of its own
   * choosing. So: offer "on" and you owe both.
   */
  const offersOn = instance.axes.weekNumbers.values.includes("on");
  if (!offersOn) return;
  if (instance.tokens.weekNumberText === undefined)
    ctx.addIssue({
      code: "custom",
      path: ["tokens", "weekNumberText"],
      message:
        'the WeekNumbers axis offers "on", so a week-number text colour is required',
    });
  instance.content.weeks.forEach((week, index) => {
    if (week.weekNumber === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["content", "weeks", index, "weekNumber"],
        message:
          'the WeekNumbers axis offers "on", so every week requires a week-number label',
      });
  });
});

/**
 * Reads the week-number label and paint for a week, on the "on" branch only.
 * `normalizeCalendarRecipeInstance` already guarantees both are present when
 * the axis offers "on"; reaching here without them means an instance was built
 * without going through normalize, so refuse by name rather than assert.
 */
const weekNumberParts = (
  instance: CalendarRecipeInstance,
  week: CalendarRecipeInstance["content"]["weeks"][number],
): { label: string; color: CalendarColorParameter } => {
  const label = week.weekNumber;
  const color = instance.tokens.weekNumberText;
  if (label === undefined || color === undefined)
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      'the WeekNumbers axis is "on" but the instance carries no week-number label or colour',
    ]);
  return { label, color };
};

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export function normalizeCalendarRecipeInstance(
  input: unknown,
): CalendarRecipeInstance {
  const instance = CalendarRecipeInstanceSchema.parse(
    input,
  ) as CalendarRecipeInstance;
  return {
    ...instance,
    inputFacts: [...instance.inputFacts].sort((left, right) =>
      compareText(factId(left), factId(right)),
    ),
    accounting: {
      carried: [...instance.accounting.carried].sort((left, right) =>
        compareText(factId(left), factId(right)),
      ),
    },
    extensions: [...instance.extensions].sort((left, right) =>
      compareText(left.id, right.id),
    ),
    receipts: [...instance.receipts].sort((left, right) =>
      compareText(factId(left.fact), factId(right.fact)),
    ),
  };
}

const hug = { mode: "hug" } as const;
const fill = { mode: "fill" } as const;
const fixed = (value: number) => ({ mode: "fixed" as const, value });
const solid = (color: string) => ({ kind: "solid" as const, color });
/**
 * Lowering half of the unbound-token pair. A parameter whose `variable` is
 * null emits NO binding at all -- the field is painted from its fallback and
 * the scene simply carries no reference for it. `binds` drops the nulls so an
 * assembly site can list every channel it knows about without first asking
 * which ones happen to be bound.
 *
 * The raising half is `binding` below, and the two have to agree: bind emits
 * nothing for an unbound token, so binding must READ nothing back as null
 * rather than refusing. If either half treated absence as an error the fixed
 * point would not close on any subject with an unjoined token file.
 */
const bind = (
  field: string,
  parameter:
    | CalendarNumberParameter
    | CalendarColorParameter
    | CalendarPercentParameter,
): VariableBinding | null =>
  parameter.variable === null
    ? null
    : {
        field,
        type: field.endsWith(".color") ? "COLOR" : "FLOAT",
        variable: parameter.variable,
      };
const binds = (entries: (VariableBinding | null)[]): VariableBinding[] =>
  entries.filter((entry): entry is VariableBinding => entry !== null);
const corners = (value: number) => ({
  topLeft: value,
  topRight: value,
  bottomRight: value,
  bottomLeft: value,
});
const fontFacts = (font: CalendarFontSpec, size: CalendarNumberParameter) => ({
  fontFamily: font.resolvedFamily,
  fontStyle: font.resolvedStyle,
  fontProvenance: font,
  fontSize: size.fallback,
  lineHeight: { unit: "auto" as const },
});
/**
 * `columnWidth` makes a text span exactly one grid column.
 *
 * Without it a weekday label hugs its own glyphs -- "Mo" is about 18px while a
 * day cell is 32 -- and the header does not line up with the days beneath it.
 * That is the same ragged-column defect the Table climb hit live, in a header
 * row instead of a body row, and `calendar/day-cell-box` does not catch it
 * because it only measures the day cells. A calendar is a grid; everything that
 * sits in a column is measured to the column.
 */
const text = (
  role: string,
  characters: string,
  font: CalendarFontSpec,
  size: CalendarNumberParameter,
  color: CalendarColorParameter,
  columnWidth?: CalendarNumberParameter,
): TextNode => ({
  kind: "text",
  role,
  label: role,
  characters,
  type: fontFacts(font, size),
  align: "center",
  verticalAlign: "center",
  fills: [solid(color.fallback)],
  width: columnWidth === undefined ? hug : fixed(columnWidth.fallback),
  height: hug,
  bindings: binds([
    bind("type.fontSize", size),
    bind("fills.0.color", color),
    ...(columnWidth === undefined ? [] : [bind("width.value", columnWidth)]),
  ]),
});

/**
 * One day cell: the measured `--size-element-md` slot `calendar/day-cell-box`
 * requires, wrapping the painted `--size-element-sm` 50% day button.
 */
/**
 * The first day label with glyphs, for use as a component-property default.
 * See its call site in dayComponent for why the first cell will not do.
 */
const representativeDayLabel = (instance: CalendarRecipeInstance): string => {
  for (const week of instance.content.weeks)
    for (const day of week.days) if (day.label.length > 0) return day.label;
  return instance.content.selectedDayLabel;
};

const dayComponent = (
  instance: CalendarRecipeInstance,
  state: CalendarDayState,
): ComponentNode => {
  const cell = instance.tokens.dayCell;
  const button = instance.tokens.dayButton;
  const stateTokens = instance.tokens.dayStates[state];
  const dayButton: FrameNode = {
    kind: "frame",
    role: "calendar/day/button",
    label: "calendar/day/button",
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "center",
      counterAxisAlign: "center",
      itemSpacing: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: fixed(button.size.fallback),
      height: fixed(button.size.fallback),
    },
    fills: [solid(stateTokens.background.fallback)],
    ...(stateTokens.ring === undefined || stateTokens.ringWidth === undefined
      ? {}
      : {
          strokes: [
            {
              weight: stateTokens.ringWidth.fallback,
              align: "inside" as const,
              paint: solid(stateTokens.ring.fallback),
            },
          ],
        }),
    cornerRadius: corners(resolveRadius(button.radius, button.size.fallback)),
    bindings: binds([
      bind("layout.width.value", button.size),
      bind("layout.height.value", button.size),
      bind("cornerRadius.topLeft", button.radius),
      bind("fills.0.color", stateTokens.background),
      ...(stateTokens.ring === undefined || stateTokens.ringWidth === undefined
        ? []
        : [
            bind("strokes.0.paint.color", stateTokens.ring),
            bind("strokes.0.weight", stateTokens.ringWidth),
          ]),
    ]),
    children: [
      text(
        "calendar/day/label",
        /**
         * The TEMPLATE label for the day component, not any particular day:
         * every instance overrides it through the Label component property.
         * It used to be `weeks[0].days[0].label` — blindly the first cell —
         * which is a BLANK OUTSIDE CELL in any month that does not begin on
         * the first weekday. January 2026 begins on a Thursday, so all four
         * day-state variants were minted with an empty label, their button
         * collapsed to zero width, and the whole grid rendered as nothing.
         *
         * Take the first day that actually carries glyphs instead. That is a
         * representative drawn from the measured content, not an invented
         * value, and `selectedDayLabel` (schema-guaranteed non-empty) is the
         * fallback for the degenerate case where no cell has a label at all.
         */
        representativeDayLabel(instance),
        instance.tokens.typography.day,
        cell.fontSize,
        stateTokens.text,
      ),
    ],
  };
  return {
    kind: "component",
    role: `calendar/day/${state}`,
    label: `State=${state}`,
    variantProperties: { State: state },
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "center",
      counterAxisAlign: "center",
      itemSpacing: 0,
      padding: {
        top: cell.padding.fallback,
        right: cell.padding.fallback,
        bottom: cell.padding.fallback,
        left: cell.padding.fallback,
      },
      width: fixed(cell.size.fallback),
      height: fixed(cell.size.fallback),
    },
    fills: [],
    cornerRadius: corners(cell.radius.fallback),
    bindings: binds([
      bind("layout.width.value", cell.size),
      bind("layout.height.value", cell.size),
      bind("layout.padding.left", cell.padding),
      bind("layout.padding.right", cell.padding),
      bind("layout.padding.top", cell.padding),
      bind("layout.padding.bottom", cell.padding),
      bind("cornerRadius.topLeft", cell.radius),
    ]),
    children: [dayButton],
  };
};

/**
 * A day instance carries the already-named `dayCell-size` box.
 *
 * Calendar live v28 host wrote FIXED 32×32 (writer teaching). Compile still
 * emitted hug. Extract firstDifference hit `height.mode` — keys sort `height`
 * before `width` — on the first month-grid day instance
 * (`$.children[0].children[0].children[2].children[0].children[1]`). Emit the
 * named FIXED box. Do not invent a px. Do not emit hug. Do not teach FIXED as
 * a fill. Day-label hug stays.
 */
const dayInstance = (
  role: string,
  day: CalendarDay,
  size: CalendarNumberParameter,
) => ({
  kind: "instance" as const,
  role,
  label: day.label,
  componentRef: "calendar@1/day",
  properties: { State: day.state, Label: day.label },
  width: fixed(size.fallback),
  height: fixed(size.fallback),
});

/** One week row: seven day instances, optionally preceded by a week number. */
const weekComponent = (
  instance: CalendarRecipeInstance,
  weekNumbers: CalendarWeekNumbers,
): ComponentNode => {
  const week = instance.content.weeks[0]!;
  const children: IRNode[] = [];
  if (weekNumbers === "on")
    children.push(
      text(
        "calendar/week/number",
        weekNumberParts(instance, week).label,
        instance.tokens.typography.weekday,
        instance.tokens.weekdayFontSize ?? instance.tokens.dayCell.fontSize,
        weekNumberParts(instance, week).color,
        instance.tokens.dayCell.size,
      ),
    );
  for (const [index, day] of week.days.entries())
    children.push(
      dayInstance(
        `calendar/day-instance/${index}`,
        day,
        instance.tokens.dayCell.size,
      ),
    );
  return {
    kind: "component",
    role: `calendar/week/${weekNumbers}`,
    label: `WeekNumbers=${weekNumbers}`,
    variantProperties: { WeekNumbers: weekNumbers },
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "center",
      itemSpacing: instance.tokens.gridGap.fallback,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
    },
    fills: [],
    bindings: binds([bind("layout.itemSpacing", instance.tokens.gridGap)]),
    children,
  };
};

/**
 * A week INSIDE the calendar grid is a frame of day instances, not an instance
 * of `calendar/week-set`.
 *
 * A week instance cannot carry this month. Day state varies WITHIN a week --
 * one day is `today`, another is `selected`, the leading days are `outside` --
 * and a component instance picks ONE variant for the whole component. Table
 * gets away with row instances because a row is selected or not as a unit; a
 * week is not. Instantiating weeks made every week in the grid render week
 * one's seven days and week one's states, three times over. That compiled, held
 * its fixed point, and was not a calendar.
 *
 * So the grid owns day instances directly: each one picks its own State variant
 * and carries its own Label. `calendar/week-set` stays as the published week
 * template, exactly as `calendar/day-set` is the published day template.
 */
const weekFrame = (
  instance: CalendarRecipeInstance,
  week: CalendarWeek,
  index: number,
  weekNumbers: CalendarWeekNumbers,
): FrameNode => {
  const children: IRNode[] = [];
  if (weekNumbers === "on")
    children.push(
      text(
        `calendar/week/${index}/number`,
        weekNumberParts(instance, week).label,
        instance.tokens.typography.weekday,
        instance.tokens.weekdayFontSize ?? instance.tokens.dayCell.fontSize,
        weekNumberParts(instance, week).color,
        instance.tokens.dayCell.size,
      ),
    );
  for (const [dayIndex, day] of week.days.entries())
    children.push(
      dayInstance(
        `calendar/week/${index}/day/${dayIndex}`,
        day,
        instance.tokens.dayCell.size,
      ),
    );
  return {
    kind: "frame",
    role: `calendar/week/${index}`,
    label: week.id,
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "center",
      itemSpacing: instance.tokens.gridGap.fallback,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
    },
    fills: [],
    bindings: binds([bind("layout.itemSpacing", instance.tokens.gridGap)]),
    children,
  };
};

const weekdayRow = (
  instance: CalendarRecipeInstance,
  weekNumbers: CalendarWeekNumbers,
): FrameNode => {
  const children: IRNode[] = [];
  if (weekNumbers === "on")
    children.push(
      text(
        "calendar/weekday/spacer",
        weekNumberParts(instance, instance.content.weeks[0]!).label,
        instance.tokens.typography.weekday,
        instance.tokens.weekdayFontSize ?? instance.tokens.dayCell.fontSize,
        weekNumberParts(instance, instance.content.weeks[0]!).color,
        instance.tokens.dayCell.size,
      ),
    );
  for (const [index, weekday] of instance.content.weekdays.entries())
    children.push(
      text(
        `calendar/weekday/${index}`,
        weekday,
        instance.tokens.typography.weekday,
        instance.tokens.weekdayFontSize ?? instance.tokens.dayCell.fontSize,
        instance.tokens.weekdayText,
        instance.tokens.dayCell.size,
      ),
    );
  return {
    kind: "frame",
    role: "calendar/weekday-row",
    label: "calendar/weekday-row",
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "center",
      itemSpacing: instance.tokens.gridGap.fallback,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
    },
    fills: [],
    bindings: binds([bind("layout.itemSpacing", instance.tokens.gridGap)]),
    children,
  };
};

/**
 * Month nav is Button+Icon in source (`ghost`, `isIconOnly`, default `md`
 * 32, `Icon` `chevronLeft`/`chevronRight` size `sm`). calendar@1 has no
 * Button primitive; it carries the rendered chrome: a 32 slot and the
 * glyphs `defaultIcons.tsx` names for those icons (`‹` / `›`).
 */
const navButton = (
  instance: CalendarRecipeInstance,
  role: "calendar/nav/previous" | "calendar/nav/next",
  label: "Previous month" | "Next month",
  glyph: "‹" | "›",
): FrameNode => ({
  kind: "frame",
  role,
  label,
  layout: {
    mode: "horizontal",
    primaryAxisAlign: "center",
    counterAxisAlign: "center",
    itemSpacing: 0,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    width: fixed(instance.tokens.dayCell.size.fallback),
    height: fixed(instance.tokens.dayCell.size.fallback),
  },
  fills: [],
  bindings: binds([
    bind("layout.width.value", instance.tokens.dayCell.size),
    bind("layout.height.value", instance.tokens.dayCell.size),
  ]),
  children: [
    text(
      `${role}/icon`,
      glyph,
      instance.tokens.typography.caption,
      instance.tokens.navIconSize,
      instance.tokens.captionText,
    ),
  ],
});

const captionInHeader = (instance: CalendarRecipeInstance): TextNode => ({
  kind: "text",
  role: "calendar/caption",
  label: "calendar/caption",
  characters: instance.content.caption,
  type: fontFacts(
    instance.tokens.typography.caption,
    instance.tokens.dayCell.fontSize,
  ),
  align: "center",
  verticalAlign: "center",
  fills: [solid(instance.tokens.captionText.fallback)],
  width: fill,
  height: hug,
  bindings: binds([
    bind("type.fontSize", instance.tokens.dayCell.fontSize),
    bind("fills.0.color", instance.tokens.captionText),
  ]),
});

const headerRow = (instance: CalendarRecipeInstance): FrameNode => {
  const headerGap = instance.tokens.captionGap;
  return {
    kind: "frame",
    role: "calendar/header",
    label: "calendar/header",
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "space-between",
      counterAxisAlign: "center",
      itemSpacing: headerGap.fallback,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: fill,
      height: hug,
    },
    fills: [],
    bindings: binds([bind("layout.itemSpacing", headerGap)]),
    children: [
      navButton(instance, "calendar/nav/previous", "Previous month", "‹"),
      captionInHeader(instance),
      navButton(instance, "calendar/nav/next", "Next month", "›"),
    ],
  };
};

const calendarComponent = (
  instance: CalendarRecipeInstance,
  weekNumbers: CalendarWeekNumbers,
): ComponentNode => {
  const gap = instance.tokens.gridGap;
  /**
   * Caption-stack gap is the named header.marginBottom, not daysGrid gap.
   * CALENDAR-COMPILE-CARRIES-HEADER-MARGIN-BOTTOM. Do not bind this to
   * gridGap. Do not invent a px. Do not teach FIXED as a fill.
   * CALENDAR-COMPILE-CARRIES-SOURCE-NAMED-MONTH: 6-row default, Button+Icon
   * nav chrome, 28 circle day button, root --spacing-3 / minWidth 220.
   */
  const stackGap = instance.tokens.captionGap;
  const rootPad = instance.tokens.rootPadding;
  const grid: FrameNode = {
    kind: "frame",
    role: "calendar/grid",
    label: "calendar/grid",
    layout: {
      mode: "vertical",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: gap.fallback,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
    },
    fills: [],
    bindings: binds([bind("layout.itemSpacing", gap)]),
    children: instance.content.weeks.map((week, index) =>
      weekFrame(instance, week, index, weekNumbers),
    ),
  };
  return {
    kind: "component",
    role: `calendar/variant/${weekNumbers}`,
    label: `WeekNumbers=${weekNumbers}`,
    variantProperties: { WeekNumbers: weekNumbers },
    layout: {
      mode: "vertical",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: stackGap.fallback,
      padding: {
        top: rootPad.fallback,
        right: rootPad.fallback,
        bottom: rootPad.fallback,
        left: rootPad.fallback,
      },
      width: hug,
      height: hug,
      minWidth: instance.tokens.rootMinWidth.fallback,
    },
    fills: [solid(instance.tokens.surface.fallback)],
    bindings: binds([
      bind("layout.itemSpacing", stackGap),
      bind("layout.padding.left", rootPad),
      bind("layout.padding.right", rootPad),
      bind("layout.padding.top", rootPad),
      bind("layout.padding.bottom", rootPad),
      bind("layout.minWidth", instance.tokens.rootMinWidth),
      bind("fills.0.color", instance.tokens.surface),
    ]),
    children: [headerRow(instance), weekdayRow(instance, weekNumbers), grid],
  };
};

const setNode = (
  role: string,
  label: string,
  children: ComponentNode[],
  axes: Record<string, string[]>,
): ComponentSetNode => ({
  kind: "component-set",
  role,
  label,
  variantAxes: Object.entries(axes).map(([name, values]) => ({ name, values })),
  layout: {
    mode: "vertical",
    primaryAxisAlign: "min",
    counterAxisAlign: "min",
    itemSpacing: 16,
    padding: { top: 16, right: 16, bottom: 16, left: 16 },
    width: hug,
    height: hug,
  },
  fills: [],
  bindings: binds([]),
  children,
});

export function compileCalendarIr(instance: CalendarRecipeInstance): FrameNode {
  /**
   * Enumerate the axes THE INSTANCE DECLARES, not the module-level lists of
   * every value the archetype knows about. Those constants describe what a
   * calendar may vary; `instance.axes` describes what THIS subject varies. A
   * source that pins showWeekNumber false offers only "off", and building an
   * "on" variant for it fabricates a week-number column -- the compiler was
   * doing exactly that, which is the same mistake as CALENDAR_WEEK_COUNT:
   * one possible shape hardcoded as the only shape.
   */
  const weekNumberValues = instance.axes.weekNumbers.values;
  const calendarValues = instance.axes.weekNumbers.values;
  const dayStateValues = instance.axes.dayState.values;
  const daySet = variantGroup(
    "calendar/day-set",
    "Calendar day",
    dayStateValues.map((state) => dayComponent(instance, state)),
    "State",
    dayStateValues,
  );
  const weekSet = variantGroup(
    "calendar/week-set",
    "Calendar week",
    weekNumberValues.map((weekNumbers) => weekComponent(instance, weekNumbers)),
    "WeekNumbers",
    weekNumberValues,
  );
  const calendarSet = variantGroup(
    "calendar/set",
    instance.identity.name,
    calendarValues.map((weekNumbers) =>
      calendarComponent(instance, weekNumbers),
    ),
    "WeekNumbers",
    calendarValues,
  );
  return {
    kind: "frame",
    role: "calendar/library",
    label: instance.identity.name,
    layout: {
      mode: "vertical",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: 48,
      padding: { top: 48, right: 48, bottom: 48, left: 48 },
      width: hug,
      height: hug,
    },
    fills: [],
    bindings: binds([]),
    children: [calendarSet, weekSet, daySet],
  };
}

export function compileCalendarRecipe(input: unknown): RecipeEnvelope {
  const instance = normalizeCalendarRecipeInstance(input);
  const totality = checkTotality(instance.inputFacts, instance);
  if (!isTotal(totality))
    throw new RecipeRefusal(
      CALENDAR_RECIPE_REF,
      totalityLines(instance.identity.id, totality),
    );
  const unsigned = {
    envelope: ENVELOPE_VERSION,
    id: instance.identity.id,
    name: instance.identity.name,
    archetype: "calendar / date-picker",
    recipe: CALENDAR_RECIPE_REF,
    ir: compileCalendarIr(instance),
    accounting: instance.accounting,
    extensions: instance.extensions,
    receipts: instance.receipts,
    provenance: instance.provenance,
  } as const;
  return RecipeEnvelopeSchema.parse({
    ...unsigned,
    integrity: deriveRecipeIntegrity(unsigned),
  });
}

const setByRole = (root: FrameNode, role: string): ComponentSetNode => {
  const found = root.children.find(
    (child) => child.kind === "component-set" && child.role === role,
  );
  if (!found)
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      `missing required set ${role}`,
    ]);
  return found as ComponentSetNode;
};
/**
 * A dimension with ONE declared value is not a variant axis, and figma-ir.ts
 * is right to refuse one: a component set requires an axis of at least two
 * values. Figma models a component that does not vary as a plain component,
 * and so do we.
 *
 * This is what lets a subject that pins `showWeekNumber` compile at all. The
 * alternatives were both wrong: emit a 1-valued axis (an IR the schema
 * rejects) or synthesise a second variant (week-number labels and a paint the
 * capture never measured -- invented content).
 */
const variantGroup = (
  role: string,
  label: string,
  children: ComponentNode[],
  axisName: string,
  values: readonly string[],
): ComponentSetNode | ComponentNode =>
  values.length >= 2
    ? setNode(role, label, children, { [axisName]: [...values] })
    : { ...children[0]!, role, label };

/** Reads a group back whether it was emitted as a set or a lone component. */
const groupByRole = (
  root: FrameNode,
  role: string,
): { node: ComponentSetNode | ComponentNode; variants: ComponentNode[] } => {
  const found = root.children.find(
    (child) =>
      (child.kind === "component-set" || child.kind === "component") &&
      child.role === role,
  );
  if (!found)
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      `missing required set ${role}`,
    ]);
  const group = found as ComponentSetNode | ComponentNode;
  return group.kind === "component-set"
    ? { node: group, variants: group.children }
    : { node: group, variants: [group] };
};

/**
 * Selects one variant by axis value. When the group is a lone component the
 * dimension does not vary, so the only variant IS the answer whatever value
 * is asked for -- asking for "on" against a subject that only has "off" is
 * caught earlier, at the schema, not here.
 */
const variantFor = (
  group: { node: ComponentSetNode | ComponentNode; variants: ComponentNode[] },
  properties: Record<string, string>,
): ComponentNode => {
  if (group.node.kind === "component") return group.variants[0]!;
  return componentFor(group.node, properties);
};

const componentFor = (
  set: ComponentSetNode,
  properties: Record<string, string>,
): ComponentNode => {
  const found = set.children.filter(
    (child) =>
      child.kind === "component" &&
      Object.entries(properties).every(
        ([name, value]) => child.variantProperties?.[name] === value,
      ),
  );
  if (found.length !== 1)
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      `${set.role}: expected exactly one component for ${JSON.stringify(properties)}`,
    ]);
  return found[0] as ComponentNode;
};
/** As `direct`, but absence is a value rather than a refusal. */
const directOptional = <Kind extends IRNode["kind"]>(
  parent: { children?: IRNode[] },
  role: string,
  kind: Kind,
): Extract<IRNode, { kind: Kind }> | null => {
  const found = (parent.children ?? []).filter(
    (child) => child.role === role && child.kind === kind,
  );
  if (found.length > 1)
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      `expected at most one ${role} of kind ${kind}`,
    ]);
  return found.length === 0
    ? null
    : (found[0] as Extract<IRNode, { kind: Kind }>);
};
const direct = <Kind extends IRNode["kind"]>(
  parent: { children?: IRNode[] },
  role: string,
  kind: Kind,
): Extract<IRNode, { kind: Kind }> => {
  const found = (parent.children ?? []).filter(
    (child) => child.role === role && child.kind === kind,
  );
  if (found.length !== 1)
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      `expected exactly one ${role} of kind ${kind}`,
    ]);
  return found[0] as Extract<IRNode, { kind: Kind }>;
};
/**
 * Raising half of the unbound-token pair (see `bind`). ZERO bindings for a
 * field is the readback of an unbound token and returns null; TWO OR MORE is
 * still a refusal, because that is an ambiguous scene rather than an absent
 * fact. Only the ambiguity is an error -- absence is a value.
 */
const binding = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
): string | null => {
  const found = (node.bindings ?? []).filter((entry) => entry.field === field);
  if (found.length > 1)
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      `${node.role ?? "node"}: binding ${field} appears ${found.length} times; it must appear at most once`,
    ]);
  return found.length === 0 ? null : found[0]!.variable;
};
const numberFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: number,
): CalendarNumberParameter => ({ variable: binding(node, field), fallback });
const colorFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: string,
): CalendarColorParameter => ({ variable: binding(node, field), fallback });
const solidColor = (paint: unknown, role: string): string => {
  const candidate = paint as { kind?: string; color?: string } | undefined;
  if (candidate?.kind !== "solid" || typeof candidate.color !== "string")
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      `${role}: expected a solid fill`,
    ]);
  return candidate.color;
};
const fontFrom = (node: TextNode): CalendarFontSpec => {
  const provenance = node.type.fontProvenance;
  if (!provenance)
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      `${node.role ?? "text"}: font provenance is required`,
    ]);
  return provenance as CalendarFontSpec;
};

export function validateCalendarStructure(root: FrameNode): void {
  /** Every variant of one instance draws the same month shape; the first
   *  variant sets it and the rest must agree. */
  let gridWeeks: number | null = null;
  if (root.role !== "calendar/library")
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      "missing calendar library frame",
    ]);
  const calendarGroup = groupByRole(root, "calendar/set");
  const weekGroup = groupByRole(root, "calendar/week-set");
  const dayGroup = groupByRole(root, "calendar/day-set");
  const calendarSet = { children: calendarGroup.variants };
  const weekSet = { children: weekGroup.variants };
  const daySet = { children: dayGroup.variants };
  /**
   * This validator sees only the drawn scene, so it cannot know which axis
   * values the instance declared. What it CAN prove is that the count is
   * legal and that the two WeekNumbers-keyed sets agree with each other -- a
   * scene offering two calendar variants but one week variant is incoherent
   * however it was produced. Pinning both to CALENDAR_WEEK_NUMBERS.length
   * instead refused every subject that legitimately varies on fewer.
   */
  const weekNumberVariants = calendarSet.children.length;
  if (
    weekNumberVariants < 1 ||
    weekNumberVariants > CALENDAR_WEEK_NUMBERS.length
  )
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      `calendar/set carries ${weekNumberVariants} WeekNumbers variant(s); a calendar declares 1-${CALENDAR_WEEK_NUMBERS.length}`,
    ]);
  if (weekSet.children.length !== weekNumberVariants)
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      `calendar/week-set carries ${weekSet.children.length} WeekNumbers variant(s) but calendar/set carries ${weekNumberVariants}`,
    ]);
  if (
    daySet.children.length < 1 ||
    daySet.children.length > CALENDAR_DAY_STATES.length
  )
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      `calendar/day-set carries ${daySet.children.length} State variant(s); a calendar declares 1-${CALENDAR_DAY_STATES.length}`,
    ]);
  for (const day of daySet.children) {
    if (day.kind !== "component")
      throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
        "day variant is not a component",
      ]);
    if (day.layout.width.mode !== "fixed" || day.layout.height.mode !== "fixed")
      throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
        `${day.role}: a day cell must carry a measured box, not hug — calendar/day-cell-box`,
      ]);
    const dayButton = direct(day, "calendar/day/button", "frame");
    if (
      dayButton.layout.width.mode !== "fixed" ||
      dayButton.layout.height.mode !== "fixed"
    )
      throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
        `${day.role}: the day button must carry the named --size-element-sm box`,
      ]);
    direct(dayButton, "calendar/day/label", "text");
  }
  for (const week of weekSet.children) {
    if (week.kind !== "component" || week.layout.mode !== "horizontal")
      throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
        "a week must be a horizontal row — calendar/day-grid",
      ]);
    const days = (week.children ?? []).filter((child) =>
      String(child.role ?? "").startsWith("calendar/day-instance/"),
    );
    if (days.length !== CALENDAR_DAY_COUNT)
      throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
        `${week.role}: a week carries exactly ${CALENDAR_DAY_COUNT} days`,
      ]);
  }
  // No dead axis. An axis whose values compile to the same thing decides
  // nothing, and a designer can still click it -- which is worse than not
  // offering it. `OutsideDays` was exactly that before it was dropped:
  // `show` and `hide` produced byte-identical content.
  for (const group of [calendarGroup, weekGroup, dayGroup]) {
    const set = group.node;
    if (set.kind !== "component-set") continue;
    for (const axis of set.variantAxes) {
      const rendered = new Set(
        set.children.map((child) => {
          const stripped = structuredClone(child) as unknown as Record<
            string,
            unknown
          >;
          delete stripped.role;
          delete stripped.label;
          delete stripped.variantProperties;
          return canonicalJson(stripped);
        }),
      );
      if (rendered.size < set.children.length)
        throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
          `${set.role}: axis ${axis.name} is dead — two or more variants compile to identical content`,
        ]);
    }
  }

  for (const variant of calendarSet.children) {
    if (variant.kind !== "component" || variant.layout.mode !== "vertical")
      throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
        "a calendar variant stacks caption, weekdays and grid",
      ]);
    const header = direct(variant, "calendar/header", "frame");
    direct(header, "calendar/nav/previous", "frame");
    direct(header, "calendar/caption", "text");
    direct(header, "calendar/nav/next", "frame");
    const weekdays = direct(variant, "calendar/weekday-row", "frame");
    const labels = (weekdays.children ?? []).filter((child) =>
      String(child.role ?? "").startsWith("calendar/weekday/"),
    );
    if (labels.length < CALENDAR_DAY_COUNT)
      throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
        `${variant.role}: the weekday row names all ${CALENDAR_DAY_COUNT} days`,
      ]);
    const grid = direct(variant, "calendar/grid", "frame");
    // THE GRID IS A MONTH GRID, NOT A SIX-WEEK GRID. This compared against a
    // constant 6 — Astryx's default — and that is what refused react-day-picker
    // in the F1 held-out exam. This validator only sees the drawn scene, so it
    // checks the two things the scene can actually prove: the count is a legal
    // month-grid height, and every variant agrees on it. The exact number is
    // the instance's declaration and the schema enforces that separately.
    const weeksHere = (grid.children ?? []).length;
    if (weeksHere < CALENDAR_WEEK_MIN || weeksHere > CALENDAR_WEEK_MAX)
      throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
        `${variant.role}: the grid carries ${weeksHere} week(s); a month grid is ${CALENDAR_WEEK_MIN}–${CALENDAR_WEEK_MAX} rows`,
      ]);
    if (gridWeeks === null) gridWeeks = weeksHere;
    else if (gridWeeks !== weeksHere)
      throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
        `${variant.role}: the grid carries ${weeksHere} week(s) where an earlier variant carried ${gridWeeks} — one instance draws one month shape`,
      ]);

    // Every cell that sits in a column must be measured to the column.
    //
    // A required fact scoped to one role cannot see a defect one row above it:
    // `calendar/day-cell-box` measures day cells, and it did not stop the
    // weekday header shipping as `hug`, where "Mo" is about 18px against a 32px
    // day cell. That is the ragged-column defect the Table climb hit live. This
    // refuses the whole class rather than that one instance -- a text child of a
    // column-bearing row is either measured, or it is not a column.
    const columnRows = [weekdays, ...(grid.children ?? [])];
    for (const row of columnRows)
      for (const cell of (row as { children?: IRNode[] }).children ?? []) {
        if (cell.kind !== "text") continue;
        if (cell.width.mode !== "fixed")
          throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
            `${cell.role}: a text cell in a column-bearing row must be measured to the column, not hug — calendar/day-cell-box applies to every column, not only day cells`,
          ]);
      }
  }
}

const firstDifference = (
  left: unknown,
  right: unknown,
  path = "$",
): string | undefined => {
  if (canonicalJson(left) === canonicalJson(right)) return undefined;
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  )
    return path;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return path;
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      const found = firstDifference(
        left[index],
        right[index],
        `${path}[${index}]`,
      );
      if (found) return found;
    }
    return path;
  }
  const l = left as Record<string, unknown>;
  const r = right as Record<string, unknown>;
  for (const key of [
    ...new Set([...Object.keys(l), ...Object.keys(r)]),
  ].sort()) {
    if (!(key in l) || !(key in r)) return `${path}.${key}`;
    const found = firstDifference(l[key], r[key], `${path}.${key}`);
    if (found) return found;
  }
  return undefined;
};

export function collapseCalendarRecipe(
  envelopeInput: unknown,
  selectionInput: unknown,
): CalendarRecipeInstance {
  requireExactRecipeSelection(selectionInput, CALENDAR_RECIPE_REF);
  const envelope = RecipeEnvelopeSchema.parse(envelopeInput);
  if (
    envelope.recipe.id !== "calendar" ||
    envelope.recipe.version !== 1 ||
    envelope.archetype !== "calendar / date-picker"
  )
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      "selected envelope is not calendar@1",
    ]);
  if (hashRecipeEnvelope(envelope) !== envelope.integrity.canonicalHash)
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      "integrity.canonicalHash does not match the selected envelope",
    ]);
  if (envelope.ir.kind !== "frame")
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      "missing calendar library frame",
    ]);
  const root = envelope.ir;
  validateCalendarStructure(root);

  const calendarGroup = groupByRole(root, "calendar/set");
  const weekGroup = groupByRole(root, "calendar/week-set");
  const dayGroup = groupByRole(root, "calendar/day-set");
  const baseline = variantFor(calendarGroup, { WeekNumbers: "on" });
  const header = direct(baseline, "calendar/header", "frame");
  const captionText = direct(header, "calendar/caption", "text");
  const weekdayRowFrame = direct(baseline, "calendar/weekday-row", "frame");
  const gridFrame = direct(baseline, "calendar/grid", "frame");
  const weekOn = variantFor(weekGroup, { WeekNumbers: "on" });
  const dayDefault = variantFor(dayGroup, { State: "default" });
  const dayButton = direct(dayDefault, "calendar/day/button", "frame");
  const dayLabel = direct(dayButton, "calendar/day/label", "text");
  /**
   * Absent whenever the WeekNumbers axis does not offer "on" -- the scene then
   * has no week-number column to read. `directOptional` returns null instead
   * of refusing, and the token below is simply not emitted.
   */
  const weekNumberText = directOptional(weekOn, "calendar/week/number", "text");
  /**
   * Weekday typography comes from a WEEKDAY node. It used to be read off the
   * week-number node, which happened to carry the same font in the one library
   * calendar@1 was written against -- and which does not exist at all in a
   * calendar without week numbers.
   */
  const weekdayTextNode = direct(weekdayRowFrame, "calendar/weekday/0", "text");

  /**
   * The axis values actually present in the scene. A group emitted as a lone
   * component (see `variantGroup`) declares exactly one value, and a set
   * declares whatever its variantAxes say.
   */
  const axisValuesOf = <T extends string>(
    group: { node: ComponentSetNode | ComponentNode },
    axisName: string,
    fallback: T,
  ): T[] => {
    if (group.node.kind !== "component-set") return [fallback];
    const axis = group.node.variantAxes.find((a) => a.name === axisName);
    return (axis?.values ?? [fallback]) as T[];
  };
  const weekNumberAxisValues = axisValuesOf<CalendarWeekNumbers>(
    calendarGroup,
    "WeekNumbers",
    weekNumberText === null ? "off" : "on",
  );
  const dayStateAxisValues = axisValuesOf<CalendarDayState>(
    dayGroup,
    "State",
    "default",
  );

  const weekdays = (weekdayRowFrame.children ?? [])
    .filter((child) => String(child.role ?? "").startsWith("calendar/weekday/"))
    .filter((child) => child.role !== "calendar/weekday/spacer")
    .map((child) => {
      if (child.kind !== "text")
        throw new RecipeRefusal(CALENDAR_RECIPE_REF, ["weekday is not text"]);
      return child.characters;
    });

  const dayStateFor = (state: CalendarDayState): DayStateTokens => {
    const component = variantFor(dayGroup, { State: state });
    const button = direct(component, "calendar/day/button", "frame");
    const label = direct(button, "calendar/day/label", "text");
    /**
     * Detected from the PAINT, not from a binding. An unbound token (one with
     * no verified DTCG variable) emits no binding at all, so keying off
     * `strokes.0.paint.color` silently dropped the ring for every subject
     * without a token file -- the stroke was drawn on the canvas and then lost
     * on the way back, which is precisely the silent loss this recipe exists
     * to prevent. The stroke's presence in the scene is the fact.
     */
    const hasRing = (button.strokes ?? []).length > 0;
    return {
      background: colorFrom(
        button,
        "fills.0.color",
        solidColor(button.fills[0], button.role!),
      ),
      text: colorFrom(
        label,
        "fills.0.color",
        solidColor(label.fills[0], label.role!),
      ),
      ...(hasRing
        ? {
            ring: colorFrom(
              button,
              "strokes.0.paint.color",
              solidColor(button.strokes?.[0]?.paint, button.role!),
            ),
            ringWidth: numberFrom(
              button,
              "strokes.0.weight",
              button.strokes?.[0]?.weight ?? 0,
            ),
          }
        : {}),
    };
  };

  const weeks = (gridFrame.children ?? []).map((child, index): CalendarWeek => {
    if (child.kind !== "frame")
      throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
        `week ${index} must be a frame of day instances, not an instance`,
      ]);
    /**
     * Present only when the calendar renders a week-number column. A scene
     * without one is not malformed -- it is a calendar whose WeekNumbers axis
     * never offered "on" -- so absence raises as an absent field, matching the
     * optional `weekNumber` in the schema. A node that exists but is not text
     * is still a refusal.
     */
    const numberText = (child.children ?? []).find(
      (node) => node.role === `calendar/week/${index}/number`,
    );
    if (numberText && numberText.kind !== "text")
      throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
        `week ${index}: the week number is not a text node`,
      ]);
    const days = (child.children ?? [])
      .filter((day) =>
        String(day.role ?? "").startsWith(`calendar/week/${index}/day/`),
      )
      .map((day): CalendarDay => {
        if (day.kind !== "instance")
          throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
            "day is not an instance",
          ]);
        const label = day.properties.Label;
        const state = day.properties.State;
        if (
          typeof label !== "string" ||
          !CALENDAR_DAY_STATES.includes(state as CalendarDayState)
        )
          throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
            "invalid ARIA/data model on a day cell",
          ]);
        return { label, state: state as CalendarDayState };
      });
    if (days.length !== CALENDAR_DAY_COUNT)
      throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
        `week ${index} carries exactly ${CALENDAR_DAY_COUNT} days`,
      ]);
    return {
      id: typeof child.label === "string" ? child.label : `week-${index}`,
      ...(numberText ? { weekNumber: numberText.characters } : {}),
      days,
    };
  });

  const selected = weeks
    .flatMap((week) => week.days)
    .find((day) => day.state === "selected");
  const today = weeks
    .flatMap((week) => week.days)
    .find((day) => day.state === "today");

  const instance = normalizeCalendarRecipeInstance({
    identity: { id: envelope.id, name: envelope.name },
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
      /**
       * Recover the axes the SCENE declares, not the module-level lists. A
       * calendar compiled from a subject that pins showWeekNumber carries one
       * WeekNumbers value, and reconstructing ["on","off"] here re-asserted a
       * variant the scene does not contain -- which the schema then correctly
       * refused for missing week-number content. The compile and the raise
       * have to agree about what varies, or the round trip cannot close.
       */
      weekNumbers: {
        name: "WeekNumbers",
        values: weekNumberAxisValues,
        default: weekNumberAxisValues[0]!,
      },
      dayState: {
        name: "State",
        values: dayStateAxisValues,
        default: dayStateAxisValues.includes("default")
          ? "default"
          : dayStateAxisValues[0]!,
      },
    },
    content: {
      caption: captionText.characters,
      weekdays,
      weeks,
      selectedDayLabel: selected?.label ?? weeks[0]!.days[0]!.label,
      todayDayLabel: today?.label ?? weeks[0]!.days[0]!.label,
    },
    tokens: {
      dayCell: {
        size: numberFrom(
          dayDefault,
          "layout.width.value",
          dayDefault.layout.width.mode === "fixed"
            ? dayDefault.layout.width.value
            : 0,
        ),
        padding: numberFrom(
          dayDefault,
          "layout.padding.left",
          dayDefault.layout.padding.left,
        ),
        fontSize: numberFrom(dayLabel, "type.fontSize", dayLabel.type.fontSize),
        radius: numberFrom(
          dayDefault,
          "cornerRadius.topLeft",
          dayDefault.cornerRadius?.topLeft ?? 0,
        ),
      },
      dayButton: {
        size: numberFrom(
          dayButton,
          "layout.width.value",
          dayButton.layout.width.mode === "fixed"
            ? dayButton.layout.width.value
            : 0,
        ),
        radius: numberFrom(
          dayButton,
          "cornerRadius.topLeft",
          dayButton.cornerRadius?.topLeft ?? 0,
        ),
      },
      gridGap: numberFrom(
        gridFrame,
        "layout.itemSpacing",
        gridFrame.layout.itemSpacing,
      ),
      captionGap: numberFrom(
        baseline,
        "layout.itemSpacing",
        baseline.layout.itemSpacing,
      ),
      rootPadding: numberFrom(
        baseline,
        "layout.padding.left",
        baseline.layout.padding.left,
      ),
      rootMinWidth: numberFrom(
        baseline,
        "layout.minWidth",
        baseline.layout.minWidth ?? 0,
      ),
      navIconSize: (() => {
        const icon = direct(
          direct(header, "calendar/nav/previous", "frame"),
          "calendar/nav/previous/icon",
          "text",
        );
        return numberFrom(icon, "type.fontSize", icon.type.fontSize);
      })(),
      surface: colorFrom(
        baseline,
        "fills.0.color",
        solidColor(baseline.fills[0], baseline.role!),
      ),
      captionText: colorFrom(
        captionText,
        "fills.0.color",
        solidColor(captionText.fills[0], captionText.role!),
      ),
      weekdayText: (() => {
        const first = (weekdayRowFrame.children ?? []).find(
          (child) =>
            String(child.role ?? "").startsWith("calendar/weekday/") &&
            child.role !== "calendar/weekday/spacer",
        );
        if (!first || first.kind !== "text")
          throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
            "weekday label absent",
          ]);
        return colorFrom(
          first,
          "fills.0.color",
          solidColor(first.fills[0], first.role!),
        );
      })(),
      ...(weekNumberText === null
        ? {}
        : {
            weekNumberText: colorFrom(
              weekNumberText,
              "fills.0.color",
              solidColor(weekNumberText.fills[0], weekNumberText.role!),
            ),
          }),
      /**
       * Recovered from the weekday node itself. Emitted only when it differs
       * from the day size -- the token's absence means "same as
       * dayCell.fontSize", so writing it when they agree would raise a
       * different instance than the one that was compiled.
       */
      ...(weekdayTextNode.type.fontSize === dayLabel.type.fontSize
        ? {}
        : {
            weekdayFontSize: numberFrom(
              weekdayTextNode,
              "type.fontSize",
              weekdayTextNode.type.fontSize,
            ),
          }),
      dayStates: {
        default: dayStateFor("default"),
        today: dayStateFor("today"),
        selected: dayStateFor("selected"),
        outside: dayStateFor("outside"),
      },
      typography: {
        caption: fontFrom(captionText),
        weekday: fontFrom(weekdayTextNode),
        day: fontFrom(dayLabel),
      },
    },
    inputFacts: [
      ...envelope.accounting.carried,
      ...envelope.extensions.flatMap((extension) => extension.absorbs),
      ...envelope.receipts.map((receipt) => receipt.fact),
    ],
    accounting: envelope.accounting,
    extensions: envelope.extensions,
    receipts: envelope.receipts,
    provenance: envelope.provenance,
  });
  const recompiled = compileCalendarRecipe(instance);
  const difference = firstDifference(recompiled.ir, envelope.ir);
  if (difference)
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      `unsupported structural edit at ${difference}; calendar@1 accepts only the declared designer edit surface`,
    ]);
  return instance;
}

export const calendarRecipe: Recipe<CalendarRecipeInstance> = {
  ref: CALENDAR_RECIPE_REF,
  normalize: normalizeCalendarRecipeInstance,
  compile: compileCalendarRecipe,
  collapse: collapseCalendarRecipe,
};

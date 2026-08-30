import * as z from "zod";

import {
  ENVELOPE_VERSION,
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
 * body-row counts. Seven days is what a week IS. The week count is a template
 * depth, not a claim about any particular month: a recipe compiles a shape, and
 * the month that fills it is content.
 */
export const CALENDAR_DAY_COUNT = 7;
export const CALENDAR_WEEK_COUNT = 3;

export type CalendarWeekNumbers = (typeof CALENDAR_WEEK_NUMBERS)[number];
export type CalendarDayState = (typeof CALENDAR_DAY_STATES)[number];

export interface CalendarNumberParameter {
  variable: string;
  fallback: number;
}
export interface CalendarColorParameter {
  variable: string;
  fallback: string;
}
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
  weekNumber: string;
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
    gridGap: CalendarNumberParameter;
    surface: CalendarColorParameter;
    captionText: CalendarColorParameter;
    weekdayText: CalendarColorParameter;
    weekNumberText: CalendarColorParameter;
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
    selection: RecipeSelection;
    [key: string]: unknown;
  };
}

const FactRefSchema = z.strictObject({
  path: z.string().min(1),
  channel: z.string().min(1),
});
const NumberParameterSchema = z.strictObject({
  variable: z.string().min(1),
  fallback: z.number().finite(),
});
const ColorParameterSchema = z.strictObject({
  variable: z.string().min(1),
  fallback: z.string().min(1),
});
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
          weekNumber: z.string().min(1),
          days: z
            .array(
              z.strictObject({
                label: z.string().min(1),
                state: z.enum(CALENDAR_DAY_STATES),
              }),
            )
            .length(CALENDAR_DAY_COUNT),
        }),
      )
      .length(CALENDAR_WEEK_COUNT),
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
    gridGap: NumberParameterSchema,
    surface: ColorParameterSchema,
    captionText: ColorParameterSchema,
    weekdayText: ColorParameterSchema,
    weekNumberText: ColorParameterSchema,
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
  extensions: z.array(z.any()),
  receipts: z.array(z.any()),
  provenance: z.looseObject({
    source: z.string().min(1),
    tool: z.string().min(1),
    generatedAt: z.string().min(1),
    selection: RecipeSelectionSchema,
  }),
});

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
const fixed = (value: number) => ({ mode: "fixed" as const, value });
const solid = (color: string) => ({ kind: "solid" as const, color });
const bind = (
  field: string,
  parameter: CalendarNumberParameter | CalendarColorParameter,
): VariableBinding => ({
  field,
  type: field.endsWith(".color") ? "COLOR" : "FLOAT",
  variable: parameter.variable,
});
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
  bindings: [
    bind("type.fontSize", size),
    bind("fills.0.color", color),
    ...(columnWidth === undefined ? [] : [bind("width.value", columnWidth)]),
  ],
});

/** One day cell: the measured box `calendar/day-cell-box` requires. */
const dayComponent = (
  instance: CalendarRecipeInstance,
  state: CalendarDayState,
): ComponentNode => {
  const cell = instance.tokens.dayCell;
  const stateTokens = instance.tokens.dayStates[state];
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
    cornerRadius: corners(cell.radius.fallback),
    bindings: [
      bind("layout.width.value", cell.size),
      bind("layout.height.value", cell.size),
      bind("layout.padding.left", cell.padding),
      bind("layout.padding.right", cell.padding),
      bind("layout.padding.top", cell.padding),
      bind("layout.padding.bottom", cell.padding),
      bind("cornerRadius.topLeft", cell.radius),
      bind("fills.0.color", stateTokens.background),
      ...(stateTokens.ring === undefined || stateTokens.ringWidth === undefined
        ? []
        : [
            bind("strokes.0.paint.color", stateTokens.ring),
            bind("strokes.0.weight", stateTokens.ringWidth),
          ]),
    ],
    children: [
      text(
        "calendar/day/label",
        instance.content.weeks[0]!.days[0]!.label,
        instance.tokens.typography.day,
        cell.fontSize,
        stateTokens.text,
      ),
    ],
  };
};

const dayInstance = (role: string, day: CalendarDay) => ({
  kind: "instance" as const,
  role,
  label: day.label,
  componentRef: "calendar@1/day",
  properties: { State: day.state, Label: day.label },
  width: hug,
  height: hug,
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
        week.weekNumber,
        instance.tokens.typography.weekday,
        instance.tokens.dayCell.fontSize,
        instance.tokens.weekNumberText,
        instance.tokens.dayCell.size,
      ),
    );
  for (const [index, day] of week.days.entries())
    children.push(dayInstance(`calendar/day-instance/${index}`, day));
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
    bindings: [bind("layout.itemSpacing", instance.tokens.gridGap)],
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
        week.weekNumber,
        instance.tokens.typography.weekday,
        instance.tokens.dayCell.fontSize,
        instance.tokens.weekNumberText,
        instance.tokens.dayCell.size,
      ),
    );
  for (const [dayIndex, day] of week.days.entries())
    children.push(dayInstance(`calendar/week/${index}/day/${dayIndex}`, day));
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
    bindings: [bind("layout.itemSpacing", instance.tokens.gridGap)],
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
        instance.content.weeks[0]!.weekNumber,
        instance.tokens.typography.weekday,
        instance.tokens.dayCell.fontSize,
        instance.tokens.weekNumberText,
        instance.tokens.dayCell.size,
      ),
    );
  for (const [index, weekday] of instance.content.weekdays.entries())
    children.push(
      text(
        `calendar/weekday/${index}`,
        weekday,
        instance.tokens.typography.weekday,
        instance.tokens.dayCell.fontSize,
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
    bindings: [bind("layout.itemSpacing", instance.tokens.gridGap)],
    children,
  };
};

const calendarComponent = (
  instance: CalendarRecipeInstance,
  weekNumbers: CalendarWeekNumbers,
): ComponentNode => {
  const gap = instance.tokens.gridGap;
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
    bindings: [bind("layout.itemSpacing", gap)],
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
      itemSpacing: gap.fallback,
      padding: {
        top: instance.tokens.dayCell.padding.fallback,
        right: instance.tokens.dayCell.padding.fallback,
        bottom: instance.tokens.dayCell.padding.fallback,
        left: instance.tokens.dayCell.padding.fallback,
      },
      width: hug,
      height: hug,
    },
    fills: [solid(instance.tokens.surface.fallback)],
    bindings: [
      bind("layout.itemSpacing", gap),
      bind("layout.padding.left", instance.tokens.dayCell.padding),
      bind("layout.padding.right", instance.tokens.dayCell.padding),
      bind("layout.padding.top", instance.tokens.dayCell.padding),
      bind("layout.padding.bottom", instance.tokens.dayCell.padding),
      bind("fills.0.color", instance.tokens.surface),
    ],
    children: [
      text(
        "calendar/caption",
        instance.content.caption,
        instance.tokens.typography.caption,
        instance.tokens.dayCell.fontSize,
        instance.tokens.captionText,
      ),
      weekdayRow(instance, weekNumbers),
      grid,
    ],
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
  bindings: [],
  children,
});

export function compileCalendarIr(instance: CalendarRecipeInstance): FrameNode {
  const daySet = setNode(
    "calendar/day-set",
    "Calendar day",
    CALENDAR_DAY_STATES.map((state) => dayComponent(instance, state)),
    { State: [...CALENDAR_DAY_STATES] },
  );
  const weekSet = setNode(
    "calendar/week-set",
    "Calendar week",
    CALENDAR_WEEK_NUMBERS.map((weekNumbers) =>
      weekComponent(instance, weekNumbers),
    ),
    { WeekNumbers: [...CALENDAR_WEEK_NUMBERS] },
  );
  const calendarSet = setNode(
    "calendar/set",
    instance.identity.name,
    CALENDAR_WEEK_NUMBERS.map((weekNumbers) =>
      calendarComponent(instance, weekNumbers),
    ),
    { WeekNumbers: [...CALENDAR_WEEK_NUMBERS] },
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
    bindings: [],
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
const binding = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
): string => {
  const found = (node.bindings ?? []).filter((entry) => entry.field === field);
  if (found.length !== 1)
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      `${node.role ?? "node"}: required binding ${field} must appear exactly once`,
    ]);
  return found[0]!.variable;
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
  if (root.role !== "calendar/library")
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      "missing calendar library frame",
    ]);
  const calendarSet = setByRole(root, "calendar/set");
  const weekSet = setByRole(root, "calendar/week-set");
  const daySet = setByRole(root, "calendar/day-set");
  if (calendarSet.children.length !== CALENDAR_WEEK_NUMBERS.length)
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      "calendar/set must carry every WeekNumbers variant",
    ]);
  if (weekSet.children.length !== CALENDAR_WEEK_NUMBERS.length)
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      "calendar/week-set must carry every WeekNumbers variant",
    ]);
  if (daySet.children.length !== CALENDAR_DAY_STATES.length)
    throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
      "calendar/day-set must carry every day State",
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
    direct(day, "calendar/day/label", "text");
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
  for (const set of [calendarSet, weekSet, daySet])
    for (const axis of set.variantAxes) {
      const rendered = new Set(
        set.children.map((child) => {
          const stripped = structuredClone(child) as Record<string, unknown>;
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

  for (const variant of calendarSet.children) {
    if (variant.kind !== "component" || variant.layout.mode !== "vertical")
      throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
        "a calendar variant stacks caption, weekdays and grid",
      ]);
    direct(variant, "calendar/caption", "text");
    const weekdays = direct(variant, "calendar/weekday-row", "frame");
    const labels = (weekdays.children ?? []).filter((child) =>
      String(child.role ?? "").startsWith("calendar/weekday/"),
    );
    if (labels.length < CALENDAR_DAY_COUNT)
      throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
        `${variant.role}: the weekday row names all ${CALENDAR_DAY_COUNT} days`,
      ]);
    const grid = direct(variant, "calendar/grid", "frame");
    if ((grid.children ?? []).length !== CALENDAR_WEEK_COUNT)
      throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
        `${variant.role}: the grid carries exactly ${CALENDAR_WEEK_COUNT} weeks`,
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

  const calendarSet = setByRole(root, "calendar/set");
  const weekSet = setByRole(root, "calendar/week-set");
  const daySet = setByRole(root, "calendar/day-set");
  const baseline = componentFor(calendarSet, { WeekNumbers: "on" });
  const captionText = direct(baseline, "calendar/caption", "text");
  const weekdayRowFrame = direct(baseline, "calendar/weekday-row", "frame");
  const gridFrame = direct(baseline, "calendar/grid", "frame");
  const weekOn = componentFor(weekSet, { WeekNumbers: "on" });
  const dayDefault = componentFor(daySet, { State: "default" });
  const dayLabel = direct(dayDefault, "calendar/day/label", "text");
  const weekNumberText = direct(weekOn, "calendar/week/number", "text");

  const weekdays = (weekdayRowFrame.children ?? [])
    .filter((child) => String(child.role ?? "").startsWith("calendar/weekday/"))
    .filter((child) => child.role !== "calendar/weekday/spacer")
    .map((child) => {
      if (child.kind !== "text")
        throw new RecipeRefusal(CALENDAR_RECIPE_REF, ["weekday is not text"]);
      return child.characters;
    });

  const dayStateFor = (state: CalendarDayState): DayStateTokens => {
    const component = componentFor(daySet, { State: state });
    const label = direct(component, "calendar/day/label", "text");
    const hasRing = (component.bindings ?? []).some(
      (entry) => entry.field === "strokes.0.paint.color",
    );
    return {
      background: colorFrom(
        component,
        "fills.0.color",
        solidColor(component.fills[0], component.role!),
      ),
      text: colorFrom(
        label,
        "fills.0.color",
        solidColor(label.fills[0], label.role!),
      ),
      ...(hasRing
        ? {
            ring: colorFrom(
              component,
              "strokes.0.paint.color",
              solidColor(component.strokes?.[0]?.paint, component.role!),
            ),
            ringWidth: numberFrom(
              component,
              "strokes.0.weight",
              component.strokes?.[0]?.weight ?? 0,
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
    const numberText = (child.children ?? []).find(
      (node) => node.role === `calendar/week/${index}/number`,
    );
    if (!numberText || numberText.kind !== "text")
      throw new RecipeRefusal(CALENDAR_RECIPE_REF, [
        `week ${index} carries no week number`,
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
      weekNumber: numberText.characters,
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
      gridGap: numberFrom(
        gridFrame,
        "layout.itemSpacing",
        gridFrame.layout.itemSpacing,
      ),
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
      weekNumberText: colorFrom(
        weekNumberText,
        "fills.0.color",
        solidColor(weekNumberText.fills[0], weekNumberText.role!),
      ),
      dayStates: {
        default: dayStateFor("default"),
        today: dayStateFor("today"),
        selected: dayStateFor("selected"),
        outside: dayStateFor("outside"),
      },
      typography: {
        caption: fontFrom(captionText),
        weekday: fontFrom(weekNumberText),
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
